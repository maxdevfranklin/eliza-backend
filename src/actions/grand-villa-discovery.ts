import { Action, generateText, IAgentRuntime, Memory, ModelClass, State, HandlerCallback, elizaLogger } from "@elizaos/core";
import { discoveryStateProvider, saveUserResponse, getUserResponses, updateUserStatus } from "../providers/discovery-state.js";

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
        phone?: string;
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
    last_updated: string;
}

interface ComprehensiveQA {
    name?: string;
    phone?: string;
    qaEntries: QAEntry[];
    contactCollectedAt?: string;
}

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
        
        try {
            // Load Grace personality from database
            let gracePersonality;
            try {
                gracePersonality = await loadGracePersonality(_runtime);
            } catch (error) {
                elizaLogger.warn("Using fallback personality:", error);
                gracePersonality = default_grace_personality;
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
            
            // Handle each stage with error protection
            try {
                switch (conversationStage) {
                    case "trust_building":
                        response_text = await handleTrustBuilding(_runtime, _message, _state, gracePersonality);
                        break;
                    case "situation_discovery":
                        response_text = await handleSituationQuestions(_runtime, _message, _state, discoveryState, gracePersonality);
                        break;
                    case "lifestyle_discovery":
                        response_text = await handleLifestyleQuestions(_runtime, _message, _state, discoveryState, gracePersonality);
                        break;
                    case "readiness_discovery":
                        response_text = await handleReadinessQuestions(_runtime, _message, _state, discoveryState, gracePersonality);
                        break;
                    case "priorities_discovery":
                        response_text = await handlePriorityQuestions(_runtime, _message, _state, discoveryState, gracePersonality);
                        break;
                    case "needs_matching":
                        response_text = await handleNeedsMatching(_runtime, _message, _state, discoveryState, gracePersonality);
                        break;
                    case "info_sharing":
                        response_text = await handleInfoSharing(_runtime, _message, _state, discoveryState, gracePersonality);
                        break;
                    case "visit_transition":    
                        response_text = await handleVisitTransition(_runtime, _message, _state, discoveryState, gracePersonality);
                        break;
                    case "schedule_visit":
                        response_text = await handleScheduleVisit(_runtime, _message, _state, discoveryState, gracePersonality);
                        break;
                    default:
                        response_text = await handleGeneralInquiry(_runtime, _message, _state, gracePersonality);
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
            
            _callback({ 
                text: response_text,
                metadata: {
                    stage: conversationStage,
                    actionName: "grand-villa-discovery",
                    reliability: "guaranteed"
                }
            });
            
            return true; // Always return true
            
        } catch (error) {
            elizaLogger.error("❌ Critical error - using ultimate fallback:", error);
            
            // Ultimate fallback that can never fail
            _callback({
                text: "Hello! I'm Grace, and I'm here to help you explore senior living options for your family. How can I assist you today?",
                metadata: {
                    actionName: "grand-villa-discovery",
                    fallback: "ultimate",
                    error: error.message
                }
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
                        if (record.contact_info.phone !== null && record.contact_info.phone !== undefined) {
                            contactUpdate.phone = record.contact_info.phone;
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
                    
                } catch (parseError) {
                    elizaLogger.error(`Error parsing comprehensive record ${i + 1}:`, parseError);
                }
            }
            
            elizaLogger.info(`🎯 MERGED RESULT: ${mergedRecord.situation_discovery.length} situation, ${mergedRecord.lifestyle_discovery.length} lifestyle entries`);
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
        
        record.last_updated = new Date().toISOString();
        
        elizaLogger.info(`=== UPDATING COMPREHENSIVE RECORD ===`);
        elizaLogger.info(`Updates: ${JSON.stringify(updates, null, 2)}`);
        elizaLogger.info(`====================================`);
        
        // Save the updated record
        await saveUserResponse(_runtime, _message, "comprehensive_record", JSON.stringify(record));
        
    } catch (error) {
        elizaLogger.error("Error updating comprehensive record:", error);
    }
}

// Helper function to save Q&A entry (kept for backward compatibility)
async function saveQAEntry(_runtime: IAgentRuntime, _message: Memory, question: string, answer: string, stage: string): Promise<void> {
    const qaEntry: QAEntry = {
        question: question,
        answer: answer,
        stage: stage,
        timestamp: new Date().toISOString()
    };
    
    elizaLogger.info(`=== SAVING Q&A ENTRY ===`);
    elizaLogger.info(`Question: ${question}`);
    elizaLogger.info(`Answer: ${answer}`);
    elizaLogger.info(`Stage: ${stage}`);
    elizaLogger.info(`========================`);
    
    // Save the Q&A entry
    await saveUserResponse(_runtime, _message, "qa_entry", JSON.stringify(qaEntry));
}

// Helper function to get all Q&A entries
async function getAllQAEntries(_runtime: IAgentRuntime, _message: Memory): Promise<QAEntry[]> {
    try {
        const userResponses = await getUserResponses(_runtime, _message);
        const qaEntries: QAEntry[] = [];
        
        if (userResponses.qa_entry && userResponses.qa_entry.length > 0) {
            for (const entryString of userResponses.qa_entry) {
                try {
                    const entry = JSON.parse(entryString);
                    qaEntries.push(entry);
                } catch (error) {
                    elizaLogger.error("Error parsing Q&A entry:", error);
                }
            }
        }
        
        return qaEntries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } catch (error) {
        elizaLogger.error("Error retrieving Q&A entries:", error);
        return [];
    }
}

// Helper function to display Q&A summary
async function displayQASummary(_runtime: IAgentRuntime, _message: Memory): Promise<void> {
    const qaEntries = await getAllQAEntries(_runtime, _message);
    const contactInfo = await getContactInfo(_runtime, _message);
    
    elizaLogger.info(`=== COMPREHENSIVE Q&A SUMMARY ===`);
    if (contactInfo?.name) {
        elizaLogger.info(`👤 Name: ${contactInfo.name}`);
    }
    if (contactInfo?.phone) {
        elizaLogger.info(`📞 Phone: ${contactInfo.phone}`);
    }
    elizaLogger.info(`📝 Total Q&A Entries: ${qaEntries.length}`);
    elizaLogger.info(`==================================`);
    
    qaEntries.forEach((entry, index) => {
        elizaLogger.info(`\n${index + 1}. [${entry.stage.toUpperCase()}]`);
        elizaLogger.info(`   Q: ${entry.question}`);
        elizaLogger.info(`   A: ${entry.answer}`);
        elizaLogger.info(`   Time: ${entry.timestamp}`);
    });
    
    elizaLogger.info(`==================================`);
}

// Trust Building Handler
async function handleTrustBuilding(_runtime: IAgentRuntime, _message: Memory, _state: State, gracePersonality: string): Promise<string> {
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
        
        // Try to extract name, phone number, and loved one's name from ALL trust building responses
        const extractionContext = `Please extract the user's information from these responses: "${allTrustBuildingText}"

            Look for:
            - User's full name (first and last name)
            - Phone number (any format: xxx-xxx-xxxx, (xxx) xxx-xxxx, xxx.xxx.xxxx, xxxxxxxxxx)
            - Name of their loved one/family member (the person they're seeking senior living for - could be "my mom", "my father", "John", "Mary", etc.)
            
            ${existingContactInfo ? `Note: We may already have some info - Name: ${existingContactInfo.name || 'none'}, Phone: ${existingContactInfo.phone || 'none'}, Loved One: ${existingContactInfo.loved_one_name || 'none'}` : ''}
            
            Return your response in this exact JSON format:
            {
                "name": "extracted user's full name or null if not found",
                "phone": "extracted phone number in clean format (xxx-xxx-xxxx) or null if not found",
                "loved_one_name": "extracted loved one's name or null if not found",
                "foundName": true/false,
                "foundPhone": true/false,
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
            let finalPhone = parsed.foundPhone && parsed.phone ? parsed.phone : (existingContactInfo?.phone || null);
            let finalLovedOneName = parsed.foundLovedOneName && parsed.loved_one_name ? parsed.loved_one_name : (existingContactInfo?.loved_one_name || null);
            
            elizaLogger.info(`=== CONTACT INFO EXTRACTION ===`);
            elizaLogger.info(`Extracted name: ${parsed.foundName ? parsed.name : 'NO'}`);
            elizaLogger.info(`Extracted phone: ${parsed.foundPhone ? parsed.phone : 'NO'}`);
            elizaLogger.info(`Extracted loved one: ${parsed.foundLovedOneName ? parsed.loved_one_name : 'NO'}`);
            elizaLogger.info(`Final name: ${finalName || 'NO'}`);
            elizaLogger.info(`Final phone: ${finalPhone || 'NO'}`);
            elizaLogger.info(`Final loved one: ${finalLovedOneName || 'NO'}`);
            elizaLogger.info(`===============================`);

            // If we found all three pieces of info, save them and proceed
            if (finalName && finalPhone && finalLovedOneName) {
                elizaLogger.info(`=== SAVING CONTACT INFO TO COMPREHENSIVE RECORD ===`);
                elizaLogger.info(`Name: ${finalName}, Phone: ${finalPhone}, Loved One: ${finalLovedOneName}`);
                
                // Save contact information to comprehensive record
                await updateComprehensiveRecord(_runtime, _message, {
                    contact_info: {
                        name: finalName,
                        phone: finalPhone,
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
            if (finalName || finalPhone || finalLovedOneName) {
                elizaLogger.info(`=== SAVING PARTIAL CONTACT INFO TO COMPREHENSIVE RECORD ===`);
                elizaLogger.info(`Name: ${finalName || 'not provided'}, Phone: ${finalPhone || 'not provided'}, Loved One: ${finalLovedOneName || 'not provided'}`);
                
                await updateComprehensiveRecord(_runtime, _message, {
                    contact_info: {
                        name: finalName,
                        phone: finalPhone,
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
            if (!finalPhone) missingItems.push("your phone number");
            if (!finalLovedOneName) missingItems.push("your loved one's name");
            
            if (missingItems.length === 3) {
                missingInfoResponse = "I'd love to help you! To get started, could I get your name, phone number, and the name of your loved one you're looking for senior living options for?";
            } else if (missingItems.length === 2) {
                missingInfoResponse = `Thanks for sharing! Could I also get ${missingItems.join(" and ")}?`;
            } else if (missingItems.length === 1) {
                missingInfoResponse = `${finalName ? `Thanks, ${finalName}!` : 'Thanks!'} Could I also get ${missingItems[0]}?`;
            }
            
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
            const fallbackResponse = "I'd love to help you! To get started, could I get your name, phone number, and the name of your loved one you're looking for senior living options for?";
            
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
    
    // First interaction - ask for name, phone, and loved one's name
    const initialResponse = "Hello! I'm Grace, and I'm here to help you explore senior living options for your family. To get started, could I get your name, phone number, and the name of your loved one you're looking for senior living options for?";
    
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
async function handleSituationQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any, gracePersonality: string): Promise<string> {
    // Save user response from this stage
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "situation", _message.content.text);
    }
    
    // Get contact information for personalization
    const contactInfo = await getContactInfo(_runtime, _message);
    const userName = await getUserFirstName(_runtime, _message);
    
    // Create personalized questions using loved one's name
    const lovedOneName = contactInfo?.loved_one_name || "your loved one";
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
        return await handleLifestyleQuestions(_runtime, transitionMessage, _state, discoveryState, gracePersonality);
    }
    
    // Generate AI response that asks the next unanswered question with context
    const nextQuestion = remainingQuestions[0];
    const currentAnsweredCount = situationQuestions.length - remainingQuestions.length;
    
    // Get any previous answers to provide context
    const previousAnswers = situationQAEntries.map(entry => `${entry.question}: ${entry.answer}`).join(' | ');
    
    const responseContext = `The user ${userName ? `(${userName}) ` : ''}is sharing their senior living situation.

Progress: ${currentAnsweredCount}/4 questions answered so far.
${previousAnswers ? `Previous answers: ${previousAnswers}` : ''}

User's last response: "${_message.content.text}"

I need to ask: "${nextQuestion}"
"${gracePersonality}"
- Uses both the user's name \"${userName}\" and their loved one's name \"${lovedOneName}\" naturally within the response, making it feel personal and caring

Return ONLY the response text, no extra commentary or formatting.`;
    elizaLogger.info("chris_context1", responseContext);
    try {
        const aiResponse = await generateText({
            runtime: _runtime,
            context: responseContext,
            modelClass: ModelClass.SMALL
        });
        
        const response = aiResponse || `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: response,
                metadata: { 
                    askedQuestion: response,
                    stage: "situation_discovery"
                }
            }
        });
        
        return response;
        
    } catch (error) {
        elizaLogger.error("Failed to generate AI response:", error);
        const fallbackResponse = `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: fallbackResponse,
                metadata: { 
                    askedQuestion: fallbackResponse,
                    stage: "situation_discovery"
                }
            }
        });
        
        return fallbackResponse;
    }
}

// Lifestyle Discovery Handler  
async function handleLifestyleQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any, gracePersonality: string): Promise<string> {
    // The 3 basic lifestyle questions we need to collect answers for
    const lifestyleQuestions = [
        "Tell me about your loved one. What does a typical day look like for them?",
        "What does he/she enjoy doing?"
    ];
    
    // Save user response from this stage
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "lifestyle", _message.content.text);
    }
    
    // Get contact information for personalization (randomly use name)

    const contactInfo = await getContactInfo(_runtime, _message);
    const useName = shouldUseName();
    const userName = useName ? await getUserFirstName(_runtime, _message) : "";
    const lovedOneName = contactInfo?.loved_one_name || "your loved one";
    
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
        return await handleReadinessQuestions(_runtime, transitionMessage, _state, discoveryState, gracePersonality);
    }
    
    // Determine which question to ask next and generate a contextual response
    const nextQuestion = remainingQuestions[0];
    const currentAnsweredCount = lifestyleQuestions.length - remainingQuestions.length;
    
    // Get any previous answers to provide context
    const previousAnswers = lifestyleQAEntries.map(entry => `${entry.question}: ${entry.answer}`).join(' | ');
    
    const responseContext = `The user ${userName ? `(${userName}) ` : ''}is sharing about their loved one's lifestyle and daily activities. 

Progress: ${currentAnsweredCount}/3 questions answered so far.
${previousAnswers ? `Previous answers: ${previousAnswers}` : ''}

User's last response: "${_message.content.text}"

Next question to ask: "${nextQuestion}"
"${gracePersonality}"
- Uses both the user's name \"${userName}\" and their loved one's name \"${lovedOneName}\" naturally within the response, making it feel personal and caring

Return ONLY the response text, nothing else.`;

    try {
        const aiResponse = await generateText({
            runtime: _runtime,
            context: responseContext,
            modelClass: ModelClass.SMALL
        });
        
        const response = aiResponse || `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: response,
                metadata: { 
                    askedQuestion: response,
                    stage: "lifestyle_discovery"
                }
            }
        });
        
        return response;
        
    } catch (error) {
        elizaLogger.error("Failed to generate AI response:", error);
        const fallbackResponse = `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: fallbackResponse,
                metadata: { 
                    askedQuestion: fallbackResponse,
                    stage: "lifestyle_discovery"
                }
            }
        });
        
        return fallbackResponse;
    }
}

// Readiness Discovery Handler
async function handleReadinessQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any, gracePersonality: string): Promise<string> {
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
        return await handlePriorityQuestions(_runtime, transitionMessage, _state, discoveryState, gracePersonality);
    }
    
    elizaLogger.info(`⏳ STILL NEED ${remainingQuestions.length} MORE ANSWERS - staying in readiness_discovery`);
    
    // Generate AI response that asks the next unanswered question with context
    const nextQuestion = remainingQuestions[0];
    const currentAnsweredCount = readinessQuestions.length - remainingQuestions.length;
    
    elizaLogger.info(`🔄 ASKING NEXT QUESTION: "${nextQuestion}"`);
    elizaLogger.info(`📊 PROGRESS: ${currentAnsweredCount}/${readinessQuestions.length} questions answered`);
    
    // Get any previous answers to provide context
    const previousAnswers = readinessQAEntries.map(entry => `${entry.question}: ${entry.answer}`).join(' | ');
    
    const responseContext = `The user ${userName ? `(${userName}) ` : ''}is sharing about their loved one's readiness and family involvement.

Progress: ${currentAnsweredCount}/3 questions answered so far.
${previousAnswers ? `Previous answers: ${previousAnswers}` : ''}

User's last response: "${_message.content.text}"

I need to ask: "${nextQuestion}"
"${gracePersonality}"
- Uses both the user's name \"${userName}\" and their loved one's name \"${lovedOneName}\" naturally within the response, making it feel personal and caring

Return ONLY the response text, no extra commentary or formatting.`;

    const contextualResponse = await generateText({
        runtime: _runtime,
        context: responseContext,
        modelClass: ModelClass.SMALL
    });
    
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: {
            text: contextualResponse,
            metadata: { 
                askedQuestion: nextQuestion,
                stage: "readiness_discovery"
            }
        }
    });
    
    return contextualResponse;
}

// Priority Discovery Handler
async function handlePriorityQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any, gracePersonality: string): Promise<string> {
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
        return await handleNeedsMatching(_runtime, transitionMessage, _state, discoveryState, gracePersonality);
    }
    
    elizaLogger.info(`⏳ STILL NEED ${remainingQuestions.length} MORE ANSWERS - staying in priorities_discovery`);
    
    // Generate AI response that asks the next unanswered question with context
    const nextQuestion = remainingQuestions[0];
    const currentAnsweredCount = priorityQuestions.length - remainingQuestions.length;
    
    elizaLogger.info(`🔄 ASKING NEXT QUESTION: "${nextQuestion}"`);
    elizaLogger.info(`📊 PROGRESS: ${currentAnsweredCount}/${priorityQuestions.length} questions answered`);
    
    // Get any previous answers to provide context
    const previousAnswers = prioritiesQAEntries.map(entry => `${entry.question}: ${entry.answer}`).join(' | ');
    
    const responseContext = `The user ${userName ? `(${userName}) ` : ''}is sharing about their priorities and what's important in choosing a senior living community.

Progress: ${currentAnsweredCount}/2 questions answered so far.
${previousAnswers ? `Previous answers: ${previousAnswers}` : ''}

User's last response: "${_message.content.text}"

I need to ask: "${nextQuestion}"
"${gracePersonality}"
- Uses both the user's name \"${userName}\" and their loved one's name \"${lovedOneName}\" naturally within the response, making it feel personal and caring

Return ONLY the response text, no extra commentary or formatting.`;

    try {
        const aiResponse = await generateText({
            runtime: _runtime,
            context: responseContext,
            modelClass: ModelClass.SMALL
        });
        
        const response = aiResponse || `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: response,
                metadata: { 
                    askedQuestion: response,
                    stage: "priorities_discovery"
                }
            }
        });
        
        return response;
        
    } catch (error) {
        elizaLogger.error("Failed to generate AI response:", error);
        const fallbackResponse = `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: fallbackResponse,
                metadata: { 
                    askedQuestion: fallbackResponse,
                    stage: "priorities_discovery"
                }
            }
        });
        
        return fallbackResponse;
    }
}

// Needs Matching Handler
async function handleNeedsMatching(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any, gracePersonality: string): Promise<string> {
    // Check if this is a user response (not the initial transition)
    const isUserResponse = _message.content.text && _message.userId !== _message.agentId;
    
    // Save the user response if this is a user message
    if (isUserResponse) {
        await saveUserResponse(_runtime, _message, "needs_matching", _message.content.text);
    }
    
    // Get all user responses from previous stages
    const userResponses = await getUserResponses(_runtime, _message);
    const situationResponses = userResponses.situation || [];
    const lifestyleResponses = userResponses.lifestyle || [];
    const readinessResponses = userResponses.readiness || [];
    const prioritiesResponses = userResponses.priorities || [];
    
    // Show comprehensive summary of all collected responses
    elizaLogger.info(`=== NEEDS MATCHING STAGE ===`);
    elizaLogger.info(`📋 COMPREHENSIVE USER RESPONSE SUMMARY:`);
    elizaLogger.info(`  🏠 Situation Responses (${situationResponses.length}): ${JSON.stringify(situationResponses, null, 2)}`);
    elizaLogger.info(`  🎯 Lifestyle Responses (${lifestyleResponses.length}): ${JSON.stringify(lifestyleResponses, null, 2)}`);
    elizaLogger.info(`  💭 Readiness Responses (${readinessResponses.length}): ${JSON.stringify(readinessResponses, null, 2)}`);
    elizaLogger.info(`  ⭐ Priority Responses (${prioritiesResponses.length}): ${JSON.stringify(prioritiesResponses, null, 2)}`);
    elizaLogger.info(`Current user message: ${_message.content.text}`);
    elizaLogger.info(`Current user status: ${discoveryState.userStatus}`);
    elizaLogger.info(`===============================`);
    
    // Get contact information for personalization
    const contactInfo = await getContactInfo(_runtime, _message);
    const useName = shouldUseName();
    const userName = useName ? await getUserFirstName(_runtime, _message) : "";
    const lovedOneName = contactInfo?.loved_one_name || "your loved one";
    elizaLogger.info(`Using name in needs matching: ${useName ? 'YES' : 'NO'} (${userName || 'N/A'})`);
    
    // Combine all responses for comprehensive analysis
    const allUserResponses = [
        ...situationResponses,
        ...lifestyleResponses,
        ...readinessResponses,
        ...prioritiesResponses
    ].join(" ");
    
    // Analyze user response and update status using AI with deeply emotional, empathetic language
    const context = `Current user status: "${discoveryState.userStatus}"
                    Personality of Grace: "${gracePersonality}"
                    User ${userName ? `(${userName}) ` : ''}latest response about what would bring ${lovedOneName} peace and joy: "${_message.content.text}"
                    All user responses throughout discovery: "${allUserResponses}"

                    Please analyze all this information and provide TWO things in JSON format:
                    1. A comprehensive final status report about the user's complete situation, needs, interests, priorities, and what they want, incorporating all discovery information
                    2. A deeply empathetic, beautiful response that acknowledges what they shared and shows why Grand Villa is a perfect fit for ${lovedOneName}'s needs, like a line from a heartfelt film. Your response should:

                    - Use both the user's name "${userName}" and ${lovedOneName}'s name naturally to make it personal and warm
                    - Begin with an evocative, emotional phrase or reflection that sounds like a touching line from a film
                    - Show deep understanding of their situation, weaving in vivid imagery or metaphors if appropriate
                    - Clearly explain why Grand Villa is a perfect fit for what ${lovedOneName} needs (community, care, activities, connections) in a way that feels natural and inspiring
                    - Feel like a loving friend, wise counselor, or thoughtful guide speaking – always authentic, never robotic or generic
                    - Use language that inspires reflection, evokes genuine emotion, and feels profoundly human – words they might carry with them after reading
                    - Be longer and richer than typical chatbot replies (under 120 words) to convey care and thoughtful understanding, but remain clear and purposeful

                    Return your response in this exact JSON format:
                    {
                        "updatedUserStatus": "Comprehensive final analysis of user's complete situation, family needs, interests, priorities, readiness level, and what they're looking for in senior living, incorporating all discovery information",
                        "responseMessage": "A deeply empathetic, beautifully written response that uses both ${userName} and ${lovedOneName}'s names, starts with an evocative phrase, and explains why Grand Villa is a perfect fit for their needs in a way that feels loving, cinematic, and human. LIMIT TO 120 WORDS OR LESS."
                    }

                    Make sure to return ONLY valid JSON, no additional text.`;

    let updatedUserStatus = "";
    let finalResponse = "";
    
    try {
        const aiResponse = await generateText({
            runtime: _runtime,
            context: context,
            modelClass: ModelClass.SMALL
        });

        const parsed = JSON.parse(aiResponse);
        // 🔧 Fix: Convert object to string if needed
        const rawStatus = parsed.updatedUserStatus || "";
        updatedUserStatus = typeof rawStatus === 'object' ? JSON.stringify(rawStatus) : rawStatus;
        finalResponse = parsed.responseMessage || "";
        
        // Log the extracted information
        elizaLogger.info(`=== UPDATED USER STATUS ===`);
        elizaLogger.info(updatedUserStatus);
        elizaLogger.info(`=== RESPONSE MESSAGE ===`);
        elizaLogger.info(finalResponse);
        elizaLogger.info(`===========================`);
        
        // Display comprehensive Q&A summary at needs matching stage
        await displayQASummary(_runtime, _message);
        
    } catch (error) {
        elizaLogger.error("Failed to parse JSON response:", error);
        // Still display Q&A summary even if response generation failed
        await displayQASummary(_runtime, _message);
        
        // Generate fallback response with emotional tone
        try {
            const fallbackPrompt = `User ${userName ? `(${userName}) ` : ''}comprehensive status: "${discoveryState.userStatus}"
                                   All user responses throughout discovery: "${allUserResponses}"
                                   They want to bring ${lovedOneName} peace and joy: "${_message.content.text}"

                                   Based on this understanding, generate a deeply empathetic response similar to this example:
                                   "That's such a beautiful way to put it, ${userName || 'John'}—helping her find a new way to see life. It sounds like being surrounded by others and having opportunities to connect could really lift her spirits."

                                   Your response should:
                                   ${userName ? `IMPORTANT: Start with the user's name "${userName}" and acknowledge what they shared in a beautiful, emotional way` : 'Begin by acknowledging what they shared in a beautiful, emotional way'}
                                   1. Use phrases like "That's such a beautiful way to put it" or "It sounds like" to validate their feelings
                                   2. Build on what they said about bringing ${lovedOneName} peace/joy
                                   3. Naturally connect to how Grand Villa could provide those things (community, activities, connections)
                                   4. Feel like a caring friend who sees the beauty in their love for ${lovedOneName}

                                   ${userName ? `Start the response with "${userName}," and then continue.` : ''} Keep it emotionally resonant, caring, and deeply empathetic. LIMIT TO 65 WORDS OR LESS. Make it feel like you truly understand the beauty of their love and care.`;
            
            const personalizedResponse = await generateText({
                runtime: _runtime,
                context: fallbackPrompt,
                modelClass: ModelClass.SMALL
            });
            
            if (personalizedResponse) {
                elizaLogger.info(`Generated fallback personalized needs matching response: ${personalizedResponse}`);
                finalResponse = personalizedResponse;
            }
        } catch (fallbackError) {
            elizaLogger.error(`Error generating fallback needs matching response: ${fallbackError}`);
        }
    }

    // Ultimate fallback to default response if all generation fails
    if (!finalResponse) {
        finalResponse = `${userName ? `${userName}, ` : ''}That's such a beautiful way to think about it—wanting to bring ${lovedOneName} peace and joy. It sounds like having a caring community around them could really make a difference. Grand Villa has that warm, supportive environment where residents truly feel at home. Would you like to visit and see how the community could embrace ${lovedOneName}?`;
    }
    
    // If this is a user response, transition to info_sharing stage
    if (isUserResponse) {
        elizaLogger.info("User responded to needs matching, transitioning to info_sharing stage");
        
        // Store the needs matching response in memory with stage transition to info_sharing
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: finalResponse,
                metadata: { 
                    askedQuestion: finalResponse,
                    stage: "info_sharing"
                }
            }
        });
        
        // Let info sharing handler create the actual response
        const transitionMessage = {
            ..._message,
            content: { text: "" }
        };
        return await handleInfoSharing(_runtime, transitionMessage, _state, discoveryState, gracePersonality);
    } else {
        // This is the initial transition from priorities_discovery, stay in needs_matching
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: {
                text: finalResponse,
                metadata: { 
                    askedQuestion: finalResponse,
                    stage: "needs_matching"
                }
            }
        });
        
        return finalResponse;
    }
}

