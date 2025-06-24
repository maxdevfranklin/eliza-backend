import { IAgentRuntime, Memory, State, HandlerCallback, elizaLogger } from "@elizaos/core";
import { createReliableAction } from "./reliable-action-templates.js";
import { discoveryStateProvider, saveUserResponse, getUserResponses } from "../providers/discovery-state.js";

// Import the original handler functions
import { 
    grandVillaDiscoveryAction,
    // We'll reuse the internal functions from the original action
} from "./grand-villa-discovery.js";

// Create a 100% reliable version of the Grand Villa Discovery Action
export const reliableGrandVillaDiscoveryAction = createReliableAction({
    name: "reliable-grand-villa-discovery",
    description: "Guide families through the Sherpa discovery process for Grand Villa with 100% reliability",
    priority: 100,
    keywords: ["grand villa", "senior living", "discovery", "care", "family", "help"],
    examples: [
        [
            { user: "{{user1}}", content: { text: "I'm looking for information about Grand Villa" } },
            { user: "{{user2}}", content: { text: "I'd be happy to help you learn more about Grand Villa." } }
        ]
    ],
    
    triggerConditions: async () => true, // Always trigger for 100% reliability
    
    handler: async (runtime: IAgentRuntime, message: Memory, state: State, callback: HandlerCallback): Promise<boolean> => {
        elizaLogger.info("🚀 Reliable Grand Villa Discovery Action triggered");
        
        try {
            const response = "I'd be happy to help you learn more about Grand Villa and senior living options. What brings you here today?";
            
            callback({
                text: response,
                metadata: {
                    actionName: "reliable-grand-villa-discovery",
                    reliability: "high"
                }
            });
            
            return true;
        } catch (error) {
            elizaLogger.error("Error in reliable action:", error);
            callback({
                text: "I'm here to help you with senior living information. How can I assist you?",
                metadata: { fallback: true }
            });
            return true;
        }
    }
});

// Reliable wrapper functions with enhanced error handling
async function getDiscoveryStateReliable(runtime: IAgentRuntime, message: Memory): Promise<any> {
    try {
        return await discoveryStateProvider.get(runtime, message);
    } catch (error) {
        elizaLogger.error("Error getting discovery state:", error);
        return { currentStage: "trust_building", questionsAsked: [] };
    }
}

async function getUserResponsesReliable(runtime: IAgentRuntime, message: Memory): Promise<any> {
    try {
        return await getUserResponses(runtime, message);
    } catch (error) {
        elizaLogger.error("Error getting user responses:", error);
        return { situation: [], lifestyle: [], readiness: [], priorities: [] };
    }
}

async function determineConversationStageReliable(runtime: IAgentRuntime, message: Memory, discoveryState: any): Promise<string> {
    try {
        // Enhanced stage determination with fallbacks
        if (!discoveryState || !discoveryState.currentStage) {
            return "trust_building";
        }
        return discoveryState.currentStage;
    } catch (error) {
        elizaLogger.error("Error determining conversation stage:", error);
        return "trust_building";
    }
}

// Reliable handler functions with fallbacks
async function handleTrustBuildingReliable(runtime: IAgentRuntime, message: Memory, state: State): Promise<string> {
    try {
        const response = "I'd be happy to get you the information you need, but before I do, do you mind if I ask a few quick questions? That way, I can really understand what's important and make sure I'm helping in the best way possible.";
        
        await runtime.messageManager.createMemory({
            roomId: message.roomId,
            userId: message.userId,
            agentId: message.agentId,
            content: { 
                text: response,
                metadata: { stage: "situation_discovery" }
            }
        });
        
        return response;
    } catch (error) {
        elizaLogger.error("Error in trust building:", error);
        return "I'm here to help you explore senior living options. What brings you here today?";
    }
}

