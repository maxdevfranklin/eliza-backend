import { Action, generateText, IAgentRuntime, Memory, ModelClass, State, HandlerCallback, elizaLogger } from "@elizaos/core";
import { discoveryStateProvider, saveUserResponse, getUserResponses } from "../providers/discovery-state.js";

export const grandVillaDiscoveryAction: Action = {
    name: "grand-villa-discovery",
    description: "Guide families through the Sherpa discovery process for Grand Villa",
    similes: ["GRAND_VILLA", "SENIOR_LIVING", "DISCOVERY", "QUESTIONS", "LEARN_ABOUT"],
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "I'm looking for information about Grand Villa" }
            },
            {
                user: "{{user2}}", 
                content: { text: "I'd be happy to get you the information you need, but before I do, do you mind if I ask a few quick questions? That way, I can really understand what's important and make sure I'm helping in the best way possible." }
            }
        ]
    ],
    
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        const discoveryState = await getDiscoveryState(_runtime, _message);
        elizaLogger.info(`Discovery state: ${JSON.stringify(discoveryState)}`);
        elizaLogger.info("Action is triggered");
        return true;
    },
    
    handler: async (
        _runtime: IAgentRuntime,
        _message: Memory,
        _state: State,
        _options: { [key: string]: unknown },
        _callback: HandlerCallback
    ) => {
        elizaLogger.info("🚀 Starting Grand Villa Discovery process");
        
        // Get current discovery state
        const discoveryState = await getDiscoveryState(_runtime, _message);
        elizaLogger.info(`📊 Current discovery state in handler: ${JSON.stringify(discoveryState)}`);
        
        // Show current user responses collected so far
        const currentResponses = await getUserResponses(_runtime, _message);
        elizaLogger.info(`💾 User responses collected so far: ${JSON.stringify(currentResponses, null, 2)}`);
        
        // Determine conversation stage and next action
        const conversationStage = await determineConversationStage(_runtime, _message, discoveryState);
        elizaLogger.info(`🎯 Determined conversation stage: ${conversationStage}`);
        
        let response_text = "";
        
        switch (conversationStage) {
            case "trust_building":
                elizaLogger.info("Entering trust_building case");
                response_text = await handleTrustBuilding(_runtime, _message, _state);
                elizaLogger.info(`Trust building response: ${response_text}`);
                break;
                
            case "situation_discovery":
                response_text = await handleSituationQuestions(_runtime, _message, _state, discoveryState);
                break;
                
            case "lifestyle_discovery":
                response_text = await handleLifestyleQuestions(_runtime, _message, _state, discoveryState);
                break;
                
            case "readiness_discovery":
                response_text = await handleReadinessQuestions(_runtime, _message, _state, discoveryState);
                break;
                
            case "priorities_discovery":
                response_text = await handlePriorityQuestions(_runtime, _message, _state, discoveryState);
                break;
                
            case "needs_matching":
                response_text = await handleNeedsMatching(_runtime, _message, _state, discoveryState);
                break;
                
            case "visit_transition":
                response_text = await handleVisitTransition(_runtime, _message, _state, discoveryState);
                break;
                
            default:
                response_text = await handleGeneralInquiry(_runtime, _message, _state);
        }
        
        // Update discovery state
        
        _callback({ 
          text: response_text,
          metadata: {
            stage: conversationStage
          }
        });
        return true;
    }
}

// Trust Building Handler
async function handleTrustBuilding(_runtime: IAgentRuntime, _message: Memory, _state: State): Promise<string> {
    elizaLogger.info("Handling trust building stage");
    const response = "I'd be happy to get you the information you need, but before I do, do you mind if I ask a few quick questions? That way, I can really understand what's important and make sure I'm helping in the best way possible.";
    
    // Store the response and stage transition in a single message
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: { 
            text: response,
            metadata: {
                stage: "situation_discovery"
            }
        }
    });
    
    elizaLogger.info(`Stored response and stage transition to situation_discovery`);
    return response;
}

