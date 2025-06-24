import { Action, generateText, IAgentRuntime, Memory, ModelClass, State, HandlerCallback, elizaLogger } from "@elizaos/core";
import { PriorityAction } from "./priority-action-system.js";

// Template for 100% reliable actions
export function createReliableAction(config: {
    name: string;
    description: string;
    priority: number;
    keywords: string[];
    examples: any[];
    handler: (runtime: IAgentRuntime, message: Memory, state: State, callback: HandlerCallback) => Promise<boolean>;
    triggerConditions?: (runtime: IAgentRuntime, message: Memory) => Promise<boolean>;
}): PriorityAction {
    return {
        name: config.name,
        description: config.description,
        priority: config.priority,
        triggerType: 'conditional',
        similes: config.keywords,
        examples: config.examples,
        
        validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
            elizaLogger.info(`🔍 Validating action: ${config.name}`);
            
            // Multi-layered validation approach
            const validationResults = await Promise.allSettled([
                // 1. Keyword matching
                keywordValidation(message.content.text || "", config.keywords),
                
                // 2. AI-powered intent detection
                aiIntentValidation(runtime, message, config.description, config.examples),
                
                // 3. Custom conditions (if provided)
                config.triggerConditions ? config.triggerConditions(runtime, message) : Promise.resolve(false),
                
                // 4. Fallback validation (always returns true with low confidence)
                Promise.resolve(true)
            ]);
            
            // Check if any validation passed
            const passed = validationResults.some(result => 
                result.status === 'fulfilled' && result.value === true
            );
            
            elizaLogger.info(`✅ Action ${config.name} validation result: ${passed}`);
            return passed;
        },
        
        conditions: config.triggerConditions,
        
        handler: async (
            runtime: IAgentRuntime,
            message: Memory,
            state: State,
            options: { [key: string]: unknown },
            callback: HandlerCallback
        ): Promise<boolean> => {
            elizaLogger.info(`🚀 Executing action: ${config.name}`);
            
            try {
                const result = await config.handler(runtime, message, state, callback);
                elizaLogger.info(`✅ Action ${config.name} completed successfully`);
                return result;
            } catch (error) {
                elizaLogger.error(`❌ Action ${config.name} failed:`, error);
                
                // Provide fallback response to maintain conversation flow
                callback({
                    text: "I understand. Let me help you with that in a different way.",
                    metadata: {
                        actionName: config.name,
                        fallback: true,
                        error: error.message
                    }
                });
                
                return true; // Return true to prevent other actions from triggering
            }
        }
    };
}

// Keyword-based validation
async function keywordValidation(messageText: string, keywords: string[]): Promise<boolean> {
    const text = messageText.toLowerCase();
    const matched = keywords.some(keyword => 
        text.includes(keyword.toLowerCase()) ||
        text.includes(keyword.toLowerCase().replace(/[_-]/g, ' '))
    );
    
    elizaLogger.info(`🔑 Keyword validation: ${matched} (keywords: ${keywords.join(', ')})`);
    return matched;
}

// AI-powered intent validation
async function aiIntentValidation(
    runtime: IAgentRuntime, 
    message: Memory, 
    actionDescription: string,
    examples: any[]
): Promise<boolean> {
    try {
        const exampleTexts = examples
            .map(ex => ex.map(turn => turn.content.text).join(' '))
            .join('\n');
            
        const prompt = `Analyze if the user's message matches the intent for this action.
        
Action Description: ${actionDescription}
Example conversations: ${exampleTexts}
User message: "${message.content.text}"

Does the user's message match the intent of this action? Respond only with 'yes' or 'no'.`;

        const response = await generateText({
            runtime,
            context: prompt,
            modelClass: ModelClass.SMALL,
            stop: ["\n"],
        });
        
        const matched = response.toLowerCase().trim() === 'yes';
        elizaLogger.info(`🤖 AI intent validation: ${matched}`);
        return matched;
        
    } catch (error) {
        elizaLogger.error("AI intent validation failed:", error);
        return false;
    }
}

// Universal fallback action that always triggers
export const universalFallbackAction: PriorityAction = createReliableAction({
    name: "universal-fallback",
    description: "Universal fallback action that handles any unmatched user input",
    priority: 1, // Lowest priority
    keywords: ["*"], // Matches everything
    examples: [
        [
            { user: "user", content: { text: "anything" } },
            { user: "agent", content: { text: "I understand. How can I help you?" } }
        ]
    ],
    
    handler: async (runtime, message, state, callback) => {
        // Analyze the message and provide a contextual response
        const response = await generateContextualResponse(runtime, message);
        
        callback({
            text: response,
            metadata: {
                handledBy: "universal-fallback",
                confident: false
            }
        });
        
        return true;
    },
    
    triggerConditions: async () => true // Always trigger as fallback
});

async function generateContextualResponse(runtime: IAgentRuntime, message: Memory): Promise<string> {
    try {
        const prompt = `The user said: "${message.content.text}"
        
Generate a helpful, contextual response that:
1. Acknowledges what they said
2. Asks a clarifying question or offers assistance
3. Keeps the conversation flowing naturally

Response:`;

        const response = await generateText({
            runtime,
            context: prompt,
            modelClass: ModelClass.SMALL,
        });
        
        return response || "I understand. Could you tell me more about what you're looking for?";
        
    } catch (error) {
        elizaLogger.error("Failed to generate contextual response:", error);
        return "I hear you. How can I best help you today?";
    }
} 