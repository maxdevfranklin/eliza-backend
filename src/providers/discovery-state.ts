import { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";

export const discoveryStateProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        const userId = message.userId;
        
        // Get or create discovery state from memory
        const existingState = await runtime.messageManager.getMemories({
            roomId: message.roomId,
            count: 50,
            unique: false
        });
        
        // Parse previous conversation for discovery state
        const discoveryState = {
            currentStage: "trust_building",
            questionsAsked: [],
            identifiedNeeds: [],
            concernsShared: [],
            readyForVisit: false,
            visitScheduled: false
        };
        
        // Simple state tracking based on conversation history
        for (const mem of existingState) {
            if (mem.content.text?.includes("What made you decide")) {
                discoveryState.questionsAsked.push("What made you decide to call us today?");
            }
            if (mem.content.text?.includes("typical day")) {
                discoveryState.questionsAsked.push("What does a typical day look like for them?");
            }
            // Add more parsing logic as needed
        }
        
        return discoveryState;
    }
};