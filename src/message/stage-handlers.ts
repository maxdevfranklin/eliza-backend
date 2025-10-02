// Stage handlers for the Grand Villa Discovery process
import { DiscoveryStateManager } from './state-manager.js';
import { OpenAIClient } from './openai-client.js';
import { 
    DISCOVERY_STAGES, 
    SITUATION_QUESTIONS, 
    LIFESTYLE_QUESTIONS, 
    READINESS_QUESTIONS, 
    PRIORITIES_QUESTIONS,
    GRACE_PERSONALITY,
    GRAND_VILLA_INFO,
    ComprehensiveRecord
} from './types.js';
import { EmailService } from '../utils/email-service.js';

export class StageHandlers {
    private stateManager: DiscoveryStateManager;
    private openaiClient: OpenAIClient;
    
    constructor(openaiApiKey: string) {
        this.stateManager = DiscoveryStateManager.getInstance();
        this.openaiClient = new OpenAIClient(openaiApiKey);
    }

    /**
     * Send comprehensive records to frontend via email service
     * Similar to how grand-villa-discovery.ts sends records
     * @param email - Recipient email address
     * @param comprehensiveRecord - The comprehensive record data
     */
    private async sendComprehensiveRecordsToFrontend(email: string, comprehensiveRecord: ComprehensiveRecord): Promise<boolean> {
        try {
            console.log("📧 [StageHandlers] Starting sendComprehensiveRecordsToFrontend request");
            console.log(`📧 [StageHandlers] To: ${email}`);
            console.log(`📧 [StageHandlers] Record keys:`, Object.keys(comprehensiveRecord || {}));
            
            const success = await EmailService.sendComprehensiveRecords(email, comprehensiveRecord);
            
            if (success) {
                console.log("✅ [StageHandlers] Comprehensive records sent successfully to frontend");
                return true;
            } else {
                console.error("❌ [StageHandlers] Failed to send comprehensive records to frontend");
                return false;
            }
        } catch (error) {
            console.error("❌ [StageHandlers] Error sending comprehensive records to frontend:", error);
            return false;
        }
    }
    
    // Trust Building Handler
    public async handleTrustBuilding(userId: string, userMessage: string): Promise<string> {
        console.log("🔒 Handling trust building stage");
        
        // Get user session
        const session = this.stateManager.getUserSession(userId);
        const contactInfo = this.stateManager.getContactInfo(userId);
        
        // Check if user provided a response (not the first interaction)
        if (userMessage && userMessage.trim()) {
            // Try to extract contact information from user responses
            const extractionResult = await this.openaiClient.extractContactInfo(userMessage, contactInfo);
            
            // Merge with existing info if we have any
            let finalName = extractionResult.foundName && extractionResult.name ? extractionResult.name : (contactInfo?.name || null);
            let finalLocation = extractionResult.foundLocation && extractionResult.location ? extractionResult.location : (contactInfo?.location || null);
            let finalLovedOneName = extractionResult.foundLovedOneName && extractionResult.loved_one_name ? extractionResult.loved_one_name : (contactInfo?.loved_one_name || null);
            
            console.log(`=== CONTACT INFO EXTRACTION ===`);
            console.log(`Extracted name: ${extractionResult.foundName ? extractionResult.name : 'NO'}`);
            console.log(`Extracted location: ${extractionResult.foundLocation ? extractionResult.location : 'NO'}`);
            console.log(`Extracted loved one: ${extractionResult.foundLovedOneName ? extractionResult.loved_one_name : 'NO'}`);
            console.log(`Final name: ${finalName || 'NO'}`);
            console.log(`Final location: ${finalLocation || 'NO'}`);
            console.log(`Final loved one: ${finalLovedOneName || 'NO'}`);
            console.log(`===============================`);
            
            // Update contact info
            this.stateManager.updateContactInfo(userId, {
                name: finalName,
                location: finalLocation,
                loved_one_name: finalLovedOneName,
                collected_at: new Date().toISOString()
            });
            
            // If we found all three pieces of info, move to next stage
            if (finalName && finalLocation && finalLovedOneName) {
                console.log(`=== SAVING COMPLETE CONTACT INFO ===`);
                console.log(`Name: ${finalName}, Location: ${finalLocation}, Loved One: ${finalLovedOneName}`);
                
                // Move to situation discovery stage
                this.stateManager.updateDiscoveryState(userId, { currentStage: DISCOVERY_STAGES.SITUATION_DISCOVERY });
                
                const response = `Thank you, ${finalName}! I'd be happy to get you the information you need, but before I do, do you mind if I ask a few quick questions? That way, I can really understand what's important and make sure I'm helping in the best way possible.`;
                
                console.log(`Stored complete contact info and moving to situation_discovery`);
                return response;
            }
            
            // If we're missing any required info, ask for what's missing
            const missingItems = [];
            if (!finalName) missingItems.push("your name");
            if (!finalLocation) missingItems.push("your location");
            if (!finalLovedOneName) missingItems.push("your loved one's name");
            
            const generationContext = `User message: "${userMessage}"

This is the start of the conversation. Do NOT give all the details from "${GRAND_VILLA_INFO}". 
Instead:
- Then naturally explain that to provide the most helpful information, you'll need a few basics from the user.
- Ask politely for the missing details: ${missingItems.join(", ")}.
- Keep response under 30-50 words.
- Return ONLY the response text, no formatting or extra commentary.`;

            try {
                const generated = await this.openaiClient.generateText([
                    { role: 'system', content: 'You are Grace, a warm and empathetic senior living guide. Respond naturally and conversationally.' },
                    { role: 'user', content: generationContext }
                ], 'gpt-4.1', 100, 0.7);
                
                console.log("Generated trust building response:", generated);
                return generated;
            } catch (error) {
                console.error("Error generating trust building response:", error);
                return "I'd love to help you! To get started, could I get your name, location, and the name of your loved one you're looking for senior living options for?";
            }
        }
        
        // First interaction - ask for name, location, and loved one's name
        const initialResponse = "Hello! I'm Grace, and I'm here to help you explore senior living options for your family. To get started, could I get your name, location, and the name of your loved one you're looking for senior living options for?";
        
        console.log(`Stored initial contact request in trust_building stage`);
        return initialResponse;
    }
    
