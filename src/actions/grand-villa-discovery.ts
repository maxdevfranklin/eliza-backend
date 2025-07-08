import { Action, generateText, IAgentRuntime, Memory, ModelClass, State, HandlerCallback, elizaLogger } from "@elizaos/core";
import { discoveryStateProvider, saveUserResponse, getUserResponses, updateUserStatus } from "../providers/discovery-state.js";

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
                currentResponses = { situation: [], lifestyle: [], readiness: [], priorities: [] };
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
                        response_text = await handleTrustBuilding(_runtime, _message, _state);
                        break;
                    case "situation_discovery":
                        response_text = await handleSituationQuestions(_runtime, _message, _state, discoveryState);
                        break;
                    case "lifestyle_discovery":
                        response_text = await handleLifestyleQuestions(_runtime, _message, _state, discoveryState);
                        break;
                    case "readiness_discovery":
                        response_text = await handleReadinessQuestions(_runtime, _message, _state, discoveryState);
                        break;
                    case "priorities_discovery":
                        response_text = await handlePriorityQuestions(_runtime, _message, _state, discoveryState);
                        break;
                    case "needs_matching":
                        response_text = await handleNeedsMatching(_runtime, _message, _state, discoveryState);
                        break;
                    case "info_sharing":
                        response_text = await handleInfoSharing(_runtime, _message, _state, discoveryState);
                        break;
                    case "visit_transition":
                        response_text = await handleVisitTransition(_runtime, _message, _state, discoveryState);
                        break;
                    default:
                        response_text = await handleGeneralInquiry(_runtime, _message, _state);
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

