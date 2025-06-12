import { Action, generateText, IAgentRuntime, Memory, ModelClass, State, HandlerCallback, elizaLogger, ActionExample } from "@elizaos/core";

export const grandvillaAction: Action = {
    name: "grand-villa",
    description: "Guide users in discovering Grand Villa senior living communities and facilities",
    similes: ["SENIOR_LIVING_GUIDE", "COMMUNITY_DISCOVERY", "FACILITY_EXPLORATION", "SENIOR_CARE_OPTIONS"],
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
        const context = `Analyze the user's message to determine if it is a first-time hello message or not (e.g., "hi", "hello", "hey", "good morning", etc.).
                        The message is: ${_message.content.text}
                        Only respond with one of: greeting or not-greeting.
                        No other text.`;

        elizaLogger.info("Context: ", context);

        const aspect = await generateText({
            runtime: _runtime,
            context,
            modelClass: ModelClass.SMALL,
            stop: ["\n"],
        });

        elizaLogger.info("aspect: ", aspect);

        let response_text = "";

        switch(aspect.trim()) {
            case "greeting":
                response_text = "I'd be happy to get you the information you need, but before I do, do you mind if I ask a few quick questions? That way, I can really understand what's important and make sure I'm helping in the best way possible.";
                break;
            default:
                response_text = "I'd love to help you explore senior living options! Grand Villa is a premier senior living community that offers a perfect blend of comfort, care, and engaging activities. " +
                              "We understand that finding the right senior living solution is an important decision, and we're here to help guide you through the process. " +
                              "Would you like to know more about:\n\n" +
                              "• Our communities and facilities\n" +
                              "• The activities and lifestyle we offer\n" +
                              "• Our different living options\n" +
                              "• How to schedule a tour\n\n" +
                              "What interests you most?";
        }

        _callback({text: response_text});
        return true;
    }
}