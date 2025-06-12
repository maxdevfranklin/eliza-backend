// import { elizaLogger, Evaluator, IAgentRuntime, Memory, State } from "@elizaos/core";

// export const discoveryProgressEvaluator: Evaluator = {
//     name: "discovery-progress",
    
//     handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
//         const discoveryState = await runtime.getProvider("discovery-state");
        
//         // Simple progress tracking
//         const progressMetrics = {
//             questions_asked: discoveryState.questionsAsked.length,
//             needs_identified: discoveryState.identifiedNeeds.length,
//             stage_completed: discoveryState.currentStage,
//             visit_scheduled: discoveryState.visitScheduled
//         };
        
//         // Log for analytics (can be enhanced later)
//         elizaLogger.info("Discovery Progress:", progressMetrics);
        
//         return progressMetrics;
//     }
// };