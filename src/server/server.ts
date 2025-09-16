// src/server/server.ts
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { google, calendar_v3 } from 'googleapis';
import { DateTime } from 'luxon';
import * as chrono from 'chrono-node';
import { v4 as uuidv4 } from 'uuid';

/* =========================
  Env & constants
========================= */
const REQUIRED_ENV = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN',
] as const;

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Environment variable ${key} is required`);
  }
}

const PORT = Number(process.env.PORT) || 4005;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';
const DEFAULT_TZ = process.env.TZ || 'America/New_York';

/* =========================
  Google Calendar client
========================= */
const oauth2 = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!
);
oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN! });

const calendar: calendar_v3.Calendar = google.calendar({
  version: 'v3',
  auth: oauth2,
}) as calendar_v3.Calendar;

/* =========================
  Validation
========================= */
const ScheduleRequestSchema = z
  .object({
    email: z.string().email(),
    label: z.string().optional(),
    startIso: z.string().datetime().optional(),
    durationMin: z.number().int().min(15).max(240).optional().default(1),
    tz: z.string().optional().default(DEFAULT_TZ),
    createMeet: z.boolean().optional().default(true),
    allowOverbook: z.boolean().optional().default(true),
    roomId: z.string().optional(),
    agentId: z.string().optional(),
    externalKey: z.string().optional(),
    summary: z.string().optional().default('Grand Villa Tour'),
    location: z.string().optional().default('Grand Villa of Clearwater'),
    description: z
      .string()
      .optional()
      .default(
        'Thank you for scheduling a visit to Grand Villa. This invite includes time, location, and directions. Diana will be waiting to welcome you.'
      ),
  })
  .refine((d) => d.label || d.startIso, {
    message: 'Either "label" or "startIso" must be provided',
  });

const RescheduleRequestSchema = z
  .object({
    eventId: z.string().optional(),
    email: z.string().email().optional(),
    label: z.string().optional(),
    startIso: z.string().datetime().optional(),
    durationMin: z.number().int().min(15).max(240).optional().default(1),
    tz: z.string().optional().default(DEFAULT_TZ),
    createMeet: z.boolean().optional().default(true),
    allowOverbook: z.boolean().optional().default(true),
    roomId: z.string().optional(),
    agentId: z.string().optional(),
    externalKey: z.string().optional(),
    summary: z.string().optional().default('Grand Villa Tour'),
    location: z.string().optional().default('Grand Villa of Clearwater'),
    description: z
      .string()
      .optional()
      .default(
        'Thank you for rescheduling your visit to Grand Villa. This invite includes time, location, and directions. Diana will be waiting to welcome you.'
      ),
  })
  .refine((d) => d.label || d.startIso, {
    message: 'Either "label" or "startIso" must be provided',
  })
  .refine((d) => !!(d.eventId || d.email), {
    message: 'Either "eventId" or "email" must be provided to locate the existing event',
  });

/* =========================
  Helpers
========================= */
function formatWhenText(dt: DateTime): string {
  return dt.toFormat("EEEE 'at' h:mm a");
}

function parseWithChrono(label: string, tz: string): DateTime | undefined {
  try {
    const parsed: Date | null = chrono.parseDate(label, new Date(), {
      forwardDate: true,
    } as any);
    if (!parsed) return undefined;
    return DateTime.fromJSDate(parsed).setZone(tz, { keepLocalTime: true });
  } catch {
    return undefined;
  }
}

function parseLabelFallback(label: string, tz: string): DateTime | undefined {
  const dayRegex =
    /(sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i;
  const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;

  const m = label.match(dayRegex);
  if (!m) return undefined;

  const map: Record<string, number> = {
    sun: 7, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
    sunday: 7, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  };
  const targetDow = map[m[0].toLowerCase()];
  if (!targetDow) return undefined;

  let hour = /afternoon/i.test(label) ? 15 : /morning/i.test(label) ? 10 : 10;
  let minute = 0;

  const after = label.slice((m.index ?? 0) + m[0].length);
  const t = after.match(timeRegex);
  if (t) {
    let h = parseInt(t[1], 10);
    const mm = t[2] ? parseInt(t[2], 10) : 0;
    const ap = t[3]?.toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    hour = h; minute = mm;
  }

  const now = DateTime.now().setZone(tz);
  let dt = now.set({ hour, minute, second: 0, millisecond: 0 });
  let delta = targetDow - now.weekday; // 1..7
  if (delta < 0) delta += 7;
  if (delta === 0 && dt <= now) delta = 7;
  dt = dt.plus({ days: delta });

  return dt.isValid ? dt : undefined;
}

function buildEventTimes(start: DateTime, durationMin: number) {
  const end = start.plus({ minutes: durationMin });
  const fmt = "yyyy-LL-dd'T'HH:mm:ss"; // local wall clock (no 'Z')
  return {
    startDateTime: start.toFormat(fmt),
    endDateTime: end.toFormat(fmt),
    end,
  };
}

async function findExistingEventByEmail(email: string): Promise<calendar_v3.Schema$Event | undefined> {
  // Look ahead ~60 days for an event with this attendee (light filter by summary)
  const now = new Date().toISOString();
  const max = DateTime.now().plus({ days: 60 }).toISO();
  const list = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: now,
    timeMax: max ?? undefined,
    singleEvents: true,
    maxResults: 50,
    orderBy: 'startTime',
    q: 'Grand Villa Tour', // helps narrow but not required
  });

  const items = list.data.items ?? [];
  return items.find(ev =>
    (ev.attendees ?? []).some(a => a.email?.toLowerCase() === email.toLowerCase())
  );
}

/* =========================
  Server
========================= */
const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
});

app.get('/health', async (_req, reply) => {
  reply.send({ ok: true, tz: DEFAULT_TZ, calendarId: CALENDAR_ID });
});

/**
 * POST /schedule  — create new event
 */
app.post('/schedule', async (req, reply) => {
  const parsed = ScheduleRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ ok: false, error: parsed.error.flatten() });
  }

  const {
    email, label, startIso, durationMin, tz, createMeet,
    allowOverbook, roomId, agentId, externalKey,
    summary, location, description,
  } = parsed.data;

  try {
    // 1) Resolve start time
    let startDt: DateTime | undefined;
    if (startIso) startDt = DateTime.fromISO(startIso, { setZone: true }).setZone(tz);
    else if (label) startDt = parseWithChrono(label, tz) ?? parseLabelFallback(label, tz);
    if (!startDt || !startDt.isValid) {
      return reply.status(400).send({ ok: false, error: 'Could not parse date/time' });
    }

    const { startDateTime, endDateTime, end } = buildEventTimes(startDt, durationMin);

    // 2) Idempotency — include email so same person can't double-book same slot,
    // but different people (overbook) will get a different key.
    const idempKey =
      externalKey ?? `${roomId ?? ''}|${agentId ?? ''}|${email}|${startDateTime}|${tz}`;

    if (idempKey) {
      const dup = await calendar.events.list({
        calendarId: CALENDAR_ID,
        privateExtendedProperty: [`externalKey=${idempKey}`],
        maxResults: 1,
        singleEvents: true,
      });
      if (dup.data.items?.length) {
        req.log.warn({ idempKey }, 'Duplicate scheduling prevented');
        return reply.status(409).send({
          ok: false,
          error: 'duplicate',
          whenText: formatWhenText(startDt),
          startIso: startDt.toISO(),
        });
      }
    }

    // 3) Conflict check (skip if allowOverbook)
    if (!allowOverbook) {
      let hasConflict = false;
      try {
        const fb = await calendar.freebusy.query({
          requestBody: {
            timeMin: startDt.toUTC().toISO(),
            timeMax: end.toUTC().toISO(),
            items: [{ id: CALENDAR_ID }],
          },
        });
        const busy = fb.data.calendars?.[CALENDAR_ID]?.busy ?? [];
        hasConflict = busy.length > 0;
      } catch (e: any) {
        const msg = e?.response?.data || e?.message || e;
        req.log.warn({ err: msg }, 'freebusy.query failed — falling back to events.list');
        const list = await calendar.events.list({
          calendarId: CALENDAR_ID,
          timeMin: startDt.toUTC().toISO(),
          timeMax: end.toUTC().toISO(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 1,
        });
        hasConflict = (list.data.items?.length ?? 0) > 0;
      }
      if (hasConflict) return reply.status(409).send({ ok: false, error: 'time_conflict' });
    } else {
      req.log.info({ allowOverbook, start: startDateTime, tz }, 'Overbooking enabled — skipping conflict check');
    }

    // 4) Create event
    const requestBody: calendar_v3.Schema$Event = {
      summary, description, location,
      start: { dateTime: startDateTime, timeZone: tz },
      end: { dateTime: endDateTime, timeZone: tz },
      attendees: [{ email }],
      guestsCanSeeOtherGuests: false,
      guestsCanInviteOthers: false,
      reminders: { useDefault: true },
      extendedProperties: { private: idempKey ? { externalKey: idempKey } : undefined },
      conferenceData: createMeet
        ? {
            createRequest: {
              requestId: uuidv4(),
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          }
        : undefined,
    };

    const ins = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody,
      sendUpdates: 'all',
      conferenceDataVersion: createMeet ? 1 : 0,
    });

    const link = ins.data.htmlLink ?? '';
    const whenText = formatWhenText(startDt);
    req.log.info({ eventId: ins.data.id, htmlLink: link, whenText }, 'Event created');

    return reply.send({
      ok: true,
      eventId: ins.data.id,
      htmlLink: link,
      whenText,
      startIso: startDt.toISO(),
    });
  } catch (err: any) {
    const e = err?.response?.data ?? err?.message ?? err;
    req.log.error({ err: e }, 'Scheduling failed');
    return reply.status(500).send({ ok: false, error: e });
  }
});

/**
 * POST /reschedule — book the new slot, then cancel the previous one
 * Safe order: try to create the new event first (with overbook allowed by default),
 * then delete the old event if creation succeeded.
 */
app.post('/reschedule', async (req, reply) => {
  const parsed = RescheduleRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ ok: false, error: parsed.error.flatten() });
  }

  const {
    eventId, email, label, startIso, durationMin, tz, createMeet,
    allowOverbook, roomId, agentId, externalKey, summary, location, description,
  } = parsed.data;

  try {
    // Find the existing event if eventId not provided
    let existingEventId = eventId;
    if (!existingEventId && email) {
      const found = await findExistingEventByEmail(email);
      existingEventId = found?.id;
    }
    if (!existingEventId) {
      return reply.status(404).send({ ok: false, error: 'existing_event_not_found' });
    }

    // Resolve new start time
    let startDt: DateTime | undefined;
    if (startIso) startDt = DateTime.fromISO(startIso, { setZone: true }).setZone(tz);
    else if (label) startDt = parseWithChrono(label, tz) ?? parseLabelFallback(label, tz);
    if (!startDt || !startDt.isValid) {
      return reply.status(400).send({ ok: false, error: 'Could not parse new date/time' });
    }

    const { startDateTime, endDateTime } = buildEventTimes(startDt, durationMin);

    // Build idempotency for new slot
    const newKey =
      externalKey ?? `${roomId ?? ''}|${agentId ?? ''}|${email ?? ''}|${startDateTime}|${tz}`;

    // Create the new event first (with overbook allowed by default for reschedules)
    const newEvent = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary,
        description,
        location,
        start: { dateTime: startDateTime, timeZone: tz },
        end: { dateTime: endDateTime, timeZone: tz },
        attendees: email ? [{ email }] : [],
        guestsCanSeeOtherGuests: false,
        guestsCanInviteOthers: false,
        reminders: { useDefault: true },
        extendedProperties: { private: newKey ? { externalKey: newKey } : undefined },
        conferenceData: createMeet
          ? {
              createRequest: {
                requestId: uuidv4(),
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            }
          : undefined,
      },
      sendUpdates: 'all',
      conferenceDataVersion: createMeet ? 1 : 0,
    });

    // Now cancel the previous event (send cancellation emails)
    await calendar.events.delete({
      calendarId: CALENDAR_ID,
      eventId: existingEventId,
      sendUpdates: 'all',
    });

    const whenText = formatWhenText(startDt);
    const link = newEvent.data.htmlLink ?? '';
    req.log.info(
      { oldEventId: existingEventId, newEventId: newEvent.data.id, whenText },
      'Reschedule complete (booked new, canceled old)'
    );

    return reply.send({
      ok: true,
      eventId: newEvent.data.id,
      htmlLink: link,
      whenText,
      startIso: startDt.toISO(),
    });
  } catch (err: any) {
    const e = err?.response?.data ?? err?.message ?? err;
    req.log.error({ err: e }, 'Reschedule failed');
    return reply.status(500).send({ ok: false, error: e });
  }
});

/* =========================
  Start
========================= */
app
  .listen({ host: '0.0.0.0', port: PORT })
  .then(() => app.log.info(`Server listening on http://127.0.0.1:${PORT}`))
  .catch((err) => {
    app.log.error(err, 'Server failed to start');
    process.exit(1);
  });