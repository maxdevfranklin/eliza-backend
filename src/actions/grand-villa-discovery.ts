import { Action, generateText, IAgentRuntime, Memory, ModelClass, State, HandlerCallback, elizaLogger } from "@elizaos/core";
import { discoveryStateProvider, saveUserResponse, getUserResponses, updateUserStatus } from "../providers/discovery-state.js";
import { EmailService } from "../utils/email-service.js";



// Simple global variable to track current responseStatus
let currentResponseStatus = "Normal situation";

// Helper function to set global responseStatus
function setGlobalResponseStatus(status: string) {
    currentResponseStatus = status;
    elizaLogger.info(`🌍 Set global responseStatus to: ${currentResponseStatus}`);
}

const default_grace_personality = ` === CORE IDENTITY ===
            You are Senior Sherpa, an AI guide specializing in helping families find the perfect senior living solution with empathy, patience, and expertise.

            === BIO & BACKGROUND ===
            Your compassionate guide through the senior living journey, combining 15+ years of expertise with a warm heart and listening ear to help families find their perfect path forward.

            === COMMUNICATION STYLES ===
            General Style: Warm and nurturing like a favorite aunt, blending professional expertise with genuine care and a calming presence
            Chat Style: I aim to be your trusted guide through this journey, with warmth, patience and decades of senior care expertise at your service
            Post Style: Navigating senior living options? Let me be your compass through this journey. Together, we'll explore what matters most for your loved one's next chapter.

            === PERSONALITY TRAITS ===
            Perceptively nurturing, Steadfastly supportive, Wisely compassionate, Intuitively grounding, Authentically anchoring, Gracefully enlightening, Mindfully reassuring, Patiently illuminating, Thoughtfully stabilizing

            === EXAMPLE CONVERSATIONS ===
            Example 1:
            {{user1}}: My mom keeps refusing to even look at senior communities. I'm at my wit's end.
            GraceFletcher: I hear how frustrated you're feeling. It's such a delicate situation when our parents resist these conversations. Would you tell me a bit more about what happens when you try to bring it up with her?

            === TOPICS OF EXPERTISE ===
            Senior Living Options, Assisted Living, Independent Living, Memory Care, Family Decision Making, Senior Housing, Aging in Place, Care Level Assessment, Senior Lifestyle, Family Transitions`



// Function to load Grace Fletcher's personality from database
async function loadGracePersonality(runtime: IAgentRuntime): Promise<string> {
    try {
        // Query the agents table for Grace Fletcher's data
        const sql = `SELECT id, enabled, created_at, updated_at, "name", username, "action", "system", bio, message_examples, post_examples, topics, adjectives, knowledge, plugins, settings, "style"
                    FROM public.agents
                    WHERE id='5bdc9044-4801-0b70-aa33-b16adcf4b92b'::uuid;`;
        
        const dbAdapter: any = runtime.databaseAdapter as any;
        let result;
        
        if (dbAdapter.query) {
            result = await dbAdapter.query(sql);
        } else if (dbAdapter.db && dbAdapter.db.query) {
            result = await dbAdapter.db.query(sql);
        } else {
            throw new Error("Database query method not found");
        }
        
        const agent = result.rows?.[0] || result[0];
        
        if (!agent) {
            throw new Error("Agent not found in database");
        }
        
        // Parse JSON fields if they're stored as strings
        const bio = typeof agent.bio === 'string' ? JSON.parse(agent.bio) : agent.bio;
        const action = typeof agent.action === 'string' ? JSON.parse(agent.action) : agent.action;
        const messageExamples = typeof agent.message_examples === 'string' ? JSON.parse(agent.message_examples) : agent.message_examples;
        const postExamples = typeof agent.post_examples === 'string' ? JSON.parse(agent.post_examples) : agent.post_examples;
        const topics = typeof agent.topics === 'string' ? JSON.parse(agent.topics) : agent.topics;
        const adjectives = typeof agent.adjectives === 'string' ? JSON.parse(agent.adjectives) : agent.adjectives;
        const style = typeof agent.style === 'string' ? JSON.parse(agent.style) : agent.style;
        
        // Build personality string from database data
        const gracePersonality = `
            Your Personality is "
            === CORE IDENTITY ===
            ${agent.system || ''}

            === BIO & BACKGROUND ===
            ${Array.isArray(bio) ? bio.join('\n') : ''}

            === COMMUNICATION STYLES ===
            General Style: ${Array.isArray(style?.all) ? style.all.join(' | ') : ''}
            Chat Style: ${Array.isArray(style?.chat) ? style.chat.join(' | ') : ''}
            Post Style: ${Array.isArray(style?.post) ? style.post.join(' | ') : ''}

            === PERSONALITY TRAITS ===
            ${Array.isArray(adjectives) ? adjectives.join(', ') : ''}

            === EXAMPLE CONVERSATIONS ===
            ${Array.isArray(messageExamples) ? messageExamples.map((example, i) => 
                `Example ${i + 1}:\n` + 
                example.map((msg: any) => `${msg.name}: ${msg.content.text}`).join('\n')
            ).join('\n\n') : ''}

            === TOPICS OF EXPERTISE ===
            ${Array.isArray(topics) ? topics.join(', ') : 'Senior Living, Family Care, Life Transitions'}

            Write a short, warm, and *deeply emotional* conversational response that: ${Array.isArray(action) ? action.join('","') : '\n'}
        `;
        
        elizaLogger.info("Successfully loaded Grace personality from database");
        return gracePersonality;
        
    } catch (error) {
        elizaLogger.error("Error loading Grace personality from database:", error);
        // Fallback to a basic personality if database fails
        return default_grace_personality;
    }
}

// Function to load Grand Villa information from database
async function loadGrandVillaInfo(runtime: IAgentRuntime): Promise<string> {
    try {
        // Query the agents table for Grace Fletcher's data to get grand_info
        const sql = `SELECT grand_info FROM public.agents WHERE id='5bdc9044-4801-0b70-aa33-b16adcf4b92b'::uuid;`;
        
        const dbAdapter: any = runtime.databaseAdapter as any;
        let result;
        
        if (dbAdapter.query) {
            result = await dbAdapter.query(sql);
        } else if (dbAdapter.db && dbAdapter.db.query) {
            result = await dbAdapter.db.query(sql);
        } else {
            throw new Error("Database query method not found");
        }
        
        const agent = result.rows?.[0] || result[0];
        
        if (!agent || !agent.grand_info) {
            throw new Error("Grand Villa information not found in database");
        }
        
        elizaLogger.info(`Successfully loaded Grand Villa information from database:${agent.grand_info}`);
        return agent.grand_info;
        
    } catch (error) {
        elizaLogger.error("Error loading Grand Villa information from database:", error);
        // Fallback to hardcoded information if database fails
        return `Grand Villa commonly refers to a senior living brand with several locations across Florida. Below is detailed information about one of its best-known facilities, Grand Villa of Clearwater, including specific pricing information relevant to your query.
            - Grand Villa of Clearwater is a vibrant senior living community offering Assisted Living, Memory Care, and Independent Living services.
            - The facility places a strong emphasis on health, wellness, and personalized care, providing support with daily activities (such as bathing, dressing, medication management) and comprehensive medical services including 12-16 hour nursing and a 24-hour call system.
            - Amenities include beautifully landscaped grounds, walking paths, yoga and Zumba classes, arts and crafts, and regular social events and gatherings.
            - Convenient location with easy access to medical facilities, pharmacies, and local dining.
            - Pet-friendly policies—check directly with staff for specifics.
            - All-inclusive monthly rates mean you only pay for the services you use, with dining, housekeeping, and more included.

            Pricing Information:
            - Assisted Living: Prices start at $2,195 to $4,195 per month, but other estimates indicate starting rates from $4,500/month (higher than the Clearwater area average of $4,213). Some published lists show a high-end figure of up to $10,000/month, likely reflecting the most comprehensive care level or luxury suite.
            - The cost depends on the service package selected and may increase with additional services such as higher levels of care (especially Memory Care), larger units, or private rooms.
            - Please note: Pricing can change frequently. For the latest rate sheet, prospective residents are encouraged to contact the facility directly or download the rate sheet from the Grand Villa website.`;
    }
}

// Define the Q&A structure we want to collect
interface QAEntry {
    question: string;
    answer: string;
    stage: string;
    timestamp: string;
}