// Info Sharing Handler
async function handleInfoSharing(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any, gracePersonality: string): Promise<string> {
    // Save user response from this stage
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "info_sharing", _message.content.text);
    }
    
    // Get user name for potential personalization (randomly use name)
    const useName = shouldUseName();
    const userName = useName ? await getUserFirstName(_runtime, _message) : "";
    
    // Show previous user responses collected so far
    const previousResponses = await getUserResponses(_runtime, _message);
    elizaLogger.info(`=== INFO SHARING STAGE ===`);
    elizaLogger.info(`Previous responses collected: ${JSON.stringify(previousResponses, null, 2)}`);
    elizaLogger.info(`Current user message: ${_message.content.text}`);
    elizaLogger.info(`Current user status: ${discoveryState.userStatus}`);
    elizaLogger.info(`Using name in response: ${useName ? 'YES' : 'NO'} (${userName || 'N/A'})`);
    elizaLogger.info(`==============================`)
    
    // Analyze user response and update status using AI (like earlier stages)
    const statusContext = `Current user status: "${discoveryState.userStatus}"
                          User ${userName ? `(${userName}) ` : ''}latest response about Grand Villa: "${_message.content.text}"

                          Please analyze this information and provide TWO things in JSON format:
                          1. An updated comprehensive status report about the user's situation, needs, interests, and what they want, building on the previous status
                          2. A helpful response that answers their question about Grand Villa and then naturally asks if they'd like to schedule a visit

                          Grand Villa Information to use in your response:
                          Grand Villa has locations in Florida, California, and Colorado.
                          They offer Independent Living, Assisted Living, Memory Care, and Respite Care.
                          Facilities include dining, medication management, housekeeping, laundry, fitness centers, gardens, walking trails, salon, barber, transportation, and activity programs.
                          Rooms are private or companion style with kitchenettes, cable TV, and Wi-Fi.
                          Staff is available 24 hours with emergency call systems.
                          
                          Pricing examples:
                          Sarasota, FL: contact for rates.
                          Escondido, CA: starts at $4,800 per month.
                          Grand Junction, CO: $4,587 to $5,963 per month.
                          Ormond Beach, FL: $3,195 to $4,095 per month.
                          New Port Richey, FL: studios from $3,095, one-bedrooms from $3,695.
                          
                          Activities include book clubs, sewing circles, gardening groups, music programs, art classes, cooking activities, game nights, yoga, bingo, painting, wellness programs, and outings.

                          Return your response in this exact JSON format:
                          {
                              "updatedUserStatus": "Updated comprehensive analysis of user's status, needs, interests, and what they want, incorporating the new information they asked about",
                              "responseMessage": "A helpful response that ${userName ? `starts with '${userName},' and then ` : ''}answers their question about Grand Villa, then naturally transitions to asking if they'd like to schedule a visit to see it firsthand. Keep it warm, informative, conversational, and LIMIT TO 50 WORDS OR LESS."
                          }

                          Make sure to return ONLY valid JSON, no additional text.`;

    let updatedUserStatus = "";
    let response = "";
    
    try {
        const aiResponse = await generateText({
            runtime: _runtime,
            context: statusContext,
            modelClass: ModelClass.SMALL
        });

        const parsed = JSON.parse(aiResponse);
        // 🔧 Fix: Convert object to string if needed
        const rawStatus = parsed.updatedUserStatus || "";
        updatedUserStatus = typeof rawStatus === 'object' ? JSON.stringify(rawStatus) : rawStatus;
        response = parsed.responseMessage || "";
        
        // Log the extracted information
        elizaLogger.info(`=== UPDATED USER STATUS ===`);
        elizaLogger.info(updatedUserStatus);
        elizaLogger.info(`=== RESPONSE MESSAGE ===`);
        elizaLogger.info(response);
        elizaLogger.info(`===========================`);
        
        // Save the Q&A entry for information requests
        if (_message.content.text && _message.userId !== _message.agentId) {
            await saveQAEntry(_runtime, _message, "What would you like to know about Grand Villa?", _message.content.text, "info_sharing");
        }
        
    } catch (error) {
        elizaLogger.error("Failed to parse JSON response:", error);
        // Fallback response that asks to schedule a visit
        response = `I'd be happy to help you learn more about Grand Villa. ${userName ? `${userName}, ` : ''}would you like to schedule a visit so you can see the community and what daily life would feel like firsthand?`;
        // Save the Q&A entry even if parsing failed
        if (_message.content.text && _message.userId !== _message.agentId) {
            await saveQAEntry(_runtime, _message, "What would you like to know about Grand Villa?", _message.content.text, "info_sharing");
        }
    }

    // Fallback if response is empty
    if (!response) {
        response = `I'd be happy to help you learn more about Grand Villa. ${userName ? `${userName}, ` : ''}would you like to schedule a visit so you can see the community and what daily life would feel like firsthand?`;
    }
    
    // Store the response in memory with stage transition to schedule_visit
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: {
            text: response,
            metadata: { 
                askedQuestion: response,
                stage: "schedule_visit"
            }
        }
    });
    
    return response;
}