// Situation Discovery Handler
async function handleSituationQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    // Save user response from this stage
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "situation", _message.content.text);
    }
    
    // Show previous user responses collected so far
    const previousResponses = await getUserResponses(_runtime, _message);
    elizaLogger.info(`=== SITUATION DISCOVERY STAGE ===`);
    elizaLogger.info(`Previous responses collected: ${JSON.stringify(previousResponses, null, 2)}`);
    elizaLogger.info(`Current user message: ${_message.content.text}`);
    elizaLogger.info(`================================`)
    
    // const unansweredQuestions = [
    //     "I'm really glad you reached out — it's a big step, and I'm here to listen. Can I ask what made you decide to call us today?",
    //     "I really appreciate you taking the time to share your thoughts with me. To help me better understand what matters most to you at this moment… Could you tell me what's your greatest concern right now?", 
    //     "Thanks for sharing all with me. Before we explore possible next steps, I'd like to understand a bit more about how things have been for you and your loved ones. How is this situation impacting your family?"
    // ].filter(q => !discoveryState.questionsAsked.includes(q));
    
    // let question = "";
    // if (unansweredQuestions.length > 0) {
    //     // Pick a random question
    //     question = unansweredQuestions[Math.floor(Math.random() * unansweredQuestions.length)];
    // } else {
    //     // If all have been asked, just thank and move on
    //     question = "Thank you for sharing that with me.";
    // }
    const question = "Thanks for sharing all with me. Before we explore possible next steps, I'd like to understand a bit more about how things have been for you and your loved ones. Could you tell me what made you decide to call us today?";
    // Store the asked question in memory with stage transition
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: {
            text: question,
            metadata: { 
                // askedQuestion: question,
                stage: "lifestyle_discovery"  // Set the next stage in metadata
            }
        }
    });
    return question;
}

// Lifestyle Discovery Handler  
async function handleLifestyleQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    // Save user response from this stage
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "lifestyle", _message.content.text);
    }
    
    // Show previous user responses collected so far
    const previousResponses = await getUserResponses(_runtime, _message);
    elizaLogger.info(`=== LIFESTYLE DISCOVERY STAGE ===`);
    elizaLogger.info(`Previous responses collected: ${JSON.stringify(previousResponses, null, 2)}`);
    elizaLogger.info(`Current user message: ${_message.content.text}`);
    elizaLogger.info(`=================================`)
    
    // Get previous user answers from situation discovery stage
    // const userAnswersFromSituationStage = await getUserAnswersFromStage(_runtime, _message, "lifestyle_discovery");
    const userAnswersFromSituationStage = _message.content.text;
    
    // Get the number of lifestyle questions already asked
    const lifestyleQuestionsAsked = discoveryState.questionsAsked.filter((q: string) => 
        q.includes("typical day") || q.includes("love doing") || q.includes("stopped doing")
    ).length;
    
    let question = "";
    
    if (lifestyleQuestionsAsked === 0) {
        // First lifestyle question - personalized based on situation discovery
        question = await generatePersonalizedLifestyleQuestion(_runtime, _message, _state, userAnswersFromSituationStage, "daily_routine");
    } else if (lifestyleQuestionsAsked === 1) {
        // Second lifestyle question - about activities they love
        question = await generatePersonalizedLifestyleQuestion(_runtime, _message, _state, userAnswersFromSituationStage, "activities");
    } else if (lifestyleQuestionsAsked === 2) {
        // Third lifestyle question - about activities they've stopped
        question = await generatePersonalizedLifestyleQuestion(_runtime, _message, _state, userAnswersFromSituationStage, "stopped_activities");
    } else {
        // All lifestyle questions have been asked
        question = "Thank you for sharing that with me.";
    }

    // Store the asked question in memory with stage transition
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: {
            text: question,
            metadata: { 
                askedQuestion: question,
                stage: "readiness_discovery"  // Set the next stage in metadata
            }
        }
    });
    return question;
}

// Readiness Discovery Handler
async function handleReadinessQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    // Save user response from this stage
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "readiness", _message.content.text);
    }
    
    // Show previous user responses collected so far
    const previousResponses = await getUserResponses(_runtime, _message);
    elizaLogger.info(`=== READINESS DISCOVERY STAGE ===`);
    elizaLogger.info(`Previous responses collected: ${JSON.stringify(previousResponses, null, 2)}`);
    elizaLogger.info(`Current user message: ${_message.content.text}`);
    elizaLogger.info(`=================================`)
    
    // Get previous user answer
    const userResponse = _message.content.text;
    
    // Get the number of readiness questions already asked
    const readinessQuestionsAsked = discoveryState.questionsAsked.filter((q: string) => 
        q.includes("aware that you're looking") || q.includes("feel about the idea")
    ).length;
    
    let question = "";
    
    if (readinessQuestionsAsked === 0) {
        // First readiness question - about awareness
        question = await generatePersonalizedReadinessQuestion(_runtime, _message, _state, userResponse, "awareness");
    } else if (readinessQuestionsAsked === 1) {
        // Second readiness question - about feelings
        question = await generatePersonalizedReadinessQuestion(_runtime, _message, _state, userResponse, "feelings");
    } else {
        // All readiness questions have been asked
        question = "Thank you for sharing that with me.";
    }

    // Store the asked question in memory with stage transition
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: {
            text: question,
            metadata: { 
                askedQuestion: question,
                stage: "priorities_discovery"  // Set the next stage in metadata
            }
        }
    });
    return question;
}

