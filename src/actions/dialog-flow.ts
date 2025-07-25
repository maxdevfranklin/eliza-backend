import { Action, generateText, IAgentRuntime, Memory, ModelClass, State, HandlerCallback, elizaLogger } from "@elizaos/core";
import { discoveryStateProvider } from "../providers/discovery-state.js";

// Grace Fletcher Personality Definition
const gracePersonality = `
You are Grace Fletcher, a Senior Sherpa - a warm, patient, and deeply knowledgeable AI guide specializing in helping families find the perfect senior living solution with empathy, patience, and expertise.

Core Identity:
- Name: Grace Fletcher, Senior Sherpa
- Role: Trusted guide for families navigating senior living decisions
- Description: A thoughtful, emotionally intelligent guide who understands that families need support, not sales pressure

Core Principles:
1. Empathy & Emotional Awareness - This family is going through a major life transition. Your first priority is to make them feel heard and supported.
2. Guidance Over Sales - You don't push decisions—you help people make their own, informed choices.
3. Personalization & Long-Term Trust - Every family is different. You remember details and tailor responses accordingly.

Communication Style:
- Warm and nurturing like a favorite aunt, blending professional expertise with genuine care
- Thoughtful and steady, offering wisdom wrapped in compassion and patience  
- Embodies Betty White's spirit - warm, wise, endlessly kind, with just the right amount of sass and cultural fluency
- Grounded and familiar, never performative - someone families trust for tough conversations
- Ask one open-ended question at a time, answer each in a truthful, caring and reassuring manner

Approach:
- Listen & adapt in real-time, never force scripted conversations
- Use reflective questions to uncover the "why" behind concerns
- Adjust pacing based on user engagement & emotional state
- Meet families exactly where they are emotionally
- Frame senior living as an opportunity to thrive, not just a change of residence
- Acknowledge the emotional weight of decisions and validate family concerns
- Build authentic connections through genuine curiosity about their journey
`;

export const dialogFlowAction: Action = {
    name: "dialog-flow",
    description: "Fallback dialog handler for general conversation flow and contextual responses",
    similes: ["GENERAL_CONVERSATION", "DIALOG_HANDLER", "FALLBACK", "CONVERSATION_FLOW", "CHAT"],
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "That sounds interesting" }
            },
            {
                user: "{{user2}}", 
                content: { text: "I'm glad you think so! Is there anything specific you'd like to know more about?" }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "I'm not sure about that" }
            },
            {
                user: "{{user2}}", 
                content: { text: "That's completely understandable. What questions can I help answer to make things clearer?" }
            }
        ]
    ],
    
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        // This action should always be available as a fallback
        // It will be triggered after other actions have a chance to handle the message
        elizaLogger.info("Dialog flow action validation - always available as fallback");
        return true;
    },
    
    handler: async (
        _runtime: IAgentRuntime,
        _message: Memory,
        _state: State,
        _options: { [key: string]: unknown },
        _callback: HandlerCallback
    ) => {
        elizaLogger.info("Dialog flow action handler triggered");
        
        try {
            // Get discovery state for context
            const discoveryState = await getDiscoveryState(_runtime, _message);
            elizaLogger.info(`Discovery state in dialog flow: ${JSON.stringify(discoveryState)}`);
            
            // Analyze the user's message to determine the appropriate response type
            const responseType = await determineResponseType(_runtime, _message, discoveryState);
            elizaLogger.info(`Determined response type: ${responseType}`);
            
            let response_text = "";
            
            switch (responseType) {
                case "acknowledgment":
                    response_text = await handleAcknowledgment(_runtime, _message, discoveryState);
                    break;
                    
                case "clarification":
                    response_text = await handleClarificationRequest(_runtime, _message, discoveryState);
                    break;
                    
                case "information_sharing":
                    response_text = await handleInformationSharing(_runtime, _message, discoveryState);
                    break;
                    
                case "concern_expression":
                    response_text = await handleConcernExpression(_runtime, _message, discoveryState);
                    break;
                    
                case "general_inquiry":
                    response_text = await handleGeneralInquiry(_runtime, _message, discoveryState);
                    break;
                    
                default:
                    response_text = await handleDefault(_runtime, _message, discoveryState);
            }
            
            elizaLogger.info(`Dialog flow response: ${response_text}`);
            
            _callback({ 
                text: response_text,
                metadata: {
                    responseType: responseType,
                    handledBy: "dialog-flow"
                }
            });
            
            return true;
            
        } catch (error) {
            elizaLogger.error("Error in dialog flow handler:", error);
            
            // Fallback response if something goes wrong
            _callback({ 
                text: "I understand. Could you tell me more about what you're thinking?"
            });
            
            return true;
        }
    }
}

// Helper function to get discovery state
async function getDiscoveryState(_runtime: IAgentRuntime, _message: Memory): Promise<any> {
    try {
        return await discoveryStateProvider.get(_runtime, _message);
    } catch (error) {
        elizaLogger.error("Error getting discovery state:", error);
        return null;
    }
}

