// Types and interfaces for the Grand Villa Discovery process

export interface QAEntry {
    question: string;
    answer: string;
    stage: string;
    timestamp: string;
}

export interface ContactInfo {
    name?: string;
    location?: string;
    loved_one_name?: string;
    collected_at: string;
}

export interface ComprehensiveRecord {
    contact_info: ContactInfo;
    situation_discovery: QAEntry[];
    lifestyle_discovery: QAEntry[];
    readiness_discovery: QAEntry[];
    priorities_discovery: QAEntry[];
    visit_scheduling: QAEntry[];
    last_updated: string;
}

export interface DiscoveryState {
    currentStage: string;
    questionsAsked: string[];
    identifiedNeeds: string[];
    concernsShared: string[];
    readyForVisit: boolean;
    visitScheduled: boolean;
}

export interface VisitStepStatus {
    currentStep: number;
    isInitial: boolean;
}

export interface UserSession {
    userId: string;
    userName?: string;
    comprehensiveRecord?: ComprehensiveRecord;
    discoveryState?: DiscoveryState;
    lastMessage?: string;
    createdAt: string;
    lastUpdated: string;
}

export interface OpenAIResponse {
    text: string;
    metadata: {
        stage: string;
        responseStatus: string;
        actionName: string;
        reliability: string;
    };
}

export interface ClassificationResult {
    status: "Normal situation" | "Unexpected situation";
}

export interface AgreementAnalysis {
    agreed: boolean;
    response: string;
}

export interface TimeAnalysis {
    confirmed: boolean;
    rejected: boolean;
    alternative_time: string | null;
    reasoning: string;
}

export interface EmailAnalysis {
    email: string | null;
    reasoning: string;
}

// Stage constants
export const DISCOVERY_STAGES = {
    TRUST_BUILDING: "trust_building",
    SITUATION_DISCOVERY: "situation_discovery", 
    LIFESTYLE_DISCOVERY: "lifestyle_discovery",
    READINESS_DISCOVERY: "readiness_discovery",
    PRIORITIES_DISCOVERY: "priorities_discovery",
    NEEDS_MATCHING: "needs_matching",
    SCHEDULE_VISIT: "schedule_visit"
} as const;

// Question sets for each stage
export const SITUATION_QUESTIONS = [
    "Move to next step",
    "What made you decide to reach out about senior living today?",
    "What's your biggest concern about your loved one right now?", 
    "How is this situation impacting your family?",
    "Where does your loved one currently live?"
];

export const LIFESTYLE_QUESTIONS = [
    "Tell me about your loved one. What does a typical day look like for them?",
    "What does he/she enjoy doing?"
];

export const READINESS_QUESTIONS = [
    "Is your loved one aware that you're looking at options?",
    "How does your loved one feel about the idea of moving?",
    "Who else is involved in helping make this decision?"
];

export const PRIORITIES_QUESTIONS = [
    "What's most important to you regarding the community you may choose?"
];

// Grace's personality and Grand Villa information
export const GRACE_PERSONALITY = `=== CORE IDENTITY ===
You are Senior Sherpa, an AI guide specializing in helping families find the perfect senior living solution with empathy, patience, and expertise.

=== BIO & BACKGROUND ===
Your compassionate guide through the senior living journey, combining 15+ years of expertise with a warm heart and listening ear to help families find their perfect path forward.

=== COMMUNICATION STYLES ===
General Style: Warm and nurturing like a favorite aunt, blending professional expertise with genuine care and a calming presence
Chat Style: I aim to be your trusted guide through this journey, with warmth, patience and decades of senior care expertise at your service
Post Style: Navigating senior living options? Let me be your compass through this journey. Together, we'll explore what matters most for your loved one's next chapter.

=== PERSONALITY TRAITS ===
Perceptively nurturing, Steadfastly supportive, Wisely compassionate, Intuitively grounding, Authentically anchoring, Gracefully enlightening, Mindfully reassuring, Patiently illuminating, Thoughtfully stabilizing

=== TOPICS OF EXPERTISE ===
Senior Living Options, Assisted Living, Independent Living, Memory Care, Family Decision Making, Senior Housing, Aging in Place, Care Level Assessment, Senior Lifestyle, Family Transitions`;

export const GRAND_VILLA_INFO = `1. Care options & Services
- Offers three main care levels: Independent Living, Assisted Living, and Memory Care
- Care is tailored to resident needs, so you pay only for the services used
- Assisted Living services include daily meals, housekeeping/laundry, apartment maintenance, scheduled transportation, recreational activities, medication and bathing assistance, and 24-hour staffing

2. Safety & Technology
- Equipped with state-of-the-art Resident Care Technology to ensure timely, dignified care delivery
- Medication Management features include ordering and delivery via a preferred provider for accuracy and convenience

3. Community & Lifestyle
- Set on three acres of resort-style, beautifully landscaped grounds with walking paths, courtyard, gazebo, BBQ areas
Amenities & Activities:
- Restaurant-style dining room serving three chef-prepared meals daily
- Activities include yoga, Zumba, gardening club, walking club, Wii bowling, painting, Bingo tournaments, parties, classes, lectures, and excursions
- Apartment options: studio, one-bedroom, two-bedroom, with both private and companion living available

4. Dining, Housekeeping & Convenience
-All-inclusive monthly rates cover fine dining, housekeeping, laundry, and more
- Community encourages a "looks like home, feels like family" atmosphere

5. Pricing Estimates
- Grand Villa of Clearwater
Semi-private: from $3,934/mo
1-Bedroom: from $4,720/mo
Studio: from $5,114/mo
- Grand Villa of Englewood
Starting prices:
Independent Living: from $2,295/mo
Assisted Living: from $2,795/mo
Memory Care: from $3,495/mo
- Grand Villa of Ormond Beach
Semi-private: from $2,495/mo
Studio: $3,095+/mo
1-Bedroom: $3,995+/mo
- Grand Villa of Lakeland
Private Room: from $3,800/mo
Studio: from $4,500/mo
One Bedroom: from $5,300/mo
- Grand Villa of DeLand
Assisted Living rates: $2,895 to $4,095/mo
Average: $3,145/mo, below the area average of $4,760/mo`;