// Visit Transition Handler
async function handleVisitTransition(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any, gracePersonality: string): Promise<string> {
    return "It sounds like your family member could really thrive here, and I'd love for you to experience it firsthand. Why don't we set up a time for you to visit, tour the community, and even enjoy a meal with us? That way, you can really see what daily life would feel like.\n\nWould Wednesday afternoon or Friday morning work better for you?";
}

// Schedule Visit Handler
async function handleScheduleVisit(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any, gracePersonality: string): Promise<string> {
    elizaLogger.info("Handling schedule visit stage");
    
    // Check if user provided a response (not the first interaction)
    if (_message.content.text && _message.userId !== _message.agentId) {
        // Get all user responses from schedule_visit stage so far
        let scheduleVisitResponses = await getUserAnswersFromStage(_runtime, _message, "schedule_visit");
        
        // Fallback: if stage-based approach returns empty, get recent messages from ONLY current user
        if (scheduleVisitResponses.length === 0) {
            elizaLogger.info("Stage-based approach returned empty, using fallback to get current user's messages");
            const allMemories = await _runtime.messageManager.getMemories({
                roomId: _message.roomId,
                count: 20
            });
            
            scheduleVisitResponses = allMemories
                .filter(mem => mem.userId === _message.userId && mem.userId !== _message.agentId && mem.content.text.trim())
                .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
                .slice(-5) // Get last 5 user messages
                .map(mem => mem.content.text);
            
            elizaLogger.info(`🔒 USER ISOLATION: Fallback collected ${scheduleVisitResponses.length} messages from user ${_message.userId} only`);
        }
        
        const allScheduleVisitText = scheduleVisitResponses.join(" ");
        
        elizaLogger.info(`=== SCHEDULE VISIT RESPONSES ===`);
        elizaLogger.info(`All schedule visit responses: ${JSON.stringify(scheduleVisitResponses)}`);
        elizaLogger.info(`Combined text: ${allScheduleVisitText}`);
        elizaLogger.info(`===============================`);
        
        // Check if we already have any visit info stored
        let existingVisitInfo = await getVisitInfo(_runtime, _message);
        
        // Try to extract email, mailing address, and preferred contact method from ALL responses
        const extractionContext = `Please extract the user's email, mailing address, and preferred contact method from these responses: "${allScheduleVisitText}"

            Look for:
            - Email address (any format: user@domain.com, user@domain.org, etc.)
            - Mailing address (street address, city, state, zip code - can be partial)
            - Preferred contact method (phone, email, or any indication of preference)
            
            ${existingVisitInfo ? `Note: We may already have some info - Email: ${existingVisitInfo.email || 'none'}, Address: ${existingVisitInfo.mailingAddress || 'none'}, Preferred Contact: ${existingVisitInfo.preferredContact || 'none'}` : ''}
            
            Return your response in this exact JSON format:
            {
                "email": "extracted email address or null if not found",
                "mailingAddress": "extracted mailing address or null if not found", 
                "preferredContact": "phone or email based on user preference, or null if not found",
                "foundEmail": true/false,
                "foundAddress": true/false,
                "foundPreference": true/false
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
            let finalEmail = parsed.foundEmail && parsed.email ? parsed.email : (existingVisitInfo?.email || null);
            let finalAddress = parsed.foundAddress && parsed.mailingAddress ? parsed.mailingAddress : (existingVisitInfo?.mailingAddress || null);
            let finalPreference = parsed.foundPreference && parsed.preferredContact ? parsed.preferredContact : (existingVisitInfo?.preferredContact || null);
            
            elizaLogger.info(`=== VISIT INFO EXTRACTION ===`);
            elizaLogger.info(`Extracted email: ${parsed.foundEmail ? parsed.email : 'NO'}`);
            elizaLogger.info(`Extracted address: ${parsed.foundAddress ? parsed.mailingAddress : 'NO'}`);
            elizaLogger.info(`Extracted preference: ${parsed.foundPreference ? parsed.preferredContact : 'NO'}`);
            elizaLogger.info(`Final email: ${finalEmail || 'NO'}`);
            elizaLogger.info(`Final address: ${finalAddress || 'NO'}`);
            elizaLogger.info(`Final preference: ${finalPreference || 'NO'}`);
            elizaLogger.info(`============================`);

            // If we found all required info, save them and proceed
            if (finalEmail && finalAddress && finalPreference) {
                const visitInfo = {
                    email: finalEmail,
                    mailingAddress: finalAddress,
                    preferredContact: finalPreference,
                    collectedAt: new Date().toISOString()
                };
                
                elizaLogger.info(`=== SAVING VISIT INFO ===`);
                elizaLogger.info(`visitInfo object: ${JSON.stringify(visitInfo)}`);
                
                // Save visit information (overwrite any previous partial info)
                await saveUserResponse(_runtime, _message, "visit_info", JSON.stringify(visitInfo));
                elizaLogger.info(`Visit info saved to visit_info category`);
                
                // Update user status with visit information
                const statusUpdate = `Visit info collected - Email: ${finalEmail}, Address: ${finalAddress}, Preferred Contact: ${finalPreference}`;
                await updateUserStatus(_runtime, _message, statusUpdate);
                
                // Get user name for personalized response
                const userName = await getUserFirstName(_runtime, _message);
                
                // Complete visit scheduling with personalized response
                const response = `Perfect${userName ? `, ${userName}` : ''}! I have all the information I need. I'll send you a confirmation and directions to your ${finalPreference === 'email' ? 'email' : 'phone'}. Our team will also follow up to make sure you have everything you need for your visit. We're excited to welcome you and show you what makes Grand Villa special!`;
                
                await _runtime.messageManager.createMemory({
                    roomId: _message.roomId,
                    userId: _message.userId,
                    agentId: _message.agentId,
                    content: { 
                        text: response,
                        metadata: {
                            stage: "visit_scheduled"
                        }
                    }
                });
                
                elizaLogger.info(`Stored complete visit info and moving to visit_scheduled`);
                return response;
            }
            
            // Save partial visit info if we have new information
            if (finalEmail || finalAddress || finalPreference) {
                const partialVisitInfo = {
                    email: finalEmail,
                    mailingAddress: finalAddress,
                    preferredContact: finalPreference,
                    collectedAt: new Date().toISOString()
                };
                
                elizaLogger.info(`=== SAVING PARTIAL VISIT INFO ===`);
                elizaLogger.info(`partialVisitInfo object: ${JSON.stringify(partialVisitInfo)}`);
                
                await saveUserResponse(_runtime, _message, "visit_info", JSON.stringify(partialVisitInfo));
                elizaLogger.info(`Partial visit info saved to visit_info category`);
            }
            
            // If we're missing information, ask for what's missing
            let missingInfoResponse = "";
            const missing = [];
            if (!finalEmail) missing.push("email address");
            if (!finalAddress) missing.push("mailing address");
            if (!finalPreference) missing.push("preferred contact method");
            
            if (missing.length === 3) {
                missingInfoResponse = "Perfect! To complete your visit scheduling, I'll need your email address, mailing address, and whether you prefer to be contacted by phone or email. Could you share those with me?";
            } else if (missing.length === 2) {
                missingInfoResponse = `Great! I just need your ${missing.join(" and ")} to complete the scheduling. Could you provide those for me?`;
            } else if (missing.length === 1) {
                missingInfoResponse = `Almost there! I just need your ${missing[0]} to finish setting up your visit. Could you share that with me?`;
            }
            
            // Stay in schedule_visit stage
            await _runtime.messageManager.createMemory({
                roomId: _message.roomId,
                userId: _message.userId,
                agentId: _message.agentId,
                content: { 
                    text: missingInfoResponse,
                    metadata: {
                        stage: "schedule_visit"
                    }
                }
            });
            
            return missingInfoResponse;
            
        } catch (error) {
            elizaLogger.error("Error extracting visit info:", error);
            // Fallback to asking for visit info
            const fallbackResponse = "Perfect! To complete your visit scheduling, I'll need your email address, mailing address, and whether you prefer to be contacted by phone or email. Could you share those with me?";
            
            await _runtime.messageManager.createMemory({
                roomId: _message.roomId,
                userId: _message.userId,
                agentId: _message.agentId,
                content: { 
                    text: fallbackResponse,
                    metadata: {
                        stage: "schedule_visit"
                    }
                }
            });
            
            return fallbackResponse;
        }
    }
    
    // First interaction in schedule_visit stage - natural transition from info_sharing
    const userName = await getUserFirstName(_runtime, _message);
    const initialResponse = `That's wonderful${userName ? `, ${userName}` : ''}! I can see Grand Villa would be a great fit for your family. Let's get your visit scheduled so you can experience it firsthand. I'll need your email address, mailing address, and whether you prefer to be contacted by phone or email to send you confirmation and directions.`;
    
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: { 
            text: initialResponse,
            metadata: {
                stage: "schedule_visit"
            }
        }
    });
    
    elizaLogger.info(`Stored initial visit scheduling request in schedule_visit stage`);
    return initialResponse;
}