// Trust Building Handler
async function handleTrustBuilding(_runtime: IAgentRuntime, _message: Memory, _state: State): Promise<string> {
    elizaLogger.info("Handling trust building stage");
    
    // Check if user provided a response (not the first interaction)
    if (_message.content.text && _message.userId !== _message.agentId) {
        // Get all user responses from trust building stage so far
        let trustBuildingResponses = await getUserAnswersFromStage(_runtime, _message, "trust_building");
        
        // Fallback: if stage-based approach returns empty, get all user messages in conversation
        if (trustBuildingResponses.length === 0) {
            elizaLogger.info("Stage-based approach returned empty, using fallback to get all user messages");
            const allMemories = await _runtime.messageManager.getMemories({
                roomId: _message.roomId,
                count: 50
            });
            
            trustBuildingResponses = allMemories
                .filter(mem => mem.userId !== _message.agentId && mem.content.text.trim())
                .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
                .map(mem => mem.content.text);
            
            elizaLogger.info(`Fallback collected ${trustBuildingResponses.length} user messages`);
        }
        
        const allTrustBuildingText = trustBuildingResponses.join(" ");
        
        elizaLogger.info(`=== TRUST BUILDING RESPONSES ===`);
        elizaLogger.info(`All trust building responses: ${JSON.stringify(trustBuildingResponses)}`);
        elizaLogger.info(`Combined text: ${allTrustBuildingText}`);
        elizaLogger.info(`===============================`);
        
        // Check if we already have any contact info stored
        let existingContactInfo = await getContactInfo(_runtime, _message);
        
        // Try to extract name and phone number from ALL trust building responses
        const extractionContext = `Please extract the user's name and phone number from these responses: "${allTrustBuildingText}"

            Look for:
            - Full name (first and last name)
            - Phone number (any format: xxx-xxx-xxxx, (xxx) xxx-xxxx, xxx.xxx.xxxx, xxxxxxxxxx)
            
            ${existingContactInfo ? `Note: We may already have some info - Name: ${existingContactInfo.name || 'none'}, Phone: ${existingContactInfo.phone || 'none'}` : ''}
            
            Return your response in this exact JSON format:
            {
                "name": "extracted full name or null if not found",
                "phone": "extracted phone number in clean format (xxx-xxx-xxxx) or null if not found",
                "foundName": true/false,
                "foundPhone": true/false
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
            
            elizaLogger.info(`=== NAME & PHONE EXTRACTION ===`);
            elizaLogger.info(`Extracted name: ${parsed.foundName ? parsed.name : 'NO'}`);
            elizaLogger.info(`Extracted phone: ${parsed.foundPhone ? parsed.phone : 'NO'}`);
            elizaLogger.info(`Final name: ${finalName || 'NO'}`);
            elizaLogger.info(`Final phone: ${finalPhone || 'NO'}`);
            elizaLogger.info(`==============================`);

            // If we found both name and phone, save them and proceed
            if (finalName && finalPhone) {
                const contactInfo = {
                    name: finalName,
                    phone: finalPhone,
                    collectedAt: new Date().toISOString()
                };
                
                // Save contact information (overwrite any previous partial info)
                await saveUserResponse(_runtime, _message, "contact_info", JSON.stringify(contactInfo));
                
                // Update user status with contact information
                const statusUpdate = `Contact collected - Name: ${finalName}, Phone: ${finalPhone}`;
                await updateUserStatus(_runtime, _message, statusUpdate);
                
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
            if (finalName || finalPhone) {
                const partialContactInfo = {
                    name: finalName,
                    phone: finalPhone,
                    collectedAt: new Date().toISOString()
                };
                await saveUserResponse(_runtime, _message, "contact_info", JSON.stringify(partialContactInfo));
            }
            
            // If we're missing name or phone, ask for what's missing
            let missingInfoResponse = "";
            if (!finalName && !finalPhone) {
                missingInfoResponse = "I'd love to help you! To get started, could I get your name and phone number? That way I can provide you with personalized information and follow up if needed.";
            } else if (!finalName) {
                missingInfoResponse = `Thanks for the phone number! Could I also get your name so I can personalize our conversation?`;
            } else if (!finalPhone) {
                missingInfoResponse = `Thanks, ${finalName}! Could I also get your phone number? That way I can follow up with any additional information that might be helpful.`;
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
            elizaLogger.error("Error extracting name/phone:", error);
            // Fallback to asking for contact info
            const fallbackResponse = "I'd love to help you! To get started, could I get your name and phone number? That way I can provide you with personalized information and follow up if needed.";
            
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
    
    // First interaction - ask for name and phone
    const initialResponse = "Hello! I'm Grace, and I'm here to help you explore senior living options for your family. To get started, could I get your name and phone number? That way I can provide you with personalized information and follow up if needed.";
    
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
async function handleSituationQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    // Save user response from this stage
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "situation", _message.content.text);
    }
    
    // Get contact information for personalization
    const contactInfo = await getContactInfo(_runtime, _message);
    const userName = contactInfo?.name ? contactInfo.name.split(' ')[0] : "";
    
    // Show previous user responses collected so far
    const previousResponses = await getUserResponses(_runtime, _message);
    elizaLogger.info(`=== SITUATION DISCOVERY STAGE ===`);
    elizaLogger.info(`Previous responses collected: ${JSON.stringify(previousResponses, null, 2)}`);
    elizaLogger.info(`Current user message: ${_message.content.text}`);
    elizaLogger.info(`Contact info: ${JSON.stringify(contactInfo)}`);
    elizaLogger.info(`================================`)
    
    //Decide to move on to the next or to final
    const context = `The user ${userName ? `(${userName}) ` : ''}responded to my request to ask questions before we begin. Their response was: ${_message.content.text}

            Please analyze this response and provide TWO things in JSON format:
            1. A brief report about the user's current status, needs, and what they want
            2. A thoughtful, empathetic response that:
               - First acknowledges and validates their response with understanding
               - Shows genuine care and empathy for their situation
               - Provides a brief, relevant insight or reassurance about their feelings/concerns
               - Then naturally transitions to asking what brought them here today or what feels most important to them right now
               - Should be warm, conversational, and show deep understanding (not too short, but not overly long)

            Return your response in this exact JSON format:
            {
                "userReport": "Brief analysis of user's status, needs, and what they want based on their response",
                "responseMessage": "A thoughtful response that acknowledges their answer, shows empathy and understanding, provides brief insight or reassurance, then naturally asks what brought them here today or what feels most important. Keep it warm, genuine, conversational, and LIMIT TO 40 WORDS OR LESS."
            }

            Make sure to return ONLY valid JSON, no additional text.`;

    const aiResponse = await generateText({
        runtime: _runtime,
        context: context,
        modelClass: ModelClass.SMALL
    });

    // Parse the JSON response
    let userReport = "";
    let answer = "";
    
    try {
        const parsed = JSON.parse(aiResponse);
        userReport = parsed.userReport || "";
        answer = parsed.responseMessage || "";
        
        // Log the extracted information
        elizaLogger.info(`=== EXTRACTED USER REPORT ===`);
        elizaLogger.info(userReport);
        elizaLogger.info(`=== RESPONSE MESSAGE ===`);
        elizaLogger.info(answer);
        elizaLogger.info(`=============================`);
        
        // Save the user status report
        await updateUserStatus(_runtime, _message, userReport);
        
    } catch (error) {
        elizaLogger.error("Failed to parse JSON response:", error);
        // Fallback to using the entire response as the answer
        answer = aiResponse;
        userReport = `Unable to parse user status from response: ${_message.content.text}`;
        await updateUserStatus(_runtime, _message, userReport);
    }

    // Store the asked question in memory with stage transition
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: {
            text: answer,
            metadata: { 
                askedQuestion: answer,
                stage: "lifestyle_discovery"
            }
        }
    });
    return answer;
}

// Lifestyle Discovery Handler  
async function handleLifestyleQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    // Save user response from this stage
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "lifestyle", _message.content.text);
    }
    
    // Show previous user responses collected so far
    const previousResponses = await getUserResponses(_runtime, _message);
    elizaLogger.info(`=== LIFESTYLE DISCOVERY STAGE ===`);
    elizaLogger.info(`Previous responses collected: ${JSON.stringify(previousResponses, null, 2)}`);
    elizaLogger.info(`Current user message: ${_message.content.text}`);
    elizaLogger.info(`Current user status: ${discoveryState.userStatus}`);
    elizaLogger.info(`=================================`)
    
    // Analyze user response and update status using AI
    const context = `Current user status: "${discoveryState.userStatus}"
                    User's latest response about their situation: "${_message.content.text}"
                    
                    Please analyze this information and provide TWO things in JSON format:
                    1. An updated comprehensive status report about the user's situation, needs, and what they want, building on the previous status
                    2. A thoughtful, empathetic response that:
                       - First acknowledges and validates what they shared about their situation
                       - Shows genuine understanding of their concerns and feelings
                       - Provides reassurance or insight about their experience (e.g., "That sounds really challenging" or "You're clearly very thoughtful about this")
                       - Then naturally transitions to asking about their loved one's daily life or what they enjoy doing
                       - Should demonstrate deep listening and emotional intelligence
                    
                    Return your response in this exact JSON format:
                    {
                        "updatedUserStatus": "Updated comprehensive analysis of user's status, needs, and what they want, incorporating the new information",
                        "responseMessage": "A thoughtful response that acknowledges their situation, shows understanding and empathy, provides reassurance or validation, then naturally asks about their loved one's daily life or activities they enjoy. Keep it warm, genuine, conversational, and LIMIT TO 35 WORDS OR LESS."
                    }
                    
                    Make sure to return ONLY valid JSON, no additional text.`;
    const aiResponse = await generateText({
        runtime: _runtime,
        context: context,
        modelClass: ModelClass.SMALL
    });

    // Parse the JSON response
    let updatedUserStatus = "";
    let answer = "";
    
    try {
        const parsed = JSON.parse(aiResponse);
        updatedUserStatus = parsed.updatedUserStatus || "";
        answer = parsed.responseMessage || "";
        
        // Log the extracted information
        elizaLogger.info(`=== UPDATED USER STATUS ===`);
        elizaLogger.info(updatedUserStatus);
        elizaLogger.info(`=== RESPONSE MESSAGE ===`);
        elizaLogger.info(answer);
        elizaLogger.info(`===========================`);
        
        // Save the updated user status
        await updateUserStatus(_runtime, _message, updatedUserStatus);
        
    } catch (error) {
        elizaLogger.error("Failed to parse JSON response:", error);
        // Fallback to using the entire response as the answer
        answer = aiResponse;
        updatedUserStatus = `${discoveryState.userStatus} | Lifestyle update: ${_message.content.text}`;
        await updateUserStatus(_runtime, _message, updatedUserStatus);
    }

    // Store the asked question in memory with stage transition
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: {
            text: answer,
            metadata: { 
                askedQuestion: answer,
                stage: "readiness_discovery"
            }
        }
    });
    return answer;
}

// Readiness Discovery Handler
async function handleReadinessQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    // Save user response from this stage
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "readiness", _message.content.text);
    }
    
    // Show previous user responses collected so far
    const previousResponses = await getUserResponses(_runtime, _message);
    elizaLogger.info(`=== READINESS DISCOVERY STAGE ===`);
    elizaLogger.info(`Previous responses collected: ${JSON.stringify(previousResponses, null, 2)}`);
    elizaLogger.info(`Current user message: ${_message.content.text}`);
    elizaLogger.info(`Current user status: ${discoveryState.userStatus}`);
    elizaLogger.info(`=================================`)
    
    // Analyze user response and update status using AI
    const context = `Current user status: "${discoveryState.userStatus}"
                    User's latest response about their loved one's lifestyle: "${_message.content.text}"

                    Please analyze this lifestyle information and provide TWO things in JSON format:
                    1. An updated comprehensive status report about the user's situation, needs, and what they want, building on the previous status
                    2. A thoughtful, empathetic response that:
                       - First acknowledges and validates what they shared about their loved one's daily life and activities
                       - If they mentioned specific interests (reading, sewing, gardening, music, crafts, cooking, etc.), briefly mention how wonderful those interests are
                       - Connect their interests to similar activities available at senior communities (like "book clubs" for readers, "sewing circles" for sewers, "gardening groups" for gardeners)
                       - Then naturally transitions to asking about their loved one's awareness of the situation or readiness for change
                       - Should demonstrate care for both the user and their loved one

                    Return your response in this exact JSON format:
                    {
                        "updatedUserStatus": "Updated comprehensive analysis of user's status, needs, and what they want, incorporating the new lifestyle information",
                        "responseMessage": "A thoughtful response that acknowledges their loved one's lifestyle, appreciates their interests, briefly connects interests to community activities (book clubs, sewing groups, etc.), then naturally asks about their loved one's awareness or readiness. Keep it warm, genuine, conversational, and LIMIT TO 40 WORDS OR LESS."
                    }

                    Make sure to return ONLY valid JSON, no additional text.`;

    const aiResponse = await generateText({
        runtime: _runtime,
        context: context,
        modelClass: ModelClass.SMALL
    });

    // Parse the JSON response
    let updatedUserStatus = "";
    let answer = "";
    
    try {
        const parsed = JSON.parse(aiResponse);
        updatedUserStatus = parsed.updatedUserStatus || "";
        answer = parsed.responseMessage || "";
        
        // Log the extracted information
        elizaLogger.info(`=== UPDATED USER STATUS ===`);
        elizaLogger.info(updatedUserStatus);
        elizaLogger.info(`=== RESPONSE MESSAGE ===`);
        elizaLogger.info(answer);
        elizaLogger.info(`===========================`);
        
        // Save the updated user status
        await updateUserStatus(_runtime, _message, updatedUserStatus);
        
    } catch (error) {
        elizaLogger.error("Failed to parse JSON response:", error);
        // Fallback to using the entire response as the answer
        answer = aiResponse;
        updatedUserStatus = `${discoveryState.userStatus} | Readiness update: ${_message.content.text}`;
        await updateUserStatus(_runtime, _message, updatedUserStatus);
    }

    // Store the asked question in memory with stage transition
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: {
            text: answer,
            metadata: { 
                askedQuestion: answer,
                stage: "priorities_discovery"
            }
        }
    });
    return answer;
}

// Priority Discovery Handler
async function handlePriorityQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    // Save user response from this stage
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "priorities", _message.content.text);
    }
    
    // Show previous user responses collected so far
    const previousResponses = await getUserResponses(_runtime, _message);
    elizaLogger.info(`=== PRIORITY DISCOVERY STAGE ===`);
    elizaLogger.info(`Previous responses collected: ${JSON.stringify(previousResponses, null, 2)}`);
    elizaLogger.info(`Current user message: ${_message.content.text}`);
    elizaLogger.info(`Current user status: ${discoveryState.userStatus}`);
    elizaLogger.info(`================================`)
    
    // Analyze user response and update status using AI
    const context = `Current user status: "${discoveryState.userStatus}"
                    User's latest response about their loved one's readiness: "${_message.content.text}"

                    Please analyze this readiness information and provide TWO things in JSON format:
                    1. An updated comprehensive status report about the user's situation, needs, and what they want, building on the previous status
                    2. A thoughtful, empathetic response that:
                       - First acknowledges and validates what they shared about their loved one's readiness and feelings
                       - Shows genuine understanding of the emotional complexity of the situation
                       - Provides reassurance or insight about the transition process or their loved one's feelings
                       - Then naturally transitions to asking about their priorities in choosing a community or what support would be most meaningful
                       - Should demonstrate sensitivity to the emotional aspects of this decision

                    Return your response in this exact JSON format:
                    {
                        "updatedUserStatus": "Updated comprehensive analysis of user's status, needs, and what they want, incorporating the new readiness information",
                        "responseMessage": "A thoughtful response that acknowledges their loved one's readiness, shows understanding of the emotional complexity, provides reassurance about the process, then naturally asks about their priorities or support needs. Keep it warm, genuine, conversational, and LIMIT TO 35 WORDS OR LESS."
                    }

                    Make sure to return ONLY valid JSON, no additional text.`;

    const aiResponse = await generateText({
        runtime: _runtime,
        context: context,
        modelClass: ModelClass.SMALL
    });

    // Parse the JSON response
    let updatedUserStatus = "";
    let answer = "";
    
    try {
        const parsed = JSON.parse(aiResponse);
        updatedUserStatus = parsed.updatedUserStatus || "";
        answer = parsed.responseMessage || "";
        
        // Log the extracted information
        elizaLogger.info(`=== UPDATED USER STATUS ===`);
        elizaLogger.info(updatedUserStatus);
        elizaLogger.info(`=== RESPONSE MESSAGE ===`);
        elizaLogger.info(answer);
        elizaLogger.info(`===========================`);
        
        // Save the updated user status
        await updateUserStatus(_runtime, _message, updatedUserStatus);
        
    } catch (error) {
        elizaLogger.error("Failed to parse JSON response:", error);
        // Fallback to using the entire response as the answer
        answer = aiResponse;
        updatedUserStatus = `${discoveryState.userStatus} | Priority update: ${_message.content.text}`;
        await updateUserStatus(_runtime, _message, updatedUserStatus);
    }

    // Store the asked question in memory with stage transition
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: {
            text: answer,
            metadata: { 
                askedQuestion: answer,
                stage: "needs_matching"
            }
        }
    });
    return answer;
}

// Needs Matching Handler
async function handleNeedsMatching(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    // Save the final user response if this is a user message
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "priorities", _message.content.text);
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
    elizaLogger.info(`===============================`);
    
    // Get current user status for final analysis
    elizaLogger.info(`Current user status before final analysis: ${discoveryState.userStatus}`);
    
    // Combine all responses for comprehensive analysis
    const allUserResponses = [
        ...situationResponses,
        ...lifestyleResponses,
        ...readinessResponses,
        ...prioritiesResponses
    ].join(" ");
    
    const finalStatusUpdate = `Complete discovery phase finished. Current status: ${discoveryState.userStatus}. All responses: ${allUserResponses}. Ready for needs matching and Grand Villa recommendations.`;
    await updateUserStatus(_runtime, _message, finalStatusUpdate);
    
    // Generate personalized needs matching response based on all user responses
    let finalResponse = "";
    try {
        const prompt = `Current comprehensive user status: "${discoveryState.userStatus}"
                        All user responses throughout discovery: "${allUserResponses}"

                        Based on this understanding, generate a short, warm response that:
                        1. Briefly acknowledges their loved one's main needs and personality
                        2. If they mentioned specific interests (reading, sewing, gardening, music, crafts, cooking, games, etc.), specifically mention how Grand Villa has those activities (book clubs, sewing circles, gardening groups, music programs, art classes, cooking activities, game nights, etc.)
                        3. Simply explains why Grand Villa feels like a good fit for their situation
                        4. Encourages them to visit to see it for themselves

                        Keep it conversational, caring, and personal. LIMIT TO 60 WORDS OR LESS. Make it feel like you really listened to their specific situation.`;
        
        const personalizedResponse = await generateText({
            runtime: _runtime,
            context: prompt,
            modelClass: ModelClass.SMALL
        });
        
        if (personalizedResponse) {
            elizaLogger.info(`Generated personalized needs matching response: ${personalizedResponse}`);
            finalResponse = personalizedResponse;
        }
    } catch (error) {
        elizaLogger.error(`Error generating personalized needs matching response: ${error}`);
    }

    // Fallback to default response if generation fails
    if (!finalResponse) {
        finalResponse = `I can see how much you care about finding the right place. Grand Villa has wonderful activities like book clubs, sewing circles, gardening groups, and music programs. The staff really focus on making residents feel at home. Would you like to visit so you can see what daily life would feel like?`;
    }
    
    // Store the needs matching response in memory with stage transition
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
    
    return finalResponse;
}

// Info Sharing Handler
async function handleInfoSharing(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    // Save user response from this stage
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "info_sharing", _message.content.text);
    }
    
    // Show previous user responses collected so far
    const previousResponses = await getUserResponses(_runtime, _message);
    elizaLogger.info(`=== INFO SHARING STAGE ===`);
    elizaLogger.info(`Previous responses collected: ${JSON.stringify(previousResponses, null, 2)}`);
    elizaLogger.info(`Current user message: ${_message.content.text}`);
    elizaLogger.info(`Current user status: ${discoveryState.userStatus}`);
    elizaLogger.info(`==============================`)
    
    // Generate response using AI with Grand Villa information as context
    const context = `User asked: "${_message.content.text}"
                    Current user status: "${discoveryState.userStatus}"
                    
                    Grand Villa Information:
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
                    They provide medication delivery, technology-enabled care tracking, and hurricane preparedness in Florida locations.
                    Their environment is family-friendly and looks like a home with a resort-style feel.
                    They have flexible monthly rates covering most services.
                    They also offer senior day programs and short-term stays for respite care.
                    
                    Please provide a helpful, warm response that answers the user's question using the Grand Villa information above. If they ask about activities, mention specific ones that match interests mentioned earlier in the conversation. Keep it short, simple and clear - LIMIT TO 40 WORDS OR LESS. Make it personal and caring.`;
    
    let response = "";
    try {
        const aiResponse = await generateText({
            runtime: _runtime,
            context: context,
            modelClass: ModelClass.SMALL
        });
        
        response = aiResponse || "I'd be happy to help you learn more about Grand Villa. What would you like to know?";
    } catch (error) {
        elizaLogger.error("Error generating AI response for info sharing:", error);
        response = "I'd be happy to help you learn more about Grand Villa. What would you like to know?";
    }
    
    // Update user status with the information shared
    const updatedStatus = `${discoveryState.userStatus} | Asked about: ${_message.content.text}`;
    await updateUserStatus(_runtime, _message, updatedStatus);
    
    // Store the response in memory with stage transition to visit_transition
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: {
            text: response,
            metadata: { 
                askedQuestion: response,
                stage: "info_sharing"
            }
        }
    });
    
    return response;
}

