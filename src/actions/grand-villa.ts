import { Action, generateText, IAgentRuntime, Memory, ModelClass, State, HandlerCallback, elizaLogger, ActionExample } from "@elizaos/core";

export const grandVillaDiscoveryAction: Action = {
    name: "grand-villa-discovery",
    description: "Guide families through the Sherpa discovery process for Grand Villa",
    similes: ["SENIOR_LIVING_GUIDE", "GRAND_VILLA", "COMMUNITY_DISCOVERY", "FACILITY_EXPLORATION", "SENIOR_CARE_OPTIONS"],
    examples: [],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    handler: async (
        _runtime: IAgentRuntime,
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

async function handleTrustBuilding(runtime: IAgentRuntime, message: Memory, state: State): Promise<string> {
    return "I'd be happy to get you the information you need, but before I do, do you mind if I ask a few quick questions? That way, I can really understand what's important and make sure I'm helping in the best way possible.";
}

async function handleSituationQuestions(runtime: IAgentRuntime, message: Memory, state: State, discoveryState: any): Promise<string> {
    const unansweredQuestions = [
        "What made you decide to call us today?",
        "What's your greatest concern right now?", 
        "How is this situation impacting your family?"
    ].filter(q => !discoveryState.questions.includes(q));

    if (unansweredQuestions.length > 0) {
        const question = unansweredQuestions[0];
    }

    return "Thank you for sharing that." + await moveToNextStage(runtime, message, state, "lifestyle_discovery");
}

// Lifestyle Discovery Handler  
async function handleLifestyleQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    const unansweredQuestions = [
        "Tell me about your Mom or Dad. What does a typical day look like for them?",
        "What are some things they love doing?",
        "What's something they've always enjoyed but may have stopped doing recently?"
    ].filter(q => !discoveryState.questionsAsked.includes(q));
    
    if (unansweredQuestions.length > 0) {
        return unansweredQuestions[0];
    }
    
    return await moveToNextStage(_runtime, _message, "readiness_discovery");
}

async function handleReadinessQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    const unansweredQuestions = [
        "Is your Mom or Dad aware that you're looking at options?",
        "How do they feel about the idea of moving?",
        "Who else is involved in helping make this decision?"
    ].filter(q => !discoveryState.questionsAsked.includes(q));
    
    if (unansweredQuestions.length > 0) {
        return unansweredQuestions[0];
    }
    
    return await moveToNextStage(_runtime, _message, "priorities_discovery");
}

// Priority Discovery Handler
async function handlePriorityQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    const unansweredQuestions = [
        "What's most important to you in the community you choose?",
        "What kind of support do you feel would make the biggest difference for your family?"
    ].filter(q => !discoveryState.questionsAsked.includes(q));
    
    if (unansweredQuestions.length > 0) {
        return unansweredQuestions[0];
    }
    
    return await moveToNextStage(_runtime, _message, "needs_matching");
}

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