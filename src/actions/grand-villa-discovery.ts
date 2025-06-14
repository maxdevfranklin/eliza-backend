import { Action, generateText, IAgentRuntime, Memory, ModelClass, State, HandlerCallback, elizaLogger } from "@elizaos/core";
import { discoveryStateProvider } from "../providers/discovery-state.js";

export const grandVillaDiscoveryAction: Action = {
    name: "grand-villa-discovery",
    description: "Guide families through the Sherpa discovery process for Grand Villa",
    similes: ["GRAND_VILLA", "SENIOR_LIVING", "DISCOVERY", "QUESTIONS", "LEARN_ABOUT"],
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "I'm looking for information about Grand Villa" }
            },
            {
                user: "{{user2}}", 
                content: { text: "I'd be happy to get you the information you need, but before I do, do you mind if I ask a few quick questions? That way, I can really understand what's important and make sure I'm helping in the best way possible." }
            }
        ]
    ],
    
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        const discoveryState = await getDiscoveryState(_runtime, _message);
        elizaLogger.info(`Discovery state: ${JSON.stringify(discoveryState)}`);
        elizaLogger.info("Action is triggered");
        return true;
    },
    
    handler: async (
        _runtime: IAgentRuntime,
        _message: Memory,
        _state: State,
        _options: { [key: string]: unknown },
        _callback: HandlerCallback
    ) => {
        elizaLogger.info("Starting Grand Villa Discovery process");
        
        // Get current discovery state
        const discoveryState = await getDiscoveryState(_runtime, _message);
        elizaLogger.info(`Current discovery state in handler: ${JSON.stringify(discoveryState)}`);
        
        // Determine conversation stage and next action
        const conversationStage = await determineConversationStage(_runtime, _message, discoveryState);
        elizaLogger.info(`Determined conversation stage: ${conversationStage}`);
        
        let response_text = "";
        
        switch (conversationStage) {
            case "trust_building":
                elizaLogger.info("Entering trust_building case");
                response_text = await handleTrustBuilding(_runtime, _message, _state);
                elizaLogger.info(`Trust building response: ${response_text}`);
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
                
            case "visit_transition":
                response_text = await handleVisitTransition(_runtime, _message, _state, discoveryState);
                break;
                
            default:
                response_text = await handleGeneralInquiry(_runtime, _message, _state);
        }
        
        // Update discovery state
        // await updateDiscoveryState(_runtime, _message, conversationStage, response_text);
        
        _callback({ 
          text: response_text,
          metadata: {
            stage: conversationStage
          }
        });
        return true;
    }
}

// Trust Building Handler
async function handleTrustBuilding(_runtime: IAgentRuntime, _message: Memory, _state: State): Promise<string> {
    elizaLogger.info("Handling trust building stage");
    const response = "I'd be happy to get you the information you need, but before I do, do you mind if I ask a few quick questions? That way, I can really understand what's important and make sure I'm helping in the best way possible.";
    
    // Store the response and stage transition in a single message
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
    
    elizaLogger.info(`Stored response and stage transition to situation_discovery`);
    return response;
}

// Situation Discovery Handler
async function handleSituationQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    const unansweredQuestions = [
        "I’m really glad you reached out — it’s a big step, and I’m here to listen. Can I ask what made you decide to call us today?",
        "I really appreciate you taking the time to share your thoughts with me. To help me better understand what matters most to you at this moment… Could you tell me what's your greatest concern right now?", 
        "Thanks for sharing all with me. Before we explore possible next steps, I'd like to understand a bit more about how things have been for you and your loved ones. How is this situation impacting your family?"
    ].filter(q => !discoveryState.questionsAsked.includes(q));
    
    let question = "";
    if (unansweredQuestions.length > 0) {
        // Pick a random question
        question = unansweredQuestions[Math.floor(Math.random() * unansweredQuestions.length)];
    } else {
        // If all have been asked, just thank and move on
        question = "Thank you for sharing that with me.";
    }
    // Store the asked question in memory with stage transition
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: {
            text: question,
            metadata: { 
                askedQuestion: question,
                stage: "lifestyle_discovery"  // Set the next stage in metadata
            }
        }
    });
    return question;
}

// Lifestyle Discovery Handler  
async function handleLifestyleQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    const unansweredQuestions = [
        "Thank you for sharing so openly — I can tell how much you care. Let's talk about your Mom or Dad. What does a typical day look like for them?",
        "Thank you, It sounds like you know your parents so well, and that’s truly wonderful. Could you tell me what are some things your parents love doing?",
        "Thank you for helping me understand them better — I can see how much their happiness means to you. Sometimes, as life changes, our loved ones step away from things they used to love. What's something they've always enjoyed but may have stopped doing recently?"
    ].filter(q => !discoveryState.questionsAsked.includes(q));
    
    let question = "";
    if (unansweredQuestions.length > 0) {
        question = unansweredQuestions[Math.floor(Math.random() * unansweredQuestions.length)];
    } else {
        question = "Thank you for sharing that with me.";
    }

    // Store the asked question in memory with stage transition
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: {
            text: question,
            metadata: { 
                askedQuestion: question,
                stage: "readiness_discovery"  // Set the next stage in metadata
            }
        }
    });
    return question;
}