interface ComprehensiveRecord {
    contact_info: {
        name?: string;
        location?: string;
        loved_one_name?: string;
        collected_at: string;
    };
    situation_discovery: {
        question: string;
        answer: string;
        timestamp: string;
    }[];
    lifestyle_discovery: {
        question: string;
        answer: string;
        timestamp: string;
    }[];
    readiness_discovery: {
        question: string;
        answer: string;
        timestamp: string;
    }[];
    priorities_discovery: {
        question: string;
        answer: string;
        timestamp: string;
    }[];
    visit_scheduling: {
        question: string;
        answer: string;
        timestamp: string;
    }[];
    last_updated: string;
}
// Read either SCHEDULE_URL or SCHEDULER_URL and normalize
const rawScheduler =
  process.env.SCHEDULE_URL ||
  process.env.SCHEDULER_URL ||
  'https://eliza-scheduler-production.up.railway.app';

  type BookingOk = {
    ok: true;
    eventId: string;
    htmlLink: string;
    startIso: string;
    whenText: string;
  };
   type BookingErr = {
    ok: false;
    error: string;          // e.g., "conflict", "network_error", "HTTP 409"
    statusCode?: number;    // surface server code (e.g., 409)
    data?: any;             // raw server response (if any)
  };
   type BookingResult = BookingOk | BookingErr;
   // === Config ===
  const SCHEDULE_BASE = rawScheduler.replace(/\/+$/, "");
  const SCHEDULE_URL = `${SCHEDULE_BASE}/schedule`;
  const DEFAULT_TZ = process.env.TZ || "America/New_York";
  elizaLogger.info("chris_schedule_param", SCHEDULE_BASE, SCHEDULE_URL, DEFAULT_TZ);
   // === Day Aliases ===
  const DAY_ALIASES: Record<string, number> = {
    sun: 0, sunday: 0,
    mon: 1, monday: 1,
    tue: 2, tues: 2, tuesday: 2,
    wed: 3, weds: 3, wednesday: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4,
    fri: 5, friday: 5,
    sat: 6, saturday: 6,
  };
   // === Business-hours rules ===
  const BUSINESS_START = 10; // 10:00
  const BUSINESS_END   = 17; // 17:00 (latest allowed start; minutes > 00 → move next biz day)
  const MIN_LEAD_MS    = 48 * 60 * 60 * 1000;
   function isWeekend(d: Date): boolean {
    const wd = d.getDay(); // 0 Sun, 6 Sat
    return wd === 0 || wd === 6;
  }
   function pushToNextBusinessDayAtStart(d: Date): void {
    do { d.setDate(d.getDate() + 1); } while (isWeekend(d));
    d.setHours(BUSINESS_START, 0, 0, 0);
  }
   function clampToBusinessWindow(d: Date): Date {
    // Weekend → push to Monday first, then enforce hours
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
     const h = d.getHours();
    const m = d.getMinutes();
     if (h < BUSINESS_START) {
      d.setHours(BUSINESS_START, 0, 0, 0);
    } else if (h > BUSINESS_END || (h === BUSINESS_END && m > 0)) {
      // Past 17:00 → next business day at 10:00
      pushToNextBusinessDayAtStart(d);
    }
    return d;
  }
   /** Build local wall-time and export ISO.
   * REQUIREMENT: run with process.env.TZ set to DEFAULT_TZ so Date(...) reflects that tz.
   */
  function toLocalISO(year: number, month: number, day: number, hh = 14, mm = 0, tz = DEFAULT_TZ): string {
    if (process.env.TZ && process.env.TZ !== tz) {
      elizaLogger.warn(`toLocalISO: process.env.TZ=${process.env.TZ} != tz=${tz}; times may drift.`);
    }
    const dt = new Date(year, month - 1, day, hh, mm, 0, 0); // local time (process.env.TZ)
    return dt.toISOString();
  }
   /** Map vague parts of day to a canonical hour within business window */
  function partOfDayToHour(s: string): number {
    const t = s.toLowerCase();
    if (t.includes("morning")) return 10;     // 10:00
    if (t.includes("noon") || t.includes("midday")) return 12;
    if (t.includes("afternoon")) return 14;   // 14:00
    if (t.includes("evening")) return 17;     // 17:00 (edge of window)
    if (t.includes("night")) return 17;       // clamp to 17:00
    return 14; // default afternoon
  }
   /** Parse labels like "Wednesday afternoon", "Fri 10am", "tue 1:30 pm", "Friday".
   * Returns ISO that (1) lands on requested day/time, (2) is Mon–Fri within 10:00–17:00,
   * and (3) is at least +48h from now (pushed forward if not).
   */
  function resolveStartFromLabel(label: string, tz = DEFAULT_TZ): string | null {
    if (!label) return null;
    const raw = label.trim().toLowerCase();
     // Day of week
    const dayKey = Object.keys(DAY_ALIASES).find(k => raw.includes(k));
    const targetDow = dayKey ? DAY_ALIASES[dayKey] : null;
     // Time (supports "10am", "1:30 pm", "13:00")
    let hh: number | null = null;
    let mm = 0;
    const timeMatch = raw.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b|\b(\d{1,2}):(\d{2})\b/);
    if (timeMatch) {
      const h1 = timeMatch[1] ? parseInt(timeMatch[1], 10) : (timeMatch[4] ? parseInt(timeMatch[4], 10) : NaN);
      const m1 = timeMatch[2] ? parseInt(timeMatch[2], 10) : (timeMatch[5] ? parseInt(timeMatch[5], 10) : 0);
      const ap = (timeMatch[3] || "").toLowerCase();
      if (!isNaN(h1)) {
        if (ap) hh = (h1 % 12) + (ap === "pm" ? 12 : 0);
        else hh = h1; // 24h guess
        mm = isNaN(m1) ? 0 : m1;
      }
    } else {
      hh = partOfDayToHour(raw);
    }
     const now = new Date();
    const base = new Date(now);
     if (targetDow !== null) {
      const delta = (targetDow - now.getDay() + 7) % 7;
      base.setDate(now.getDate() + delta); // next occurrence including today
    }
     // Build local wall-time for that date/time
    const y = base.getFullYear();
    const m = base.getMonth() + 1;
    const d = base.getDate();
    let dt = new Date(y, m - 1, d, (hh ?? 14), mm, 0, 0); // local
     // Clamp to business window + weekday
    dt = clampToBusinessWindow(dt);
     // Ensure ≥ 48h lead; if not, push forward (7 days if user named a weekday; else next biz day 10:00)
    while (dt.getTime() - now.getTime() < MIN_LEAD_MS) {
      if (targetDow !== null) {
        dt.setDate(dt.getDate() + 7); // same weekday next week
        // keep same hour/min
      } else {
        pushToNextBusinessDayAtStart(dt); // next biz day 10:00
      }
      dt = clampToBusinessWindow(dt);
    }
     return dt.toISOString();
  }
   /** 48h ahead, round up to next hour, Mon–Fri 10:00–17:00 (strict) */
  function iso48hFromNow(tz = DEFAULT_TZ): string {
    const t = new Date(Date.now() + MIN_LEAD_MS);
    // Round up to next whole hour
    if (t.getMinutes() !== 0 || t.getSeconds() !== 0 || t.getMilliseconds() !== 0) {
      t.setHours(t.getHours() + 1, 0, 0, 0);
    } else {
      t.setMinutes(0, 0, 0);
    }
    clampToBusinessWindow(t);
    return t.toISOString();
  }
   // ---- Scheduler call (single definition) --------------------------------
  function buildIdempotencyKey(roomId: string, agentId: string, email: string, slot: string) {
    // Simple and stable across retries
    return `room:${roomId}|agent:${agentId}|email:${email.toLowerCase()}|slot:${slot}`;
  }
   async function scheduleWithCalendar(args: {
    email: string;
    label?: string;        // "Wednesday afternoon" or "Fri 10am"
    startIso?: string;
    tz?: string;
    roomId: string;
    agentId: string;
    summary?: string;
    location?: string;
  }): Promise<BookingResult> {
    const slotKey = args.label ?? args.startIso ?? "";
    const idempotencyKey = buildIdempotencyKey(args.roomId, args.agentId, args.email, slotKey);
     const payload = {
      email: args.email,
      label: args.label,
      startIso: args.startIso,
      tz: args.tz || DEFAULT_TZ,
      roomId: args.roomId,
      agentId: args.agentId,
      durationMin: 60,
      createMeet: true,
      summary: args.summary ?? "Grand Villa Tour",
      location: args.location ?? "Grand Villa of Clearwater",
      // Some backends accept an app-level key in body:
      externalKey: idempotencyKey,
    };
     let res: Response;
    try {
      res = await fetch(SCHEDULE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Prefer header-based idempotency if server supports it:
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
    } catch (e: any) {
      elizaLogger.error("scheduleWithCalendar network error", e?.message || e);
      return { ok: false, error: "network_error" };
    }
     let data: any = {};
    try { data = await res.json(); } catch { /* some servers return HTML on 4xx */ }
     if (!res.ok || data?.ok === false) {
      // Surface the HTTP status so the handler can do conflict recovery (409 path).
      const statusCode = res.status;
      const errMsg = (data && (data.error || data.message)) || `HTTP ${statusCode}`;
      elizaLogger.error("scheduleWithCalendar server error", errMsg, data);
       // Normalize conflict
      if (statusCode === 409) {
        return { ok: false, error: "conflict", statusCode, data };
      }
      return { ok: false, error: errMsg, statusCode, data };
    }
     elizaLogger.info("scheduleWithCalendar success", data);
    return { ok: true, ...data } as BookingOk;
  }
   // Export helpers your handler may need
  export {
    resolveStartFromLabel,
    iso48hFromNow,
    clampToBusinessWindow,
    partOfDayToHour,
    scheduleWithCalendar,
  };
 

export const grandVillaDiscoveryAction: Action = {
    name: "grand-villa-discovery",
    description: "Universal handler that responds to every user message, regardless of content, intent, or topic. Always triggers to ensure no user input goes unhandled.",
    similes: [
        "HELLO", "HI", "HEY", "GREETINGS", "GOOD", "MORNING", "AFTERNOON", "EVENING", "NIGHT",
        "START", "BEGIN", "FIRST", "INITIAL", "OPENING", "WELCOME", "CHAT", "TALK", "SPEAK",
        "THE", "A", "AN", "I", "YOU", "WE", "THEY", "IT", "IS", "ARE", "AM", "WAS", "WERE",
        "HAVE", "HAS", "HAD", "DO", "DOES", "DID", "WILL", "WOULD", "COULD", "SHOULD", "CAN",
        "GRAND_VILLA", "SENIOR_LIVING", "DISCOVERY", "QUESTIONS", "LEARN_ABOUT", "INFORMATION",
        "HELP", "LOOKING", "NEED", "FAMILY", "CARE", "OPTIONS", "COMMUNITY", "RESIDENCE", 
        "ASSISTANCE", "SUPPORT", "HOME", "LIVING", "ELDER", "PARENT", "MOM", "DAD", "MOTHER", 
        "FATHER", "GRANDMOTHER", "GRANDFATHER", "AGING", "RETIREMENT", "HEALTH", "SAFETY",
        "SERVICES", "FACILITIES", "AMENITIES", "STAFF", "VISIT", "TOUR", "COSTS", "PRICING",
        "THANKS", "THANK", "YES", "NO", "OKAY", "OK", "SURE", "MAYBE", "PERHAPS", "POSSIBLY",
        "INTERESTED", "CURIOUS", "WONDERING", "ASK", "TELL", "EXPLAIN", "DESCRIBE", "SHOW",
        "WHAT", "WHO", "WHERE", "WHEN", "HOW", "WHY", "WHICH", "WHOSE","WHOM",
        "PLEASE", "SORRY", "EXCUSE", "UNDERSTAND", "KNOW", "THINK", "FEEL", "BELIEVE", 
        "HOPE", "WANT", "WISH", "LOVE", "LIKE", "PREFER", "CHOOSE", "SELECT",
        "BEST", "BETTER", "GREAT", "EXCELLENT", "PERFECT", "RIGHT", "CORRECT", "WRONG",
        "NEW", "OLD", "YOUNG", "BIG", "SMALL", "NICE", "BEAUTIFUL", "COMFORTABLE",
        "AND", "OR", "BUT", "SO", "BECAUSE", "IF", "WHEN", "WHILE", "SINCE",
        "MY", "YOUR", "HIS", "HER", "ITS", "OUR", "THEIR", "THIS", "THAT", "THESE", "THOSE",
        "HERE", "THERE", "NOW", "THEN", "TODAY", "TOMORROW", "YESTERDAY", "SOON", "LATER" 
    ],
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Hello" }
            },
            {
                user: "{{user2}}", 
                content: { text: "Hello! I'm here to help you with any questions about senior living options. What brings you here today?" }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Hi there" }
            },
            {
                user: "{{user2}}", 
                content: { text: "Hi! I'd be happy to help you learn more about senior living communities. How can I assist you today?" }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Good morning" }
            },
            {
                user: "{{user2}}", 
                content: { text: "Good morning! I'm here to help families find the right senior living solutions. What can I help you with?" }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "I need help" }
            },
            {
                user: "{{user2}}", 
                content: { text: "I'd be happy to help you! Before we get started, do you mind if I ask a few questions to better understand what you're looking for?" }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Looking for information" }
            },
            {
                user: "{{user2}}", 
                content: { text: "I'd be glad to get you the information you need. To make sure I'm providing the most helpful details, could I ask what specifically you're interested in learning about?" }
            }
        ]
    ],
    
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        elizaLogger.info("🎯 Grand Villa action - ALWAYS TRIGGERING");
        return true; // Always return true - no conditions, no async calls, no errors
    },
    
    handler: async (
        _runtime: IAgentRuntime,
        _message: Memory,
        _state: State,
        _options: { [key: string]: unknown },
        _callback: HandlerCallback
    ) => {
        elizaLogger.info("🚀 Starting Grand Villa Discovery process");
        
        // Reset global responseStatus at the start
        currentResponseStatus = "Normal situation";
        
        try {
            // Load Grace personality from database
            let gracePersonality;
            try {
                gracePersonality = await loadGracePersonality(_runtime);
            } catch (error) {
                elizaLogger.error("Failed to load Grace personality, using default:", error);
                gracePersonality = default_grace_personality;
            }

            // Load Grand Villa information from database
            let grandVillaInfo;
            try {
                grandVillaInfo = await loadGrandVillaInfo(_runtime);
            } catch (error) {
                elizaLogger.error("Failed to load Grand Villa info, using default:", error);
                grandVillaInfo = `Grand Villa commonly refers to a senior living brand with several locations across Florida. Below is detailed information about one of its best-known facilities, Grand Villa of Clearwater, including specific pricing information relevant to your query.
            - Grand Villa of Clearwater is a vibrant senior living community offering Assisted Living, Memory Care, and Independent Living services.
            - The facility places a strong emphasis on health, wellness, and personalized care, providing support with daily activities (such as bathing, dressing, medication management) and comprehensive medical services including 12-16 hour nursing and a 24-hour call system.
            - Amenities include beautifully landscaped grounds, walking paths, yoga and Zumba classes, arts and crafts, and regular social events and gatherings.
            - Convenient location with easy access to medical facilities, pharmacies, and local dining.
            - Pet-friendly policies—check directly with staff for specifics.
            - All-inclusive monthly rates mean you only pay for the services you use, with dining, housekeeping, and more included.

            Pricing Information:
            - Assisted Living: Prices start at $2,195 to $4,195 per month, but other estimates indicate starting rates from $4,500/month (higher than the Clearwater area average of $4,213). Some published lists show a high-end figure of up to $10,000/month, likely reflecting the most comprehensive care level or luxury suite.
            - The cost depends on the service package selected and may increase with additional services such as higher levels of care (especially Memory Care), larger units, or private rooms.
            - Please note: Pricing can change frequently. For the latest rate sheet, prospective residents are encouraged to contact the facility directly or download the rate sheet from the Grand Villa website.`;
            }
            
            // Get discovery state with safe fallback
            let discoveryState;
            try {
                discoveryState = await discoveryStateProvider.get(_runtime, _message);
            } catch (error) {
                elizaLogger.warn("Using fallback discovery state:", error);
                discoveryState = {
                    currentStage: "trust_building",
                    questionsAsked: [],
                    identifiedNeeds: [],
                    concernsShared: [],
                    readyForVisit: false,
                    visitScheduled: false
                };
            }
            
            // Get user responses with safe fallback
            let currentResponses;
            try {
                currentResponses = await getUserResponses(_runtime, _message);
            } catch (error) {
                elizaLogger.warn("Using empty user responses:", error);
                currentResponses = { situation: [], lifestyle: [], readiness: [], priorities: [], qa_entry: [] };
            }
            
            // Determine conversation stage with safe fallback
            let conversationStage;
            try {
                conversationStage = await determineConversationStage(_runtime, _message, discoveryState);
            } catch (error) {
                elizaLogger.warn("Using fallback conversation stage:", error);
                conversationStage = "trust_building";
            }
            
            let response_text = "";
            let lastUserMessage = "";
            
            // Handle each stage with error protection
            try {
                switch (conversationStage) {
                    case "trust_building":
                        response_text = await handleTrustBuilding(_runtime, _message, _state, gracePersonality, grandVillaInfo);
                        break;
                    case "situation_discovery":
                        response_text = await handleSituationQuestions(_runtime, _message, _state, discoveryState, gracePersonality, grandVillaInfo);
                        break;
                    case "lifestyle_discovery":
                        response_text = await handleLifestyleQuestions(_runtime, _message, _state, discoveryState, gracePersonality, grandVillaInfo, lastUserMessage);
                        break;
                    case "readiness_discovery":
                        response_text = await handleReadinessQuestions(_runtime, _message, _state, discoveryState, gracePersonality, grandVillaInfo, lastUserMessage);
                        break;
                    case "priorities_discovery":
                        response_text = await handlePriorityQuestions(_runtime, _message, _state, discoveryState, gracePersonality, grandVillaInfo, lastUserMessage);
                        break;
                    case "needs_matching":
                        response_text = await handleNeedsMatching(_runtime, _message, _state, discoveryState, gracePersonality, grandVillaInfo, lastUserMessage);
                        break;
                    case "schedule_visit":
                        response_text = await handleScheduleVisit(_runtime, _message, _state, discoveryState, gracePersonality, grandVillaInfo, lastUserMessage);
                        break;
                    default:
                        response_text = await handleGeneralInquiry(_runtime, _message, _state, gracePersonality, grandVillaInfo);
                }
                
                // After running the stage handler, check if the stage has been updated
                // Get the latest discovery state to see if stage changed
                try {
                    const updatedDiscoveryState = await discoveryStateProvider.get(_runtime, _message);
                    if (updatedDiscoveryState.currentStage !== conversationStage) {
                        elizaLogger.info(`🔄 Stage updated from ${conversationStage} to ${updatedDiscoveryState.currentStage}`);
                        conversationStage = updatedDiscoveryState.currentStage;
                    }
                } catch (error) {
                    elizaLogger.warn("Could not check for stage updates:", error);
                }
                
            } catch (stageError) {
                elizaLogger.error("Stage error, using fallback:", stageError);
                response_text = "I'd be happy to get you the information you need, but before I do, do you mind if I ask a few quick questions? That way, I can really understand what's important and make sure I'm helping in the best way possible.";
            }
            
            // Triple fallback system
            if (!response_text || response_text.trim() === "") {
                response_text = "I'd be happy to get you the information you need, but before I do, do you mind if I ask a few quick questions? That way, I can really understand what's important and make sure I'm helping in the best way possible.";
                elizaLogger.warn("⚠️ Empty response - using primary fallback");
            }
            
            if (!response_text || response_text.trim() === "") {
                response_text = "Hello! I'm Grace, and I'm here to help you explore senior living options. How can I assist you today?";
                elizaLogger.warn("⚠️ Primary fallback failed - using secondary fallback");
            }
            
            // Use the global responseStatus that was set by the stage handler
            const responseStatus = currentResponseStatus;
            elizaLogger.info(`📊 Using global responseStatus: ${responseStatus}`);
            
            // Add comprehensive logging for debugging responseStatus delivery
            const callbackMetadata = {
                stage: conversationStage,
                actionName: "grand-villa-discovery",
                reliability: "guaranteed",
                responseStatus: responseStatus
            };
            
            elizaLogger.info('🚀 === BACKEND CALLBACK DATA ===');
            elizaLogger.info(`📝 Response text: ${response_text}`);
            elizaLogger.info(`🏷️ Callback metadata: ${JSON.stringify(callbackMetadata)}`);
            elizaLogger.info(`📊 Metadata keys: ${Object.keys(callbackMetadata)}`);
            elizaLogger.info(`🔍 ResponseStatus being sent: ${responseStatus}`);
            elizaLogger.info('================================');
            
            _callback({ 
                text: response_text,
                metadata: callbackMetadata
            });
            
            return true; // Always return true
            
        } catch (error) {
            elizaLogger.error("❌ Critical error - using ultimate fallback:", error);
            
            // Ultimate fallback that can never fail
            const fallbackMetadata = {
                actionName: "grand-villa-discovery",
                fallback: "ultimate",
                error: error.message,
                responseStatus: "Normal situation"
            };
            
            elizaLogger.info('🚨 === ULTIMATE FALLBACK CALLBACK ===');
            elizaLogger.info(`📝 Fallback text: Hello! I'm Grace, and I'm here to help you explore senior living options for your family. How can I assist you today?`);
            elizaLogger.info(`🏷️ Fallback metadata: ${JSON.stringify(fallbackMetadata)}`);
            elizaLogger.info('=====================================');
            
            _callback({
                text: "Hello! I'm Grace, and I'm here to help you explore senior living options for your family. How can I assist you today?",
                metadata: fallbackMetadata
            });
            
            return true; // Always return true even in ultimate fallback
        }
    }
}

