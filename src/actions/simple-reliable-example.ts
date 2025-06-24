import { Action, IAgentRuntime, Memory, State, HandlerCallback, elizaLogger } from "@elizaos/core";

// Example 1: Simple Always-Trigger Action
export const simpleReliableAction: Action = {
    name: "simple-reliable",
    description: "A simple action that always triggers",
    similes: ["help", "assist", "support"],
    examples: [
        [
            { user: "{{user1}}", content: { text: "I need help" } },
            { user: "{{agent}}", content: { text: "I'm here to help you!" } }
        ]
    ],

    // SOLUTION 1: Always return true for 100% triggering
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        elizaLogger.info("✅ Simple reliable action - always triggers");
        return true; // This guarantees the action will always be considered
    },

    handler: async (
        _runtime: IAgentRuntime,
        _message: Memory,
        _state: State,
        _options: { [key: string]: unknown },
        _callback: HandlerCallback
    ) => {
        elizaLogger.info("🚀 Simple reliable action handler executed");

        try {
            // Your main business logic here
            const response = `I understand you said: "${_message.content.text}". How can I help you today?`;
            
            _callback({
                text: response,
                metadata: {
                    actionName: "simple-reliable",
                    triggered: true
                }
            });

            return true;
        } catch (error) {
            elizaLogger.error("Error in simple reliable action:", error);
            
            // Even if there's an error, provide a response
            _callback({
                text: "I'm here to help. What can I do for you?",
                metadata: {
                    actionName: "simple-reliable",
                    fallback: true
                }
            });

            return true; // Always return true to prevent other actions
        }
    }
};

// Example 2: Multi-Strategy Reliable Action
export const multiStrategyAction: Action = {
    name: "multi-strategy-reliable",
    description: "Uses multiple strategies to ensure triggering",
    similes: ["grand villa", "senior living", "help", "information"],
    examples: [],

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        elizaLogger.info("🔍 Multi-strategy validation starting");

        // Strategy 1: Keyword matching
        const messageText = message.content.text?.toLowerCase() || "";
        const keywords = ["grand villa", "senior living", "help", "care", "family"];
        const hasKeyword = keywords.some(keyword => messageText.includes(keyword));
        
        if (hasKeyword) {
            elizaLogger.info("✅ Triggered by keyword match");
            return true;
        }

        // Strategy 2: Message length check (any substantial message)
        if (messageText.length > 3) {
            elizaLogger.info("✅ Triggered by message length");
            return true;
        }

        // Strategy 3: Always true fallback
        elizaLogger.info("✅ Triggered by fallback strategy");
        return true; // Guarantees triggering
    },

    handler: async (runtime, message, state, options, callback) => {
        elizaLogger.info("🚀 Multi-strategy action handler executed");

        const response = "I'm here to assist you with any questions or information you need. What would you like to know?";
        
        callback({
            text: response,
            metadata: {
                actionName: "multi-strategy-reliable",
                strategies: "keyword,length,fallback"
            }
        });

        return true;
    }
};

// Example 3: Enhanced Error-Resistant Action
export const errorResistantAction: Action = {
    name: "error-resistant",
    description: "Handles errors gracefully while maintaining reliability",
    similes: ["*"], // Matches anything
    examples: [],

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        try {
            // Even if this complex logic fails, we have fallbacks
            const complexValidation = await performComplexValidation(runtime, message);
            return complexValidation;
        } catch (error) {
            elizaLogger.warn("Complex validation failed, using fallback:", error);
            return true; // Fallback to always trigger
        }
    },

    handler: async (runtime, message, state, options, callback) => {
        elizaLogger.info("🚀 Error-resistant action handler executed");

        try {
            // Attempt main functionality
            const response = await performMainLogic(runtime, message);
            callback({ text: response });
            return true;
        } catch (mainError) {
            elizaLogger.error("Main logic failed, using fallback:", mainError);
            
            try {
                // Attempt fallback functionality
                const fallbackResponse = await performFallbackLogic(runtime, message);
                callback({ 
                    text: fallbackResponse,
                    metadata: { fallback: true }
                });
                return true;
            } catch (fallbackError) {
                elizaLogger.error("Fallback logic failed, using simple response:", fallbackError);
                
                // Ultimate fallback - simple response
                callback({
                    text: "I'm here to help. Could you tell me more about what you need?",
                    metadata: { 
                        fallback: true,
                        level: "ultimate"
                    }
                });
                return true;
            }
        }
    }
};

// Helper functions for demonstration
async function performComplexValidation(runtime: IAgentRuntime, message: Memory): Promise<boolean> {
    // Simulate complex validation that might fail
    if (Math.random() > 0.5) {
        throw new Error("Complex validation failed");
    }
    return true;
}

async function performMainLogic(runtime: IAgentRuntime, message: Memory): Promise<string> {
    // Simulate main logic that might fail
    if (Math.random() > 0.7) {
        throw new Error("Main logic failed");
    }
    return `Main response to: "${message.content.text}"`;
}

async function performFallbackLogic(runtime: IAgentRuntime, message: Memory): Promise<string> {
    // Simulate fallback logic that might also fail
    if (Math.random() > 0.9) {
        throw new Error("Fallback logic failed");
    }
    return `Fallback response to: "${message.content.text}"`;
}

// Example 4: Priority-based Fallback Action (use this as your last action)
export const ultimateFallbackAction: Action = {
    name: "ultimate-fallback",
    description: "Guaranteed to handle any input when other actions fail",
    similes: ["*"],
    examples: [],

    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        elizaLogger.info("🛡️ Ultimate fallback - always ready to respond");
        return true; // Never fails
    },

    handler: async (runtime, message, state, options, callback) => {
        elizaLogger.info("🚀 Ultimate fallback action triggered");

        // Simple, reliable response that never fails
        const responses = [
            "I understand. How can I help you?",
            "Thank you for reaching out. What would you like to know?",
            "I'm here to assist you. What questions do you have?",
            "I'd be happy to help. Could you tell me more about what you need?"
        ];

        const randomResponse = responses[Math.floor(Math.random() * responses.length)];

        callback({
            text: randomResponse,
            metadata: {
                actionName: "ultimate-fallback",
                guaranteed: true
            }
        });

        return true;
    }
}; 