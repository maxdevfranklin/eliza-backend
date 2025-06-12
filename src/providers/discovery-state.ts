import { Provider, IAgentRuntime, Memory, State, elizaLogger } from "@elizaos/core";

const VALID_STAGES = [
    "trust_building",
    "situation_discovery",
    "lifestyle_discovery",
    "readiness_discovery",
    "priorities_discovery",
    "needs_matching",
    "visit_transition"
] as const;

type Stage = typeof VALID_STAGES[number];

interface MessageMetadata {
    stage?: Stage;
}

export const discoveryStateProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        const userId = message.userId;
        elizaLogger.info("Getting discovery state from message history");
        
        // Get or create discovery state from memory
        const existingState = await runtime.messageManager.getMemories({
            roomId: message.roomId,
            count: 50,
            unique: false
        });
        
        elizaLogger.info(`Found ${existingState.length} messages in history`);
        
        // Parse previous conversation for discovery state
        const discoveryState = {
            currentStage: "trust_building" as Stage,
            questionsAsked: [],
            identifiedNeeds: [],
            concernsShared: [],
            readyForVisit: false,
            visitScheduled: false
        };
        
        // Track all discovery stages and questions
        for (const mem of existingState) {
            const text = mem.content.text?.toLowerCase() || "";
            elizaLogger.info(`Processing message: ${text}`);
            
            // Check for stage in metadata first
            const metadata = mem.content.metadata as MessageMetadata | undefined;
            if (metadata?.stage && VALID_STAGES.includes(metadata.stage)) {
                elizaLogger.info(`Found stage transition in metadata to: ${metadata.stage}`);
                discoveryState.currentStage = metadata.stage;
                continue;
            }
            
            // Only process questions and needs if we're in the appropriate stage
            if (discoveryState.currentStage === "trust_building") {
                // Trust Building Stage - no questions to track yet
                continue;
            }
            
            if (discoveryState.currentStage === "situation_discovery") {
                // Situation Discovery Stage
                if (text.includes("what made you decide")) {
                    discoveryState.questionsAsked.push("What made you decide to call us today?");
                }
                if (text.includes("greatest concern")) {
                    discoveryState.questionsAsked.push("What's your greatest concern right now?");
                }
                if (text.includes("impacting your family")) {
                    discoveryState.questionsAsked.push("How is this situation impacting your family?");
                }
            }
            
            // Track identified needs only after situation discovery
            if (!["trust_building", "situation_discovery"].includes(discoveryState.currentStage)) {
                if (text.includes("eat") || text.includes("meal") || text.includes("food") || text.includes("nutrition")) {
                    discoveryState.identifiedNeeds.push("nutrition");
                }
                if (text.includes("activity") || text.includes("hobby") || text.includes("garden")) {
                    discoveryState.identifiedNeeds.push("activities");
                }
                if (text.includes("safe") || text.includes("fall") || text.includes("emergency")) {
                    discoveryState.identifiedNeeds.push("safety");
                }
                if (text.includes("social") || text.includes("lonely") || text.includes("friend")) {
                    discoveryState.identifiedNeeds.push("social");
                }
                if (text.includes("independent") || text.includes("freedom")) {
                    discoveryState.identifiedNeeds.push("independence");
                }
            }
            
            // Track concerns
            if (text.includes("worried") || text.includes("concern") || text.includes("afraid")) {
                const concern = text.split(/worried|concern|afraid/)[1]?.trim();
                if (concern) {
                    discoveryState.concernsShared.push(concern);
                }
            }
            
            // Track visit readiness
            if (text.includes("visit") || text.includes("tour") || text.includes("come by")) {
                discoveryState.readyForVisit = true;
            }
            if (text.includes("wednesday") || text.includes("friday") || text.includes("schedule")) {
                discoveryState.visitScheduled = true;
            }
        }
        
        elizaLogger.info(`Final discovery state: ${JSON.stringify(discoveryState)}`);
        return discoveryState;
    }
};