    // Situation Discovery Handler
    public async handleSituationDiscovery(userId: string, userMessage: string, isTransition: boolean = false, originalUserMessage?: string): Promise<string> {
        console.log("🔍 Handling situation discovery stage");
        
        const contactInfo = this.stateManager.getContactInfo(userId);
        const userName = this.stateManager.getUserFirstName(userId);
        const lovedOneName = contactInfo?.loved_one_name || "your loved one";
        const location = contactInfo?.location || "Florida";
        
        // Get comprehensive record to see what questions have been asked/answered
        const answeredQuestions = this.stateManager.getAnsweredQuestions(userId, DISCOVERY_STAGES.SITUATION_DISCOVERY);
        
        console.log(`=== SITUATION DISCOVERY STAGE ===`);
        console.log(`Current user message: ${userMessage}`);
        console.log(`Already answered questions: ${JSON.stringify(answeredQuestions)}`);
        console.log(`================================`);
        
        // Track which questions get answered in this interaction
        let locallyAnsweredQuestions: string[] = [...answeredQuestions];
        
        // If user provided a response and we're not in a transition, assign it to the next unanswered question
        if (userMessage && userMessage.trim() && !isTransition) {
            const unansweredQuestions = SITUATION_QUESTIONS.filter(q => !locallyAnsweredQuestions.includes(q));
            
            if (unansweredQuestions.length > 0) {
                const nextQuestion = unansweredQuestions[0];
                this.stateManager.addQAEntry(userId, DISCOVERY_STAGES.SITUATION_DISCOVERY, nextQuestion, userMessage);
                
                locallyAnsweredQuestions.push(nextQuestion);
                console.log(`✓ Assigned user response to: ${nextQuestion}`);
                console.log(`   Answer: ${userMessage}`);
            }
        }
        
        if (isTransition) {
            console.log(`🔄 Stage transition detected - will ask first question instead of auto-assigning user message`);
        }
        
        // Use locally tracked answers instead of database retrieval to avoid timing issues
        const remainingQuestions = SITUATION_QUESTIONS.filter(q => !locallyAnsweredQuestions.includes(q));
        
        console.log(`=== REMAINING QUESTIONS CHECK ===`);
        console.log(`Total answered: ${locallyAnsweredQuestions.length}/${SITUATION_QUESTIONS.length}`);
        console.log(`Remaining questions: ${JSON.stringify(remainingQuestions)}`);
        console.log(`=================================`);
        
        // If all questions are answered, move to next stage
        if (remainingQuestions.length === 0) {
            console.log("All situation questions answered, moving to lifestyle_discovery stage");
            
            // Move to lifestyle discovery stage
            this.stateManager.updateDiscoveryState(userId, { currentStage: DISCOVERY_STAGES.LIFESTYLE_DISCOVERY });
            
            // Let lifestyle discovery handler create the actual response
            return await this.handleLifestyleDiscovery(userId, "", true, userMessage);
        }
        
        // Generate AI response that asks the next unanswered question with context
        const nextQuestion = remainingQuestions[0];
        const currentAnsweredCount = SITUATION_QUESTIONS.length - remainingQuestions.length;
        
        // Get any previous answers to provide context
        const previousAnswers = answeredQuestions.map(q => {
            const record = this.stateManager.getComprehensiveRecord(userId);
            const entry = record?.situation_discovery.find(e => e.question === q);
            return entry ? `${q}: ${entry.answer}` : q;
        }).join(' | ');
        
        // STEP 1: Determine situation classification
        const classification = await this.openaiClient.classifySituation(userMessage);
        const status = classification.status;
        
        console.log(`Situation classified as: ${status}`);
        
        // STEP 2: Generate appropriate response based on classification
        try {
            const response = await this.openaiClient.generateContextualResponse(
                DISCOVERY_STAGES.SITUATION_DISCOVERY,
                userMessage,
                status,
                nextQuestion,
                userName,
                lovedOneName,
                location,
                GRAND_VILLA_INFO,
                previousAnswers,
                currentAnsweredCount,
                SITUATION_QUESTIONS.length
            );
            
            console.log("Generated situation discovery response:", response);
            return response;
            
        } catch (error) {
            console.error("Failed to generate AI response:", error);
            return `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        }
    }
    
    // Lifestyle Discovery Handler
    public async handleLifestyleDiscovery(userId: string, userMessage: string, isTransition: boolean = false, originalUserMessage?: string): Promise<string> {
        console.log("🎨 Handling lifestyle discovery stage");
        
        const contactInfo = this.stateManager.getContactInfo(userId);
        const userName = this.stateManager.getUserFirstName(userId);
        const lovedOneName = contactInfo?.loved_one_name || "your loved one";
        const location = contactInfo?.location || "Florida";
        
        // Get comprehensive record to see what questions have been asked/answered
        const answeredQuestions = this.stateManager.getAnsweredQuestions(userId, DISCOVERY_STAGES.LIFESTYLE_DISCOVERY);
        
        console.log(`=== LIFESTYLE DISCOVERY STAGE ===`);
        console.log(`Current user message: ${userMessage}`);
        console.log(`Already answered questions: ${JSON.stringify(answeredQuestions)}`);
        console.log(`Using name in response: ${userName ? 'YES' : 'NO'} (${userName || 'N/A'})`);
        console.log(`================================`);
        
        // Track which questions get answered in this interaction
        let locallyAnsweredQuestions: string[] = [...answeredQuestions];
        
        // If user provided a response and we're not in a transition, assign it to the next unanswered question
        if (userMessage && userMessage.trim() && !isTransition) {
            const unansweredQuestions = LIFESTYLE_QUESTIONS.filter(q => !locallyAnsweredQuestions.includes(q));
            
            if (unansweredQuestions.length > 0) {
                const nextQuestion = unansweredQuestions[0];
                this.stateManager.addQAEntry(userId, DISCOVERY_STAGES.LIFESTYLE_DISCOVERY, nextQuestion, userMessage);
                
                locallyAnsweredQuestions.push(nextQuestion);
                console.log(`✓ Assigned user response to: ${nextQuestion}`);
                console.log(`   Answer: ${userMessage}`);
            }
        }
        
        if (isTransition) {
            console.log(`🔄 Stage transition detected - will ask first question instead of auto-assigning user message`);
        }
        
        // Use locally tracked answers instead of database retrieval to avoid timing issues
        const remainingQuestions = LIFESTYLE_QUESTIONS.filter(q => !locallyAnsweredQuestions.includes(q));
        
        console.log(`=== REMAINING QUESTIONS CHECK ===`);
        console.log(`Total answered: ${locallyAnsweredQuestions.length}/${LIFESTYLE_QUESTIONS.length}`);
        console.log(`Remaining questions: ${JSON.stringify(remainingQuestions)}`);
        console.log(`=================================`);
        
        // If all questions are answered, move to next stage
        if (remainingQuestions.length === 0) {
            console.log("All lifestyle questions answered, moving to readiness_discovery stage");
            
            // Move to readiness discovery stage
            this.stateManager.updateDiscoveryState(userId, { currentStage: DISCOVERY_STAGES.READINESS_DISCOVERY });
            
            // Let readiness discovery handler create the actual response
            return await this.handleReadinessDiscovery(userId, "", true, userMessage);
        }
        
        // Generate AI response that asks the next unanswered question with context
        const nextQuestion = remainingQuestions[0];
        const currentAnsweredCount = LIFESTYLE_QUESTIONS.length - remainingQuestions.length;
        
        // Get any previous answers to provide context
        const previousAnswers = answeredQuestions.map(q => {
            const record = this.stateManager.getComprehensiveRecord(userId);
            const entry = record?.lifestyle_discovery.find(e => e.question === q);
            return entry ? `${q}: ${entry.answer}` : q;
        }).join(' | ');
        
        // STEP 1: Determine situation classification
        // Use originalUserMessage for classification if this is a transition, otherwise use userMessage
        const messageForClassification = (isTransition && originalUserMessage) ? originalUserMessage : userMessage;
        const classification = await this.openaiClient.classifySituation(messageForClassification);
        const status = classification.status;
        
        console.log(`Situation classified as: ${status} (using message: "${messageForClassification}")`);
        
        // STEP 2: Generate appropriate response based on classification
        try {
            const response = await this.openaiClient.generateContextualResponse(
                DISCOVERY_STAGES.LIFESTYLE_DISCOVERY,
                messageForClassification,
                status,
                nextQuestion,
                userName,
                lovedOneName,
                location,
                GRAND_VILLA_INFO,
                previousAnswers,
                currentAnsweredCount,
                LIFESTYLE_QUESTIONS.length
            );
            
            console.log("Generated lifestyle discovery response:", response);
            return response;
            
        } catch (error) {
            console.error("Failed to generate AI response:", error);
            return `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        }
    }
    