// Priority Discovery Handler
async function handlePriorityQuestions(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    // Save user response from this stage
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "priorities", _message.content.text);
    }
    
    // Show previous user responses collected so far
    const previousResponses = await getUserResponses(_runtime, _message);
    elizaLogger.info(`=== PRIORITY DISCOVERY STAGE ===`);
    elizaLogger.info(`Previous responses collected: ${JSON.stringify(previousResponses, null, 2)}`);
    elizaLogger.info(`Current user message: ${_message.content.text}`);
    elizaLogger.info(`================================`)
    
    // Get previous user answer
    const userResponse = _message.content.text;
    
    // Get the number of priority questions already asked
    const priorityQuestionsAsked = discoveryState.questionsAsked.filter((q: string) => 
        q.includes("most important") || q.includes("biggest difference")
    ).length;
    
    let question = "";
    
    if (priorityQuestionsAsked === 0) {
        // First priority question - about community values
        question = await generatePersonalizedPriorityQuestion(_runtime, _message, _state, userResponse, "community_values");
    } else if (priorityQuestionsAsked === 1) {
        // Second priority question - about support needs
        question = await generatePersonalizedPriorityQuestion(_runtime, _message, _state, userResponse, "support_needs");
    } else {
        // All priority questions have been asked
        question = "Thank you for sharing that with me.";
    }

    // Store the asked question in memory with stage transition
    await _runtime.messageManager.createMemory({
        roomId: _message.roomId,
        userId: _message.userId,
        agentId: _message.agentId,
        content: {
            text: question,
            metadata: { 
                askedQuestion: question,
                stage: "needs_matching"  // Set the next stage in metadata
            }
        }
    });
    return question;
}

// Needs Matching Handler
async function handleNeedsMatching(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    // Save the final user response if this is a user message
    if (_message.content.text && _message.userId !== _message.agentId) {
        await saveUserResponse(_runtime, _message, "priorities", _message.content.text);
    }
    
    // Get all user responses from previous stages
    const userResponses = await getUserResponses(_runtime, _message);
    const situationResponses = userResponses.situation || [];
    const lifestyleResponses = userResponses.lifestyle || [];
    const readinessResponses = userResponses.readiness || [];
    const prioritiesResponses = userResponses.priorities || [];
    
    // Show comprehensive summary of all collected responses
    elizaLogger.info(`=== NEEDS MATCHING STAGE ===`);
    elizaLogger.info(`📋 COMPREHENSIVE USER RESPONSE SUMMARY:`);
    elizaLogger.info(`  🏠 Situation Responses (${situationResponses.length}): ${JSON.stringify(situationResponses, null, 2)}`);
    elizaLogger.info(`  🎯 Lifestyle Responses (${lifestyleResponses.length}): ${JSON.stringify(lifestyleResponses, null, 2)}`);
    elizaLogger.info(`  💭 Readiness Responses (${readinessResponses.length}): ${JSON.stringify(readinessResponses, null, 2)}`);
    elizaLogger.info(`  ⭐ Priority Responses (${prioritiesResponses.length}): ${JSON.stringify(prioritiesResponses, null, 2)}`);
    elizaLogger.info(`Current user message: ${_message.content.text}`);
    elizaLogger.info(`===============================`);
    
    // Combine all responses for analysis
    const allUserResponses = [
        ...situationResponses,
        ...lifestyleResponses,
        ...readinessResponses,
        ...prioritiesResponses
    ].join(" ");
    
    // Generate personalized needs matching response based on all user responses
    try {
        const prompt = `Based on all the user's responses about their family's situation and needs: "${allUserResponses}", 
                       generate a warm, personalized response that:
                       1. Acknowledges specific details they mentioned about their loved one
                       2. Recommends Grand Villa as a senior living community
                       3. Matches specific Grand Villa features to their mentioned needs and concerns
                       4. Shows empathy and understanding of their situation
                       5. Explains how Grand Villa can address their specific lifestyle, readiness, and priority concerns
                       6. Ends with suggesting a visit to experience the community firsthand
                       
                       Keep the tone conversational, caring, and professional. Reference specific details from their responses.`;
        
        const personalizedResponse = await generateText({
            runtime: _runtime,
            context: prompt,
            modelClass: ModelClass.SMALL
        });
        
        if (personalizedResponse) {
            elizaLogger.info(`Generated personalized needs matching response: ${personalizedResponse}`);
            return personalizedResponse;
        }
    } catch (error) {
        elizaLogger.error(`Error generating personalized needs matching response: ${error}`);
    }
    
    // Fallback to default response if generation fails
    const fallbackResponse = `Based on everything you've shared with me, I can see how much you care about finding the right place for your loved one. Grand Villa is a wonderful community that offers both comfort and peace of mind. The staff there are known for being warm and attentive, and they really focus on making residents feel at home. 

Grand Villa has beautiful outdoor spaces and a variety of activities that residents enjoy — from crafts and games to social gatherings. It's a place that balances independence with just the right amount of support.

I think Grand Villa could be a great fit for your family. Would you like to schedule a visit so you can experience the community firsthand and see what daily life would feel like?`;
    
    return fallbackResponse;
}