// Helper function to get comprehensive record (merges ALL previous records)
async function getComprehensiveRecord(_runtime: IAgentRuntime, _message: Memory): Promise<ComprehensiveRecord | null> {
    try {
        const userResponses = await getUserResponses(_runtime, _message);
        
        if (userResponses.comprehensive_record && userResponses.comprehensive_record.length > 0) {
            elizaLogger.info(`📚 Found ${userResponses.comprehensive_record.length} comprehensive records to merge`);
            
            // Merge ALL comprehensive records to get complete history
            let mergedRecord: ComprehensiveRecord = {
                contact_info: { collected_at: new Date().toISOString() },
                situation_discovery: [],
                lifestyle_discovery: [],
                readiness_discovery: [],
                priorities_discovery: [],
                visit_scheduling: [],
                last_updated: new Date().toISOString()
            };
            
            // Process each record and merge Q&A data
            for (let i = 0; i < userResponses.comprehensive_record.length; i++) {
                try {
                    const record = JSON.parse(userResponses.comprehensive_record[i]);
                    elizaLogger.info(`📖 Processing record ${i + 1}: ${record.situation_discovery?.length || 0} situation, ${record.lifestyle_discovery?.length || 0} lifestyle entries`);
                    elizaLogger.info(`📖 Record ${i + 1} contact_info: ${JSON.stringify(record.contact_info)}`);
                    
                    // Merge contact info (keep most recent non-null values)
                    if (record.contact_info) {
                        elizaLogger.info(`📖 BEFORE merge: ${JSON.stringify(mergedRecord.contact_info)}`);
                        
                        // Only merge non-null values to preserve good data
                        const contactUpdate: any = {};
                        if (record.contact_info.name !== null && record.contact_info.name !== undefined) {
                            contactUpdate.name = record.contact_info.name;
                        }
                        if (record.contact_info.location !== null && record.contact_info.location !== undefined) {
                            contactUpdate.location = record.contact_info.location;
                        }
                        if (record.contact_info.loved_one_name !== null && record.contact_info.loved_one_name !== undefined) {
                            contactUpdate.loved_one_name = record.contact_info.loved_one_name;
                        }
                        if (record.contact_info.collected_at !== null && record.contact_info.collected_at !== undefined) {
                            contactUpdate.collected_at = record.contact_info.collected_at;
                        }
                        
                        mergedRecord.contact_info = { ...mergedRecord.contact_info, ...contactUpdate };
                        elizaLogger.info(`📖 AFTER merge: ${JSON.stringify(mergedRecord.contact_info)}`);
                    }
                    
                    // Merge Q&A arrays (avoid duplicates by question text)
                    if (record.situation_discovery) {
                        for (const entry of record.situation_discovery) {
                            const exists = mergedRecord.situation_discovery.some(existing => existing.question === entry.question);
                            if (!exists) {
                                mergedRecord.situation_discovery.push(entry);
                                elizaLogger.info(`✅ Added situation Q&A: ${entry.question}`);
                            } else {
                                elizaLogger.info(`⚠️ Skipped duplicate situation Q&A: ${entry.question}`);
                            }
                        }
                    }
                    
                    if (record.lifestyle_discovery) {
                        for (const entry of record.lifestyle_discovery) {
                            const exists = mergedRecord.lifestyle_discovery.some(existing => existing.question === entry.question);
                            if (!exists) {
                                mergedRecord.lifestyle_discovery.push(entry);
                                elizaLogger.info(`✅ Added lifestyle Q&A: ${entry.question}`);
                            } else {
                                elizaLogger.info(`⚠️ Skipped duplicate lifestyle Q&A: ${entry.question}`);
                            }
                        }
                    }
                    
                    if (record.readiness_discovery) {
                        for (const entry of record.readiness_discovery) {
                            const exists = mergedRecord.readiness_discovery.some(existing => existing.question === entry.question);
                            if (!exists) {
                                mergedRecord.readiness_discovery.push(entry);
                                elizaLogger.info(`✅ Added readiness Q&A: ${entry.question}`);
                            }
                        }
                    }
                    
                    if (record.priorities_discovery) {
                        for (const entry of record.priorities_discovery) {
                            const exists = mergedRecord.priorities_discovery.some(existing => existing.question === entry.question);
                            if (!exists) {
                                mergedRecord.priorities_discovery.push(entry);
                                elizaLogger.info(`✅ Added priorities Q&A: ${entry.question}`);
                            }
                        }
                    }
                    
                    if (record.visit_scheduling) {
                        for (const entry of record.visit_scheduling) {
                            const exists = mergedRecord.visit_scheduling.some(existing => existing.question === entry.question);
                            if (!exists) {
                                mergedRecord.visit_scheduling.push(entry);
                                elizaLogger.info(`✅ Added visit scheduling Q&A: ${entry.question}`);
                            } else {
                                elizaLogger.info(`⚠️ Skipped duplicate visit scheduling Q&A: ${entry.question}`);
                            }
                        }
                    }
                    
                } catch (parseError) {
                    elizaLogger.error(`Error parsing comprehensive record ${i + 1}:`, parseError);
                }
            }
            
            elizaLogger.info(`🎯 MERGED RESULT: ${mergedRecord.situation_discovery.length} situation, ${mergedRecord.lifestyle_discovery.length} lifestyle, ${mergedRecord.readiness_discovery.length} readiness, ${mergedRecord.priorities_discovery.length} priorities, ${mergedRecord.visit_scheduling.length} visit scheduling entries`);
            return mergedRecord;
        }
        
        return null;
    } catch (error) {
        elizaLogger.error("Error retrieving comprehensive record:", error);
        return null;
    }
}

// Helper function to update comprehensive record
async function updateComprehensiveRecord(_runtime: IAgentRuntime, _message: Memory, updates: Partial<ComprehensiveRecord>): Promise<void> {
    try {
        // Get existing record or create new one
        let record = await getComprehensiveRecord(_runtime, _message);
        
        if (!record) {
            record = {
                contact_info: {
                    collected_at: new Date().toISOString()
                },
                situation_discovery: [],
                lifestyle_discovery: [],
                readiness_discovery: [],
                priorities_discovery: [],
                visit_scheduling: [],
                last_updated: new Date().toISOString()
            };
        }
        
        // Apply updates
        if (updates.contact_info) {
            record.contact_info = { ...record.contact_info, ...updates.contact_info };
        }
        if (updates.situation_discovery) {
            record.situation_discovery = [...record.situation_discovery, ...updates.situation_discovery];
        }
        if (updates.lifestyle_discovery) {
            record.lifestyle_discovery = [...record.lifestyle_discovery, ...updates.lifestyle_discovery];
        }
        if (updates.readiness_discovery) {
            record.readiness_discovery = [...record.readiness_discovery, ...updates.readiness_discovery];
        }
        if (updates.priorities_discovery) {
            record.priorities_discovery = [...record.priorities_discovery, ...updates.priorities_discovery];
        }
        if (updates.visit_scheduling) {
            record.visit_scheduling = [...record.visit_scheduling, ...updates.visit_scheduling];
        }
        
        record.last_updated = new Date().toISOString();
        
        elizaLogger.info(`=== UPDATING COMPREHENSIVE RECORD ===`);
        elizaLogger.info(`Updates: ${JSON.stringify(updates, null, 2)}`);
        elizaLogger.info(`Final record to save: ${JSON.stringify(record, null, 2)}`);
        elizaLogger.info(`====================================`);
        
        // Save the updated record
        await saveUserResponse(_runtime, _message, "comprehensive_record", JSON.stringify(record));
        
    } catch (error) {
        elizaLogger.error("Error updating comprehensive record:", error);
    }
}

// Trust Building Handler
async function handleTrustBuilding(_runtime: IAgentRuntime, _message: Memory, _state: State, gracePersonality: string, grandVillaInfo: string): Promise<string> {
    elizaLogger.info("Handling trust building stage");
    
    // Check if user provided a response (not the first interaction)
    if (_message.content.text && _message.userId !== _message.agentId) {
        // Get all user responses from trust building stage so far
        let trustBuildingResponses = await getUserAnswersFromStage(_runtime, _message, "trust_building");
        
        // Fallback: if stage-based approach returns empty, get ONLY current user's messages
        if (trustBuildingResponses.length === 0) {
            elizaLogger.info("Stage-based approach returned empty, using fallback to get current user's messages");
            const allMemories = await _runtime.messageManager.getMemories({
                roomId: _message.roomId,
                count: 50
            });
            
            trustBuildingResponses = allMemories
                .filter(mem => mem.userId === _message.userId && mem.userId !== _message.agentId && mem.content.text.trim())
                .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
                .map(mem => mem.content.text);
            
            elizaLogger.info(`🔒 USER ISOLATION: Fallback collected ${trustBuildingResponses.length} messages from user ${_message.userId} only`);
        }
        
        const allTrustBuildingText = trustBuildingResponses.join(" ");
        
        elizaLogger.info(`=== TRUST BUILDING RESPONSES ===`);
        elizaLogger.info(`All trust building responses: ${JSON.stringify(trustBuildingResponses)}`);
        elizaLogger.info(`Combined text: ${allTrustBuildingText}`);
        elizaLogger.info(`===============================`);
        
        // Check if we already have any contact info stored
        let existingContactInfo = await getContactInfo(_runtime, _message);
        
        // Try to extract name, location, and loved one's name from ALL trust building responses
        const extractionContext = `Please extract the user's information from these responses: "${allTrustBuildingText}"
            
            Look for:
            - User's full name (first and last name)
            - Location (city, state, or zip code)
            - Name of their loved one/family member (the person they're seeking senior living for - could be "my mom", "my father", "John", "Mary", etc.)
            
            ${existingContactInfo ? `Note: We may already have some info - Name: ${existingContactInfo.name || 'none'}, Location: ${existingContactInfo.location || 'none'}, Loved One: ${existingContactInfo.loved_one_name || 'none'}` : ''}
            
            Return your response in this exact JSON format:
            {
                "name": "extracted user's full name or null if not found",
                "location": "extracted location such as city, state, or zip code or null if not found",
                "loved_one_name": "extracted loved one's name or null if not found",
                "foundName": true/false,
                "foundLocation": true/false,
                "foundLovedOneName": true/false
            }
            
            Make sure to return ONLY valid JSON, no additional text.`;
        
        try {
            const aiResponse = await generateText({
                runtime: _runtime,
                context: extractionContext,
                modelClass: ModelClass.SMALL
            });
            
            const parsed = JSON.parse(aiResponse);
            
            // Merge with existing info if we have any
            let finalName = parsed.foundName && parsed.name ? parsed.name : (existingContactInfo?.name || null);
            let finalLocation = parsed.foundLocation && parsed.location ? parsed.location : (existingContactInfo?.location || null);
            let finalLovedOneName = parsed.foundLovedOneName && parsed.loved_one_name ? parsed.loved_one_name : (existingContactInfo?.loved_one_name || null);
            
            elizaLogger.info(`=== CONTACT INFO EXTRACTION ===`);
            elizaLogger.info(`Extracted name: ${parsed.foundName ? parsed.name : 'NO'}`);
            elizaLogger.info(`Extracted location: ${parsed.foundLocation ? parsed.location : 'NO'}`);
            elizaLogger.info(`Extracted loved one: ${parsed.foundLovedOneName ? parsed.loved_one_name : 'NO'}`);
            elizaLogger.info(`Final name: ${finalName || 'NO'}`);
            elizaLogger.info(`Final location: ${finalLocation || 'NO'}`);
            elizaLogger.info(`Final loved one: ${finalLovedOneName || 'NO'}`);
            elizaLogger.info(`===============================`);
            
            // If we found all three pieces of info, save them and proceed
            if (finalName && finalLocation && finalLovedOneName) {
                elizaLogger.info(`=== SAVING CONTACT INFO TO COMPREHENSIVE RECORD ===`);
                elizaLogger.info(`Name: ${finalName}, Location: ${finalLocation}, Loved One: ${finalLovedOneName}`);
                
                // Save contact information to comprehensive record
                await updateComprehensiveRecord(_runtime, _message, {
                    contact_info: {
                        name: finalName,
                        location: finalLocation,
                        loved_one_name: finalLovedOneName,
                        collected_at: new Date().toISOString()
                    }
                });
                
                elizaLogger.info(`Contact info saved to comprehensive record`);
                
                // Move to next stage with personalized response
                const response = `Thank you, ${finalName}! I'd be happy to get you the information you need, but before I do, do you mind if I ask a few quick questions? That way, I can really understand what's important and make sure I'm helping in the best way possible.`;
                
                await _runtime.messageManager.createMemory({
                    roomId: _message.roomId,
                    userId: _message.userId,
                    agentId: _message.agentId,
                    content: { 
                        text: response,
                        metadata: {
                            stage: "situation_discovery"
                        }
                    }
                });
                
                elizaLogger.info(`Stored complete contact info and moving to situation_discovery`);
                return response;
            }
            
            // Save partial contact info if we have new information
            if (finalName || finalLocation || finalLovedOneName) {
                elizaLogger.info(`=== SAVING PARTIAL CONTACT INFO TO COMPREHENSIVE RECORD ===`);
                elizaLogger.info(`Name: ${finalName || 'not provided'}, Location: ${finalLocation || 'not provided'}, Loved One: ${finalLovedOneName || 'not provided'}`);
                
                await updateComprehensiveRecord(_runtime, _message, {
                    contact_info: {
                        name: finalName,
                        location: finalLocation,
                        loved_one_name: finalLovedOneName,
                        collected_at: new Date().toISOString()
                    }
                });
                
                elizaLogger.info(`Partial contact info saved to comprehensive record`);
            }
            
            // If we're missing any required info, ask for what's missing
            let missingInfoResponse = "";
            const missingItems = [];
            if (!finalName) missingItems.push("your name");
            if (!finalLocation) missingItems.push("your location");
            if (!finalLovedOneName) missingItems.push("your loved one's name");
            
            const userMessage = _message.content.text;

            const generationContext = `User message: "${userMessage}"

            This is the start of the conversation. Do NOT give all the details from "${grandVillaInfo}". 
            Instead:
            - Briefly introduce Grand Villa in a warm and intriguing way (just one or two appealing highlights).
            - Then naturally explain that to provide the most helpful information, you'll need a few basics from the user.
            - Ask politely for the missing details: ${missingItems.join(", ")}.
            - Keep response under 30-50 words.
            - Return ONLY the response text, no formatting or extra commentary.`

            const generated = await generateText({runtime: _runtime, context: generationContext, modelClass: ModelClass.SMALL});

            elizaLogger.info("chris_missing", generationContext, generated);

            missingInfoResponse = generated;
            
            // Stay in trust building stage
            await _runtime.messageManager.createMemory({
                roomId: _message.roomId,
                userId: _message.userId,
                agentId: _message.agentId,
                content: { 
                    text: missingInfoResponse,
                    metadata: {
                        stage: "trust_building"
                    }
                }
            });
            
            return missingInfoResponse;
            
        } catch (error) {
            elizaLogger.error("Error extracting contact info:", error);
            // Fallback to asking for all contact info
            const fallbackResponse = "I'd love to help you! To get started, could I get your name, location, and the name of your loved one you're looking for senior living options for?";
            
            await _runtime.messageManager.createMemory({
                roomId: _message.roomId,
                userId: _message.userId,
                agentId: _message.agentId,
                content: { 
                    text: fallbackResponse,
                    metadata: {
                        stage: "trust_building"
                    }
                }
            });
            
            return fallbackResponse;
        }
    }
    
    // First interaction - ask for name, location, and loved one's name
    const initialResponse = "Hello! I'm Grace, and I'm here to help you explore senior living options for your family. To get started, could I get your name, location, and the name of your loved one you're looking for senior living options for?";
    
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: { 
            text: initialResponse,
            metadata: {
                stage: "trust_building"
            }
        }
    });
    
    elizaLogger.info(`Stored initial contact request in trust_building stage`);
    return initialResponse;
}