    // Readiness Discovery Handler
    public async handleReadinessDiscovery(userId: string, userMessage: string, isTransition: boolean = false, originalUserMessage?: string): Promise<string> {
        console.log("🎯 Handling readiness discovery stage");
        
        const contactInfo = this.stateManager.getContactInfo(userId);
        const userName = this.stateManager.getUserFirstName(userId);
        const lovedOneName = contactInfo?.loved_one_name || "your loved one";
        const location = contactInfo?.location || "Florida";
        
        // Get comprehensive record to see what questions have been asked/answered
        const answeredQuestions = this.stateManager.getAnsweredQuestions(userId, DISCOVERY_STAGES.READINESS_DISCOVERY);
        
        console.log(`=== READINESS DISCOVERY STAGE ===`);
        console.log(`Current user message: ${userMessage}`);
        console.log(`📝 ALL REQUIRED QUESTIONS:`);
        READINESS_QUESTIONS.forEach((q, i) => console.log(`   ${i+1}. ${q}`));
        console.log(`✅ ANSWERED QUESTIONS (${answeredQuestions.length}/${READINESS_QUESTIONS.length}):`);
        answeredQuestions.forEach((q, i) => console.log(`   ${i+1}. ${q}`));
        console.log(`❌ MISSING QUESTIONS:`);
        const missingQuestions = READINESS_QUESTIONS.filter(q => !answeredQuestions.includes(q));
        missingQuestions.forEach((q, i) => console.log(`   ${i+1}. ${q}`));
        console.log(`Using name in response: ${userName ? 'YES' : 'NO'} (${userName || 'N/A'})`);
        console.log(`================================`);
        
        // Track which questions get answered in this interaction
        let locallyAnsweredQuestions: string[] = [...answeredQuestions];
        
        // If user provided a response and we're not in a transition, assign it to the next unanswered question
        if (userMessage && userMessage.trim() && !isTransition) {
            const unansweredQuestions = READINESS_QUESTIONS.filter(q => !locallyAnsweredQuestions.includes(q));
            
            if (unansweredQuestions.length > 0) {
                const nextQuestion = unansweredQuestions[0];
                this.stateManager.addQAEntry(userId, DISCOVERY_STAGES.READINESS_DISCOVERY, nextQuestion, userMessage);
                
                locallyAnsweredQuestions.push(nextQuestion);
                console.log(`✓ Assigned user response to: ${nextQuestion}`);
                console.log(`   Answer: ${userMessage}`);
            }
        }
        
        if (isTransition) {
            console.log(`🔄 Stage transition detected - will ask first question instead of auto-assigning user message`);
        }
        
        // Use locally tracked answers instead of database retrieval to avoid timing issues
        const remainingQuestions = READINESS_QUESTIONS.filter(q => !locallyAnsweredQuestions.includes(q));
        
        console.log(`=== REMAINING QUESTIONS CHECK ===`);
        console.log(`Total answered: ${locallyAnsweredQuestions.length}/${READINESS_QUESTIONS.length}`);
        console.log(`Remaining questions: ${JSON.stringify(remainingQuestions)}`);
        console.log(`=================================`);
        
        // If all questions are answered, move to next stage
        if (remainingQuestions.length === 0) {
            console.log("All readiness questions answered, moving to priorities_discovery stage");
            
            // Move to priorities discovery stage
            this.stateManager.updateDiscoveryState(userId, { currentStage: DISCOVERY_STAGES.PRIORITIES_DISCOVERY });
            
            // Let priorities discovery handler create the actual response
            return await this.handlePrioritiesDiscovery(userId, "", true, userMessage);
        }
        
        console.log(`⏳ STILL NEED ${remainingQuestions.length} MORE ANSWERS - staying in readiness_discovery`);
        
        // Generate AI response that asks the next unanswered question with context
        const nextQuestion = remainingQuestions[0];
        const currentAnsweredCount = READINESS_QUESTIONS.length - remainingQuestions.length;
        
        console.log(`🔄 ASKING NEXT QUESTION: "${nextQuestion}"`);
        console.log(`📊 PROGRESS: ${currentAnsweredCount}/${READINESS_QUESTIONS.length} questions answered`);
        
        // Get any previous answers to provide context
        const previousAnswers = answeredQuestions.map(q => {
            const record = this.stateManager.getComprehensiveRecord(userId);
            const entry = record?.readiness_discovery.find(e => e.question === q);
            return entry ? `${q}: ${entry.answer}` : q;
        }).join(' | ');
        
        // STEP 1: Determine situation classification
        // Use originalUserMessage for classification if this is a transition, otherwise use userMessage
        const messageForClassification = (isTransition && originalUserMessage) ? originalUserMessage : userMessage;
        const classification = await this.openaiClient.classifySituation(messageForClassification);
        const status = classification.status;
        
        console.log(`Situation classified as: ${status} (using message: "${messageForClassification}")`);
        
        // STEP 2: Generate appropriate response based on classification
        try {
            const response = await this.openaiClient.generateContextualResponse(
                DISCOVERY_STAGES.READINESS_DISCOVERY,
                messageForClassification,
                status,
                nextQuestion,
                userName,
                lovedOneName,
                location,
                GRAND_VILLA_INFO,
                previousAnswers,
                currentAnsweredCount,
                READINESS_QUESTIONS.length
            );
            
            console.log("Generated readiness discovery response:", response);
            return response;
            
        } catch (error) {
            console.error("Failed to generate AI response:", error);
            return `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        }
    }
    
    // Priorities Discovery Handler
    public async handlePrioritiesDiscovery(userId: string, userMessage: string, isTransition: boolean = false, originalUserMessage?: string): Promise<string> {
        console.log("⭐ Handling priorities discovery stage");
        
        const contactInfo = this.stateManager.getContactInfo(userId);
        const userName = this.stateManager.getUserFirstName(userId);
        const lovedOneName = contactInfo?.loved_one_name || "your loved one";
        const location = contactInfo?.location || "Florida";
        
        // Get comprehensive record to see what questions have been asked/answered
        const answeredQuestions = this.stateManager.getAnsweredQuestions(userId, DISCOVERY_STAGES.PRIORITIES_DISCOVERY);
        
        console.log(`=== PRIORITIES DISCOVERY STAGE ===`);
        console.log(`Current user message: ${userMessage}`);
        console.log(`📝 ALL REQUIRED QUESTIONS:`);
        PRIORITIES_QUESTIONS.forEach((q, i) => console.log(`   ${i+1}. ${q}`));
        console.log(`✅ ANSWERED QUESTIONS (${answeredQuestions.length}/${PRIORITIES_QUESTIONS.length}):`);
        answeredQuestions.forEach((q, i) => console.log(`   ${i+1}. ${q}`));
        console.log(`❌ MISSING QUESTIONS:`);
        const missingQuestions = PRIORITIES_QUESTIONS.filter(q => !answeredQuestions.includes(q));
        missingQuestions.forEach((q, i) => console.log(`   ${i+1}. ${q}`));
        console.log(`Using name in response: ${userName ? 'YES' : 'NO'} (${userName || 'N/A'})`);
        console.log(`=================================`);
        
        // Track which questions get answered in this interaction
        let locallyAnsweredQuestions: string[] = [...answeredQuestions];
        
        // If user provided a response and we're not in a transition, assign it to the next unanswered question
        if (userMessage && userMessage.trim() && !isTransition) {
            const unansweredQuestions = PRIORITIES_QUESTIONS.filter(q => !locallyAnsweredQuestions.includes(q));
            
            if (unansweredQuestions.length > 0) {
                const nextQuestion = unansweredQuestions[0];
                this.stateManager.addQAEntry(userId, DISCOVERY_STAGES.PRIORITIES_DISCOVERY, nextQuestion, userMessage);
                
                locallyAnsweredQuestions.push(nextQuestion);
                console.log(`✓ Assigned user response to: ${nextQuestion}`);
                console.log(`   Answer: ${userMessage}`);
            }
        }
        
        if (isTransition) {
            console.log(`🔄 Stage transition detected - will ask first question instead of auto-assigning user message`);
        }
        
        // Use locally tracked answers instead of database retrieval to avoid timing issues
        const remainingQuestions = PRIORITIES_QUESTIONS.filter(q => !locallyAnsweredQuestions.includes(q));
        
        console.log(`=== REMAINING QUESTIONS CHECK ===`);
        console.log(`Total answered: ${locallyAnsweredQuestions.length}/${PRIORITIES_QUESTIONS.length}`);
        console.log(`Remaining questions: ${JSON.stringify(remainingQuestions)}`);
        console.log(`=================================`);
        
        // If all questions are answered, move to next stage
        if (remainingQuestions.length === 0) {
            console.log("All priorities questions answered, moving to needs_matching stage");
            
            // Move to needs matching stage
            this.stateManager.updateDiscoveryState(userId, { currentStage: DISCOVERY_STAGES.NEEDS_MATCHING });
            
            // Let needs matching handler create the actual response
            return await this.handleNeedsMatching(userId, "", true, userMessage);
        }
        
        console.log(`⏳ STILL NEED ${remainingQuestions.length} MORE ANSWERS - staying in priorities_discovery`);
        
        // Generate AI response that asks the next unanswered question with context
        const nextQuestion = remainingQuestions[0];
        const currentAnsweredCount = PRIORITIES_QUESTIONS.length - remainingQuestions.length;
        
        console.log(`🔄 ASKING NEXT QUESTION: "${nextQuestion}"`);
        console.log(`📊 PROGRESS: ${currentAnsweredCount}/${PRIORITIES_QUESTIONS.length} questions answered`);
        
        // Get any previous answers to provide context
        const previousAnswers = answeredQuestions.map(q => {
            const record = this.stateManager.getComprehensiveRecord(userId);
            const entry = record?.priorities_discovery.find(e => e.question === q);
            return entry ? `${q}: ${entry.answer}` : q;
        }).join(' | ');
        
        // STEP 1: Determine situation classification
        // Use originalUserMessage for classification if this is a transition, otherwise use userMessage
        const messageForClassification = (isTransition && originalUserMessage) ? originalUserMessage : userMessage;
        const classification = await this.openaiClient.classifySituation(messageForClassification);
        const status = classification.status;
        
        console.log(`Situation classified as: ${status} (using message: "${messageForClassification}")`);
        
        // STEP 2: Generate appropriate response based on classification
        try {
            const response = await this.openaiClient.generateContextualResponse(
                DISCOVERY_STAGES.PRIORITIES_DISCOVERY,
                messageForClassification,
                status,
                nextQuestion,
                userName,
                lovedOneName,
                location,
                GRAND_VILLA_INFO,
                previousAnswers,
                currentAnsweredCount,
                PRIORITIES_QUESTIONS.length
            );
            
            console.log("Generated priorities discovery response:", response);
            return response;
            
        } catch (error) {
            console.error("Failed to generate AI response:", error);
            return `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        }
    }
    