// Visit Transition Handler
async function handleVisitTransition(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    return "It sounds like your family member could really thrive here, and I'd love for you to experience it firsthand. Why don't we set up a time for you to visit, tour the community, and even enjoy a meal with us? That way, you can really see what daily life would feel like.\n\nWould Wednesday afternoon or Friday morning work better for you?";
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

// Helper function to get stored contact information
async function getContactInfo(_runtime: IAgentRuntime, _message: Memory): Promise<{name?: string, phone?: string} | null> {
    try {
        const userResponses = await getUserResponses(_runtime, _message);
        const contactInfoArray = userResponses.contact_info || [];
        
        if (contactInfoArray.length > 0) {
            const latestContactInfo = contactInfoArray[contactInfoArray.length - 1];
            const parsed = JSON.parse(latestContactInfo);
            elizaLogger.info(`Retrieved contact info: Name=${parsed.name}, Phone=${parsed.phone}`);
            return { name: parsed.name, phone: parsed.phone };
        }
    } catch (error) {
        elizaLogger.error("Error retrieving contact info:", error);
    }
    
    return null;
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
    
    // Collect user messages within the stage boundaries
    if (stageStartIndex !== -1) {
        for (let i = stageStartIndex + 1; i < stageEndIndex; i++) {
            const memory = sortedMemories[i];
            if (memory.userId !== _message.agentId) {
                userAnswers.push(memory.content.text);
                elizaLogger.info(`Collected user answer in ${stage}: ${memory.content.text}`);
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

async function handleGeneralInquiry(_runtime: IAgentRuntime, _message: Memory, _state: State): Promise<string> {
    return "I'd be happy to help you learn more about Grand Villa. What would you like to know?";
}