import { Provider, IAgentRuntime, Memory, State, elizaLogger } from "@elizaos/core";

const VALID_STAGES = [
    "trust_building",
    "situation_discovery",
    "lifestyle_discovery",
    "readiness_discovery",
    "priorities_discovery",
    "needs_matching",
    "info_sharing",
    "schedule_visit",
    "visit_transition"
] as const;

type Stage = typeof VALID_STAGES[number];

interface MessageMetadata {
    stage?: Stage;
    status?: string;
    askedQuestion?: string;
}

export const discoveryStateProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        const userId = message.userId;
        elizaLogger.info("Getting discovery state from message history");
        
        // Get or create discovery state from memory
        const allMemories = await runtime.messageManager.getMemories({
            roomId: message.roomId,
            count: 50,
            unique: false
        });
        
        // Filter memories to only include those from this specific user or agent
        const existingState = allMemories.filter(mem => 
            mem.userId === userId || mem.userId === message.agentId
        );
        
        elizaLogger.info(`Found ${existingState.length} messages in history`);
        
        // Parse previous conversation for discovery state
        const discoveryState = {
            currentStage: "trust_building" as Stage,
            questionsAsked: [],
            identifiedNeeds: [],
            concernsShared: [],
            readyForVisit: false,
            visitScheduled: false,
            userStatus: "" // New field to track user status
        };
        
        // Process messages from oldest to newest to preserve latest stage transitions
        for (const mem of existingState.reverse()) {
            const text = mem.content.text?.toLowerCase() || "";
            elizaLogger.info(`Processing message: ${text}`);
            
            // Check for stage in metadata first
            const metadata = mem.content.metadata as MessageMetadata | undefined;
            if (metadata?.stage && VALID_STAGES.includes(metadata.stage)) {
                elizaLogger.info(`Found stage transition in metadata to: ${metadata.stage}`);
                discoveryState.currentStage = metadata.stage;
                continue;
            }
            
            // Track user status from metadata
            if (metadata?.status) {
                elizaLogger.info(`Found user status update: ${metadata.status}`);
                discoveryState.userStatus = metadata.status;
            }
            
            // Track asked questions from metadata
            if (metadata?.askedQuestion) {
                discoveryState.questionsAsked.push(metadata.askedQuestion);
            }
            
            // Track identified needs
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

// Utility functions for user response persistence
export async function saveUserResponse(runtime: IAgentRuntime, message: Memory, stage: string, userResponse: string) {
    elizaLogger.info(`Saving user response for stage ${stage}: ${userResponse}`);
    
    await runtime.messageManager.createMemory({
        roomId: message.roomId,
        userId: message.userId,
        agentId: message.agentId,
        content: {
            text: `[Discovery Response] ${userResponse}`,
            metadata: {
                discoveryStage: stage,
                userResponse: userResponse,
                timestamp: new Date().toISOString()
            }
        }
    });
}

export async function getUserResponses(runtime: IAgentRuntime, message: Memory) {
    const allMemories = await runtime.messageManager.getMemories({
        roomId: message.roomId,
        count: 100,
        unique: false
    });
    
    // Filter memories to only include those from this specific user or agent
    const memories = allMemories.filter(mem => 
        mem.userId === message.userId || mem.userId === message.agentId
    );
    
    const userResponses: { [key: string]: string[] } = {
        contact_info: [],
        situation: [],
        lifestyle: [],
        readiness: [],
        priorities: []
    };
    
    for (const mem of memories) {
        const metadata = mem.content.metadata as any;
        if (metadata?.discoveryStage && metadata?.userResponse) {
            const stage = metadata.discoveryStage;
            if (userResponses[stage]) {
                userResponses[stage].push(metadata.userResponse);
            }
        }
    }
    
    elizaLogger.info(`Retrieved user responses: ${JSON.stringify(userResponses)}`);
    return userResponses;
}

// New utility function to update user status
export async function updateUserStatus(runtime: IAgentRuntime, message: Memory, statusUpdate: string) {
    elizaLogger.info(`Updating user status: ${statusUpdate}`);
    
    await runtime.messageManager.createMemory({
        roomId: message.roomId,
        userId: message.userId,
        agentId: message.agentId,
        content: {
            text: `[Status Update] ${statusUpdate}`,
            metadata: {
                status: statusUpdate,
                timestamp: new Date().toISOString()
            }
        }
    });
}