    // Needs Matching Handler
    public async handleNeedsMatching(userId: string, userMessage: string, isTransition: boolean = false, originalUserMessage?: string): Promise<string> {
        console.log("🎯 Handling needs matching stage");
        
        const contactInfo = this.stateManager.getContactInfo(userId);
        const userName = this.stateManager.getUserFirstName(userId);
        const lovedOneName = contactInfo?.loved_one_name || "your loved one";
        const location = contactInfo?.location || "Florida";
        
        console.log(`=== NEEDS MATCHING STAGE ===`);
        console.log(`Current user message: ${userMessage}`);
        console.log(`Is user response: ${userMessage && userMessage.trim() ? 'YES' : 'NO'}`);
        console.log(`Using name in response: ${userName ? 'YES' : 'NO'} (${userName || 'N/A'})`);
        console.log(`===============================`);
        
        // If this is NOT a user response (initial transition) or is a transition, stay in needs_matching and provide the matching response
        if ((!userMessage || !userMessage.trim()) || isTransition) {
            console.log("start needs matching");
            
            // Get comprehensive record to see all previous answers
            const record = this.stateManager.getComprehensiveRecord(userId);
            const situationQAEntries = record?.situation_discovery || [];
            const lifestyleQAEntries = record?.lifestyle_discovery || [];
            const readinessQAEntries = record?.readiness_discovery || [];
            const prioritiesQAEntries = record?.priorities_discovery || [];
            
            // Combine all previous answers for comprehensive analysis
            const allPreviousAnswers = [
                ...situationQAEntries.map(entry => `${entry.question}: ${entry.answer}`),
                ...lifestyleQAEntries.map(entry => `${entry.question}: ${entry.answer}`),
                ...readinessQAEntries.map(entry => `${entry.question}: ${entry.answer}`),
                ...prioritiesQAEntries.map(entry => `${entry.question}: ${entry.answer}`)
            ].join(" | ");
            
            try {
                const response = await this.openaiClient.generateNeedsMatchingResponse(
                    allPreviousAnswers,
                    userName,
                    lovedOneName,
                    location,
                    GRAND_VILLA_INFO
                );
                
                console.log("Generated needs matching response:", response);
                return response;
                
            } catch (error) {
                console.error("Failed to generate AI response:", error);
                return `${userName ? `${userName}, ` : ''}Based on everything you've shared about ${lovedOneName}, I can see how Grand Villa would be such a perfect fit. The community, care, and activities we offer align beautifully with what you've described. It sounds like this could really bring ${lovedOneName} the peace and joy you want for them.`;
            }
        }
        
        // If this IS a user response (and not a transition), transition to schedule_visit
        if (!isTransition) {
            console.log("User responded to needs matching, transitioning to schedule_visit stage");
            
            // Move to schedule visit stage
            this.stateManager.updateDiscoveryState(userId, { currentStage: DISCOVERY_STAGES.SCHEDULE_VISIT });
            
            // Let schedule visit handler create the actual response
            return await this.handleScheduleVisit(userId, "", true, userMessage);
        }
        
        // If this is a transition, we should not reach here since we handled it above
        console.log("This should not be reached - transition case should be handled above");
        return "I'm here to help you with your senior living needs. How can I assist you today?";
    }
    