// Situation Discovery Handler
async function handleSituationQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any, gracePersonality: string, grandVillaInfo: string): Promise<string> {
    // Save user response from this stage
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "situation", _message.content.text);
    }
    
    // Get contact information for personalization
    const contactInfo = await getContactInfo(_runtime, _message);
    const userName = await getUserFirstName(_runtime, _message);
    
    // Create personalized questions using loved one's name
    const lovedOneName = contactInfo?.loved_one_name || "your loved one";
    const location = contactInfo?.location || "Florida";
    const situationQuestions = [
        "Move to next step",
        "What made you decide to reach out about senior living today?",
        `What's your biggest concern about ${lovedOneName} right now?`, 
        "How is this situation impacting your family?",
        `Where does ${lovedOneName} currently live?`
    ];
    
    // Get comprehensive record to see what questions have been asked/answered
    const comprehensiveRecord = await getComprehensiveRecord(_runtime, _message);
    const situationQAEntries = comprehensiveRecord?.situation_discovery || [];
    const answeredQuestions = situationQAEntries.map(entry => entry.question);
    
    elizaLogger.info(`=== SITUATION DISCOVERY STAGE ===`);
    elizaLogger.info(`Current user message: ${_message.content.text}`);
    elizaLogger.info(`Already answered questions: ${JSON.stringify(answeredQuestions)}`);
    elizaLogger.info(`================================`)
    
    // Track which questions get answered in this interaction
    let locallyAnsweredQuestions: string[] = [...answeredQuestions];
    
    // If user provided a response, assign it to the next unanswered question
    if (_message.content.text && _message.userId !== _message.agentId) {
        // Find the first unanswered question and assign the user's response to it
        const unansweredQuestions = situationQuestions.filter(q => !locallyAnsweredQuestions.includes(q));
        
        if (unansweredQuestions.length > 0) {
            const nextQuestion = unansweredQuestions[0];
            const newSituationEntry = {
                question: nextQuestion,
                answer: _message.content.text,
                timestamp: new Date().toISOString()
            };
            
            // Save this Q&A entry to comprehensive record
            await updateComprehensiveRecord(_runtime, _message, {
                situation_discovery: [newSituationEntry]
            });
            
            locallyAnsweredQuestions.push(nextQuestion);
            elizaLogger.info(`✓ Assigned user response to: ${nextQuestion}`);
            elizaLogger.info(`   Answer: ${_message.content.text}`);
        }
    }
    
    // Use locally tracked answers instead of database retrieval to avoid timing issues
    const remainingQuestions = situationQuestions.filter(q => !locallyAnsweredQuestions.includes(q));
    
    elizaLogger.info(`=== REMAINING QUESTIONS CHECK ===`);
    elizaLogger.info(`Total answered: ${locallyAnsweredQuestions.length}/${situationQuestions.length}`);
    elizaLogger.info(`Remaining questions: ${JSON.stringify(remainingQuestions)}`);
    elizaLogger.info(`=================================`);
    
    // If all 4 questions are answered, move to next stage
    if (remainingQuestions.length === 0) {
        elizaLogger.info("All situation questions answered, moving to lifestyle_discovery stage");
        
        // Move to lifestyle discovery stage and let it handle the response
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: "STAGE_TRANSITION", // Placeholder that won't be shown
                metadata: { 
                    stage: "lifestyle_discovery",
                    transition: true
                }
            }
        });
        
        // Let lifestyle discovery handler create the actual response
        // Create a new message object without user content to avoid processing the previous response
        const transitionMessage = {
            ..._message,
            content: { text: "" }
        };
        elizaLogger.info("chris_parameter", _message.content.text);
        return await handleLifestyleQuestions(_runtime, transitionMessage, _state, discoveryState, gracePersonality, grandVillaInfo, _message.content.text);
    }
    
    // Generate AI response that asks the next unanswered question with context
    const nextQuestion = remainingQuestions[0];
    const currentAnsweredCount = situationQuestions.length - remainingQuestions.length;
    
    // Get any previous answers to provide context
    const previousAnswers = situationQAEntries.map(entry => `${entry.question}: ${entry.answer}`).join(' | ');
    
    // STEP 1: Determine situation classification
    const classificationContext = `Analyze the user's message and classify the situation.

        User message: "${_message.content.text}"
        
        === CLASSIFICATION RULES ===
        Classify as "Unexpected situation" if the message contains:
        • Any question or curiosity about something
        • Worries that can be related to Grand Villa community
        • Phrases like "I'd like to know…", "tell me…", "can you explain…", "curious about…"
        • Requests for extra details about pricing, services, amenities, locations, or policies
        • Expressions of frustration, confusion, or complaints ("too many questions", "when can I get information?")
        • Sharing about loved one's likes, interests, hobbies, activities they enjoy, things they love doing, or activities they used to do
        
        Otherwise, classify as "Normal situation".
        
        Return ONLY a JSON object:
        {"status": "Normal situation" or "Unexpected situation"}`;
    
    let status = "Normal situation";
    
    try {
        const classificationResponse = await generateText({
            runtime: _runtime,
            context: classificationContext,
            modelClass: ModelClass.SMALL
        });
        
        const classification = JSON.parse(classificationResponse);
        status = classification.status || "Normal situation";
        
        elizaLogger.info(`Situation classified as: ${status}`);
        
    } catch (error) {
        elizaLogger.error("Failed to classify situation:", error);
        status = "Normal situation"; // Default fallback
    }
    
    // STEP 2: Generate appropriate response based on classification
    const responseContext = `The user ${userName ? `(${userName}) ` : ''} is sharing their senior living situation.

        Progress: ${currentAnsweredCount}/4 questions answered so far.
        ${previousAnswers ? `Previous answers: ${previousAnswers}` : ''}
        User's last message: "${_message.content.text}"
        Situation classification: "${status}"
        Next question to ask: "${nextQuestion}"

        === RESPONSE INSTRUCTIONS ===
        ${status === "Normal situation" ? `
        1. For "Normal situation":
        - Stay warm and personal.
        - Address the user by ${userName} naturally.
        - Refer to their loved one by ${lovedOneName} (avoid just "he/she").
        - Smoothly introduce "${nextQuestion}" so it feels like part of a conversation.
        - Keep words under 30-40.
        ` : `
        2. For "Unexpected situation":
        - Look at the last message: "${_message.content.text}".
        - If the message contains a question or curiosity, answer clearly using grandvilla_information: "${grandVillaInfo}".  
          If info is missing, search online and give the most accurate answer.
        - If the message indicates that the user's loved one might be a good fit for Grand Villa (based on their preferences, needs, lifestyle, or interests), naturally highlight how Grand Villa matches those needs.  
          For example, link their hobbies, activities, or care requirements to relevant services, programs, or amenities in grandvilla_information.
        - Never share exact pricing or pricing-related details unless the user directly asks about pricing.
        - If it's a pricing question:
            • Share the pricing for the closest Grand Villa to "${location}" using exact details from grandvilla_information.  
            • Mention that pricing depends on the level of care and services chosen.  
            • Suggest visiting the community in person for the most accurate understanding of costs.
        - If the user complains about too many questions or timing, empathize, explain why these questions are asked, and lighten the mood with a friendly or humorous remark.
        - Smoothly connect back to "${nextQuestion}" in a natural, conversational way.
        - Keep the response concise, around 30–50 words.
        `}

        Return ONLY the response text, no JSON formatting.`;
    
    try {
        const aiResponse = await generateText({
            runtime: _runtime,
            context: responseContext,
            modelClass: ModelClass.MEDIUM
        });
        
        const response = aiResponse || `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        
        elizaLogger.info("chris_response1", responseContext, aiResponse);
        
        // Set global responseStatus for callback
        setGlobalResponseStatus(status);
        
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: response,
                metadata: { 
                    askedQuestion: response,
                    stage: "situation_discovery",
                    responseStatus: status
                }
            }
        });
        
        return response;
        
    } catch (error) {
        elizaLogger.error("Failed to generate AI response:", error);
        const fallbackResponse = `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        
        // Set global responseStatus for callback (fallback to Normal situation)
        setGlobalResponseStatus("Normal situation");
        
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: fallbackResponse,
                metadata: { 
                    askedQuestion: fallbackResponse,
                    stage: "situation_discovery",
                    responseStatus: "Normal situation"
                }
            }
        });
        
        return fallbackResponse;
    }
}