// Readiness Discovery Handler
async function handleReadinessQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    const unansweredQuestions = [
        "Ok, Looks great. I can feel that you really care your family. Can I ask you if your Mom or Dad aware that you're looking at options?",
        "Great, I can feel that you really care your family. How do they feel about the idea of moving?",
    ].filter(q => !discoveryState.questionsAsked.includes(q));
    
    let question = "";
    if (unansweredQuestions.length > 0) {
        question = unansweredQuestions[Math.floor(Math.random() * unansweredQuestions.length)];
    } else {
        question = "Thank you for sharing that with me.";
    }
    // Store the asked question in memory with stage transition
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: {
            text: question,
            metadata: { 
                askedQuestion: question,
                stage: "priorities_discovery"  // Set the next stage in metadata
            }
        }
    });
    return question;
}

// Priority Discovery Handler
async function handlePriorityQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    const unansweredQuestions = [
        "Finding the right community can make all the difference in feeling at home and supported. We want to make sure the place you choose truly fits your family’s needs and values. What's most important to you in the community you choose?",
        "Everyone’s needs are different, and the right kind of support can really ease the transition. We want to understand what would help your family feel comfortable and cared for every step of the way. What kind of support do you feel would make the biggest difference for your family?"
    ].filter(q => !discoveryState.questionsAsked.includes(q));
    
    let question = "";
    if (unansweredQuestions.length > 0) {
        question = unansweredQuestions[Math.floor(Math.random() * unansweredQuestions.length)];
    } else {
        question = "Thank you for sharing that with me.";
    }
    // Store the asked question in memory with stage transition
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: {
            text: question,
            metadata: { 
                askedQuestion: question,
                stage: "needs_matching"  // Set the next stage in metadata
            }
        }
    });
    return question;
}

// Needs Matching Handler
async function handleNeedsMatching(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    const identifiedNeeds = discoveryState.identifiedNeeds || [];
    
    // Hard-coded Grand Villa features for MVP
    const grandVillaFeatures = {
        dining: "Since you mentioned that making sure your mom eats well is important, I think you'll love learning more about our chef-prepared meals. We focus on fresh, nutritious options, and residents enjoy a social dining experience, which often improves appetite and overall well-being.",
        
        activities: "Since your dad used to love gardening, I think he'd really enjoy our resident-led gardening club. It's a great way for him to do something he enjoys while meeting new people in a relaxed setting.",
        
        safety: "Since your mom has had a few falls recently, I want to highlight the extra safety measures in place here—like our emergency response system and 24/7 trained staff. That way, she has independence but also support when needed.",
        
        social: "I can see that staying socially connected is important. Our community really focuses on building friendships through shared meals, group activities, and common spaces where residents naturally gather.",
        
        independence: "It sounds like maintaining independence is crucial. Grand Villa is designed to support that—residents have their own apartments but can access help when they need it."
    };
    
    // Match needs to features (simplified for MVP)
    let matchedFeatures = [];
    
    if (identifiedNeeds.includes("nutrition") || identifiedNeeds.includes("eating") || identifiedNeeds.includes("meals")) {
        matchedFeatures.push(grandVillaFeatures.dining);
    }
    if (identifiedNeeds.includes("activities") || identifiedNeeds.includes("hobbies") || identifiedNeeds.includes("gardening")) {
        matchedFeatures.push(grandVillaFeatures.activities);
    }
    if (identifiedNeeds.includes("safety") || identifiedNeeds.includes("falls") || identifiedNeeds.includes("emergency")) {
        matchedFeatures.push(grandVillaFeatures.safety);
    }
    if (identifiedNeeds.includes("social") || identifiedNeeds.includes("lonely") || identifiedNeeds.includes("friends")) {
        matchedFeatures.push(grandVillaFeatures.social);
    }
    
    if (matchedFeatures.length === 0) {
        matchedFeatures.push(grandVillaFeatures.independence); // Default
    }
    
    const response = matchedFeatures.join("\n\n") + "\n\n" + await moveToNextStage(_runtime, _message, "visit_transition");
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

async function handleGeneralInquiry(_runtime: IAgentRuntime, _message: Memory, _state: State): Promise<string> {
    return "I'd be happy to help you learn more about Grand Villa. Could you tell me what specific information you're looking for?";
}