    // Schedule Visit Handler
    public async handleScheduleVisit(userId: string, userMessage: string, isTransition: boolean = false, originalUserMessage?: string): Promise<string> {
        console.log("📅 Handling schedule visit stage");
        
        const contactInfo = this.stateManager.getContactInfo(userId);
        const userName = this.stateManager.getUserFirstName(userId);
        const lovedOneName = contactInfo?.loved_one_name || "your loved one";
        
        // Get current step status
        const stepStatus = this.stateManager.getVisitStepStatus(userId);
        
        console.log(`=== SCHEDULE VISIT - CURRENT STEP: ${stepStatus.currentStep} ===`);
        console.log(`User message: "${userMessage}"`);
        console.log(`Is transition: ${isTransition}`);
        console.log(`Original user message: "${originalUserMessage}"`);
        
        // Get comprehensive record once and pass it to step handlers
        const record = this.stateManager.getComprehensiveRecord(userId);
        const visitEntries = record?.visit_scheduling || [];
        console.log(`Visit entries: ${JSON.stringify(visitEntries.map(e => e.question))}`);
        console.log(`Visit entries details: ${JSON.stringify(visitEntries)}`);
        
        let response: string;
        
        switch (stepStatus.currentStep) {
            case 1:
                response = await this.handleStepOne(userId, userMessage, userName, lovedOneName, isTransition, originalUserMessage, record);
                break;
            case 2:
                response = await this.handleStepTwo(userId, userMessage, userName, lovedOneName, record);
                break;
            case 3:
                response = await this.handleStepThree(userId, userMessage, userName, lovedOneName, record);
                break;
            case 4:
                response = await this.handleStepFour(userId, userMessage, userName, lovedOneName, record);
                break;
            case 5:
                response = await this.handleStepFive(userId, userMessage, userName, lovedOneName, record);
                break;
            default:
                response = `${userName ? `${userName}, ` : ''}I'd love to help you schedule a visit to Grand Villa. Would you be interested in seeing our community in person?`;
        }
        
        return response;
    }
    