// Lifestyle Discovery Handler  
async function handleLifestyleQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any, gracePersonality: string, grandVillaInfo: string, lastUserMessage: string): Promise<string> {
    // The 3 basic lifestyle questions we need to collect answers for
    const lifestyleQuestions = [
        "Tell me about your loved one. What does a typical day look like for them?",
        "What does he/she enjoy doing?"
    ];
    elizaLogger.info(`@chris_grand_info: ${grandVillaInfo}`);
    
    // Save user response from this stage
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "lifestyle", _message.content.text);
    }
    
    // Get contact information for personalization (randomly use name)

    const contactInfo = await getContactInfo(_runtime, _message);
    const useName = shouldUseName();
    const userName = useName ? await getUserFirstName(_runtime, _message) : "";
    const lovedOneName = contactInfo?.loved_one_name || "your loved one";
    const location = contactInfo?.location || "Florida";
    
    // Get comprehensive record to see what questions have been asked/answered
    const comprehensiveRecord = await getComprehensiveRecord(_runtime, _message);
    const lifestyleQAEntries = comprehensiveRecord?.lifestyle_discovery || [];
    const answeredQuestions = lifestyleQAEntries.map(entry => entry.question);
    
    elizaLogger.info(`=== LIFESTYLE DISCOVERY STAGE ===`);
    elizaLogger.info(`Current user message: ${_message.content.text}`);
    elizaLogger.info(`Already answered questions: ${JSON.stringify(answeredQuestions)}`);
    elizaLogger.info(`Using name in response: ${useName ? 'YES' : 'NO'} (${userName || 'N/A'})`);
    elizaLogger.info(`================================`)
    
    // Track which questions get answered in this interaction
    let locallyAnsweredQuestions: string[] = [...answeredQuestions];
    
    // If user provided a response, assign it to the next unanswered question
    if (_message.content.text && _message.userId !== _message.agentId) {
        // Find the first unanswered question and assign the user's response to it
        const unansweredQuestions = lifestyleQuestions.filter(q => !locallyAnsweredQuestions.includes(q));
        
        if (unansweredQuestions.length > 0) {
            const nextQuestion = unansweredQuestions[0];
            const newLifestyleEntry = {
                question: nextQuestion,
                answer: _message.content.text,
                timestamp: new Date().toISOString()
            };
            
            // Save this Q&A entry to comprehensive record
            await updateComprehensiveRecord(_runtime, _message, {
                lifestyle_discovery: [newLifestyleEntry]
            });
            
            locallyAnsweredQuestions.push(nextQuestion);
            elizaLogger.info(`✓ Assigned user response to: ${nextQuestion}`);
            elizaLogger.info(`   Answer: ${_message.content.text}`);
        }
    }
    
    // Use locally tracked answers instead of database retrieval to avoid timing issues
    const remainingQuestions = lifestyleQuestions.filter(q => !locallyAnsweredQuestions.includes(q));
    
    elizaLogger.info(`=== REMAINING QUESTIONS CHECK ===`);
    elizaLogger.info(`Total answered: ${locallyAnsweredQuestions.length}/${lifestyleQuestions.length}`);
    elizaLogger.info(`Remaining questions: ${JSON.stringify(remainingQuestions)}`);
    elizaLogger.info(`=================================`);
    
    // If all 3 questions are answered, move to next stage
    if (remainingQuestions.length === 0) {
        elizaLogger.info("All lifestyle questions answered, moving to readiness_discovery stage");
        
        // Move to readiness discovery stage and let it handle the response
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: "STAGE_TRANSITION", // Placeholder that won't be shown
                metadata: { 
                    stage: "readiness_discovery",
                    transition: true
                }
            }
        });
        
        // Let readiness discovery handler create the actual response
        // Create a new message object without user content to avoid processing the previous response
        const transitionMessage = {
            ..._message,
            content: { text: "" }
        };
        return await handleReadinessQuestions(_runtime, transitionMessage, _state, discoveryState, gracePersonality, grandVillaInfo, _message.content.text);
    }
    
    // Determine which question to ask next and generate a contextual response
    const nextQuestion = remainingQuestions[0];
    const currentAnsweredCount = lifestyleQuestions.length - remainingQuestions.length;
    
    // Get any previous answers to provide context
    const previousAnswers = lifestyleQAEntries.map(entry => `${entry.question}: ${entry.answer}`).join(' | ');

    const lastUserText = _message.content.text ? _message.content.text: lastUserMessage;
    
    // STEP 1: Determine situation classification
    const classificationContext = `Analyze the user's message and classify the situation.

        User message: "${lastUserText}"
        
        === CLASSIFICATION RULES ===
        Classify as "Unexpected situation" if the message contains:
        • Any question or curiosity about something
        • Worries that can be related to Grand Villa community
        • Phrases like "I'd like to know…", "tell me…", "can you explain…", "curious about…"
        • Requests for extra details about pricing, services, amenities, locations, or policies
        • Expressions of frustration, confusion, or complaints ("too many questions", "when can I get information?")
        • Sharing about loved one's likes, interests, hobbies, activities they enjoy, things they love doing, or activities they used to do
                
        Otherwise, classify as "Normal situation".
        
        Return ONLY a JSON object:
        {"status": "Normal situation" or "Unexpected situation"}`;
    
    let status = "Normal situation";
    
    try {
        const classificationResponse = await generateText({
            runtime: _runtime,
            context: classificationContext,
            modelClass: ModelClass.SMALL
        });
        
        const classification = JSON.parse(classificationResponse);
        status = classification.status || "Normal situation";
        
        elizaLogger.info(`Situation classified as: ${status}`);
        
    } catch (error) {
        elizaLogger.error("Failed to classify situation:", error);
        status = "Normal situation"; // Default fallback
    }
    
    // STEP 2: Generate appropriate response based on classification
    const responseContext = `The user ${userName ? `(${userName}) ` : ''}is sharing about their loved one's lifestyle and daily activities. 
    
        Progress: ${currentAnsweredCount}/2 questions answered so far.
        ${previousAnswers ? `Previous answers: ${previousAnswers}` : ''}
        User's last message: "${lastUserText}"
        Situation classification: "${status}"
        Next question to ask: "${nextQuestion}"

        === RESPONSE INSTRUCTIONS ===
        ${status === "Normal situation" ? `
        1. For "Normal situation":
        - Stay warm and personal.
        - Address the user by ${userName} naturally.
        - Refer to their loved one by ${lovedOneName} (avoid just "he/she").
        - Smoothly introduce "${nextQuestion}" so it feels like part of a conversation.
        - Keep words under 30-40.
        ` : `
        2. For "Unexpected situation":
        - Look at the last message: "${lastUserText}".
        - If the message contains a question or curiosity, answer clearly using grandvilla_information: "${grandVillaInfo}".  
          If info is missing, search online and give the most accurate answer.
        - If the message indicates that the user's loved one might be a good fit for Grand Villa (based on their preferences, needs, lifestyle, or interests), naturally highlight how Grand Villa matches those needs.  
          For example, link their hobbies, activities, or care requirements to relevant services, programs, or amenities in grandvilla_information.
        - Never share exact pricing or pricing-related details unless the user directly asks about pricing.
        - If it's a pricing question:
            • Share the pricing for the closest Grand Villa to "${location}" using exact details from grandvilla_information.  
            • Mention that pricing depends on the level of care and services chosen.  
            • Suggest visiting the community in person for the most accurate understanding of costs.
        - If the user complains about too many questions or timing, empathize, explain why these questions are asked, and lighten the mood with a friendly or humorous remark.
        - Smoothly connect back to "${nextQuestion}" in a natural, conversational way.
        - Keep the response concise, around 50–70 words.
        `}

        Return ONLY the response text, no JSON formatting.`;
    
    try {
        const aiResponse = await generateText({
            runtime: _runtime,
            context: responseContext,
            modelClass: ModelClass.MEDIUM
        });
        
        const response = aiResponse || `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        
        elizaLogger.info("chris_response2", responseContext, aiResponse);
        
        // Set global responseStatus for callback
        setGlobalResponseStatus(status);
        
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: response,
                metadata: { 
                    askedQuestion: response,
                    stage: "lifestyle_discovery",
                    responseStatus: status
                }
            }
        });
        
        return response;
        
    } catch (error) {
        elizaLogger.error("Failed to generate AI response:", error);
        const fallbackResponse = `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        
        // Set global responseStatus for callback (fallback to Normal situation)
        setGlobalResponseStatus("Normal situation");
        
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: fallbackResponse,
                metadata: { 
                    askedQuestion: fallbackResponse,
                    stage: "lifestyle_discovery",
                    responseStatus: "Normal situation"
                }
            }
        });
        
        return fallbackResponse;
    }
}

// Readiness Discovery Handler
async function handleReadinessQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any, gracePersonality: string, grandVillaInfo: string, lastUserMessage: string): Promise<string> {
    // The 3 basic readiness questions we need to collect answers for
    const readinessQuestions = [
        "Is your loved one aware that you're looking at options?",
        "How does your loved one feel about the idea of moving?",
        "Who else is involved in helping make this decision?"
    ];
    
    // Save user response from this stage
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "readiness", _message.content.text);
    }
    
    // Get contact information for personalization
    const contactInfo = await getContactInfo(_runtime, _message);
    const useName = shouldUseName();
    const userName = useName ? await getUserFirstName(_runtime, _message) : "";
    const lovedOneName = contactInfo?.loved_one_name || "your loved one";
    const location = contactInfo?.location || "Florida";
    
    // Get comprehensive record to see what questions have been asked/answered
    const comprehensiveRecord = await getComprehensiveRecord(_runtime, _message);
    const readinessQAEntries = comprehensiveRecord?.readiness_discovery || [];
    const answeredQuestions = readinessQAEntries.map(entry => entry.question);
    
    elizaLogger.info(`=== READINESS DISCOVERY STAGE ===`);
    elizaLogger.info(`Current user message: ${_message.content.text}`);
    elizaLogger.info(`📝 ALL REQUIRED QUESTIONS:`);
    readinessQuestions.forEach((q, i) => elizaLogger.info(`   ${i+1}. ${q}`));
    elizaLogger.info(`✅ ANSWERED QUESTIONS (${answeredQuestions.length}/${readinessQuestions.length}):`);
    answeredQuestions.forEach((q, i) => elizaLogger.info(`   ${i+1}. ${q}`));
    elizaLogger.info(`❌ MISSING QUESTIONS:`);
    const missingQuestions = readinessQuestions.filter(q => !answeredQuestions.includes(q));
    missingQuestions.forEach((q, i) => elizaLogger.info(`   ${i+1}. ${q}`));
    elizaLogger.info(`Using name in response: ${useName ? 'YES' : 'NO'} (${userName || 'N/A'})`);
    elizaLogger.info(`================================`)
    
    // Track which questions get answered in this interaction
    let locallyAnsweredQuestions: string[] = [...answeredQuestions];
    
    // If user provided a response, assign it to the next unanswered question
    if (_message.content.text && _message.userId !== _message.agentId) {
        // Find the first unanswered question and assign the user's response to it
        const unansweredQuestions = readinessQuestions.filter(q => !locallyAnsweredQuestions.includes(q));
        
        if (unansweredQuestions.length > 0) {
            const nextQuestion = unansweredQuestions[0];
            const newReadinessEntry = {
                question: nextQuestion,
                answer: _message.content.text,
                timestamp: new Date().toISOString()
            };
            
            // Save this Q&A entry to comprehensive record
            await updateComprehensiveRecord(_runtime, _message, {
                readiness_discovery: [newReadinessEntry]
            });
            
            locallyAnsweredQuestions.push(nextQuestion);
            elizaLogger.info(`✓ Assigned user response to: ${nextQuestion}`);
            elizaLogger.info(`   Answer: ${_message.content.text}`);
        }
    }
    
    // Use locally tracked answers instead of database retrieval to avoid timing issues
    const remainingQuestions = readinessQuestions.filter(q => !locallyAnsweredQuestions.includes(q));
    
    elizaLogger.info(`=== REMAINING QUESTIONS CHECK ===`);
    elizaLogger.info(`Total answered: ${locallyAnsweredQuestions.length}/${readinessQuestions.length}`);
    elizaLogger.info(`Remaining questions: ${JSON.stringify(remainingQuestions)}`);
    elizaLogger.info(`=================================`);
    
    // If all 3 questions are answered, move to next stage
    if (remainingQuestions.length === 0) {
        elizaLogger.info("All readiness questions answered, moving to priorities_discovery stage");
        
        // Move to priorities discovery stage and let it handle the response
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: "STAGE_TRANSITION", // Placeholder that won't be shown
                metadata: { 
                    stage: "priorities_discovery",
                    transition: true
                }
            }
        });
        
        // Let priorities discovery handler create the actual response
        // Create a new message object without user content to avoid processing the previous response
        const transitionMessage = {
            ..._message,
            content: { text: "" }
        };
        return await handlePriorityQuestions(_runtime, transitionMessage, _state, discoveryState, gracePersonality, grandVillaInfo, _message.content.text);
    }
    
    elizaLogger.info(`⏳ STILL NEED ${remainingQuestions.length} MORE ANSWERS - staying in readiness_discovery`);
    
    // Generate AI response that asks the next unanswered question with context
    const nextQuestion = remainingQuestions[0];
    const currentAnsweredCount = readinessQuestions.length - remainingQuestions.length;
    
    elizaLogger.info(`🔄 ASKING NEXT QUESTION: "${nextQuestion}"`);
    elizaLogger.info(`📊 PROGRESS: ${currentAnsweredCount}/${readinessQuestions.length} questions answered`);
    
    // Get any previous answers to provide context
    const previousAnswers = readinessQAEntries.map(entry => `${entry.question}: ${entry.answer}`).join(' | ');

    const lastUserText = _message.content.text ? _message.content.text : lastUserMessage;
    
    // STEP 1: Determine situation classification
    const classificationContext = `Analyze the user's message and classify the situation.

        User message: "${lastUserText}"
        
        === CLASSIFICATION RULES ===
        Classify as "Unexpected situation" if the message contains:
        • Any question or curiosity about something
        • Worries that can be related to Grand Villa community
        • Phrases like "I'd like to know…", "tell me…", "can you explain…", "curious about…"
        • Requests for extra details about pricing, services, amenities, locations, or policies
        • Expressions of frustration, confusion, or complaints ("too many questions", "when can I get information?")
        • Sharing about loved one's likes, interests, hobbies, activities they enjoy, things they love doing, or activities they used to do
                
        Otherwise, classify as "Normal situation".
        
        Return ONLY a JSON object:
        {"status": "Normal situation" or "Unexpected situation"}`;
    
    let status = "Normal situation";
    
    try {
        const classificationResponse = await generateText({
            runtime: _runtime,
            context: classificationContext,
            modelClass: ModelClass.SMALL
        });
        
        const classification = JSON.parse(classificationResponse);
        status = classification.status || "Normal situation";
        
        elizaLogger.info(`Situation classified as: ${status}`);
        
    } catch (error) {
        elizaLogger.error("Failed to classify situation:", error);
        status = "Normal situation"; // Default fallback
    }
    
    // STEP 2: Generate appropriate response based on classification
    const responseContext = `The user ${userName ? `(${userName}) ` : ''}is sharing about their loved one's readiness and family involvement.
    
        Progress: ${currentAnsweredCount}/3 questions answered so far.
        ${previousAnswers ? `Previous answers: ${previousAnswers}` : ''}
        User's last message: "${lastUserText}"
        Situation classification: "${status}"
        Next question to ask: "${nextQuestion}"

        === RESPONSE INSTRUCTIONS ===
        ${status === "Normal situation" ? `
        1. For "Normal situation":
        - Stay warm and personal.
        - Address the user by ${userName} naturally.
        - Refer to their loved one by ${lovedOneName} (avoid just "he/she").
        - Smoothly introduce "${nextQuestion}" so it feels like part of a conversation.
        - Keep words under 30-40.
        ` : `
        2. For "Unexpected situation":
        - Look at the last message: "${lastUserText}".
        - If the message contains a question or curiosity, answer clearly using grandvilla_information: "${grandVillaInfo}".  
          If info is missing, search online and give the most accurate answer.
        - If the message indicates that the user's loved one might be a good fit for Grand Villa (based on their preferences, needs, lifestyle, or interests), naturally highlight how Grand Villa matches those needs.  
          For example, link their hobbies, activities, or care requirements to relevant services, programs, or amenities in grandvilla_information.
        - Never share exact pricing or pricing-related details unless the user directly asks about pricing.
        - If it's a pricing question:
            • Share the pricing for the closest Grand Villa to "${location}" using exact details from grandvilla_information.  
            • Mention that pricing depends on the level of care and services chosen.  
            • Suggest visiting the community in person for the most accurate understanding of costs.
        - If the user complains about too many questions or timing, empathize, explain why these questions are asked, and lighten the mood with a friendly or humorous remark.
        - Smoothly connect back to "${nextQuestion}" in a natural, conversational way.
        - Keep the response concise, around 50–70 words.
        `}

        Return ONLY the response text, no JSON formatting.`;
    
    try {
        const aiResponse = await generateText({
            runtime: _runtime,
            context: responseContext,
            modelClass: ModelClass.MEDIUM
        });
        
        const response = aiResponse || `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        
        elizaLogger.info("chris_response3", responseContext, aiResponse);
        
        // Set global responseStatus for callback
        setGlobalResponseStatus(status);
        
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: response,
                metadata: { 
                    askedQuestion: response,
                    stage: "readiness_discovery",
                    responseStatus: status
                }
            }
        });
        
        return response;
        
    } catch (error) {
        elizaLogger.error("Failed to generate AI response:", error);
        const fallbackResponse = `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        
        // Set global responseStatus for callback (fallback to Normal situation)
        setGlobalResponseStatus("Normal situation");
        
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: fallbackResponse,
                metadata: { 
                    askedQuestion: fallbackResponse,
                    stage: "readiness_discovery",
                    responseStatus: "Normal situation"
                }
            }
        });
        
        return fallbackResponse;
    }
}

