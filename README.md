# Eliza
### Grand Villa Discovery: Steps, Status, Persistence, Results

This agent action orchestrates a guided discovery conversation and saves progress in the message memory store (the backing database for `messageManager`).

- **Action name**: `grand-villa-discovery`
- **Location**: `src/actions/grand-villa-discovery.ts`
- **State provider**: `src/providers/discovery-state.ts`

#### Conversation stages (step flow)
The flow advances through these stages:
- `trust_building`
- `situation_discovery`
- `lifestyle_discovery`
- `readiness_discovery`
- `priorities_discovery`
- `needs_matching`
- `info_sharing`
- `schedule_visit`
- `visit_transition`

The current stage is inferred from prior messages and explicit stage metadata.

```1:22:backend/src/providers/discovery-state.ts
import { Provider, IAgentRuntime, Memory, State, elizaLogger } from "@elizaos/core";

const VALID_STAGES = [
    "trust_building",
    "situation_discovery",
    "lifestyle_discovery",
    "readiness_discovery",
    "priorities_discovery",
    "needs_matching",
    "info_sharing",
    "schedule_visit",
    "visit_transition"
] as const;
```

#### How stage and status are persisted
- The provider reads the last ~50 messages for the room and extracts metadata to rebuild the discovery state, including stage, questions asked, needs/concerns, and a rolling `userStatus`.
- Stage transitions are written by adding a new memory that includes `metadata.stage` so future turns can resume correctly.
- Free-form status updates are written by adding a memory with `metadata.status`.

```23:71:backend/src/providers/discovery-state.ts
export const discoveryStateProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        const allMemories = await runtime.messageManager.getMemories({
            roomId: message.roomId,
            count: 50,
            unique: false
        });
        // ...
        const discoveryState = {
            currentStage: "trust_building",
            questionsAsked: [],
            identifiedNeeds: [],
            concernsShared: [],
            readyForVisit: false,
            visitScheduled: false,
            userStatus: ""
        };
        // ...
        const metadata = mem.content.metadata as MessageMetadata | undefined;
        if (metadata?.stage && VALID_STAGES.includes(metadata.stage)) {
            discoveryState.currentStage = metadata.stage;
            continue;
        }
        if (metadata?.status) {
            discoveryState.userStatus = metadata.status;
        }
```

Stage updates are stored when the action detects a transition:

```1853:1886:backend/src/actions/grand-villa-discovery.ts
async function updateDiscoveryState(_runtime: IAgentRuntime, _message: Memory, stage: string, response: string): Promise<void> {
    const discoveryState = await getDiscoveryState(_runtime, _message);
    if (stage !== discoveryState.currentStage) {
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: { 
                text: response,
                metadata: { stage }
            }
        });
    } else {
        await _runtime.messageManager.createMemory({
            roomId: _message.roomId,
            userId: _message.userId,
            agentId: _message.agentId,
            content: { text: response }
        });
    }
}
```

Status updates are stored with `metadata.status`:

```171:187:backend/src/providers/discovery-state.ts
export async function updateUserStatus(runtime: IAgentRuntime, message: Memory, statusUpdate: string) {
    await runtime.messageManager.createMemory({
        roomId: message.roomId,
        userId: message.userId,
        agentId: message.agentId,
        content: {
            text: `[Status Update] ${statusUpdate}`,
            metadata: { status: statusUpdate, timestamp: new Date().toISOString() }
        }
    });
}
```

#### Persisting Q&A and comprehensive record
User answers and synthesized records are saved as structured entries in message memory with a `discoveryStage` tag.

- Save a response to a category/stage:

```116:133:backend/src/providers/discovery-state.ts
export async function saveUserResponse(runtime: IAgentRuntime, message: Memory, stage: string, userResponse: string) {
    await runtime.messageManager.createMemory({
        roomId: message.roomId,
        userId: message.userId,
        agentId: message.agentId,
        content: {
            text: `[Discovery Response] ${userResponse}`,
            metadata: { discoveryStage: stage, userResponse, timestamp: new Date().toISOString() }
        }
    });
}
```