    // Step 1: Guide to visit and get agreement
    private async handleStepOne(userId: string, userMessage: string, userName: string, lovedOneName: string, isTransition: boolean = false, originalUserMessage?: string, record?: ComprehensiveRecord | null): Promise<string> {
        const stepStatus = this.stateManager.getVisitStepStatus(userId);
        
        // Check if user has already agreed to visit
        const visitEntries = record?.visit_scheduling || [];
        const hasAgreedToVisit = visitEntries.some(entry => entry.question === "visit_agreement");
        
        if (hasAgreedToVisit) {
            // User already agreed, move to step 2
            return "Wonderful! How about Wednesday at 5pm? Does that work for you?";
        }

        // Get all previous answers from the passed record
        const situationQAEntries = record?.situation_discovery || [];
        const lifestyleQAEntries = record?.lifestyle_discovery || [];
        const readinessQAEntries = record?.readiness_discovery || [];
        const prioritiesQAEntries = record?.priorities_discovery || [];
        const allPreviousAnswers = [
            ...situationQAEntries.map(entry => `${entry.question}: ${entry.answer}`),
            ...lifestyleQAEntries.map(entry => `${entry.question}: ${entry.answer}`),
            ...readinessQAEntries.map(entry => `${entry.question}: ${entry.answer}`),
            ...prioritiesQAEntries.map(entry => `${entry.question}: ${entry.answer}`)
        ].join(" | ");

        // Check if this is NOT an initial transition (user provided a response to schedule visit)
        // For transitions, we should treat it as initial even if we have originalUserMessage
        const isInitial = isTransition || !userMessage || !userMessage.trim();
        
        // Use originalUserMessage for analysis if this is a transition, otherwise use userMessage
        const messageForAnalysis = (isTransition && originalUserMessage) ? originalUserMessage : userMessage;
        
        if (!isInitial) {
            // Analyze user response to see if they agreed
            const analysis = await this.openaiClient.analyzeVisitAgreement(messageForAnalysis);
            
            if (analysis.agreed) {
                // User agreed - save the agreement
                this.stateManager.addQAEntry(userId, DISCOVERY_STAGES.SCHEDULE_VISIT, "visit_agreement", messageForAnalysis);
                
                console.log(`✅ User agreed to visit, saved agreement.`);
                console.log(`Analysis response: "${analysis.response}"`);
                
                // Debug: Check step status after saving
                const newStepStatus = this.stateManager.getVisitStepStatus(userId);
                console.log(`Step status after saving agreement: ${newStepStatus.currentStep}`);
                
                // Return the analysis response which should include time suggestion
                return analysis.response;
            }
        }
        
        // User hasn't agreed yet or this is initial transition - return encouraging response with Grand Villa info
        try {
            const response = await this.openaiClient.generateEncouragingVisitResponse(
                messageForAnalysis || "",
                userName,
                lovedOneName,
                GRAND_VILLA_INFO,
                allPreviousAnswers
            );
            
            return response;
        } catch (error) {
            console.error("Error generating step one response:", error);
            return `${userName ? `${userName}, ` : ''}I understand. Seeing Grand Villa in person really helps families feel confident about their decision. Would you like to schedule a brief visit to see if it feels right for ${lovedOneName}?`;
        }
    }
    