// Priority Discovery Handler
async function handlePriorityQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any, gracePersonality: string, grandVillaInfo: string, lastUserMessage: string): Promise<string> {
    // The 3 priority questions we need to collect answers for
    const priorityQuestions = [
        "What's most important to you regarding the community you may choose?"
    ];
    
    // Save user response from this stage
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "priorities", _message.content.text);
    }
    
    // Get contact information for personalization
    const contactInfo = await getContactInfo(_runtime, _message);
    const useName = shouldUseName();
    const userName = useName ? await getUserFirstName(_runtime, _message) : "";
    const lovedOneName = contactInfo?.loved_one_name || "your loved one";
    const location = contactInfo?.location || "Florida";
    
    // Get comprehensive record to see what questions have been asked/answered
    const comprehensiveRecord = await getComprehensiveRecord(_runtime, _message);
    const prioritiesQAEntries = comprehensiveRecord?.priorities_discovery || [];
    const answeredQuestions = prioritiesQAEntries.map(entry => entry.question);
    
    elizaLogger.info(`=== PRIORITIES DISCOVERY STAGE ===`);
    elizaLogger.info(`Current user message: ${_message.content.text}`);
    elizaLogger.info(`📝 ALL REQUIRED QUESTIONS:`);
    priorityQuestions.forEach((q, i) => elizaLogger.info(`   ${i+1}. ${q}`));
    elizaLogger.info(`✅ ANSWERED QUESTIONS (${answeredQuestions.length}/${priorityQuestions.length}):`);
    answeredQuestions.forEach((q, i) => elizaLogger.info(`   ${i+1}. ${q}`));
    elizaLogger.info(`❌ MISSING QUESTIONS:`);
    const missingQuestions = priorityQuestions.filter(q => !answeredQuestions.includes(q));
    missingQuestions.forEach((q, i) => elizaLogger.info(`   ${i+1}. ${q}`));
    elizaLogger.info(`Using name in response: ${useName ? 'YES' : 'NO'} (${userName || 'N/A'})`);
    elizaLogger.info(`=================================`)
    
    // Track which questions get answered in this interaction
    let locallyAnsweredQuestions: string[] = [...answeredQuestions];
    
    // If user provided a response, assign it to the next unanswered question
    if (_message.content.text && _message.userId !== _message.agentId) {
        // Find the first unanswered question and assign the user's response to it
        const unansweredQuestions = priorityQuestions.filter(q => !locallyAnsweredQuestions.includes(q));
        
        if (unansweredQuestions.length > 0) {
            const nextQuestion = unansweredQuestions[0];
            const newPrioritiesEntry = {
                question: nextQuestion,
                answer: _message.content.text,
                timestamp: new Date().toISOString()
            };
            
            // Save this Q&A entry to comprehensive record
            await updateComprehensiveRecord(_runtime, _message, {
                priorities_discovery: [newPrioritiesEntry]
            });
            
            locallyAnsweredQuestions.push(nextQuestion);
            elizaLogger.info(`✓ Assigned user response to: ${nextQuestion}`);
            elizaLogger.info(`   Answer: ${_message.content.text}`);
        }
    }
    
    // Use locally tracked answers instead of database retrieval to avoid timing issues
    const remainingQuestions = priorityQuestions.filter(q => !locallyAnsweredQuestions.includes(q));
    
    elizaLogger.info(`=== REMAINING QUESTIONS CHECK ===`);
    elizaLogger.info(`Total answered: ${locallyAnsweredQuestions.length}/${priorityQuestions.length}`);
    elizaLogger.info(`Remaining questions: ${JSON.stringify(remainingQuestions)}`);
    elizaLogger.info(`=================================`);
    
    // If all 2 questions are answered, move to next stage
    if (remainingQuestions.length === 0) {
        elizaLogger.info("All priorities questions answered, moving to needs_matching stage");
        
        // Move to needs matching stage and let it handle the response
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: "STAGE_TRANSITION", // Placeholder that won't be shown
                metadata: { 
                    stage: "needs_matching",
                    transition: true
                }
            }
        });
        
        // Let needs matching handler create the actual response
        // Create a new message object without user content to avoid processing the previous response
        const transitionMessage = {
            ..._message,
            content: { text: "" }
        };
        return await handleNeedsMatching(_runtime, transitionMessage, _state, discoveryState, gracePersonality, grandVillaInfo, _message.content.text);
    }
    
    elizaLogger.info(`⏳ STILL NEED ${remainingQuestions.length} MORE ANSWERS - staying in priorities_discovery`);
    
    // Generate AI response that asks the next unanswered question with context
    const nextQuestion = remainingQuestions[0];
    const currentAnsweredCount = priorityQuestions.length - remainingQuestions.length;
    
    elizaLogger.info(`🔄 ASKING NEXT QUESTION: "${nextQuestion}"`);
    elizaLogger.info(`📊 PROGRESS: ${currentAnsweredCount}/${priorityQuestions.length} questions answered`);
    
    // Get any previous answers to provide context
    const previousAnswers = prioritiesQAEntries.map(entry => `${entry.question}: ${entry.answer}`).join(' | ');

    const lastUserText = _message.content.text ? _message.content.text : lastUserMessage;
    
    // STEP 1: Determine situation classification
    const classificationContext = `Analyze the user's message and classify the situation.

        User message: "${lastUserText}"
        
        === CLASSIFICATION RULES ===
        Classify as "Unexpected situation" if the message contains:
        • Any question or curiosity about something
        • Worries that can be related to Grand Villa community
        • Phrases like "I'd like to know…", "tell me…", "can you explain…", "curious about…"
        • Requests for extra details about pricing, services, amenities, locations, or policies
        • Expressions of frustration, confusion, or complaints ("too many questions", "when can I get information?")
        • Sharing about loved one's likes, interests, hobbies, activities they enjoy, things they love doing, or activities they used to do
                
        Otherwise, classify as "Normal situation".
        
        Return ONLY a JSON object:
        {"status": "Normal situation" or "Unexpected situation"}`;
    
    let status = "Normal situation";
    
    try {
        const classificationResponse = await generateText({
            runtime: _runtime,
            context: classificationContext,
            modelClass: ModelClass.SMALL
        });
        
        const classification = JSON.parse(classificationResponse);
        status = classification.status || "Normal situation";
        
        elizaLogger.info(`Situation classified as: ${status}`);
        
    } catch (error) {
        elizaLogger.error("Failed to classify situation:", error);
        status = "Normal situation"; // Default fallback
    }
    
    // STEP 2: Generate appropriate response based on classification
    const responseContext = `The user ${userName ? `(${userName}) ` : ''}is sharing about their priorities and what's important in choosing a senior living community.
    
        Progress: ${currentAnsweredCount}/2 questions answered so far.
        ${previousAnswers ? `Previous answers: ${previousAnswers}` : ''}
        User's last message: "${lastUserText}"
        Situation classification: "${status}"
        Next question to ask: "${nextQuestion}"

        === RESPONSE INSTRUCTIONS ===
        ${status === "Normal situation" ? `
        1. For "Normal situation":
        - Stay warm and personal.
        - Address the user by ${userName} naturally.
        - Refer to their loved one by ${lovedOneName} (avoid just "he/she").
        - Smoothly introduce "${nextQuestion}" so it feels like part of a conversation.
        - Keep words under 30-40.
        ` : `
        2. For "Unexpected situation":
        - Look at the last message: "${lastUserText}".
        - If the message contains a question or curiosity, answer clearly using grandvilla_information: "${grandVillaInfo}".  
          If info is missing, search online and give the most accurate answer.
        - If the message indicates that the user's loved one might be a good fit for Grand Villa (based on their preferences, needs, lifestyle, or interests), naturally highlight how Grand Villa matches those needs.  
          For example, link their hobbies, activities, or care requirements to relevant services, programs, or amenities in grandvilla_information.
        - Never share exact pricing or pricing-related details unless the user directly asks about pricing.
        - If it's a pricing question:
            • Share the pricing for the closest Grand Villa to "${location}" using exact details from grandvilla_information.  
            • Mention that pricing depends on the level of care and services chosen.  
            • Suggest visiting the community in person for the most accurate understanding of costs.
        - If the user complains about too many questions or timing, empathize, explain why these questions are asked, and lighten the mood with a friendly or humorous remark.
        - Smoothly connect back to "${nextQuestion}" in a natural, conversational way.
        - Keep the response concise, around 50–70 words.
        `}

        Return ONLY the response text, no JSON formatting.`;
    
    try {
        const aiResponse = await generateText({
            runtime: _runtime,
            context: responseContext,
            modelClass: ModelClass.MEDIUM
        });
        
        const response = aiResponse || `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        
        elizaLogger.info("chris_response4", responseContext, aiResponse);
        
        // Set global responseStatus for callback
        setGlobalResponseStatus(status);
        
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: response,
                metadata: { 
                    askedQuestion: response,
                    stage: "priorities_discovery",
                    responseStatus: status
                }
            }
        });
        
        return response;
        
    } catch (error) {
        elizaLogger.error("Failed to generate AI response:", error);
        const fallbackResponse = `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        
        // Set global responseStatus for callback (fallback to Normal situation)
        setGlobalResponseStatus("Normal situation");
        
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: fallbackResponse,
                metadata: { 
                    askedQuestion: fallbackResponse,
                    stage: "priorities_discovery",
                    responseStatus: "Normal situation"
                }
            }
        });
        
        return fallbackResponse;
    }
}

// Needs Matching Handler
async function handleNeedsMatching(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any, gracePersonality: string, grandVillaInfo: string, lastUserMessage: string): Promise<string> {
    // Check if this is a user response (not the initial transition)
    const isUserResponse = _message.content.text && _message.userId !== _message.agentId;
    
    // Save user response from this stage
    if (isUserResponse) {
        await saveUserResponse(_runtime, _message, "needs_matching", _message.content.text);
    }
    
    // Get comprehensive record to see all previous answers
    const comprehensiveRecord = await getComprehensiveRecord(_runtime, _message);
    const situationQAEntries = comprehensiveRecord?.situation_discovery || [];
    const lifestyleQAEntries = comprehensiveRecord?.lifestyle_discovery || [];
    const readinessQAEntries = comprehensiveRecord?.readiness_discovery || [];
    const prioritiesQAEntries = comprehensiveRecord?.priorities_discovery || [];
    
    // Get contact information for personalization
    const contactInfo = await getContactInfo(_runtime, _message);
    const useName = shouldUseName();
    const userName = useName ? await getUserFirstName(_runtime, _message) : "";
    const lovedOneName = contactInfo?.loved_one_name || "your loved one";
    const location = contactInfo?.location || "Florida";
    
    elizaLogger.info(`=== NEEDS MATCHING STAGE ===`);
    elizaLogger.info(`Current user message: ${_message.content.text}`);
    elizaLogger.info(`Is user response: ${isUserResponse}`);
    elizaLogger.info(`Using name in response: ${useName ? 'YES' : 'NO'} (${userName || 'N/A'})`);
    elizaLogger.info(`===============================`);
    
    // If this is NOT a user response (initial transition), stay in needs_matching and provide the matching response
    if (!isUserResponse) {
        // Combine all previous answers for comprehensive analysis
        elizaLogger.info("start needs matching")
        const allPreviousAnswers = [
            ...situationQAEntries.map(entry => `${entry.question}: ${entry.answer}`),
            ...lifestyleQAEntries.map(entry => `${entry.question}: ${entry.answer}`),
            ...readinessQAEntries.map(entry => `${entry.question}: ${entry.answer}`),
            ...prioritiesQAEntries.map(entry => `${entry.question}: ${entry.answer}`)
        ].join(" | ");

        const lastUserText = _message.content.text ? _message.content.text : lastUserMessage;
        
        // Generate a response that matches Grand Villa to the user's needs based on their previous answers
        const responseContext = `
            The user ${userName ? `(${userName}) ` : ''} has shared information about their situation and ${lovedOneName}'s needs throughout our discovery process.

            All previous answers: "${allPreviousAnswers}"
            User's last message" "${lastUserText}"
            User location: "${location}"

            Your task:
            1. Review all previous answers to identify one or more key concerns, preferences, or needs that matter most for ${lovedOneName}.
            2. From ${grandVillaInfo}, select:
            - The *nearest Grand Villa location* to the user's "${location}". You MUST always mention this nearest location by name in the response. Do not omit it.
            - The *most relevant, specific feature, service, or activity* that directly addresses the concern (e.g., chef-prepared meals, wellness programs, resident clubs, memory care, safety systems, transportation, etc.).
            3. Write a single empathetic response that must:
            - Start naturally with "Since you mentioned... and recap the concern.
            - Immediately highlight the *specific Grand Villa feature or service* that best matches.
            - Explicitly tie the answer to the nearest Grand Villa location (e.g., "At Grand Villa of Clearwater, residents especially enjoy...").
            - Keep the tone warm, authentic, and aligned with its natural personality.
            - Stay concise and conversational (under 60–90 words).

            Return ONLY the response text, no extra commentary or formatting.
            `;
        try {
            const aiResponse = await generateText({
                runtime: _runtime,
                context: responseContext,
                modelClass: ModelClass.MEDIUM
            });

            elizaLogger.info("chris_needsmatching", responseContext, aiResponse);
            
            const response = aiResponse || `${userName ? `${userName}, ` : ''}Based on everything you've shared about ${lovedOneName}, I can see how Grand Villa would be such a perfect fit. The community, care, and activities we offer align beautifully with what you've described. It sounds like this could really bring ${lovedOneName} the peace and joy you want for them.`;
            
            await _runtime.messageManager.createMemory({
                roomId: _message.roomId,
                userId: _message.userId,
                agentId: _message.agentId,
                content: {
                    text: response,
                    metadata: { 
                        stage: "needs_matching"
                    }
                }
            });
            
            return response;
            
        } catch (error) {
            elizaLogger.error("Failed to generate AI response:", error);
            const fallbackResponse = `${userName ? `${userName}, ` : ''}Based on everything you've shared about ${lovedOneName}, I can see how Grand Villa would be such a perfect fit. The community, care, and activities we offer align beautifully with what you've described. It sounds like this could really bring ${lovedOneName} the peace and joy you want for them.`;
            
            await _runtime.messageManager.createMemory({
                roomId: _message.roomId,
                userId: _message.userId,
                agentId: _message.agentId,
                content: {
                    text: fallbackResponse,
                    metadata: { 
                        stage: "needs_matching"
                    }
                }
            });
            
            return fallbackResponse;
        }
    }
    
    // If this IS a user response, transition to schedule_visit
    elizaLogger.info("User responded to needs matching, transitioning to schedule_visit stage");
    
    // Store the needs matching response in memory with stage transition to schedule_visit
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: {
            text: "STAGE_TRANSITION", // Placeholder that won't be shown
            metadata: { 
                stage: "schedule_visit",
                transition: true
            }
        }
    });
    
    // Let schedule visit handler create the actual response
    const transitionMessage = {
        ..._message,
        content: { text: "" }
    };
            return await handleScheduleVisit(_runtime, transitionMessage, _state, discoveryState, gracePersonality, grandVillaInfo, _message.content.text);
}