// Determine what type of response is most appropriate
async function determineResponseType(_runtime: IAgentRuntime, _message: Memory, discoveryState: any): Promise<string> {
    const messageText = _message.content.text?.toLowerCase() || "";
    
    // Analyze message content using AI to categorize response needed
    const context = `Analyze the user's message and determine the most appropriate response type.
                    
                    User message: "${_message.content.text}"
                    
                    Choose from these response types:
                    - acknowledgment: User is agreeing, confirming, or showing understanding
                    - clarification: User is asking for more information or seems confused
                    - information_sharing: User is sharing personal information or experiences
                    - concern_expression: User is expressing worries, fears, or concerns
                    - general_inquiry: User is asking general questions about services/options
                    
                    Respond with only the response type, no other text.`;

    try {
        const responseType = await generateText({
            runtime: _runtime,
            context,
            modelClass: ModelClass.SMALL,
            stop: ["\n"],
        });
        
        return responseType.trim();
    } catch (error) {
        elizaLogger.error("Error determining response type:", error);
        return "general_inquiry";
    }
}

// Handle acknowledgments (yes, okay, I understand, etc.)
async function handleAcknowledgment(_runtime: IAgentRuntime, _message: Memory, discoveryState: any): Promise<string> {
    const responses = [
        "Great! I'm glad we're on the same page.",
        "Wonderful. What would you like to explore next?",
        "Perfect. Is there anything else you'd like to know about?",
        "That's excellent. How can I help you move forward?",
        "I'm so glad to hear that. What questions do you have for me?"
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
}

// Handle requests for clarification
async function handleClarificationRequest(_runtime: IAgentRuntime, _message: Memory, discoveryState: any): Promise<string> {
    const messageText = _message.content.text || "";
    
    const context = `Personality of Grace: "${gracePersonality}"
    
                    User asking for clarification: "${messageText}"
                    
                    Respond with Grace's warm, patient style that:
                    - Acknowledges their need for clarification with understanding
                    - Shows appreciation that they're asking questions  
                    - Offers to explain things more clearly with empathy
                    - Maintains Grace's caring, wise personality
                    - Reassures them that questions are welcome and important`;

    try {
        const response = await generateText({
            runtime: _runtime,
            context,
            modelClass: ModelClass.SMALL,
        });
        
        return response.trim();
    } catch (error) {
        elizaLogger.error("Error generating clarification response:", error);
        return "That's such a great question, and I'm glad you asked. Let me help clarify that for you. What specifically would you like to know more about?";
    }
}

// Handle when user shares information about themselves/their situation
async function handleInformationSharing(_runtime: IAgentRuntime, _message: Memory, discoveryState: any): Promise<string> {
    const responses = [
        "Thank you for sharing that with me. That helps me understand your situation better.",
        "I really appreciate you being so open with me. That's very helpful information.",
        "Thank you for telling me about that. It sounds like you're dealing with a lot.",
        "I'm grateful you shared that with me. It helps me know how to best support you.",
        "That's really helpful for me to know. Thank you for being so candid."
    ];
    
    const baseResponse = responses[Math.floor(Math.random() * responses.length)];
    
    // Add a follow-up question based on context
    const followUps = [
        " How are you feeling about everything?",
        " What's been the most challenging part?",
        " Is there a particular area where you'd like more support?",
        " What would be most helpful for you right now?",
        " How can I best help you with this?"
    ];
    
    const followUp = followUps[Math.floor(Math.random() * followUps.length)];
    
    return baseResponse + followUp;
}

// Handle when user expresses concerns or worries
async function handleConcernExpression(_runtime: IAgentRuntime, _message: Memory, discoveryState: any): Promise<string> {
    const responses = [
        "I completely understand your concerns. Those are very valid feelings to have.",
        "It's natural to feel worried about this kind of decision. Your concerns make perfect sense.",
        "Thank you for sharing your concerns with me. It's important that we address them.",
        "I hear you, and those concerns are completely understandable. Many families feel the same way.",
        "Your worries are completely valid. It's such an important decision for your family."
    ];
    
    const baseResponse = responses[Math.floor(Math.random() * responses.length)];
    
    return baseResponse + " What would help put your mind at ease?";
}

// Handle general inquiries about services, options, etc.
async function handleGeneralInquiry(_runtime: IAgentRuntime, _message: Memory, discoveryState: any): Promise<string> {
    const messageText = _message.content.text || "";
    
    const context = `Personality of Grace: "${gracePersonality}"
    
                    The user has a general inquiry about senior living: "${messageText}"
                    
                    Respond with Grace's helpful, knowledgeable style that:
                    - Acknowledges their question with appreciation
                    - Provides helpful information when possible  
                    - Shows understanding of their situation and needs
                    - Maintains Grace's warm, expert guidance personality
                    - Asks thoughtful follow-up questions to better assist them`;

    try {
        const response = await generateText({
            runtime: _runtime,
            context,
            modelClass: ModelClass.SMALL,
        });
        
        return response.trim();
    } catch (error) {
        elizaLogger.error("Error generating general inquiry response:", error);
        return "That's such a great question, and I'm glad you asked. Let me help you find the right information. What specifically would you like to know more about?";
    }
}

// Default handler for unrecognized message types
async function handleDefault(_runtime: IAgentRuntime, _message: Memory, discoveryState: any): Promise<string> {
    const responses = [
        "I understand. Could you tell me a bit more about what you're thinking?",
        "That's interesting. What would be most helpful for you to know?",
        "I see. How can I best help you with your questions?",
        "Thank you for sharing. What information would be most valuable to you?",
        "I appreciate you reaching out. What's the most important thing I can help you with today?"
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
} 