    // Step 2: Time confirmation
    private async handleStepTwo(userId: string, userMessage: string, userName: string, lovedOneName: string, record?: ComprehensiveRecord | null): Promise<string> {
        const analysis = await this.openaiClient.analyzeTimeConfirmation(userMessage);
        
        if (analysis.confirmed && !analysis.rejected) {
            // User confirmed Wednesday 5pm
            this.stateManager.addQAEntry(userId, DISCOVERY_STAGES.SCHEDULE_VISIT, "time_confirmation", "Wednesday 5pm");
            console.log(`✅ User confirmed time, saved confirmation.`);
            return `Perfect! Wednesday at 5pm it is. Which email should I send the calendar invite and visit details to?`;
        }
        
        if (analysis.alternative_time) {
            // User suggested alternative time
            this.stateManager.addQAEntry(userId, DISCOVERY_STAGES.SCHEDULE_VISIT, "time_confirmation", analysis.alternative_time);
            console.log(`✅ User provided alternative time, saved confirmation.`);
            return `Got it, ${analysis.alternative_time} works. Which email should I send the calendar invite and details to?`;
        }
        
        if (analysis.rejected && !analysis.alternative_time) {
            // User rejected without alternative - use Villa info to ease concern & re-ask
            try {
                const response = await this.openaiClient.generateVisitSchedulingResponse(
                    userMessage,
                    userName,
                    lovedOneName,
                    GRAND_VILLA_INFO,
                    "",
                    2
                );
                
                return response;
            } catch (error) {
                console.error("Error generating step two response:", error);
                return `${userName ? userName + ", " : ""}no problem at all. When would be a better time to visit Grand Villa for ${lovedOneName}?`;
            }
        }
        
        // Unclear response - ask again
        return `${userName ? userName + ", " : ""}just to confirm — does Wednesday at 5pm work, or would you like a different time?`;
    }
    