- Retrieve responses grouped by category:

```135:169:backend/src/providers/discovery-state.ts
export async function getUserResponses(runtime: IAgentRuntime, message: Memory) {
    const allMemories = await runtime.messageManager.getMemories({ roomId: message.roomId, count: 100, unique: false });
    const memories = allMemories.filter(mem => mem.userId === message.userId || mem.userId === message.agentId);
    const userResponses = { contact_info: [], situation: [], lifestyle: [], readiness: [], priorities: [], qa_entry: [], comprehensive_record: [] };
    for (const mem of memories) {
        const metadata = mem.content.metadata as any;
        if (metadata?.discoveryStage && metadata?.userResponse) {
            const stage = metadata.discoveryStage;
            if (userResponses[stage]) userResponses[stage].push(metadata.userResponse);
        }
    }
    return userResponses;
}
```

- Merge and update the comprehensive record using prior entries, then save the merged result back under `comprehensive_record`:

```399:447:backend/src/actions/grand-villa-discovery.ts
async function updateComprehensiveRecord(_runtime: IAgentRuntime, _message: Memory, updates: Partial<ComprehensiveRecord>): Promise<void> {
    let record = await getComprehensiveRecord(_runtime, _message);
    if (!record) {
        record = { contact_info: { collected_at: new Date().toISOString() }, situation_discovery: [], lifestyle_discovery: [], readiness_discovery: [], priorities_discovery: [], last_updated: new Date().toISOString() };
    }
    if (updates.contact_info) record.contact_info = { ...record.contact_info, ...updates.contact_info };
    if (updates.situation_discovery) record.situation_discovery = [...record.situation_discovery, ...updates.situation_discovery];
    if (updates.lifestyle_discovery) record.lifestyle_discovery = [...record.lifestyle_discovery, ...updates.lifestyle_discovery];
    if (updates.readiness_discovery) record.readiness_discovery = [...record.readiness_discovery, ...updates.readiness_discovery];
    if (updates.priorities_discovery) record.priorities_discovery = [...record.priorities_discovery, ...updates.priorities_discovery];
    record.last_updated = new Date().toISOString();
    await saveUserResponse(_runtime, _message, "comprehensive_record", JSON.stringify(record));
}
```

- Visit scheduling collects contact preferences and persists them under `visit_info`, and writes a status update:

```1719:1737:backend/src/actions/grand-villa-discovery.ts
if (finalEmail && finalAddress && finalPreference) {
    const visitInfo = { email: finalEmail, mailingAddress: finalAddress, preferredContact: finalPreference, collectedAt: new Date().toISOString() };
    await saveUserResponse(_runtime, _message, "visit_info", JSON.stringify(visitInfo));
    const statusUpdate = `Visit info collected - Email: ${finalEmail}, Address: ${finalAddress}, Preferred Contact: ${finalPreference}`;
    await updateUserStatus(_runtime, _message, statusUpdate);
}
```

#### Producing the assistant’s response (the result)
- The action delegates each step to a handler that crafts the next user-facing message and decides whether to advance the stage. The final text is added to memory and returned to the user.
- In the `info_sharing` stage, the model returns a strict JSON payload with two fields: an `updatedUserStatus` string and a `responseMessage`. The status is logged/used, and the response is sent to the user; a Q&A entry is stored for traceability.

```1565:1587:backend/src/actions/grand-villa-discovery.ts
const parsed = JSON.parse(aiResponse);
const rawStatus = parsed.updatedUserStatus || "";
updatedUserStatus = typeof rawStatus === 'object' ? JSON.stringify(rawStatus) : rawStatus;
response = parsed.responseMessage || "";
// Q&A entry saved for info requests
await saveQAEntry(_runtime, _message, "What would you like to know about Grand Villa?", _message.content.text, "info_sharing");
```

#### Notes
- All persistence occurs through `runtime.messageManager.createMemory(...)`. Your configured database backend for messages will store these entries.
- Because stage and status are inferred from message history, the conversation can resume across sessions and surfaces as long as it uses the same `roomId`/`userId`.