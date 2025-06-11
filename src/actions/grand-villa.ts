import { Action, generateText, IAgentRuntime, Memory, ModelClass, State, HandlerCallback, elizaLogger, ActionExample } from "@elizaos/core";

interface DiscoveryState {
    currentStage: string;
    questionsAsked: string[];
    identifiedNeeds: string[];
    lastResponse: string;
}

interface ExtendedRuntime extends IAgentRuntime {
    getState(key: string): Promise<any>;
    setState(key: string, value: any): Promise<void>;
}

async function getDiscoveryState(runtime: ExtendedRuntime, message: Memory): Promise<DiscoveryState> {
    const state = await runtime.getState("discovery") as DiscoveryState;
    return state || {
        currentStage: "trust_building",
        questionsAsked: [],
        identifiedNeeds: [],
        lastResponse: ""
    };
}

async function updateDiscoveryState(
    runtime: ExtendedRuntime, 
    message: Memory, 
    stage: string, 
    response: string
): Promise<void> {
    const state = await getDiscoveryState(runtime, message);
    state.currentStage = stage;
    state.lastResponse = response;
    await runtime.setState("discovery", state);
}

async function determineConversationStage(
    runtime: ExtendedRuntime,
    message: Memory,
    discoveryState: DiscoveryState
): Promise<string> {
    // If we're in the middle of a stage, stay there
    if (discoveryState.currentStage !== "trust_building") {
        return discoveryState.currentStage;
    }

    // Check if we've completed trust building
    const trustBuildingComplete = discoveryState.questionsAsked.length > 0;
    return trustBuildingComplete ? "situation_discovery" : "trust_building";
}

async function moveToNextStage(
    runtime: ExtendedRuntime,
    message: Memory,
    state: State,
    nextStage: string
): Promise<string> {
    await updateDiscoveryState(runtime, message, nextStage, "");
    return "";
}

async function handleGeneralInquiry(runtime: ExtendedRuntime, message: Memory, state: State): Promise<string> {
    return "I understand you're interested in learning more about Grand Villa. Let me help guide you through what makes our community special. Could you tell me what brought you to look into senior living options today?";
}

export const grandVillaDiscoveryAction: Action = {
    name: "grand-villa-discovery",
    description: "Guide families through the Sherpa discovery process for Grand Villa",
    similes: ["SENIOR_LIVING_GUIDE", "GRAND_VILLA", "COMMUNITY_DISCOVERY", "FACILITY_EXPLORATION", "SENIOR_CARE_OPTIONS"],
    examples: [],
    validate: async (_runtime: ExtendedRuntime, _message: Memory) => {
        return true;
    },
    handler: async (
        _runtime: ExtendedRuntime,
        _message: Memory,
        _state: State,
        _options: { [key:string]: unknown},
        _callback: HandlerCallback
    ) => {
        elizaLogger.info("Starting Grand Villa action handler");
        
        //Get Current discovery state
        const discoveryState = await getDiscoveryState(_runtime, _message);

        //Determine conversation stage and next action
        const conversationStage = await determineConversationStage(_runtime, _message, discoveryState);

        let response_text = "";

        switch(conversationStage) {
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
            case "visit_transition":
                response_text = await handleVisitTransition(_runtime, _message, _state, discoveryState);
                break;
            default:
                response_text = await handleGeneralInquiry(_runtime, _message, _state);
        }

        await updateDiscoveryState(_runtime, _message, conversationStage, response_text);

        _callback({text: response_text});
        return true;
    }
}

async function handleTrustBuilding(runtime: ExtendedRuntime, message: Memory, state: State): Promise<string> {
    const discoveryState = await getDiscoveryState(runtime, message);
    if (!discoveryState.questionsAsked.includes("initial_trust")) {
        discoveryState.questionsAsked.push("initial_trust");
        await updateDiscoveryState(runtime, message, "trust_building", "");
        return "I'd be happy to get you the information you need, but before I do, do you mind if I ask a few quick questions? That way, I can really understand what's important and make sure I'm helping in the best way possible.";
    }
    return await moveToNextStage(runtime, message, state, "situation_discovery");
}