    // Step 3: Email collection
    private async handleStepThree(userId: string, userMessage: string, userName: string, lovedOneName: string, record?: ComprehensiveRecord | null): Promise<string> {
        const analysis = await this.openaiClient.extractEmail(userMessage);
        
        // Fallback regex detection if AI fails
        let email = analysis.email;
        if (!email) {
            const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
            const emailMatch = userMessage.match(emailRegex);
            if (emailMatch) email = emailMatch[0];
        }
        
        if (email) {
            // Email found — save and complete
            this.stateManager.addQAEntry(userId, DISCOVERY_STAGES.SCHEDULE_VISIT, "email_collection", email);
            console.log(`✅ User provided email, saved email.`);
            
            // Send comprehensive records to frontend via email service
            try {
                // Get the comprehensive record from state manager
                const session = this.stateManager.getUserSession(userId);
                const comprehensiveRecord = session.comprehensiveRecord;
                
                if (comprehensiveRecord) {
                    console.log("📧 Sending comprehensive records to frontend via email service");
                    const success = await this.sendComprehensiveRecordsToFrontend(email, comprehensiveRecord);
                    
                    if (success) {
                        console.log("✅ Comprehensive records sent successfully to frontend");
                    } else {
                        console.warn("⚠️ Failed to send comprehensive records to frontend, but continuing");
                    }
                } else {
                    console.warn("⚠️ No comprehensive record found to send to frontend");
                }
            } catch (error) {
                console.error("❌ Error sending comprehensive records to frontend:", error);
                // Don't fail the entire process if sending fails
            }
            
            // Ask about referral source
            return `Perfect! I've got you all set up with ${email}. You'll receive a confirmation email shortly with all the visit details. How did you first hear about Grand Villa?`;
        }
        
        // No valid email found — politely ask again
        try {
            const response = await this.openaiClient.generateVisitSchedulingResponse(
                userMessage,
                userName,
                lovedOneName,
                GRAND_VILLA_INFO,
                "",
                3
            );
            
            return response;
        } catch (error) {
            console.error("Error generating step three response:", error);
            return `${userName ? `${userName}, ` : ''}I'll need your email address to send you the visit confirmation and details. What email should I use?`;
        }
    }
    
    // Step 4: Referral source
    private async handleStepFour(userId: string, userMessage: string, userName: string, lovedOneName: string, record?: ComprehensiveRecord | null): Promise<string> {
        this.stateManager.addQAEntry(userId, DISCOVERY_STAGES.SCHEDULE_VISIT, "referral_source", userMessage);
        
        const visitEntries = record?.visit_scheduling || [];
        const timeConfirmationEntry = visitEntries.find(entry => entry.question === "time_confirmation");
        const confirmedTime = timeConfirmationEntry?.answer || "Wednesday at 5pm";
        
        try {
            const response = await this.openaiClient.generateVisitSchedulingResponse(
                userMessage,
                userName,
                lovedOneName,
                GRAND_VILLA_INFO,
                "",
                4
            );
            
            return response;
        } catch (error) {
            console.error("Error generating step four response:", error);
            return `${userName ? `${userName}, ` : ''}When you visit, our community team will show you around and can answer any specific questions about care levels and pricing. Thank you for trusting me to help guide you through this important decision for ${lovedOneName}. I look forward to seeing you ${confirmedTime}.`;
        }
    }
    
    // Step 5: Final conversation handling
    private async handleStepFive(userId: string, userMessage: string, userName: string, lovedOneName: string, record?: ComprehensiveRecord | null): Promise<string> {
        try {
            const response = await this.openaiClient.generateVisitSchedulingResponse(
                userMessage,
                userName,
                lovedOneName,
                GRAND_VILLA_INFO,
                "",
                5
            );
            
            return response;
        } catch (error) {
            console.error("Error generating step five response:", error);
            return `${userName ? `${userName}, ` : ''}I'm here if you have any other questions about your visit or Grand Villa. Looking forward to seeing you Wednesday!`;
        }
    }
}
