// OpenAI client for the Grand Villa Discovery process
import { ClassificationResult, AgreementAnalysis, TimeAnalysis, EmailAnalysis } from './types.js';

export class OpenAIClient {
    private apiKey: string;
    private baseUrl: string = 'https://api.openai.com/v1/chat/completions';
    
    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }
    
    // Generate text response using OpenAI
    public async generateText(
        messages: Array<{ role: string; content: string }>,
        model: string = 'gpt-4.1',
        maxTokens: number = 500,
        temperature: number = 0.7
    ): Promise<string> {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages,
                    max_tokens: maxTokens,
                    temperature
                })
            });
            
            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            return data.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
        } catch (error) {
            console.error('OpenAI API error:', error);
            throw error;
        }
    }
    
    // Classify situation as Normal or Unexpected
    public async classifySituation(userMessage: string): Promise<ClassificationResult> {
        const context = `Analyze the user's message and classify the situation.

User message: "${userMessage}"

=== CLASSIFICATION RULES ===
Classify as "Unexpected situation" if the message contains:
• Any question or curiosity about something
• Worries that can be related to Grand Villa community
• Phrases like "I'd like to know…", "tell me…", "can you explain…", "curious about…"
• Requests for extra details about pricing, services, amenities, locations, or policies
• Expressions of frustration, confusion, or complaints ("too many questions", "when can I get information?")
• Sharing about loved one's likes, interests, hobbies, activities they enjoy, things they love doing, or activities they used to do

Otherwise, classify as "Normal situation".

Return ONLY a JSON object:
{"status": "Normal situation" or "Unexpected situation"}`;

        console.log("@chris_classifysituation", context);

        try {
            const response = await this.generateText([
                { role: 'system', content: 'You are a classification assistant. Return only valid JSON.' },
                { role: 'user', content: context }
            ], 'gpt-4.1', 100, 0.1);
            
            // Clean the response to handle markdown code blocks
            let cleanedResponse = response.trim();
            if (cleanedResponse.startsWith('```json')) {
                cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanedResponse.startsWith('```')) {
                cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            
            return JSON.parse(cleanedResponse) as ClassificationResult;
        } catch (error) {
            console.error('Error classifying situation:', error);
            return { status: "Normal situation" };
        }
    }
    
    // Extract contact information from user responses
    public async extractContactInfo(userResponses: string, existingContactInfo?: any): Promise<{
        name: string | null;
        location: string | null;
        loved_one_name: string | null;
        foundName: boolean;
        foundLocation: boolean;
        foundLovedOneName: boolean;
    }> {
        const context = `Please extract the user's information from these responses: "${userResponses}"
            
Look for:
- User's full name (first and last name)
- Location (city, state, or zip code)
- Name of their loved one/family member (the person they're seeking senior living for - could be "my mom", "my father", "John", "Mary", etc.)

${existingContactInfo ? `Note: We may already have some info - Name: ${existingContactInfo.name || 'none'}, Location: ${existingContactInfo.location || 'none'}, Loved One: ${existingContactInfo.loved_one_name || 'none'}` : ''}

Return your response in this exact JSON format:
{
    "name": "extracted user's full name or null if not found",
    "location": "extracted location such as city, state, or zip code or null if not found",
    "loved_one_name": "extracted loved one's name or null if not found",
    "foundName": true/false,
    "foundLocation": true/false,
    "foundLovedOneName": true/false
}

Make sure to return ONLY valid JSON, no additional text.`;

        try {
            const response = await this.generateText([
                { role: 'system', content: 'You are an information extraction assistant. Return only valid JSON.' },
                { role: 'user', content: context }
            ], 'gpt-4.1', 200, 0.1);
            
            // Clean the response
            let cleanedResponse = response.trim();
            if (cleanedResponse.startsWith('```json')) {
                cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanedResponse.startsWith('```')) {
                cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            
            return JSON.parse(cleanedResponse);
        } catch (error) {
            console.error('Error extracting contact info:', error);
            return {
                name: null,
                location: null,
                loved_one_name: null,
                foundName: false,
                foundLocation: false,
                foundLovedOneName: false
            };
        }
    }
    
    // Analyze visit agreement
    public async analyzeVisitAgreement(userMessage: string): Promise<AgreementAnalysis> {
        const context = `Analyze the following user response: "${userMessage}"

Task: Determine if the user has AGREED to schedule/attend a visit to the villa/community.

Rules:
- Agreement = clear confirmation (e.g., "yes", "sure", "okay", "interested", "sounds good", "let's do it", "I'd like to visit", or user asking practical questions about the visit like time, place, etc.).
- Partial agreement = positive but uncertain (e.g., "maybe", "I'll think about it", "need more info"). Treat this as not agreed.
- Decline = clear rejection (e.g., "no", "not interested", "can't", "don't want to").
- If unclear, default to {"agreed": true}.

Output:
- If {"agreed": true}, acknowledge their agreement briefly and then ask: "How about Wednesday at 5pm? Does that work for you?" Keep it under 30 words.
- If {"agreed": false}, return a natural response to the user's message without suggesting a time.

Return ONLY a JSON object in this format:
{"agreed": true/false, "response": "your natural response here"}`;

        try {
            const response = await this.generateText([
                { role: 'system', content: 'You are an agreement analysis assistant. Return only valid JSON.' },
                { role: 'user', content: context }
            ], 'gpt-4.1', 150, 0.3);
            
            // Clean the response
            let cleanedResponse = response.trim();
            if (cleanedResponse.startsWith('```json')) {
                cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanedResponse.startsWith('```')) {
                cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            
            const result = JSON.parse(cleanedResponse) as AgreementAnalysis;
            console.log(`🔍 Visit agreement analysis: agreed=${result.agreed}, response="${result.response}"`);
            return result;
        } catch (error) {
            console.error('Error analyzing visit agreement:', error);
            return { agreed: false, response: "I understand. Would you like to schedule a visit to see Grand Villa in person?" };
        }
    }
    
    // Analyze time confirmation
    public async analyzeTimeConfirmation(userMessage: string): Promise<TimeAnalysis> {
        const context = `Analyze this response about scheduling Wednesday 5pm: "${userMessage}"
Task: Determine scheduling intent.
Rules:
- Confirmed = clear acceptance (e.g., "yes, that works", "sounds good", "okay, Wednesday 5pm is fine").
- Alternative = any mention of a different date or time.
- Rejected = "no", "can't", "doesn't work", without giving alternative.
- If unclear, default to {"confirmed": false, "rejected": false, "alternative_time": null}.
Output JSON only:
{"confirmed": true/false, "rejected": true/false, "alternative_time": "string or null", "reasoning": "brief reasoning"}`;

        try {
            const response = await this.generateText([
                { role: 'system', content: 'You are a time analysis assistant. Return only valid JSON.' },
                { role: 'user', content: context }
            ], 'gpt-4.1', 150, 0.1);
            
            // Clean the response
            let cleanedResponse = response.trim();
            if (cleanedResponse.startsWith('```json')) {
                cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanedResponse.startsWith('```')) {
                cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            
            return JSON.parse(cleanedResponse) as TimeAnalysis;
        } catch (error) {
            console.error('Error analyzing time confirmation:', error);
            return { confirmed: false, rejected: false, alternative_time: null, reasoning: "Error in analysis" };
        }
    }
    
    // Extract email from user response
    public async extractEmail(userMessage: string): Promise<EmailAnalysis> {
        const context = `Analyze the following user response: "${userMessage}"
Task: Extract a valid email address if provided, even if it's written informally (e.g., "john dot doe at gmail dot com").
Output JSON only:
{"email": "normalized email string or null", "reasoning": "short explanation"}`;

        try {
            const response = await this.generateText([
                { role: 'system', content: 'You are an email extraction assistant. Return only valid JSON.' },
                { role: 'user', content: context }
            ], 'gpt-4.1', 100, 0.1);
            
            // Clean the response
            let cleanedResponse = response.trim();
            if (cleanedResponse.startsWith('```json')) {
                cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanedResponse.startsWith('```')) {
                cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            
            return JSON.parse(cleanedResponse) as EmailAnalysis;
        } catch (error) {
            console.error('Error extracting email:', error);
            return { email: null, reasoning: "Error in extraction" };
        }
    }
    
    // Generate contextual response based on stage and classification
    public async generateContextualResponse(
        stage: string,
        userMessage: string,
        classification: string,
        nextQuestion: string,
        userName: string,
        lovedOneName: string,
        location: string,
        grandVillaInfo: string,
        previousAnswers: string,
        currentAnsweredCount: number,
        totalQuestions: number
    ): Promise<string> {
        const isFirstQuestion = currentAnsweredCount === 0;
        
        const responseContext = `The user ${userName ? `(${userName}) ` : ''}is in the ${stage} stage of our senior living discovery process.

Progress: ${currentAnsweredCount}/${totalQuestions} questions answered so far.
${previousAnswers ? `Previous answers: ${previousAnswers}` : ''}
User's last message: "${userMessage}"
Situation classification: "${classification}"
Next question to ask: "${nextQuestion}"
Is this the first question of the stage: ${isFirstQuestion}

=== RESPONSE INSTRUCTIONS ===
${classification === "Normal situation" ? `
1. For "Normal situation":
- Stay warm and personal.
- Address the user by ${userName} naturally.
- Refer to their loved one by ${lovedOneName} (avoid just "he/she").
- Smoothly introduce "${nextQuestion}" so it feels like part of a conversation.
- Keep words under 30-40.
` : `
2. For "Unexpected situation":
- Look at the last message: "${userMessage}".
- If the message contains a question or curiosity, answer clearly using grandvilla_information: "${grandVillaInfo}".  
  If info is missing, search online and give the most accurate answer.
- If the message indicates that the user's loved one might be a good fit for Grand Villa (based on their preferences, needs, lifestyle, or interests), naturally highlight how Grand Villa matches those needs.  
  For example, link their hobbies, activities, or care requirements to relevant services, programs, or amenities in grandvilla_information.
- Never share exact pricing or pricing-related details unless the user directly asks about pricing.
- If it's a pricing question:
    • Share the pricing for the closest Grand Villa to "${location}" using exact details from grandvilla_information.  
    • Mention that pricing depends on the level of care and services chosen.  
    • Suggest visiting the community in person for the most accurate understanding of costs.
- If the user complains about too many questions or timing, empathize, explain why these questions are asked, and lighten the mood with a friendly or humorous remark.
- ${isFirstQuestion ? `Since this is the first question of the ${stage} stage, after answering their question, naturally introduce "${nextQuestion}" to begin the discovery process.` : `Smoothly connect back to "${nextQuestion}" in a natural, conversational way.`}
- Keep the response concise, around 30–70 words.
`}

Return ONLY the response text, no JSON formatting.`;

console.log("@chris_classifysituation", responseContext);

        try {
            return await this.generateText([
                { role: 'system', content: 'You are Grace, a warm and empathetic senior living guide. Respond naturally and conversationally.' },
                { role: 'user', content: responseContext }
            ], 'gpt-4.1', 200, 0.7);
        } catch (error) {
            console.error('Error generating contextual response:', error);
            return `${userName ? `${userName}, ` : ''}${nextQuestion}`;
        }
    }
    
    // Generate needs matching response
    public async generateNeedsMatchingResponse(
        allPreviousAnswers: string,
        userName: string,
        lovedOneName: string,
        location: string,
        grandVillaInfo: string
    ): Promise<string> {
        const context = `The user ${userName ? `(${userName}) ` : ''} has shared information about their situation and ${lovedOneName}'s needs throughout our discovery process.

All previous answers: "${allPreviousAnswers}"
User location: "${location}"

Your task:
1. Review all previous answers to identify one or more key concerns, preferences, or needs that matter most for ${lovedOneName}.
2. From ${grandVillaInfo}, select:
- The *nearest Grand Villa location* to the user's "${location}". You MUST always mention this nearest location by name in the response. Do not omit it.
- The *most relevant, specific feature, service, or activity* that directly addresses the concern (e.g., chef-prepared meals, wellness programs, resident clubs, memory care, safety systems, transportation, etc.).
3. Write a single empathetic response that must:
- Start naturally with "Since you mentioned... and recap the concern.
- Immediately highlight the *specific Grand Villa feature or service* that best matches.
- Explicitly tie the answer to the nearest Grand Villa location (e.g., "At Grand Villa of Clearwater, residents especially enjoy...").
- Keep the tone warm, authentic, and aligned with its natural personality.
- Stay concise and conversational (under 60–90 words).

Return ONLY the response text, no extra commentary or formatting.`;

        try {
            return await this.generateText([
                { role: 'system', content: 'You are Grace, a warm and empathetic senior living guide. Respond naturally and conversationally.' },
                { role: 'user', content: context }
            ], 'gpt-4.1', 200, 0.7);
        } catch (error) {
            console.error('Error generating needs matching response:', error);
            return `${userName ? `${userName}, ` : ''}Based on everything you've shared about ${lovedOneName}, I can see how Grand Villa would be such a perfect fit. The community, care, and activities we offer align beautifully with what you've described.`;
        }
    }

    // Generate encouraging visit response based on user's previous answers and concerns
    public async generateEncouragingVisitResponse(
        userMessage: string,
        userName: string,
        lovedOneName: string,
        grandVillaInfo: string,
        allPreviousAnswers: string
    ): Promise<string> {
        const responseContext = `
            The user (${userName}) just responded: "${userMessage}" but hasn't agreed to visit yet.  
            Full conversation history with the user is: ${allPreviousAnswers}  

            Task:  
            - Carefully analyze the user's past answers to find their key concerns, curiosities, or things they seemed to like.  
            - Use that context to craft a reply that feels personal, empathetic, and relevant.  

            Your response must:  
            1. Acknowledge their latest message in a natural, human way.  
            2. Directly connect to one of their past concerns, curiosities, or likes.  
            3. Explain briefly why actually visiting Grand Villa (using this info: "${grandVillaInfo}") would help them explore or resolve that point.  
            4. Encourage them to come see it in person for ${lovedOneName}, framed as the best way to know if it's the right fit.  
            5. Keep it under 50 words, friendly and conversational.  
            6. Avoid generic greetings (like "Hi" or "Hello") since this is near the end of the conversation.  

            Return only the final conversational response (no explanations).`;
        
        try {
            const response = await this.generateText([
                { role: 'system', content: 'You are Grace, a warm and empathetic senior living guide. Respond naturally and conversationally.' },
                { role: 'user', content: responseContext }
            ], 'gpt-4.1', 150, 0.7);
            
            console.log(`Generated encouraging visit response: ${response}`);
            return response;
        } catch (error) {
            console.error('Error generating encouraging visit response:', error);
            return `${userName ? `${userName}, ` : ''}I understand. Seeing Grand Villa in person really helps families feel confident about their decision. Would you like to schedule a brief visit to see if it feels right for ${lovedOneName}?`;
        }
    }
    
    // Generate visit scheduling response
    public async generateVisitSchedulingResponse(
        userMessage: string,
        userName: string,
        lovedOneName: string,
        grandVillaInfo: string,
        allPreviousAnswers: string,
        step: number
    ): Promise<string> {
        let context = '';
        
        switch (step) {
            case 1:
                context = `The user (${userName}) just responded: "${userMessage}" but hasn't agreed to visit yet.  
Full conversation history with the user is: ${allPreviousAnswers}  

Task:  
- Carefully analyze the user's past answers to find their key concerns, curiosities, or things they seemed to like.  
- Use that context to craft a reply that feels personal, empathetic, and relevant.  

Your response must:  
1. Acknowledge their latest message in a natural, human way.  
2. Directly connect to one of their past concerns, curiosities, or likes.  
3. Explain briefly why actually visiting Grand Villa (using this info: "${grandVillaInfo}") would help them explore or resolve that point.  
4. Encourage them to come see it in person for ${lovedOneName}, framed as the best way to know if it's the right fit.  
5. Keep it under 50 words, friendly and conversational.  
6. Avoid generic greetings (like "Hi" or "Hello") since this is near the end of the conversation.  

Return only the final conversational response (no explanations).`;
                break;
            case 2:
                context = `The user said: "${userMessage}" and rejected Wednesday 5pm without suggesting another time.
Task:
- Respond naturally, empathetic tone.
- Mention something helpful about Grand Villa: "${grandVillaInfo}".
- Encourage them to pick another time for ${lovedOneName}.
- Keep it under 50 words, conversational.
Return only the response.`;
                break;
            case 3:
                context = `The user responded: "${userMessage}" but didn't provide a valid email.
Create a warm, polite response asking for their email to send the visit confirmation.
Keep it natural, friendly, and under 40 words.`;
                break;
            case 4:
                context = `The user just told how they heard about Grand Villa: ${userMessage}
User's name is ${userName} and their loved one is ${lovedOneName}.

Task: Write a warm, natural final message that:
1. Acknowledges their referral source naturally
2. Mentions that when they visit, the community team will show them around and answer questions about care levels and pricing
3. Expresses gratitude for trusting you to help guide them through this important decision for ${lovedOneName}
4. Confirms you look forward to seeing them Wednesday
5. Keep it conversational and under 60 words
6. Make it feel like a natural conclusion to the conversation

Return only the message text.`;
                break;
            case 5:
                context = `The user responded: "${userMessage}"
This is after we've completed the visit scheduling process.
Their name is ${userName || "the guest"} and their loved one is ${lovedOneName}.
Reference information about Grand Villa: ${grandVillaInfo}

Task: Provide a warm, supportive closing-style response to their message.
- Do not start with greetings, it's the last step of conversation (no "Hi" or "Hello").
- Be natural, concise, and under 50 words.
- If they have questions about the visit or Grand Villa, answer them helpfully.
- Keep the tone friendly, grateful, and final since this is the last step of the conversation.

Return only the response text.`;
                break;
        }
        
        try {
            return await this.generateText([
                { role: 'system', content: 'You are Grace, a warm and empathetic senior living guide. Respond naturally and conversationally.' },
                { role: 'user', content: context }
            ], 'gpt-4.1', 150, 0.7);
        } catch (error) {
            console.error('Error generating visit scheduling response:', error);
            return `${userName ? `${userName}, ` : ''}I'd love to help you schedule a visit to Grand Villa. Would you be interested in seeing our community in person?`;
        }
    }
}