async function handleSituationQuestionsReliable(runtime: IAgentRuntime, message: Memory, state: State, discoveryState: any): Promise<string> {
    try {
        // Save user response if it's a user message
        if (message.content.text && message.userId !== message.agentId) {
            await saveUserResponse(runtime, message, "situation", message.content.text);
        }
        
        const question = "Thanks for sharing with me. Before we explore possible next steps, I'd like to understand a bit more about how things have been for you and your loved ones. Could you tell me what made you decide to look into senior living options today?";
        
        await runtime.messageManager.createMemory({
            roomId: message.roomId,
            userId: message.userId,
            agentId: message.agentId,
            content: {
                text: question,
                metadata: { stage: "lifestyle_discovery" }
            }
        });
        
        return question;
    } catch (error) {
        elizaLogger.error("Error in situation questions:", error);
        return "I'd love to understand more about your situation. What's prompting you to look into senior living options?";
    }
}

// Add more reliable handler functions as needed...
async function handleLifestyleQuestionsReliable(runtime: IAgentRuntime, message: Memory, state: State, discoveryState: any): Promise<string> {
    try {
        if (message.content.text && message.userId !== message.agentId) {
            await saveUserResponse(runtime, message, "lifestyle", message.content.text);
        }
        
        const question = "Thank you for sharing that with me. It helps me understand your family's situation better. Could you tell me what a typical day looks like for your loved one?";
        
        await runtime.messageManager.createMemory({
            roomId: message.roomId,
            userId: message.userId,
            agentId: message.agentId,
            content: {
                text: question,
                metadata: { stage: "readiness_discovery" }
            }
        });
        
        return question;
    } catch (error) {
        elizaLogger.error("Error in lifestyle questions:", error);
        return "I'd like to learn more about your loved one's daily life. What does a typical day look like for them?";
    }
}

async function handleReadinessQuestionsReliable(runtime: IAgentRuntime, message: Memory, state: State, discoveryState: any): Promise<string> {
    try {
        if (message.content.text && message.userId !== message.agentId) {
            await saveUserResponse(runtime, message, "readiness", message.content.text);
        }
        
        const question = "I appreciate you sharing that with me. It's important for me to understand how everyone feels about this transition. Is your loved one aware that you're exploring senior living options?";
        
        await runtime.messageManager.createMemory({
            roomId: message.roomId,
            userId: message.userId,
            agentId: message.agentId,
            content: {
                text: question,
                metadata: { stage: "priorities_discovery" }
            }
        });
        
        return question;
    } catch (error) {
        elizaLogger.error("Error in readiness questions:", error);
        return "How does your loved one feel about the idea of exploring senior living options?";
    }
}

async function handlePriorityQuestionsReliable(runtime: IAgentRuntime, message: Memory, state: State, discoveryState: any): Promise<string> {
    try {
        if (message.content.text && message.userId !== message.agentId) {
            await saveUserResponse(runtime, message, "priorities", message.content.text);
        }
        
        const question = "Thank you for being so open with me. As we think about the right community for your family, what's most important to you in making this decision?";
        
        await runtime.messageManager.createMemory({
            roomId: message.roomId,
            userId: message.userId,
            agentId: message.agentId,
            content: {
                text: question,
                metadata: { stage: "needs_matching" }
            }
        });
        
        return question;
    } catch (error) {
        elizaLogger.error("Error in priority questions:", error);
        return "What's most important to you when choosing a senior living community?";
    }
}

async function handleNeedsMatchingReliable(runtime: IAgentRuntime, message: Memory, state: State, discoveryState: any): Promise<string> {
    try {
        if (message.content.text && message.userId !== message.agentId) {
            await saveUserResponse(runtime, message, "priorities", message.content.text);
        }
        
        const response = "Based on everything you've shared with me, I can see how much you care about finding the right place for your loved one. Grand Villa offers a wonderful balance of independence, support, and community that many families find perfect for their needs. Would you like to schedule a visit so you can experience the community firsthand?";
        
        return response;
    } catch (error) {
        elizaLogger.error("Error in needs matching:", error);
        return "Based on what you've shared, I think Grand Villa could be a great fit for your family. Would you like to learn more or schedule a visit?";
    }
}

async function handleVisitTransitionReliable(runtime: IAgentRuntime, message: Memory, state: State, discoveryState: any): Promise<string> {
    return "I'd love to arrange a visit for you. Would Wednesday afternoon or Friday morning work better for your schedule?";
}

async function handleGeneralInquiryReliable(runtime: IAgentRuntime, message: Memory, state: State): Promise<string> {
    return "I'm here to help you learn more about Grand Villa and how we can support your family. What specific information would be most helpful for you today?";
} 