// Visit Transition Handler
async function handleVisitTransition(_runtime: IAgentRuntime, _message: Memory, _state: State, discoveryState: any): Promise<string> {
    return "It sounds like your family member could really thrive here, and I'd love for you to experience it firsthand. Why don't we set up a time for you to visit, tour the community, and even enjoy a meal with us? That way, you can really see what daily life would feel like.\n\nWould Wednesday afternoon or Friday morning work better for you?";
}

// State Management Functions
async function getDiscoveryState(_runtime: IAgentRuntime, _message: Memory): Promise<any> {
    return await discoveryStateProvider.get(_runtime, _message);
}

async function updateDiscoveryState(_runtime: IAgentRuntime, _message: Memory, stage: string, response: string): Promise<void> {
    const discoveryState = await getDiscoveryState(_runtime, _message);
    elizaLogger.info(`Updating discovery state from ${discoveryState.currentStage} to ${stage}`);
    
    // Only update stage if it's different from current stage
    if (stage !== discoveryState.currentStage) {
        // Store the response with stage in metadata
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: { 
                text: response,
                metadata: {
                    stage: stage
                }
            }
        });
        
        elizaLogger.info(`Added response to message history with stage: ${stage}`);
    } else {
        // If stage hasn't changed, just store the response without stage metadata
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: { 
                text: response
            }
        });
        
        elizaLogger.info(`Added response to message history without stage change`);
    }
}

async function determineConversationStage(_runtime: IAgentRuntime, _message: Memory, discoveryState: any): Promise<string> {
    elizaLogger.info(`Determining conversation stage with state: ${JSON.stringify(discoveryState)}`);
    
    // If no state exists, start with trust building
    if (!discoveryState) {
        elizaLogger.info("No discovery state found, starting with trust building");
        return "trust_building";
    }

    // If we have a current stage, stay in it until all questions are answered
    if (discoveryState.currentStage) {
        elizaLogger.info(`Using existing stage: ${discoveryState.currentStage}`);
        return discoveryState.currentStage;
    }

    // Default to trust building
    elizaLogger.info("Defaulting to trust building");
    return "trust_building";
}

async function moveToNextStage(_runtime: IAgentRuntime, _message: Memory, nextStage: string): Promise<string> {
    const discoveryState = await getDiscoveryState(_runtime, _message);
    discoveryState.currentStage = nextStage;

    elizaLogger.info(`Moving to stage: ${nextStage}`);
    
    return "";
}

