// Simple test script for the Grand Villa Discovery system
// This demonstrates how the system works step by step

const { DiscoveryOrchestrator } = require('./discovery-orchestrator.js');

async function testDiscoverySystem() {
    console.log('🧪 Testing Grand Villa Discovery System\n');
    
    // Initialize the orchestrator (you'll need to set OPENAI_API_KEY environment variable)
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
        console.error('❌ Please set OPENAI_API_KEY environment variable');
        return;
    }
    
    console.log('🤖 Using GPT-4.1 for all AI responses');
    
    const orchestrator = new DiscoveryOrchestrator(openaiApiKey);
    const userId = 'test_user_123';
    
    // Test conversation flow
    const testMessages = [
        "Hello",
        "My name is John Smith, I'm in Tampa, and I'm looking for options for my mom Mary",
        "Sure, go ahead",
        "My mom is having trouble with daily activities and I'm worried about her safety",
        "It's been really stressful for our whole family, especially my sister who lives nearby",
        "She lives alone in her house in Tampa",
        "She used to love gardening and reading, but now she mostly watches TV",
        "She enjoys crossword puzzles and talking to her neighbors",
        "She knows we're looking but she's resistant to the idea",
        "She's scared about losing her independence",
        "My sister and I are both involved, and we consult with her doctor",
        "Safety and good care are most important to us"
    ];
    
    console.log('📝 Starting conversation flow...\n');
    
    for (let i = 0; i < testMessages.length; i++) {
        const message = testMessages[i];
        console.log(`👤 User: "${message}"`);
        
        try {
            const response = await orchestrator.processMessage(userId, message, 'John');
            console.log(`🤖 Grace: "${response.text}"`);
            console.log(`📊 Stage: ${response.metadata.stage}`);
            console.log(`🏷️ Status: ${response.metadata.responseStatus}\n`);
            
            // Add a small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error(`❌ Error processing message: ${error.message}`);
            break;
        }
    }
    
    // Show final session info
    console.log('📊 Final Session Info:');
    const sessionInfo = orchestrator.getUserSessionInfo(userId);
    console.log(JSON.stringify(sessionInfo, null, 2));
    
    console.log('\n✅ Test completed!');
}

// Run the test if this file is executed directly
if (require.main === module) {
    testDiscoverySystem().catch(console.error);
}

module.exports = { testDiscoverySystem };