// State Management Functions
async function getDiscoveryState(_runtime: IAgentRuntime, _message: Memory): Promise<any> {
    return await discoveryStateProvider.get(_runtime, _message);
}

async function updateDiscoveryState(_runtime: IAgentRuntime, _message: Memory, stage: string, response: string): Promise<void> {
    const discoveryState = await getDiscoveryState(_runtime, _message);
    elizaLogger.info(`Updating discovery state from ${discoveryState.currentStage} to ${stage}`);
    
    // Only update stage if it's different from current stage
    if (stage !== discoveryState.currentStage) {
        // Store the response with stage in metadata
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: { 
                text: response,
                metadata: {
                    stage: stage
                }
            }
        });
        
        elizaLogger.info(`Added response to message history with stage: ${stage}`);
    } else {
        // If stage hasn't changed, just store the response without stage metadata
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: { 
                text: response
            }
        });
        
        elizaLogger.info(`Added response to message history without stage change`);
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

async function moveToNextStage(_runtime: IAgentRuntime, _message: Memory, nextStage: string): Promise<string> {
    const discoveryState = await getDiscoveryState(_runtime, _message);
    discoveryState.currentStage = nextStage;

    elizaLogger.info(`Moving to stage: ${nextStage}`);
    
    return "";
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
async function getContactInfo(_runtime: IAgentRuntime, _message: Memory): Promise<{name?: string, phone?: string, loved_one_name?: string} | null> {
    try {
        // First try to get from comprehensive record
        const comprehensiveRecord = await getComprehensiveRecord(_runtime, _message);
        if (comprehensiveRecord?.contact_info) {
            const contactInfo = comprehensiveRecord.contact_info;
            elizaLogger.info(`getContactInfo - RAW comprehensive record: ${JSON.stringify(comprehensiveRecord)}`);
            elizaLogger.info(`getContactInfo - RAW contact_info: ${JSON.stringify(contactInfo)}`);
            elizaLogger.info(`getContactInfo - from comprehensive record: Name=${contactInfo.name}, Phone=${contactInfo.phone}, Loved One=${contactInfo.loved_one_name}`);
            return { 
                name: contactInfo.name, 
                phone: contactInfo.phone, 
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
            
            // Handle the messy format: "[Discovery Response] {"name":"Chris","phone":"..."}"
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
            elizaLogger.info(`Retrieved contact info: Name=${parsed.name}, Phone=${parsed.phone}, Loved One=${parsed.loved_one_name}`);
            return { name: parsed.name, phone: parsed.phone, loved_one_name: parsed.loved_one_name };
        }
        
        elizaLogger.info(`getContactInfo - no contact info found`);
    } catch (error) {
        elizaLogger.error("Error retrieving contact info:", error);
    }
    
    return null;
}

// Helper function to get stored visit information
async function getVisitInfo(_runtime: IAgentRuntime, _message: Memory): Promise<{email?: string, mailingAddress?: string, preferredContact?: string} | null> {
    let visitInfoArray: string[] = [];
    
    try {
        const userResponses = await getUserResponses(_runtime, _message);
        elizaLogger.info(`getVisitInfo - userResponses: ${JSON.stringify(userResponses)}`);
        
        visitInfoArray = userResponses.visit_info || [];
        elizaLogger.info(`getVisitInfo - visitInfoArray length: ${visitInfoArray.length}`);
        elizaLogger.info(`getVisitInfo - visitInfoArray: ${JSON.stringify(visitInfoArray)}`);
        
        if (visitInfoArray.length > 0) {
            const latestVisitInfo = visitInfoArray[visitInfoArray.length - 1];
            elizaLogger.info(`getVisitInfo - latestVisitInfo (raw): ${latestVisitInfo}`);
            
            // Handle the messy format: "[Discovery Response] {"email":"...","mailingAddress":"...","preferredContact":"..."}"
            let cleanJsonString = latestVisitInfo;
            
            // If it starts with "[Discovery Response]", extract the JSON part
            if (typeof cleanJsonString === 'string' && cleanJsonString.includes('[Discovery Response]')) {
                const jsonStart = cleanJsonString.indexOf('{');
                if (jsonStart !== -1) {
                    cleanJsonString = cleanJsonString.substring(jsonStart);
                    elizaLogger.info(`getVisitInfo - extracted JSON part: ${cleanJsonString}`);
                }
            }
            
            const parsed = JSON.parse(cleanJsonString);
            elizaLogger.info(`getVisitInfo - parsed: ${JSON.stringify(parsed)}`);
            elizaLogger.info(`Retrieved visit info: Email=${parsed.email}, Address=${parsed.mailingAddress}, Preferred Contact=${parsed.preferredContact}`);
            return { email: parsed.email, mailingAddress: parsed.mailingAddress, preferredContact: parsed.preferredContact };
        }
        
        elizaLogger.info(`getVisitInfo - no visit info found`);
    } catch (error) {
        elizaLogger.error("Error retrieving visit info:", error);
        elizaLogger.error("Raw visit info that failed to parse:", visitInfoArray);
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

// Helper function to generate personalized lifestyle questions based on previous answers
async function generatePersonalizedLifestyleQuestion(
    _runtime: IAgentRuntime, 
    _message: Memory, 
    _state: State, 
    previousAnswers: string, 
    questionType: string
): Promise<string> {
    const combinedAnswers = previousAnswers;
    elizaLogger.info(`generatePersonalizedLifestyleQuestion ${combinedAnswers}`);
    
    let prompt = "";
    
    switch (questionType) {
        case "daily_routine":
            prompt = `Based on the user's previous responses about their family situation: "${combinedAnswers}", 
                     generate a warm, empathetic question asking about their loved one's typical daily routine. 
                     Reference specific concerns or details they mentioned. Keep it conversational and caring.`;
            break;
            
        case "activities":
            prompt = `Based on the user's previous responses: "${combinedAnswers}", 
                     generate a personalized question asking about activities or hobbies their loved one enjoys. 
                     Reference their specific situation and show understanding of their concerns.`;
            break;
            
        case "stopped_activities":
            prompt = `Based on the user's previous responses: "${combinedAnswers}", 
                     generate a thoughtful question asking about activities their loved one used to enjoy but may have stopped doing. 
                     Show empathy for their situation and acknowledge the challenges they've mentioned.`;
            break;
            
        default:
            return "Could you tell me more about your loved one's daily life?";
    }
    
    try {
        const response = await generateText({
            runtime: _runtime,
            context: prompt,
            modelClass: ModelClass.SMALL
        });
        
        return response || getDefaultQuestion(questionType);
    } catch (error) {
        elizaLogger.error(`Error generating personalized question: ${error}`);
        return getDefaultQuestion(questionType);
    }
}

// Helper function to generate personalized readiness questions based on previous answers
async function generatePersonalizedReadinessQuestion(
    _runtime: IAgentRuntime, 
    _message: Memory, 
    _state: State, 
    previousAnswers: string, 
    questionType: string
): Promise<string> {
    const combinedAnswers = previousAnswers;
    elizaLogger.info(`generatePersonalizedReadinessQuestion ${combinedAnswers}`);
    
    let prompt = "";
    
    switch (questionType) {
        case "awareness":
            prompt = `Based on the user's previous responses about their family situation: "${combinedAnswers}", 
                     generate a warm, empathetic question asking if their loved one is aware that they're looking at living options. 
                     Reference specific details they mentioned and show understanding. Keep it conversational and caring.`;
            break;
            
        case "feelings":
            prompt = `Based on the user's previous responses: "${combinedAnswers}", 
                     generate a personalized question asking about how their loved one feels about the idea of moving to a senior community. 
                     Reference their specific situation and show empathy for their concerns.`;
            break;
            
        default:
            return "How does your loved one feel about exploring senior living options?";
    }
    
    try {
        const response = await generateText({
            runtime: _runtime,
            context: prompt,
            modelClass: ModelClass.SMALL
        });
        
        return response || getDefaultReadinessQuestion(questionType);
    } catch (error) {
        elizaLogger.error(`Error generating personalized readiness question: ${error}`);
        return getDefaultReadinessQuestion(questionType);
    }
}

// Helper function to generate personalized priority questions based on previous answers
async function generatePersonalizedPriorityQuestion(
    _runtime: IAgentRuntime, 
    _message: Memory, 
    _state: State, 
    previousAnswers: string, 
    questionType: string
): Promise<string> {
    const combinedAnswers = previousAnswers;
    elizaLogger.info(`generatePersonalizedPriorityQuestion ${combinedAnswers}`);
    
    let prompt = "";
    
    switch (questionType) {
        case "community_values":
            prompt = `Based on the user's previous responses about their family situation: "${combinedAnswers}", 
                     generate a warm, empathetic question asking what's most important to them in choosing a senior living community. 
                     Reference specific concerns or details they mentioned. Keep it conversational and caring.`;
            break;
            
        case "support_needs":
            prompt = `Based on the user's previous responses: "${combinedAnswers}", 
                     generate a personalized question asking about what kind of support would make the biggest difference for their family. 
                     Reference their specific situation and show understanding of their needs.`;
            break;
            
        default:
            return "What's most important to you in choosing the right community for your loved one?";
    }
    
    try {
        const response = await generateText({
            runtime: _runtime,
            context: prompt,
            modelClass: ModelClass.SMALL
        });
        
        return response || getDefaultPriorityQuestion(questionType);
    } catch (error) {
        elizaLogger.error(`Error generating personalized priority question: ${error}`);
        return getDefaultPriorityQuestion(questionType);
    }
}

// Fallback questions if generation fails
function getDefaultQuestion(questionType: string): string {
    switch (questionType) {
        case "daily_routine":
            return "Thank you for sharing so openly — I can tell how much you care. Let's talk about your loved one. What does a typical day look like for them?";
        case "activities":
            return "Thank you, It sounds like you know your loved one so well, and that's truly wonderful. Could you tell me what are some things they love doing?";
        case "stopped_activities":
            return "Thank you for helping me understand them better — I can see how much their happiness means to you. Sometimes, as life changes, our loved ones step away from things they used to love. What's something they've always enjoyed but may have stopped doing recently?";
        default:
            return "Could you tell me more about your loved one?";
    }
}

// Fallback readiness questions if generation fails
function getDefaultReadinessQuestion(questionType: string): string {
    switch (questionType) {
        case "awareness":
            return "Ok, Looks great. I can feel that you really care your family. Can I ask you if your Mom or Dad aware that you're looking at options?";
        case "feelings":
            return "Great, I can feel that you really care your family. How do they feel about the idea of moving?";
        default:
            return "How does your loved one feel about exploring senior living options?";
    }
}

// Fallback priority questions if generation fails
function getDefaultPriorityQuestion(questionType: string): string {
    switch (questionType) {
        case "community_values":
            return "Finding the right community can make all the difference in feeling at home and supported. We want to make sure the place you choose truly fits your family's needs and values. What's most important to you in the community you choose?";
        case "support_needs":
            return "Everyone's needs are different, and the right kind of support can really ease the transition. We want to understand what would help your family feel comfortable and cared for every step of the way. What kind of support do you feel would make the biggest difference for your family?";
        default:
            return "What's most important to you in choosing the right community for your loved one?";
    }
}

async function handleGeneralInquiry(_runtime: IAgentRuntime, _message: Memory, _state: State, gracePersonality: string): Promise<string> {
    return "I'd be happy to help you learn more about Grand Villa. What would you like to know?";
}