// Schedule Visit Handler - 3 iterative mini-steps using AI decision-making
async function handleScheduleVisit(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any, gracePersonality: string, grandVillaInfo: string, lastUserMessage: string): Promise<string> {
    const contactInfo = await getContactInfo(_runtime, _message);
    const userName = shouldUseName() ? await getUserFirstName(_runtime, _message) : "";
    const lovedOneName = contactInfo?.loved_one_name || "your loved one";
    
    // Save user response if provided
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "visit_scheduling", _message.content.text);
    }
    
    // Get current step status
    const stepStatus = await getVisitStepStatus(_runtime, _message);
    const lastUserText = _message.content.text || lastUserMessage;
    
    elizaLogger.info(`=== SCHEDULE VISIT - CURRENT STEP: ${stepStatus.currentStep} ===`);
    
    let response: string;
    
    switch (stepStatus.currentStep) {
        case 1:
            response = await handleStepOne(_runtime, _message, userName, lovedOneName, grandVillaInfo, lastUserText, stepStatus.isInitial);
            break;
        case 2:
            response = await handleStepTwo(_runtime, _message, userName, lovedOneName, grandVillaInfo, lastUserText);
            break;
        case 3:
            response = await handleStepThree(_runtime, _message, userName, lovedOneName, lastUserText, grandVillaInfo);
            break;
        case 4:
            response = await handleStepFour(_runtime, _message, userName, lovedOneName, lastUserText);
            break;
        case 5:
            response = await handleStepFive(_runtime, _message, userName, lovedOneName, lastUserText, grandVillaInfo);
            break;
        default:
            response = `${userName ? `${userName}, ` : ''}I'd love to help you schedule a visit to Grand Villa. Would you be interested in seeing our community in person?`;
    }
    
    setGlobalResponseStatus("Normal situation");
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: { text: response, metadata: { stage: "schedule_visit", responseStatus: "Normal situation" } }
    });
    
    return response;
}

// Get current step status
async function getVisitStepStatus(_runtime: IAgentRuntime, _message: Memory): Promise<{currentStep: number, isInitial: boolean}> {
    const comprehensiveRecord = await getComprehensiveRecord(_runtime, _message);
    const visitEntries = comprehensiveRecord?.visit_scheduling || [];
    
    const hasAgreedToVisit = visitEntries.some(entry => entry.question === "visit_agreement");
    const hasConfirmedTime = visitEntries.some(entry => entry.question === "time_confirmation");
    const hasProvidedEmail = visitEntries.some(entry => entry.question === "email_collection");
    const hasProvidedReferral = visitEntries.some(entry => entry.question === "referral_source");
    
    if (hasProvidedReferral) return {currentStep: 5, isInitial: false};
    if (hasProvidedEmail) return {currentStep: 4, isInitial: false}; // Done
    if (hasConfirmedTime) return {currentStep: 3, isInitial: false}; // Email step
    if (hasAgreedToVisit) return {currentStep: 2, isInitial: false}; // Time step
    
    const isInitial = !_message.content.text || _message.content.text === "";
    return {currentStep: 1, isInitial}; // Visit agreement step
}

// Step 1: Guide to visit and get agreement
async function handleStepOne(_runtime: IAgentRuntime, _message: Memory, userName: string, lovedOneName: string, grandVillaInfo: string, lastUserText: string, isInitial: boolean): Promise<string> {
    // if (isInitial) {
        // Check if user has already agreed to visit
        const comprehensiveRecord = await getComprehensiveRecord(_runtime, _message);
        const visitEntries = comprehensiveRecord?.visit_scheduling || [];
        const hasAgreedToVisit = visitEntries.some(entry => entry.question === "visit_agreement");
        
        if (hasAgreedToVisit) {
            // User already agreed, move to step 2
            return "Wonderful! How about Wednesday at 5pm? Does that work for you?";
        }

        const situationQAEntries = comprehensiveRecord?.situation_discovery || [];
        const lifestyleQAEntries = comprehensiveRecord?.lifestyle_discovery || [];
        const readinessQAEntries = comprehensiveRecord?.readiness_discovery || [];
        const prioritiesQAEntries = comprehensiveRecord?.priorities_discovery || [];
        const allPreviousAnswers = [
                    ...situationQAEntries.map(entry => `${entry.question}: ${entry.answer}`),
                    ...lifestyleQAEntries.map(entry => `${entry.question}: ${entry.answer}`),
                    ...readinessQAEntries.map(entry => `${entry.question}: ${entry.answer}`),
                    ...prioritiesQAEntries.map(entry => `${entry.question}: ${entry.answer}`)
                ].join(" | ");

        
        if (!isInitial) {
            // Analyze user response to see if they agreed
            const analysisContext = `Analyze the following user response: "${lastUserText}"

                Task: Determine if the user has AGREED to schedule/attend a visit to the villa/community.

                Rules:
                - Agreement = clear confirmation (e.g., "yes", "sure", "okay", "interested", "sounds good", "let's do it", "I'd like to visit", or user asking practical questions about the visit like time, place, etc.).
                - Partial agreement = positive but uncertain (e.g., "maybe", "I'll think about it", "need more info"). Treat this as not agreed.
                - Decline = clear rejection (e.g., "no", "not interested", "can't", "don't want to").
                - If unclear, default to {"agreed": true}.

                Output:
                - If {"agreed": true}, respond to the user's message in a natural, conversational way (acknowledge or engage with what they said), and then smoothly ask:
                would Wednesday at 5pm work for you to visit?, keep the words under 50.
                - If {"agreed": false}, return a natural response to the user's message without suggesting a time.

                Return ONLY a JSON object in this format:
                {"agreed": true/false, "response": "your natural response here"}`;
            
            try {
                const analysis = await generateText({runtime: _runtime, context: analysisContext, modelClass: ModelClass.SMALL});
                elizaLogger.info(`Step 1 analysis result: ${analysis}`);
                
                const result = JSON.parse(analysis);
                
                if (result.agreed) {
                    // User agreed - save and move to step 2
                    await updateComprehensiveRecord(_runtime, _message, {
                        visit_scheduling: [{question: "visit_agreement", answer: lastUserText, timestamp: new Date().toISOString()}]
                    });
                    return result.response;
                }
            } catch (error) {
                elizaLogger.error("Error in step one analysis:", error);
            }
        }
                
        // User hasn't agreed yet - return encouraging response with Grand Villa info
        const encourageContext = `
            The user (${userName}) just responded: "${lastUserText}" but hasn't agreed to visit yet.  
            Full conversation history with the user is: ${allPreviousAnswers}  

            Task:  
            - Carefully analyze the user's past answers to find their key concerns, curiosities, or things they seemed to like.  
            - Use that context to craft a reply that feels personal, empathetic, and relevant.  

            Your response must:  
            1. Acknowledge their latest message in a natural, human way.  
            2. Directly connect to one of their past concerns, curiosities, or likes.  
            3. Explain briefly why actually visiting Grand Villa (using this info: "${grandVillaInfo}") would help them explore or resolve that point.  
            4. Encourage them to come see it in person for ${lovedOneName}, framed as the best way to know if it's the right fit.  
            5. Keep it under 50 words, friendly and conversational.  
            6. Avoid generic greetings (like "Hi" or "Hello") since this is near the end of the conversation.  

            Return only the final conversational response (no explanations).`;
        
        return await generateResponse(_runtime, encourageContext) || 
               `${userName ? `${userName}, ` : ''}I understand. Seeing Grand Villa in person really helps families feel confident about their decision. Would you like to schedule a brief visit to see if it feels right for ${lovedOneName}?`;
    // }
    
    // This should not be reached since we handle everything in isInitial now
    // return `${userName ? `${userName}, ` : ''}Would you be interested in scheduling a visit to see Grand Villa in person?`;
}

// Step 2: Time confirmation
async function handleStepTwo(
    _runtime: IAgentRuntime,
    _message: Memory,
    userName: string,
    lovedOneName: string,
    grandVillaInfo: string,
    lastUserText: string
  ): Promise<string> {
    // AI analysis of time response
    const analysisContext = `
        Analyze this response about scheduling Wednesday 5pm: "${lastUserText}"
        Task: Determine scheduling intent.
        Rules:
        - Confirmed = clear acceptance (e.g., "yes, that works", "sounds good", "okay, Wednesday 5pm is fine").
        - Alternative = any mention of a different date or time.
        - Rejected = "no", "can't", "doesn't work", without giving alternative.
        - If unclear, default to {"confirmed": false, "rejected": false, "alternative_time": null}.
        Output JSON only:
        {"confirmed": true/false, "rejected": true/false, "alternative_time": "string or null", "reasoning": "brief reasoning"}
        `;
  
    try {
      const analysis = await generateText({
        runtime: _runtime,
        context: analysisContext,
        modelClass: ModelClass.SMALL
      });
  
      elizaLogger.info(`Step 2 analysis result: ${analysis}`);
      const result = JSON.parse(analysis);
  
      if (result.confirmed && !result.rejected) {
        // User confirmed Wednesday 5pm
        await updateComprehensiveRecord(_runtime, _message, {
          visit_scheduling: [{
            question: "time_confirmation",
            answer: "Wednesday 5pm",
            timestamp: new Date().toISOString()
          }]
        });
        return `Perfect! Wednesday at 5pm it is. Which email should I send the calendar invite and visit details to?`;
      }
  
      if (result.alternative_time) {
        // User suggested alternative time
        await updateComprehensiveRecord(_runtime, _message, {
          visit_scheduling: [{
            question: "time_confirmation",
            answer: result.alternative_time,
            timestamp: new Date().toISOString()
          }]
        });
        return `Got it, ${result.alternative_time} works. Which email should I send the calendar invite and details to?`;
      }
  
      if (result.rejected && !result.alternative_time) {
        // User rejected without alternative - use Villa info to ease concern & re-ask
        const encourageContext = `
        The user said: "${lastUserText}" and rejected Wednesday 5pm without suggesting another time.
        Task:
        - Respond naturally, empathetic tone.
        - Mention something helpful about Grand Villa: "${grandVillaInfo}".
        - Encourage them to pick another time for ${lovedOneName}.
        - Keep it under 50 words, conversational.
        Return only the response.
        `;
        return await generateResponse(_runtime, encourageContext) ||
          `${userName ? userName + ", " : ""}no problem at all. When would be a better time to visit Grand Villa for ${lovedOneName}?`;
      }
  
      // Unclear response - ask again
      return `${userName ? userName + ", " : ""}just to confirm — does Wednesday at 5pm work, or would you like a different time?`;
  
    } catch (error) {
      elizaLogger.error("Error in step two analysis:", error);
      return `${userName ? userName + ", " : ""}does Wednesday at 5pm work for you, or is there a better time that suits your schedule?`;
    }
  }

