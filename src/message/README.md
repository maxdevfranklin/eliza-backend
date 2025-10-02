# Grand Villa Discovery System

This directory contains the implementation of the Grand Villa Discovery process, which follows the same step-by-step logic as the original `grand-villa-discovery.ts` but uses OpenAI GPT-4.1 directly instead of ElizaOS structure.

## Architecture

### Core Components

1. **types.ts** - TypeScript interfaces and constants
2. **state-manager.ts** - In-memory state management for user sessions
3. **openai-client.ts** - OpenAI API client with specialized methods
4. **stage-handlers.ts** - Individual handlers for each discovery stage
5. **discovery-orchestrator.ts** - Main orchestrator that coordinates the entire process

### Discovery Stages

The system follows these stages in order:

1. **Trust Building** - Collect user's name, location, and loved one's name
2. **Situation Discovery** - Ask 4 questions about their current situation
3. **Lifestyle Discovery** - Ask 2 questions about their loved one's lifestyle
4. **Readiness Discovery** - Ask 3 questions about readiness and family involvement
5. **Priorities Discovery** - Ask 1 question about what's most important
6. **Needs Matching** - Match their needs to Grand Villa features
7. **Schedule Visit** - 5-step process to schedule a visit

### Key Features

- **Step-by-step progression** - Never skips questions, moves to next stage only when all questions are answered
- **Unexpected situation handling** - Detects when users ask questions or share concerns and responds appropriately using Grand Villa information
- **Contact info extraction** - Automatically extracts name, location, and loved one's name from user responses
- **Comprehensive logging** - Tracks progress through each stage with detailed console logs
- **Fallback responses** - Multiple levels of fallback to ensure the system never fails
- **State persistence** - Maintains user session state throughout the conversation

### Usage

The system is integrated into the main server via the `/message` endpoint. When a user sends a message:

1. The `handleOpenAIMessage` function in `index.ts` receives the request
2. It creates a `DiscoveryOrchestrator` instance
3. The orchestrator determines the current stage and routes to the appropriate handler
4. The handler processes the user's message and generates a response
5. The response is returned with metadata about the current stage

### Example Flow

```
User: "Hello"
System: "Hello! I'm Grace, and I'm here to help you explore senior living options for your family. To get started, could I get your name, location, and the name of your loved one you're looking for senior living options for?"

User: "My name is John Smith, I'm in Tampa, and I'm looking for options for my mom Mary"
System: "Thank you, John! I'd be happy to get you the information you need, but before I do, do you mind if I ask a few quick questions? That way, I can really understand what's important and make sure I'm helping in the best way possible."

User: "Sure, go ahead"
System: "What made you decide to reach out about senior living today?"

... continues through all stages until visit is scheduled
```

### Logging

The system provides comprehensive logging at each step:

- 🔒 Trust building stage
- 🔍 Situation discovery stage  
- 🎨 Lifestyle discovery stage
- 🎯 Readiness discovery stage
- ⭐ Priorities discovery stage
- 🎯 Needs matching stage
- 📅 Schedule visit stage

Each log entry includes the current stage, user message, questions answered, and progress tracking.

### Error Handling

The system has multiple levels of error handling:

1. **Stage-level fallbacks** - If a stage handler fails, it returns a basic response
2. **Orchestrator fallback** - If the entire process fails, it returns a generic greeting
3. **Ultimate fallback** - A hardcoded response that can never fail

This ensures the system is robust and always provides a response to the user.