async function handleSituationQuestions(runtime: ExtendedRuntime, message: Memory, state: State, discoveryState: DiscoveryState): Promise<string> {
    const unansweredQuestions = [
        "What made you decide to call us today?",
        "What's your greatest concern right now?", 
        "How is this situation impacting your family?"
    ].filter(q => !discoveryState.questionsAsked.includes(q));

    if (unansweredQuestions.length > 0) {
        const question = unansweredQuestions[0];
        discoveryState.questionsAsked.push(question);
        await updateDiscoveryState(runtime, message, "situation_discovery", question);
        return question;
    }

    return "Thank you for sharing that." + await moveToNextStage(runtime, message, state, "lifestyle_discovery");
}

// Lifestyle Discovery Handler  
async function handleLifestyleQuestions(runtime: ExtendedRuntime, message: Memory, state: State, discoveryState: DiscoveryState): Promise<string> {
    const unansweredQuestions = [
        "Tell me about your Mom or Dad. What does a typical day look like for them?",
        "What are some things they love doing?",
        "What's something they've always enjoyed but may have stopped doing recently?"
    ].filter(q => !discoveryState.questionsAsked.includes(q));
    
    if (unansweredQuestions.length > 0) {
        const question = unansweredQuestions[0];
        discoveryState.questionsAsked.push(question);
        await updateDiscoveryState(runtime, message, "lifestyle_discovery", question);
        return question;
    }
    
    return await moveToNextStage(runtime, message, state, "readiness_discovery");
}

async function handleReadinessQuestions(runtime: ExtendedRuntime, message: Memory, state: State, discoveryState: DiscoveryState): Promise<string> {
    const unansweredQuestions = [
        "Is your Mom or Dad aware that you're looking at options?",
        "How do they feel about the idea of moving?",
        "Who else is involved in helping make this decision?"
    ].filter(q => !discoveryState.questionsAsked.includes(q));
    
    if (unansweredQuestions.length > 0) {
        const question = unansweredQuestions[0];
        discoveryState.questionsAsked.push(question);
        await updateDiscoveryState(runtime, message, "readiness_discovery", question);
        return question;
    }
    
    return await moveToNextStage(runtime, message, state, "priorities_discovery");
}

// Priority Discovery Handler
async function handlePriorityQuestions(runtime: ExtendedRuntime, message: Memory, state: State, discoveryState: DiscoveryState): Promise<string> {
    const unansweredQuestions = [
        "What's most important to you in the community you choose?",
        "What kind of support do you feel would make the biggest difference for your family?"
    ].filter(q => !discoveryState.questionsAsked.includes(q));
    
    if (unansweredQuestions.length > 0) {
        const question = unansweredQuestions[0];
        discoveryState.questionsAsked.push(question);
        await updateDiscoveryState(runtime, message, "priorities_discovery", question);
        return question;
    }
    
    return await moveToNextStage(runtime, message, state, "needs_matching");
}

async function handleNeedsMatching(runtime: ExtendedRuntime, message: Memory, state: State, discoveryState: DiscoveryState): Promise<string> {
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
     
     const response = matchedFeatures.join("\n\n") + "\n\n" + await moveToNextStage(runtime, message, state, "visit_transition");
     return response;
 }

 // Visit Transition Handler
async function handleVisitTransition(runtime: ExtendedRuntime, message: Memory, state: State, discoveryState: DiscoveryState): Promise<string> {
    return "It sounds like your family member could really thrive here, and I'd love for you to experience it firsthand. Why don't we set up a time for you to visit, tour the community, and even enjoy a meal with us? That way, you can really see what daily life would feel like.\n\nWould Wednesday afternoon or Friday morning work better for you?";
}