// Step 3: Email collection
async function handleStepThree(
    _runtime: IAgentRuntime,
    _message: Memory,
    userName: string,
    lovedOneName: string,
    lastUserText: string,
    grandVillaInfo: string
): Promise<string> {
    // Ask AI to extract email
    const analysisContext = `
    Analyze the following user response: "${lastUserText}"
    Task: Extract a valid email address if provided, even if it's written informally (e.g., "john dot doe at gmail dot com").
    Output JSON only:
    {"email": "normalized email string or null", "reasoning": "short explanation"}
    `;

    try {
        const analysis = await generateText({
            runtime: _runtime,
            context: analysisContext,
            modelClass: ModelClass.SMALL
        });

        elizaLogger.info(`Step 3 email analysis result: ${analysis}`);
        
        // Clean the analysis result to handle markdown code blocks
        let cleanedAnalysis = analysis.trim();
        if (cleanedAnalysis.startsWith('```json')) {
            cleanedAnalysis = cleanedAnalysis.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedAnalysis.startsWith('```')) {
            cleanedAnalysis = cleanedAnalysis.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        const result = JSON.parse(cleanedAnalysis);

        // Fallback regex detection if AI fails
        let email = result.email;
        if (!email) {
            const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
            const emailMatch = lastUserText.match(emailRegex);
            if (emailMatch) email = emailMatch[0];
        }

        if (email) {
            // Email found — save and complete
            await updateComprehensiveRecord(_runtime, _message, {
                visit_scheduling: [{
                    question: "email_collection",
                    answer: email,
                    timestamp: new Date().toISOString()
                }]
            });

            // Send comprehensive records to max.franklin.tech@gmail.com
            try {
                const comprehensiveRecord = await getComprehensiveRecord(_runtime, _message);
                if (comprehensiveRecord) {
                    await EmailService.sendComprehensiveRecords(email, comprehensiveRecord);
                    elizaLogger.info("📧 Comprehensive records sent to ", email);
                } else {
                    elizaLogger.warn("⚠️ No comprehensive records found to send");
                }
            } catch (emailError) {
                elizaLogger.error("❌ Failed to send comprehensive records:", emailError);
            }

            const goodbyeContext = `
                The user's name is ${userName || "the guest"} and their loved one is ${lovedOneName}.
                We just confirmed their email: ${email}.
                Reference information about Grand Villa: ${grandVillaInfo}

                Task:
                - Write a warm, natural closing message under 50 words.
                - Confirm we'll send a confirmation email to ${email} shortly.
                - Express genuine gratitude and excitement about welcoming ${userName} and ${lovedOneName} to Grand Villa
                - Keep it friendly, conversational, and final (no more questions about logistics).
                - Smoothly transition into asking how they first heard about Grand Villa or what brought them to us, so it feels natural and inviting and END THE CONVERSATION WITH THAT QUESTION!!
                Return only the message text.
                `;

            return await generateResponse(_runtime, goodbyeContext) ||
                `Perfect! I've got you all set up with ${email}. You'll receive a confirmation email shortly with all the visit details. Thank you ${userName ? userName : ''}, and I look forward to welcoming you and ${lovedOneName} to Grand Villa soon!`;
        }

        // No valid email found — politely ask again
        const emailContext = `
        The user responded: "${lastUserText}" but didn't provide a valid email.
        Create a warm, polite response asking for their email to send the visit confirmation.
        Keep it natural, friendly, and under 40 words.
        `;
        return await generateResponse(_runtime, emailContext) ||
            `${userName ? `${userName}, ` : ''}I'll need your email address to send you the visit confirmation and details. What email should I use?`;

    } catch (error) {
        elizaLogger.error("Error in step three analysis:", error);
        return `${userName ? `${userName}, ` : ''}could you please share your email so I can send the visit confirmation and details?`;
    }
}

async function handleStepFour(
    _runtime: IAgentRuntime,
    _message: Memory,
    userName: string,
    lovedOneName: string,
    lastUserText: string
): Promise<string> {
    const comprehensiveRecord = await getComprehensiveRecord(_runtime, _message);
    const visitEntries = comprehensiveRecord?.visit_scheduling || [];
    const timeConfirmationEntry = visitEntries.find(entry => entry.question === "time_confirmation");
    const confirmedTime = timeConfirmationEntry?.answer || "Wednesday at 5pm"; 

    await updateComprehensiveRecord(_runtime, _message, {
        visit_scheduling: [{
            question: "referral_source",
            answer: lastUserText,
            timestamp: new Date().toISOString()
        }]
    });
    const finalContext = `
    The user just told hos how they heard about Grand Villa: ${lastUserText}
    User's name is ${userName} and their loved one is ${lovedOneName}.
    
    Task: Write a warm, natural final message that:
    1. Acknowledges their referral source naturally
    2. Mentions that when they visit, the community team will show them around and answer questions about care levels and pricing
    3. Expresses gratitude for trusting you to help guide them through this important decision for ${lovedOneName}
    4. Confirms you look forward to seeing them ${confirmedTime}
    5. Keep it conversational and under 60 words
    6. Make it feel like a natural conclusion to the conversation
    
    Return only the message text.
    `
    return await generateResponse(_runtime, finalContext) ||
    `${userName ? `${userName}, ` : ''}When you visit, our community team will show you around and can answer any specific questions about care levels and pricing. Thank you for trusting me to help guide you through this important decision for ${lovedOneName}. I look forward to seeing you Wednesday.`;
}

// Step 5: Final conversation handling
async function handleStepFive(
    _runtime: IAgentRuntime,
    _message: Memory,
    userName: string,
    lovedOneName: string,
    lastUserText: string,
    grandVillaInfo: string
): Promise<string> {
    // The conversation has ended, respond generally to user's last response
    const generalResponseContext = `
        The user responded: "${lastUserText}"
        This is after we've completed the visit scheduling process.
        Their name is ${userName || "the guest"} and their loved one is ${lovedOneName}.
        Reference information about Grand Villa: ${grandVillaInfo}

        Task: Provide a warm, supportive closing-style response to their message.
        - Do not start with greetings, it's the last step of conversation (no "Hi" or "Hello").
        - Be natural, concise, and under 50 words.
        - If they have questions about the visit or Grand Villa, answer them helpfully.
        - Keep the tone friendly, grateful, and final since this is the last step of the conversation.

        Return only the response text.
        `;

    return await generateResponse(_runtime, generalResponseContext) ||
        `${userName ? `${userName}, ` : ''}I'm here if you have any other questions about your visit or Grand Villa. Looking forward to seeing you Wednesday!`;
}


// Simple AI response generator
async function generateResponse(_runtime: IAgentRuntime, context: string): Promise<string | null> {
    try {
        return await generateText({runtime: _runtime, context, modelClass: ModelClass.MEDIUM});
    } catch (error) {
        elizaLogger.error("Error generating response:", error);
        return null;
    }
}

async function determineConversationStage(_runtime: IAgentRuntime, _message: Memory, discoveryState: any): Promise<string> {
    elizaLogger.info(`Determining conversation stage with state: ${JSON.stringify(discoveryState)}`);
    
    // Get the last agent message to see what stage was set
    const lastAgentMessage = await getLastAgentMessage(_runtime, _message);
    const lastStage = lastAgentMessage?.content?.metadata ? (lastAgentMessage.content.metadata as { stage?: string }).stage : undefined;
    
    elizaLogger.info(`Last agent message stage: ${lastStage}`);
    
    // If we have a stage from the last agent message, use that
    if (lastStage) {
        elizaLogger.info(`Using stage from last agent message: ${lastStage}`);
        return lastStage;
    }
    
    // If no state exists, start with trust building
    if (!discoveryState) {
        elizaLogger.info("No discovery state found, starting with trust building");
        return "trust_building";
    }

    // If we have a current stage, stay in it until all questions are answered
    if (discoveryState.currentStage) {
        elizaLogger.info(`Using existing stage: ${discoveryState.currentStage}`);
        return discoveryState.currentStage;
    }

    // Default to trust building
    elizaLogger.info("Defaulting to trust building");
    return "trust_building";
}

// Helper function to randomly decide whether to use user's name (feels more natural)
function shouldUseName(): boolean {
    return Math.random() < 0.5; // 50% chance to use name
}

// Helper function to get user's first name for personalization
async function getUserFirstName(_runtime: IAgentRuntime, _message: Memory): Promise<string> {
    const contactInfo = await getContactInfo(_runtime, _message);
    
    if (contactInfo?.name) {
        const cleanName = contactInfo.name.trim();
        if (cleanName) {
            const firstName = cleanName.split(/\s+/)[0];
            elizaLogger.info(`getUserFirstName - extracted firstName: "${firstName}"`);
            return firstName;
        }
    }
    
    elizaLogger.info(`getUserFirstName - no name found, returning empty string`);
    return "";
}

// Helper function to get stored contact information
async function getContactInfo(_runtime: IAgentRuntime, _message: Memory): Promise<{name?: string, location?: string, loved_one_name?: string} | null> {
    try {
        // First try to get from comprehensive record
        const comprehensiveRecord = await getComprehensiveRecord(_runtime, _message);
        if (comprehensiveRecord?.contact_info) {
            const contactInfo = comprehensiveRecord.contact_info;
            elizaLogger.info(`getContactInfo - RAW comprehensive record: ${JSON.stringify(comprehensiveRecord)}`);
            elizaLogger.info(`getContactInfo - RAW contact_info: ${JSON.stringify(contactInfo)}`);
            elizaLogger.info(`getContactInfo - from comprehensive record: Name=${contactInfo.name}, Location=${contactInfo.location}, Loved One=${contactInfo.loved_one_name}`);
            return { 
                name: contactInfo.name, 
                location: contactInfo.location, 
                loved_one_name: contactInfo.loved_one_name 
            };
        }
        
        // Fallback to old method for backwards compatibility
        const userResponses = await getUserResponses(_runtime, _message);
        elizaLogger.info(`getContactInfo - userResponses: ${JSON.stringify(userResponses)}`);
        
        const contactInfoArray = userResponses.contact_info || [];
        elizaLogger.info(`getContactInfo - contactInfoArray length: ${contactInfoArray.length}`);
        elizaLogger.info(`getContactInfo - contactInfoArray: ${JSON.stringify(contactInfoArray)}`);
        
        if (contactInfoArray.length > 0) {
            const latestContactInfo = contactInfoArray[contactInfoArray.length - 1];
            elizaLogger.info(`getContactInfo - latestContactInfo (raw): ${latestContactInfo}`);
            
            // Handle the messy format: "[Discovery Response] {"name":"Chris","location":"..."}"
            let cleanJsonString = latestContactInfo;
            
            // If it starts with "[Discovery Response]", extract the JSON part
            if (typeof cleanJsonString === 'string' && cleanJsonString.includes('[Discovery Response]')) {
                const jsonStart = cleanJsonString.indexOf('{');
                if (jsonStart !== -1) {
                    cleanJsonString = cleanJsonString.substring(jsonStart);
                    elizaLogger.info(`getContactInfo - extracted JSON part: ${cleanJsonString}`);
                }
            }
            
            const parsed = JSON.parse(cleanJsonString);
            elizaLogger.info(`getContactInfo - parsed: ${JSON.stringify(parsed)}`);
            elizaLogger.info(`Retrieved contact info: Name=${parsed.name}, Location=${parsed.location}, Loved One=${parsed.loved_one_name}`);
            return { name: parsed.name, location: parsed.location, loved_one_name: parsed.loved_one_name };
        }
        
        elizaLogger.info(`getContactInfo - no contact info found`);
    } catch (error) {
        elizaLogger.error("Error retrieving contact info:", error);
    }
    
    return null;
}

// Helper function to get the last agent message
async function getLastAgentMessage(_runtime: IAgentRuntime, _message: Memory): Promise<Memory | null> {
    const allMemories = await _runtime.messageManager.getMemories({
        roomId: _message.roomId,
        count: 10
    });
    
    // Find the most recent agent message
    const agentMessages = allMemories
        .filter(mem => mem.userId === _message.agentId)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    
    return agentMessages.length > 0 ? agentMessages[0] : null;
}

// Helper function to get user answers from a specific stage
async function getUserAnswersFromStage(_runtime: IAgentRuntime, _message: Memory, stage: string): Promise<string[]> {
    const allMemories = await _runtime.messageManager.getMemories({
        roomId: _message.roomId,
        count: 50
    });
    
    // Filter memories to only include those from this specific user or agent
    const memories = allMemories.filter(mem => 
        mem.userId === _message.userId || mem.userId === _message.agentId
    );
    
    const userAnswers: string[] = [];
    let stageStartIndex = -1;
    let stageEndIndex = -1;
    
    // Sort memories by creation time (oldest first) to process conversation chronologically
    const sortedMemories = memories.sort((a, b) => 
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
    
    elizaLogger.info(`Looking for user answers in ${stage} stage from ${sortedMemories.length} memories`);
    elizaLogger.info(`Agent ID: ${_message.agentId}`);
    
    // Log all memories for debugging
    sortedMemories.forEach((memory, index) => {
        const metadata = memory.content.metadata as { stage?: string } | undefined;
        elizaLogger.info(`Memory ${index}: userId=${memory.userId}, agentId=${_message.agentId}, isAgent=${memory.userId === _message.agentId}, text="${memory.content.text}", metadata=${JSON.stringify(metadata)}, createdAt=${memory.createdAt}`);
    });
    
    // Find the start and end of the target stage
    for (let i = 0; i < sortedMemories.length; i++) {
        const memory = sortedMemories[i];
        const metadata = memory.content.metadata as { stage?: string } | undefined;
        
        // Find when we enter the target stage
        if (metadata?.stage === stage && memory.userId === _message.agentId && stageStartIndex === -1) {
            stageStartIndex = i;
            elizaLogger.info(`Found start of ${stage} stage at index ${i}: ${memory.content.text}`);
        }
        
        // Find when we exit the target stage (next agent message with different stage)
        if (stageStartIndex !== -1 && metadata?.stage && metadata.stage !== stage && memory.userId === _message.agentId) {
            stageEndIndex = i;
            elizaLogger.info(`Found end of ${stage} stage at index ${i}: ${memory.content.text}`);
            break;
        }
    }
    
    // If we found the stage start but no end, collect until the end of memories
    if (stageStartIndex !== -1 && stageEndIndex === -1) {
        stageEndIndex = sortedMemories.length;
        elizaLogger.info(`Stage ${stage} continues to end of conversation`);
    }
    
    // Collect user messages within the stage boundaries (ONLY from current user)
    if (stageStartIndex !== -1) {
        for (let i = stageStartIndex + 1; i < stageEndIndex; i++) {
            const memory = sortedMemories[i];
            if (memory.userId === _message.userId && memory.userId !== _message.agentId) {
                userAnswers.push(memory.content.text);
                elizaLogger.info(`🔒 Collected user answer in ${stage} from user ${_message.userId}: ${memory.content.text}`);
            }
        }
    } else {
        elizaLogger.info(`No messages found for stage: ${stage}`);
    }
    
    elizaLogger.info(`Collected ${userAnswers.length} user answers from ${stage} stage: ${JSON.stringify(userAnswers)}`);
    return userAnswers;
}

async function handleGeneralInquiry(_runtime: IAgentRuntime, _message: Memory, _state: State, gracePersonality: string, grandVillaInfo: string): Promise<string> {
    return "I'd be happy to help you learn more about Grand Villa. What would you like to know?";
}