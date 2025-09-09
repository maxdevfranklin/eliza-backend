// src/server.ts
import 'dotenv/config';
import Fastify from 'fastify';
import { z } from 'zod';
import { google } from 'googleapis';
import { DateTime } from 'luxon';
import * as chrono from 'chrono-node';
import { v4 as uuidv4 } from 'uuid';


/* =========================
  Env & constants
========================= */
const REQUIRED_ENV = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'] as const;
for (const key of REQUIRED_ENV) {
 if (!process.env[key]) throw new Error(`Environment variable ${key} is required`);
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
// Refresh-token flow; no redirect URI needed here
oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN! });


const calendar = google.calendar({ version: 'v3', auth: oauth2 });


/* =========================
  Validation
========================= */
const ScheduleRequestSchema = z
 .object({
   email: z.string().email(),
   label: z.string().optional(),               // e.g. "Friday 9am"
   startIso: z.string().datetime().optional(), // if provided, label is optional
   durationMin: z.number().int().min(15).max(240).optional().default(60),
   tz: z.string().optional().default(DEFAULT_TZ),
   createMeet: z.boolean().optional().default(true),
   roomId: z.string().optional(),
   agentId: z.string().optional(),
   externalKey: z.string().optional(),
   summary: z.string().optional().default('Grand Villa Tour'),
   location: z.string().optional().default('Grand Villa of Clearwater'),
   description: z
     .string()
     .optional()
     .default('Thank you for scheduling a visit to Grand Villa. This invite includes time, location, and directions.'),
 })
 .refine((d) => d.label || d.startIso, { message: 'Either "label" or "startIso" must be provided' });


/* =========================
  Helpers
========================= */
function formatWhenText(dt: DateTime): string {
 return dt.toFormat("EEEE 'at' h:mm a");
}


function parseWithChrono(label: string, tz: string): DateTime | undefined {
 try {
   // forwardDate nudges ambiguous times to the future
   const parsed: Date | null = chrono.parseDate(label, new Date(), { forwardDate: true } as any);
   if (!parsed) return undefined;
   // Keep the intended wall-clock time in target tz
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
   hour = h;
   minute = mm;
 }


 const now = DateTime.now().setZone(tz);
 let dt = now.set({ hour, minute, second: 0, millisecond: 0 });
 let delta = targetDow - now.weekday; // weekday: 1..7 (Mon..Sun)
 if (delta < 0) delta += 7;
 if (delta === 0 && dt <= now) delta = 7; // same-day but time passed -> next week
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


/* =========================
  Server
========================= */
const app = Fastify({ logger: true });


app.get('/health', async (_req, reply) => {
 reply.send({ ok: true, tz: DEFAULT_TZ, calendarId: CALENDAR_ID });
});


app.post('/schedule', async (req, reply) => {
 const parsed = ScheduleRequestSchema.safeParse(req.body);
 if (!parsed.success) {
   return reply.status(400).send({ ok: false, error: parsed.error.flatten() });
 }


 const {
   email,
   label,
   startIso,
   durationMin,
   tz,
   createMeet,
   roomId,
   agentId,
   externalKey,
   summary,
   location,
   description,
 } = parsed.data;


 try {
   // 1) Resolve start time in target tz
   let startDt: DateTime | undefined;
   if (startIso) {
     startDt = DateTime.fromISO(startIso, { setZone: true }).setZone(tz);
   } else if (label) {
     startDt = parseWithChrono(label, tz) ?? parseLabelFallback(label, tz);
   }
   if (!startDt || !startDt.isValid) {
     return reply.status(400).send({ ok: false, error: 'Could not parse date/time' });
   }


   const { startDateTime, endDateTime, end } = buildEventTimes(startDt, durationMin);


   // 2) Idempotency via extendedProperties.private
   const idempKey = externalKey ?? `${roomId ?? ''}|${agentId ?? ''}|${startDateTime}|${tz}`;
   if (idempKey) {
     const dup = await calendar.events.list({
       calendarId: CALENDAR_ID,
       privateExtendedProperty: `externalKey=${idempKey}`,
       maxResults: 1,
       singleEvents: true,
     });
     if (dup.data.items?.length) {
       req.log.warn({ idempKey }, 'Duplicate scheduling prevented');
       return reply
         .status(409)
         .send({ ok: false, error: 'duplicate', whenText: formatWhenText(startDt), startIso: startDt.toISO() });
     }
   }


   // 3) Conflict check — prefer freebusy, fallback to events.list if scope insufficient
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


   if (hasConflict) {
     return reply.status(409).send({ ok: false, error: 'time_conflict' });
   }


   // 4) Create event (Google emails invite because of sendUpdates: 'all')
   const requestBody: any = {
     summary,
     description,
     location,
     start: { dateTime: startDateTime, timeZone: tz },
     end: { dateTime: endDateTime, timeZone: tz },
     attendees: [{ email }],
     guestsCanSeeOtherGuests: false,
     guestsCanInviteOthers: false,
     reminders: { useDefault: true },
     extendedProperties: { private: { externalKey: idempKey } },
   };


   if (createMeet) {
     requestBody.conferenceData = {
       createRequest: { requestId: uuidv4(), conferenceSolutionKey: { type: 'hangoutsMeet' } },
     };
   }


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


