import { Action, generateText, IAgentRuntime, Memory, ModelClass, State, HandlerCallback, elizaLogger } from "@elizaos/core";
import { discoveryStateProvider, saveUserResponse, getUserResponses, updateUserStatus } from "../providers/discovery-state.js";



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
  'https://eliza-scheduler-production.up.railway.app/';

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
        - If it's a question, answer clearly using grandvilla_information: "${grandVillaInfo}".  
            If info is missing, search online and give the most accurate answer.
        - Never share about exact pricing or pricing-related answers unless the user directly asks about pricing.
        - If it's about the loved one's likes, interests, hobbies or activities they enjoy or used to, find the similar activities or services in grandvilla_information and match their needs naturally.
        - If it's a pricing question:
            • Share the pricing for the closest Grand Villa to "${location}" using the exact details from grandvilla_information.  
            • Add that pricing depends on the level of care and services chosen.  
            • Suggest that visiting the community in person will give the most accurate understanding of costs.  
        - If they complain about too many questions or timing, empathize, explain why we ask these, and lighten the mood with a friendly or humorous remark.
        - Smoothly connect back to "${nextQuestion}" in a natural, conversational way.
        - Keep response within 50–70 words.
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
        • Phrases like "I'd like to know…", "tell me…", "can you explain…", "curious about…"
        • Requests for extra details about pricing, services, amenities, locations, or policies
        • Expressions of frustration, confusion, or complaints ("too many questions", "when does this end?")
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
        - If it's a question, answer clearly using grandvilla_information: "${grandVillaInfo}".  
            If info is missing, search online and give the most accurate answer.
        - Never share about exact pricing or pricing-related answers unless the user directly asks about pricing.
        - If it's about the loved one's likes, interests, hobbies or activities they enjoy or used to, find the similar activities or services in grandvilla_information and match their needs naturally.
        - If it's a pricing question:
            • Share the pricing for the closest Grand Villa to "${location}" using the exact details from grandvilla_information.  
            • Add that pricing depends on the level of care and services chosen.  
            • Suggest that visiting the community in person will give the most accurate understanding of costs.  
        - If they complain about too many questions or timing, empathize, explain why we ask these, and lighten the mood with a friendly or humorous remark.
        - Smoothly connect back to "${nextQuestion}" in a natural, conversational way.
        - Keep response within 50–70 words.
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
        • Phrases like "I'd like to know…", "tell me…", "can you explain…", "curious about…"
        • Requests for extra details about pricing, services, amenities, locations, or policies
        • Expressions of frustration, confusion, or complaints ("too many questions", "when does this end?")
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
        - If it's a question, answer clearly using grandvilla_information: "${grandVillaInfo}".  
            If info is missing, search online and give the most accurate answer.
        - Never share about exact pricing or pricing-related answers unless the user directly asks about pricing.
        - If it's about the loved one's likes, interests, hobbies or activities they enjoy or used to, find the similar activities or services in grandvilla_information and match their needs naturally.
        - If it's a pricing question:
            • Share the pricing for the closest Grand Villa to "${location}" using the exact details from grandvilla_information.  
            • Add that pricing depends on the level of care and services chosen.  
            • Suggest that visiting the community in person will give the most accurate understanding of costs.  
        - If they complain about too many questions or timing, empathize, explain why we ask these, and lighten the mood with a friendly or humorous remark.
        - Smoothly connect back to "${nextQuestion}" in a natural, conversational way.
        - Keep response within 50–70 words.
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
        "What's most important to you regarding the community you may choose?",
        "What would make you feel confident that this is the right decision for your family?"
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
        • Phrases like "I'd like to know…", "tell me…", "can you explain…", "curious about…"
        • Requests for extra details about pricing, services, amenities, locations, or policies
        • Expressions of frustration, confusion, or complaints ("too many questions", "when does this end?")
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
        - If it's a question, answer clearly using grandvilla_information: "${grandVillaInfo}".  
            If info is missing, search online and give the most accurate answer.
        - If it's about the loved one's likes, interests, hobbies or activities they enjoy or used to, find the similar activities or services in grandvilla_information and match their needs naturally.
        - Never share about exact pricing or pricing-related answers unless the user directly asks about pricing.
        - If it's a pricing question:
            • Share the pricing for the closest Grand Villa to "${location}" using the exact details from grandvilla_information.  
            • Add that pricing depends on the level of care and services chosen.  
            • Suggest that visiting the community in person will give the most accurate understanding of costs.  
        - If they complain about too many questions or timing, empathize, explain why we ask these, and lighten the mood with a friendly or humorous remark.
        - Smoothly connect back to "${nextQuestion}" in a natural, conversational way.
        - Keep response within 50–70 words.
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