// Helper function to get user answers from a specific stage
async function getUserAnswersFromStage(_runtime: IAgentRuntime, _message: Memory, stage: string): Promise<string[]> {
    const memories = await _runtime.messageManager.getMemories({
        roomId: _message.roomId,
        count: 50
    });
    
    const userAnswers: string[] = [];
    let stageStartIndex = -1;
    let stageEndIndex = -1;
    
    // Sort memories by creation time (oldest first) to process conversation chronologically
    const sortedMemories = memories.sort((a, b) => 
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
    
    elizaLogger.info(`Looking for user answers in ${stage} stage from ${sortedMemories.length} memories`);
    elizaLogger.info(`Agent ID: ${_message.agentId}`);
    
    // Log all memories for debugging
    sortedMemories.forEach((memory, index) => {
        const metadata = memory.content.metadata as { stage?: string } | undefined;
        elizaLogger.info(`Memory ${index}: userId=${memory.userId}, agentId=${_message.agentId}, isAgent=${memory.userId === _message.agentId}, text="${memory.content.text}", metadata=${JSON.stringify(metadata)}, createdAt=${memory.createdAt}`);
    });
    
    // Find the start and end of the target stage
    for (let i = 0; i < sortedMemories.length; i++) {
        const memory = sortedMemories[i];
        const metadata = memory.content.metadata as { stage?: string } | undefined;
        
        // Find when we enter the target stage
        if (metadata?.stage === stage && memory.userId === _message.agentId && stageStartIndex === -1) {
            stageStartIndex = i;
            elizaLogger.info(`Found start of ${stage} stage at index ${i}: ${memory.content.text}`);
        }
        
        // Find when we exit the target stage (next agent message with different stage)
        if (stageStartIndex !== -1 && metadata?.stage && metadata.stage !== stage && memory.userId === _message.agentId) {
            stageEndIndex = i;
            elizaLogger.info(`Found end of ${stage} stage at index ${i}: ${memory.content.text}`);
            break;
        }
    }
    
    // If we found the stage start but no end, collect until the end of memories
    if (stageStartIndex !== -1 && stageEndIndex === -1) {
        stageEndIndex = sortedMemories.length;
        elizaLogger.info(`Stage ${stage} continues to end of conversation`);
    }
    
    // Collect user messages within the stage boundaries
    if (stageStartIndex !== -1) {
        for (let i = stageStartIndex + 1; i < stageEndIndex; i++) {
            const memory = sortedMemories[i];
            if (memory.userId !== _message.agentId) {
                userAnswers.push(memory.content.text);
                elizaLogger.info(`Collected user answer in ${stage}: ${memory.content.text}`);
            }
        }
    } else {
        elizaLogger.info(`No messages found for stage: ${stage}`);
    }
    
    elizaLogger.info(`Collected ${userAnswers.length} user answers from ${stage} stage: ${JSON.stringify(userAnswers)}`);
    return userAnswers;
}

// Helper function to generate personalized lifestyle questions based on previous answers
async function generatePersonalizedLifestyleQuestion(
    _runtime: IAgentRuntime, 
    _message: Memory, 
    _state: State, 
    previousAnswers: string, 
    questionType: string
): Promise<string> {
    const combinedAnswers = previousAnswers;
    elizaLogger.info(`generatePersonalizedLifestyleQuestion ${combinedAnswers}`);
    
    let prompt = "";
    
    switch (questionType) {
        case "daily_routine":
            prompt = `Based on the user's previous responses about their family situation: "${combinedAnswers}", 
                     generate a warm, empathetic question asking about their loved one's typical daily routine. 
                     Reference specific concerns or details they mentioned. Keep it conversational and caring.`;
            break;
            
        case "activities":
            prompt = `Based on the user's previous responses: "${combinedAnswers}", 
                     generate a personalized question asking about activities or hobbies their loved one enjoys. 
                     Reference their specific situation and show understanding of their concerns.`;
            break;
            
        case "stopped_activities":
            prompt = `Based on the user's previous responses: "${combinedAnswers}", 
                     generate a thoughtful question asking about activities their loved one used to enjoy but may have stopped doing. 
                     Show empathy for their situation and acknowledge the challenges they've mentioned.`;
            break;
            
        default:
            return "Could you tell me more about your loved one's daily life?";
    }
    
    try {
        const response = await generateText({
            runtime: _runtime,
            context: prompt,
            modelClass: ModelClass.SMALL
        });
        
        return response || getDefaultQuestion(questionType);
    } catch (error) {
        elizaLogger.error(`Error generating personalized question: ${error}`);
        return getDefaultQuestion(questionType);
    }
}

// Helper function to generate personalized readiness questions based on previous answers
async function generatePersonalizedReadinessQuestion(
    _runtime: IAgentRuntime, 
    _message: Memory, 
    _state: State, 
    previousAnswers: string, 
    questionType: string
): Promise<string> {
    const combinedAnswers = previousAnswers;
    elizaLogger.info(`generatePersonalizedReadinessQuestion ${combinedAnswers}`);
    
    let prompt = "";
    
    switch (questionType) {
        case "awareness":
            prompt = `Based on the user's previous responses about their family situation: "${combinedAnswers}", 
                     generate a warm, empathetic question asking if their loved one is aware that they're looking at living options. 
                     Reference specific details they mentioned and show understanding. Keep it conversational and caring.`;
            break;
            
        case "feelings":
            prompt = `Based on the user's previous responses: "${combinedAnswers}", 
                     generate a personalized question asking about how their loved one feels about the idea of moving to a senior community. 
                     Reference their specific situation and show empathy for their concerns.`;
            break;
            
        default:
            return "How does your loved one feel about exploring senior living options?";
    }
    
    try {
        const response = await generateText({
            runtime: _runtime,
            context: prompt,
            modelClass: ModelClass.SMALL
        });
        
        return response || getDefaultReadinessQuestion(questionType);
    } catch (error) {
        elizaLogger.error(`Error generating personalized readiness question: ${error}`);
        return getDefaultReadinessQuestion(questionType);
    }
}

// Helper function to generate personalized priority questions based on previous answers
async function generatePersonalizedPriorityQuestion(
    _runtime: IAgentRuntime, 
    _message: Memory, 
    _state: State, 
    previousAnswers: string, 
    questionType: string
): Promise<string> {
    const combinedAnswers = previousAnswers;
    elizaLogger.info(`generatePersonalizedPriorityQuestion ${combinedAnswers}`);
    
    let prompt = "";
    
    switch (questionType) {
        case "community_values":
            prompt = `Based on the user's previous responses about their family situation: "${combinedAnswers}", 
                     generate a warm, empathetic question asking what's most important to them in choosing a senior living community. 
                     Reference specific concerns or details they mentioned. Keep it conversational and caring.`;
            break;
            
        case "support_needs":
            prompt = `Based on the user's previous responses: "${combinedAnswers}", 
                     generate a personalized question asking about what kind of support would make the biggest difference for their family. 
                     Reference their specific situation and show understanding of their needs.`;
            break;
            
        default:
            return "What's most important to you in choosing the right community for your loved one?";
    }
    
    try {
        const response = await generateText({
            runtime: _runtime,
            context: prompt,
            modelClass: ModelClass.SMALL
        });
        
        return response || getDefaultPriorityQuestion(questionType);
    } catch (error) {
        elizaLogger.error(`Error generating personalized priority question: ${error}`);
        return getDefaultPriorityQuestion(questionType);
    }
}

// Fallback questions if generation fails
function getDefaultQuestion(questionType: string): string {
    switch (questionType) {
        case "daily_routine":
            return "Thank you for sharing so openly — I can tell how much you care. Let's talk about your loved one. What does a typical day look like for them?";
        case "activities":
            return "Thank you, It sounds like you know your loved one so well, and that's truly wonderful. Could you tell me what are some things they love doing?";
        case "stopped_activities":
            return "Thank you for helping me understand them better — I can see how much their happiness means to you. Sometimes, as life changes, our loved ones step away from things they used to love. What's something they've always enjoyed but may have stopped doing recently?";
        default:
            return "Could you tell me more about your loved one?";
    }
}

// Fallback readiness questions if generation fails
function getDefaultReadinessQuestion(questionType: string): string {
    switch (questionType) {
        case "awareness":
            return "Ok, Looks great. I can feel that you really care your family. Can I ask you if your Mom or Dad aware that you're looking at options?";
        case "feelings":
            return "Great, I can feel that you really care your family. How do they feel about the idea of moving?";
        default:
            return "How does your loved one feel about exploring senior living options?";
    }
}

// Fallback priority questions if generation fails
function getDefaultPriorityQuestion(questionType: string): string {
    switch (questionType) {
        case "community_values":
            return "Finding the right community can make all the difference in feeling at home and supported. We want to make sure the place you choose truly fits your family's needs and values. What's most important to you in the community you choose?";
        case "support_needs":
            return "Everyone's needs are different, and the right kind of support can really ease the transition. We want to understand what would help your family feel comfortable and cared for every step of the way. What kind of support do you feel would make the biggest difference for your family?";
        default:
            return "What's most important to you in choosing the right community for your loved one?";
    }
}

async function handleGeneralInquiry(_runtime: IAgentRuntime, _message: Memory, _state: State): Promise<string> {
    return "I'd be happy to help you learn more about Grand Villa. Could you tell me what specific information you're looking for?";
}