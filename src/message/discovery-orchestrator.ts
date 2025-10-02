// Main discovery orchestrator for the Grand Villa Discovery process
import { DiscoveryStateManager } from './state-manager.js';
import { StageHandlers } from './stage-handlers.js';
import { DISCOVERY_STAGES, OpenAIResponse } from './types.js';

export class DiscoveryOrchestrator {
    private stateManager: DiscoveryStateManager;
    private stageHandlers: StageHandlers;
    
    constructor(openaiApiKey: string) {
        this.stateManager = DiscoveryStateManager.getInstance();
        this.stageHandlers = new StageHandlers(openaiApiKey);
    }
    
    // Main entry point for processing user messages
    public async processMessage(userId: string, userMessage: string, userName?: string): Promise<OpenAIResponse> {
        console.log("🚀 Starting Grand Villa Discovery process");
        console.log(`User ID: ${userId}, Message: "${userMessage}", User Name: ${userName || 'N/A'}`);
        
        try {
            // Get or create user session
            const session = this.stateManager.getUserSession(userId, userName);
            const currentStage = session.discoveryState?.currentStage || DISCOVERY_STAGES.TRUST_BUILDING;
            
            console.log(`📊 Current stage: ${currentStage}`);
            console.log(`📝 User message: "${userMessage}"`);
            
            let responseText = "";
            let responseStatus = "Normal situation";
            
            // Route to appropriate stage handler
            switch (currentStage) {
                case DISCOVERY_STAGES.TRUST_BUILDING:
                    console.log("🔒 Routing to trust building handler");
                    responseText = await this.stageHandlers.handleTrustBuilding(userId, userMessage);
                    break;
                    
                case DISCOVERY_STAGES.SITUATION_DISCOVERY:
                    console.log("🔍 Routing to situation discovery handler");
                    responseText = await this.stageHandlers.handleSituationDiscovery(userId, userMessage);
                    break;
                    
                case DISCOVERY_STAGES.LIFESTYLE_DISCOVERY:
                    console.log("🎨 Routing to lifestyle discovery handler");
                    responseText = await this.stageHandlers.handleLifestyleDiscovery(userId, userMessage);
                    break;
                    
                case DISCOVERY_STAGES.READINESS_DISCOVERY:
                    console.log("🎯 Routing to readiness discovery handler");
                    responseText = await this.stageHandlers.handleReadinessDiscovery(userId, userMessage);
                    break;
                    
                case DISCOVERY_STAGES.PRIORITIES_DISCOVERY:
                    console.log("⭐ Routing to priorities discovery handler");
                    responseText = await this.stageHandlers.handlePrioritiesDiscovery(userId, userMessage);
                    break;
                    
                case DISCOVERY_STAGES.NEEDS_MATCHING:
                    console.log("🎯 Routing to needs matching handler");
                    responseText = await this.stageHandlers.handleNeedsMatching(userId, userMessage);
                    break;
                    
                case DISCOVERY_STAGES.SCHEDULE_VISIT:
                    console.log("📅 Routing to schedule visit handler");
                    responseText = await this.stageHandlers.handleScheduleVisit(userId, userMessage);
                    break;
                    
                default:
                    console.log("❓ Unknown stage, defaulting to trust building");
                    responseText = await this.stageHandlers.handleTrustBuilding(userId, userMessage);
            }
            
            // Get updated stage after processing
            const updatedSession = this.stateManager.getUserSession(userId);
            const updatedStage = updatedSession.discoveryState?.currentStage || DISCOVERY_STAGES.TRUST_BUILDING;
            
            console.log(`📊 Updated stage: ${updatedStage}`);
            console.log(`📝 Response text: "${responseText}"`);
            
            // Create response object
            const response: OpenAIResponse = {
                text: responseText,
                metadata: {
                    stage: updatedStage,
                    responseStatus: responseStatus,
                    actionName: "grand-villa-discovery",
                    reliability: "guaranteed"
                }
            };
            
            console.log("🚀 === BACKEND RESPONSE DATA ===");
            console.log(`📝 Response text: ${response.text}`);
            console.log(`🏷️ Response metadata: ${JSON.stringify(response.metadata)}`);
            console.log(`📊 Stage: ${response.metadata.stage}`);
            console.log(`🔍 ResponseStatus: ${response.metadata.responseStatus}`);
            console.log("===============================");
            
            return response;
            
        } catch (error) {
            console.error("❌ Critical error in discovery orchestrator:", error);
            
            // Ultimate fallback that can never fail
            const fallbackResponse: OpenAIResponse = {
                text: "Hello! I'm Grace, and I'm here to help you explore senior living options for your family. How can I assist you today?",
                metadata: {
                    stage: DISCOVERY_STAGES.TRUST_BUILDING,
                    responseStatus: "Normal situation",
                    actionName: "grand-villa-discovery",
                    reliability: "fallback"
                }
            };
            
            console.log("🚨 === ULTIMATE FALLBACK RESPONSE ===");
            console.log(`📝 Fallback text: ${fallbackResponse.text}`);
            console.log(`🏷️ Fallback metadata: ${JSON.stringify(fallbackResponse.metadata)}`);
            console.log("=====================================");
            
            return fallbackResponse;
        }
    }
    
    // Get current user session info (for debugging)
    public getUserSessionInfo(userId: string) {
        const session = this.stateManager.getUserSession(userId);
        return {
            userId: session.userId,
            userName: session.userName,
            currentStage: session.discoveryState?.currentStage,
            contactInfo: session.comprehensiveRecord?.contact_info,
            questionsAnswered: {
                situation: session.comprehensiveRecord?.situation_discovery?.length || 0,
                lifestyle: session.comprehensiveRecord?.lifestyle_discovery?.length || 0,
                readiness: session.comprehensiveRecord?.readiness_discovery?.length || 0,
                priorities: session.comprehensiveRecord?.priorities_discovery?.length || 0,
                visitScheduling: session.comprehensiveRecord?.visit_scheduling?.length || 0
            },
            lastUpdated: session.lastUpdated
        };
    }
    
    // Reset user session (for testing)
    public resetUserSession(userId: string): void {
        this.stateManager.clearUserSession(userId);
        console.log(`🔄 Reset user session for: ${userId}`);
    }
    
    // Get all sessions (for debugging)
    public getAllSessions() {
        return this.stateManager.getAllSessions();
    }
}