// Schedule Visit Handler — strict anchor to last awaiting_email proposal + conflict-safe + user-only history + 48h default + biz hours + idempotent
async function handleScheduleVisit(
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
    _discoveryState: any,
    _gracePersonality: string,
    _grandVillaInfo: string,
    _lastUserMessage: string
  ): Promise<string> {
    elizaLogger.info("Handling schedule visit (strict anchor to awaiting_email + conflict-safe + user-only history)");
     // ---------- Config ----------
    const TZ = ((globalThis as any).DEFAULT_TZ ?? "America/New_York") as string;
    const DEDUPE_WINDOW_MIN = 5;
    const HISTORY_SCAN_COUNT = 80;            // scan more to be safe
    const RECENT_WINDOW_MS = 15 * 60 * 1000;  // last 15 minutes for time-ish mentions
     // ---------- Tiny helpers ----------
    function equalWithinMinutes(aIso: string, bIso: string, minutes = DEDUPE_WINDOW_MIN): boolean {
      const diff = Math.abs(new Date(aIso).getTime() - new Date(bIso).getTime());
      return diff <= minutes * 60 * 1000;
    }
    function formatWhenTZ(iso: string, tz = TZ): string {
      return new Date(iso).toLocaleString("en-US", {
        timeZone: tz,
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
    function looksAffirmative(text: string): boolean {
      const t = (text || "").toLowerCase().trim();
      return /\b(yes|yep|yeah|ok|okay|sure|works|sounds good|that works|good|great|confirm)\b/.test(t);
    }
    function looksNegative(text: string): boolean {
      const t = (text || "").toLowerCase();
      return /\b(no|nope|nah|doesn'?t work|does not work|not good|can'?t|won'?t|resched|reschedule|another time|different time|change time)\b/.test(t);
    }
    function extractEmail(text: string): string | null {
      if (!text || !text.includes("@")) return null; // MUST contain '@'
      return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
    }
    function looksTimeish(text: string): boolean {
      const t = (text || "").toLowerCase();
      if (t.includes("@")) return false; // never confuse emails with time
      return (
        /\b(\d{1,2})(?::\d{2})?\s*(am|pm)\b/i.test(t) ||
        /\b\d{1,2}:\d{2}\b/.test(t) ||
        /\b(mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\b/i.test(t) ||
        /\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/i.test(t) ||
        /\b(morning|afternoon|evening|night|noon|midday|tomorrow|today|next)\b/i.test(t)
      );
    }
    function looksLikeDefaultPrompt(s: string): boolean {
      const t = (s || "").toLowerCase();
      return t.includes("diana can do") && t.includes("does that time work?");
    }
    function memTimestamp(m: Memory): number {
      const v: any = (m as any)?.createdAt ?? (m as any)?.timestamp ?? Date.now();
      return typeof v === "number" ? v : new Date(v).getTime();
    }
     // ---------- Memory helpers ----------
    async function findExistingBooking(
      roomId: string
    ): Promise<null | { eventId: string; startIso: string; htmlLink?: string; email?: string }> {
      const memories = await _runtime.messageManager.getMemories({
        roomId: roomId as `${string}-${string}-${string}-${string}-${string}`,
        count: 60,
      });
      for (let i = memories.length - 1; i >= 0; i--) {
        const md = memories[i]?.content?.metadata as any;
        if (md?.stage === "schedule_visit" && md?.visit_scheduled && md?.eventId && md?.startIso) {
          return { eventId: md.eventId, startIso: md.startIso, htmlLink: md.htmlLink, email: md.email ?? null };
        }
      }
      return null;
    }
     type Ctx =
      | { status: "awaiting_email"; proposedStartIso: string }
      | { status: "awaiting_alt_time"; proposedStartIso?: string }
      | { status: "proposed"; proposedStartIso: string }
      | { status: "booked"; eventId: string; startIso: string; email?: string }
      | { status: "none" };
     async function getContext(roomId: string): Promise<Ctx> {
      const mems = await _runtime.messageManager.getMemories({
        roomId: roomId as `${string}-${string}-${string}-${string}-${string}`,
        count: 60,
      });
      for (let i = mems.length - 1; i >= 0; i--) {
        const md = mems[i]?.content?.metadata as any;
        if (md?.stage === "schedule_visit") {
          if (md?.visit_scheduled && md?.eventId && md?.startIso) return { status: "booked", eventId: md.eventId, startIso: md.startIso, email: md.email };
          if (md?.awaiting_email && md?.proposedStartIso)           return { status: "awaiting_email", proposedStartIso: md.proposedStartIso };
          if (md?.awaiting_alt_time)                                return { status: "awaiting_alt_time", proposedStartIso: md?.proposedStartIso };
          if (md?.proposedStartIso)                                 return { status: "proposed", proposedStartIso: md.proposedStartIso };
        }
      }
      return { status: "none" };
    }
     async function getLastAgentMessage(): Promise<Memory | null> {
      const mems = await _runtime.messageManager.getMemories({
        roomId: _message.roomId as `${string}-${string}-${string}-${string}-${string}`,
        count: 30,
      });
      for (let i = mems.length - 1; i >= 0; i--) {
        if (mems[i]?.agentId === _message.agentId && typeof mems[i]?.content?.text === "string") return mems[i] as any;
      }
      return null;
    }
     // Strictly pick the right slot when the user provides an email.
    // Priority:
    //   1) Most recent memory with stage=schedule_visit AND awaiting_email=true AND proposedStartIso (our "Let's target … please enter email" turn)
    //   2) Most recent AGENT memory with proposedStartIso (e.g., "Let's target Wed 4pm …")
    //   3) Most recent USER message (not agent) that looks time-ish in the last 15 min → parse
    //   4) Fallback to default
    async function pickAnchoredIsoForEmail(): Promise<{ iso: string; source: string }> {
      const mems = await _runtime.messageManager.getMemories({
        roomId: _message.roomId as `${string}-${string}-${string}-${string}-${string}`,
        count: HISTORY_SCAN_COUNT,
      });
       // 1) awaiting_email=true with proposedStartIso
      for (let i = mems.length - 1; i >= 0; i--) {
        const md = (mems[i]?.content?.metadata as any) || {};
        if (md?.stage === "schedule_visit" && md?.awaiting_email && md?.proposedStartIso) {
          return { iso: md.proposedStartIso, source: "awaiting_email" };
        }
      }
       // 2) latest AGENT proposedStartIso
      for (let i = mems.length - 1; i >= 0; i--) {
        const m = mems[i];
        if (m?.agentId !== _message.agentId) continue;
        const md = (m?.content?.metadata as any) || {};
        if (md?.stage === "schedule_visit" && md?.proposedStartIso) {
          return { iso: md.proposedStartIso, source: "agent_meta" };
        }
      }
       // 3) recent USER-only time-ish text (ignore agent prompts to avoid anchoring to default)
      const now = Date.now();
      for (let i = mems.length - 1; i >= 0; i--) {
        const m = mems[i];
        if (m?.agentId === _message.agentId) continue; // user-only
        const txt = (m?.content?.text || "") as string;
        if (!txt) continue;
        const ts = memTimestamp(m);
        if (now - ts > RECENT_WINDOW_MS) break;
        if (looksTimeish(txt)) {
          const parsed = resolveStartFromLabel(txt);
          if (parsed) return { iso: parsed, source: "user_recent_time" };
        }
      }
       // 4) default
      return { iso: iso48hFromNow(), source: "default" };
    }
     // ---------- Inputs ----------
    const currentTurnText = (_message.content?.text ?? "").trim();
    const userText = (currentTurnText || _lastUserMessage || "").trim();
    const meta = (_message.content?.metadata as any) || {};
    const isStageEnter = currentTurnText.length === 0 || /^stage_transition$/i.test(currentTurnText) || meta?.stage_transition === true;
     const defaultIso = iso48hFromNow();
    const defaultWhen = formatWhenTZ(defaultIso);
    const ctx = await getContext(_message.roomId);
    
    // Main process logging
    elizaLogger.info(`MAIN PROCESS: userText="${userText}", ctx.status="${ctx.status}", isStageEnter=${isStageEnter}`);
    
    // ---------- First-time entry check ----------
    // If this is a stage transition, show initial prompt regardless of previous context
    // This ensures the initial prompt is always shown when entering the schedule_visit stage
    if (isStageEnter) {
      elizaLogger.info("PROCESS: Stage transition to schedule_visit → showing initial prompt");
      const prompt =
        `Diana can do ${defaultWhen}. ` +
        `Does that time work? If YES, please enter your email. If NO, please reply with a new day & time (e.g., "Wed 4pm").Please note visit time must be between 10am-5pm Monday-Friday.`;
      await _runtime.messageManager.createMemory({
        roomId: _message.roomId, userId: _message.userId, agentId: _message.agentId,
        content: { text: prompt, metadata: { stage: "schedule_visit", proposedStartIso: defaultIso, awaiting_email: false } },
      });
      setGlobalResponseStatus("Normal situation");
      return prompt;
    }
     // ---------- Stage-enter suppression while waiting ----------
    if (isStageEnter && (ctx.status === "awaiting_email" || ctx.status === "awaiting_alt_time")) {
      elizaLogger.info("PROCESS: Stage-enter suppression → returning empty");
      elizaLogger.info("Stage-enter while awaiting info → suppress prompt.");
      setGlobalResponseStatus("Normal situation");
      return "";
    }
     // ---------- 1) EMAIL present → strictly anchor to last "awaiting_email" proposal ----------
    const email = extractEmail(userText);
    if (email) {
      elizaLogger.info("PROCESS: Email detected → attempting booking");
      const anchor = await pickAnchoredIsoForEmail();
      const proposedIso = anchor.iso;
      const chosenSource = anchor.source;
      elizaLogger.info(`Email received; strictly anchoring to: ${chosenSource} => ${proposedIso}`);
       // Idempotency: already booked for same slot?
      const existing = await findExistingBooking(_message.roomId);
      if (existing?.startIso && equalWithinMinutes(existing.startIso, proposedIso)) {
        elizaLogger.info("chris_sch: confirmation");
        const confirmation =
          `Great news—your tour with Diana is already booked for ${formatWhenTZ(existing.startIso)}. ` +
          `I've sent a calendar invite to ${existing.email ?? email}. We can't wait to meet you!`;
         await _runtime.messageManager.createMemory({
          roomId: _message.roomId, userId: _message.userId, agentId: _message.agentId,
          content: {
            text: confirmation,
            metadata: {
              stage: "schedule_visit",
              visit_scheduled: true,
              eventId: existing.eventId,
              startIso: existing.startIso,
              htmlLink: existing.htmlLink,
              email: existing.email ?? email,
              chosenSource,
            },
          },
        });
         setGlobalResponseStatus("Normal situation");
        return confirmation;
      }
       // Try to book
      let booked: { ok: boolean; eventId?: string; startIso?: string; whenText?: string; htmlLink?: string; statusCode?: number } | null = null;
      try {
        booked = await scheduleWithCalendar({
          email,
          startIso: proposedIso,
          roomId: _message.roomId,
          agentId: _message.agentId,
          tz: TZ,
          summary: "Grand Villa Tour",
          location: "Grand Villa of Clearwater",
        } as any);
      } catch (e) {
        elizaLogger.error("scheduleWithCalendar threw", e);
        booked = null;
      }
       // Conflict (HTTP 409) → confirm existing if matches our slot
      if (booked && !booked.ok && (booked as any).statusCode === 409) {
        const again = await findExistingBooking(_message.roomId);
        if (again?.startIso && equalWithinMinutes(again.startIso, proposedIso)) {
          const confirmation =
            `Great news—your tour with Diana is already booked for ${formatWhenTZ(again.startIso)}. ` +
            `I've sent a calendar invite to ${again.email ?? email}. We can't wait to meet you!`;
          await _runtime.messageManager.createMemory({
            roomId: _message.roomId, userId: _message.userId, agentId: _message.agentId,
            content: { text: confirmation, metadata: {
              stage: "schedule_visit", visit_scheduled: true,
              eventId: again.eventId, startIso: again.startIso, htmlLink: again.htmlLink,
              email: again.email ?? email, chosenSource
            } }
          });
          setGlobalResponseStatus("Normal situation");
          return confirmation;
        }
        // fall through to soft message if we can't reconcile
      }
       if (booked?.ok) {
        const whenText = booked.whenText || formatWhenTZ(booked.startIso || proposedIso);
        const confirmation = `Perfect—your tour with Diana is booked for ${whenText}. I've sent a calendar invite to ${email}. We can't wait to meet you!`;
         await _runtime.messageManager.createMemory({
          roomId: _message.roomId, userId: _message.userId, agentId: _message.agentId,
          content: {
            text: confirmation,
            metadata: {
              stage: "schedule_visit",
              visit_scheduled: true,
              eventId: booked.eventId!,
              startIso: (booked.startIso || proposedIso)!,
              htmlLink: booked.htmlLink,
              email,
              chosenSource,
            },
          },
        });
         setGlobalResponseStatus("Normal situation");
        return confirmation;
      } else {
        const soft =
          `Got it—I'll target ${formatWhenTZ(proposedIso)}. I couldn't finalize the calendar event just now, ` +
          `but I'll send the invite to ${email} as soon as it's ready. If you have any issues, please call (727) 286-3999.`;
         await _runtime.messageManager.createMemory({
          roomId: _message.roomId, userId: _message.userId, agentId: _message.agentId,
          content: {
            text: soft,
            metadata: { stage: "schedule_visit", proposedStartIso: proposedIso, awaiting_email: false, email, chosenSource },
          },
        });
         setGlobalResponseStatus("Normal situation");
        return soft;
      }
    }
     // ---------- 2) No email ----------
    // 2a) Pure YES/OK → ask for email (don't parse "ok" as 2pm)
    if (looksAffirmative(userText) && !looksTimeish(userText)) {
      elizaLogger.info("PROCESS: Affirmative response detected → asking for email");
      // Prefer the very last agent proposal if any; otherwise default
      const mems = await _runtime.messageManager.getMemories({
        roomId: _message.roomId as `${string}-${string}-${string}-${string}-${string}`,
        count: HISTORY_SCAN_COUNT,
      });
       let proposedIso: string | null = null;
       // last awaiting_email proposal if exists
      for (let i = mems.length - 1; i >= 0; i--) {
        const md = (mems[i]?.content?.metadata as any) || {};
        if (md?.stage === "schedule_visit" && md?.awaiting_email && md?.proposedStartIso) {
          proposedIso = md.proposedStartIso; break;
        }
      }
      // else last agent proposed
      if (!proposedIso) {
        for (let i = mems.length - 1; i >= 0; i--) {
          const m = mems[i];
          if (m?.agentId !== _message.agentId) continue;
          const md = (m?.content?.metadata as any) || {};
          if (md?.stage === "schedule_visit" && md?.proposedStartIso) {
            proposedIso = md.proposedStartIso; break;
          }
        }
      }
      if (!proposedIso) proposedIso = defaultIso;
       const whenText = formatWhenTZ(proposedIso);
      const askEmail = `Great—let's lock in ${whenText}. Please enter the best email for your calendar invite.`;
       await _runtime.messageManager.createMemory({
        roomId: _message.roomId, userId: _message.userId, agentId: _message.agentId,
        content: { text: askEmail, metadata: { stage: "schedule_visit", proposedStartIso: proposedIso, awaiting_email: true } },
      });
       setGlobalResponseStatus("Normal situation");
      return askEmail;
    }
     // 2b) Rejection → ask for an alternative time
    if (looksNegative(userText) && !looksTimeish(userText)) {
      const nudge = `No problem—what day and time work better for you? You can reply like "Tue 10am", "Wednesday 2:30pm", or "Friday afternoon".`;
       await _runtime.messageManager.createMemory({
        roomId: _message.roomId, userId: _message.userId, agentId: _message.agentId,
        content: { text: nudge, metadata: { stage: "schedule_visit", awaiting_alt_time: true } },
      });
       setGlobalResponseStatus("Normal situation");
      return nudge;
    }
     // 2c) Time-like message → parse, store proposed, ask for email
    if (looksTimeish(userText)) {
      const parsedIso = resolveStartFromLabel(userText);
      if (parsedIso) {
        const whenText = formatWhenTZ(parsedIso);
        const askEmail = `Great—let's target ${whenText}. Please enter the best email for your calendar invite.`;
         await _runtime.messageManager.createMemory({
          roomId: _message.roomId, userId: _message.userId, agentId: _message.agentId,
          content: { text: askEmail, metadata: { stage: "schedule_visit", proposedStartIso: parsedIso, awaiting_email: true } },
        });
         setGlobalResponseStatus("Normal situation");
        return askEmail;
      }
    }
     // 2d) If a proposal is pending, remind for email instead of proposing a new time
    const ctxNow = await getContext(_message.roomId);
    if (ctxNow.status === "awaiting_email" || ctxNow.status === "proposed") {
      const whenText = formatWhenTZ((ctxNow as any).proposedStartIso);
      const askEmail = `To confirm ${whenText}, please enter the best email for your calendar invite.`;
       await _runtime.messageManager.createMemory({
        roomId: _message.roomId, userId: _message.userId, agentId: _message.agentId,
        content: { text: askEmail, metadata: { stage: "schedule_visit", proposedStartIso: (ctxNow as any).proposedStartIso, awaiting_email: true } },
      });
       setGlobalResponseStatus("Normal situation");
      return askEmail;
    }
     // ---------- 3) Stage enter / nothing actionable → propose default (with dedupe) ----------
    async function lastAgentPromptIsDuplicate(): Promise<boolean> {
      const lastAgent = await getLastAgentMessage();
      const lastText = lastAgent?.content?.text || "";
      const lastMeta = (lastAgent?.content?.metadata as any) || {};
      const samePrompt = looksLikeDefaultPrompt(lastText);
      const sameSlot = lastMeta?.proposedStartIso ? equalWithinMinutes(lastMeta.proposedStartIso, defaultIso) : false;
      return samePrompt && sameSlot;
    }
     try {
      if (await lastAgentPromptIsDuplicate()) {
        elizaLogger.info("Skipping duplicate default prompt.");
        setGlobalResponseStatus("Normal situation");
        return "";
      }
    } catch {}
     const prompt =
      `Diana can do ${defaultWhen}. ` +
      `Does that time work? If YES, please enter your email. If NO, please reply with a new day & time (e.g., "Wed 4pm").Please note visit time must be between 10am-5pm Monday-Friday.`;
     await _runtime.messageManager.createMemory({
      roomId: _message.roomId, userId: _message.userId, agentId: _message.agentId,
      content: { text: prompt, metadata: { stage: "schedule_visit", proposedStartIso: defaultIso, awaiting_email: false } },
    });
     setGlobalResponseStatus("Normal situation");
    return prompt;
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