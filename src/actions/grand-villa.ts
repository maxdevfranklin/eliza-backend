import { Action, generateText, IAgentRuntime, Memory, ModelClass, State, HandlerCallback, elizaLogger, ActionExample } from "@elizaos/core";

export const grandVillaAction: Action = {
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
        const context = `Analyze the user's message to understand their specific needs and interests regarding senior living.
                        The message is: ${_message.content.text}
                        Determine if they are interested in: communities, activities, living-options, or general information.
                        Only respond with one of: communities, activities, living-options, or general.
                        No other text.`;

        const aspect = await generateText({
            runtime: _runtime,
            context,
            modelClass: ModelClass.SMALL,
            stop: ["\n"],
        });

        let response_text = "";

        switch(aspect.trim()) {
            case "communities":
                response_text = "I'd be happy to tell you about Grand Villa communities! We have beautiful, well-maintained communities designed specifically for seniors. Here's what makes our communities special:\n\n" +
                              "• Spacious, comfortable living spaces with emergency response systems\n" +
                              "• Restaurant-style dining with chef-prepared meals\n" +
                              "• Regular housekeeping and maintenance services\n" +
                              "• 24-hour staff availability for peace of mind\n" +
                              "• Beautiful grounds and common areas for socializing\n\n" +
                              "Would you like to know more about our activities, living options, or would you like to schedule a tour?";
                break;
            case "activities":
                response_text = "At Grand Villa, we believe staying active and engaged is key to a fulfilling lifestyle. Here's what residents enjoy:\n\n" +
                              "• Daily exercise and fitness classes to stay healthy\n" +
                              "• Arts and crafts workshops for creative expression\n" +
                              "• Music and entertainment programs\n" +
                              "• Social events and parties to build friendships\n" +
                              "• Group outings and excursions\n" +
                              "• Game nights and bingo for fun\n" +
                              "• Book clubs and discussion groups\n\n" +
                              "Would you like to learn more about our communities or the different living options we offer?";
                break;
            case "living-options":
                response_text = "Grand Villa offers various living options to meet different needs and preferences:\n\n" +
                              "• Independent Living: Perfect for active seniors who want maintenance-free living with access to amenities and social activities\n" +
                              "• Assisted Living: For those who need some help with daily activities while maintaining independence\n" +
                              "• Memory Care: Specialized care and support for residents with memory-related conditions\n" +
                              "• Respite Care: Short-term stays for temporary care needs\n\n" +
                              "Would you like to know more about any of these options or would you like to hear about our communities?";
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