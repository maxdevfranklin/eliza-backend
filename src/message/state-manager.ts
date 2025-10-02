// State management for the Grand Villa Discovery process
import { UserSession, ComprehensiveRecord, DiscoveryState, QAEntry, ContactInfo } from './types.js';

// In-memory storage for user sessions (in production, this would be a database)
const userSessions = new Map<string, UserSession>();

export class DiscoveryStateManager {
    private static instance: DiscoveryStateManager;
    
    private constructor() {}
    
    public static getInstance(): DiscoveryStateManager {
        if (!DiscoveryStateManager.instance) {
            DiscoveryStateManager.instance = new DiscoveryStateManager();
        }
        return DiscoveryStateManager.instance;
    }
    
    // Get or create user session
    public getUserSession(userId: string, userName?: string): UserSession {
        if (!userSessions.has(userId)) {
            const now = new Date().toISOString();
            userSessions.set(userId, {
                userId,
                userName,
                comprehensiveRecord: {
                    contact_info: { collected_at: now },
                    situation_discovery: [],
                    lifestyle_discovery: [],
                    readiness_discovery: [],
                    priorities_discovery: [],
                    visit_scheduling: [],
                    last_updated: now
                },
                discoveryState: {
                    currentStage: "trust_building",
                    questionsAsked: [],
                    identifiedNeeds: [],
                    concernsShared: [],
                    readyForVisit: false,
                    visitScheduled: false
                },
                createdAt: now,
                lastUpdated: now
            });
        }
        
        const session = userSessions.get(userId)!;
        if (userName && !session.userName) {
            session.userName = userName;
            session.lastUpdated = new Date().toISOString();
        }
        
        return session;
    }
    
    // Update user session
    public updateUserSession(userId: string, updates: Partial<UserSession>): void {
        const session = this.getUserSession(userId);
        Object.assign(session, updates, { lastUpdated: new Date().toISOString() });
        userSessions.set(userId, session);
    }
    
    // Get comprehensive record
    public getComprehensiveRecord(userId: string): ComprehensiveRecord | null {
        const session = this.getUserSession(userId);
        return session.comprehensiveRecord || null;
    }
    
    // Update comprehensive record
    public updateComprehensiveRecord(userId: string, updates: Partial<ComprehensiveRecord>): void {
        const session = this.getUserSession(userId);
        if (!session.comprehensiveRecord) {
            session.comprehensiveRecord = {
                contact_info: { collected_at: new Date().toISOString() },
                situation_discovery: [],
                lifestyle_discovery: [],
                readiness_discovery: [],
                priorities_discovery: [],
                visit_scheduling: [],
                last_updated: new Date().toISOString()
            };
        }
        
        const record = session.comprehensiveRecord;
        
        if (updates.contact_info) {
            record.contact_info = { ...record.contact_info, ...updates.contact_info };
        }
        
        if (updates.situation_discovery) {
            record.situation_discovery = [...record.situation_discovery, ...updates.situation_discovery];
        }
        
        if (updates.lifestyle_discovery) {
            record.lifestyle_discovery = [...record.lifestyle_discovery, ...updates.lifestyle_discovery];
        }
        
        if (updates.readiness_discovery) {
            record.readiness_discovery = [...record.readiness_discovery, ...updates.readiness_discovery];
        }
        
        if (updates.priorities_discovery) {
            record.priorities_discovery = [...record.priorities_discovery, ...updates.priorities_discovery];
        }
        
        if (updates.visit_scheduling) {
            record.visit_scheduling = [...record.visit_scheduling, ...updates.visit_scheduling];
        }
        
        record.last_updated = new Date().toISOString();
        session.lastUpdated = new Date().toISOString();
        userSessions.set(userId, session);
    }
    
    // Get discovery state
    public getDiscoveryState(userId: string): DiscoveryState | null {
        const session = this.getUserSession(userId);
        return session.discoveryState || null;
    }
    
    // Update discovery state
    public updateDiscoveryState(userId: string, updates: Partial<DiscoveryState>): void {
        const session = this.getUserSession(userId);
        if (!session.discoveryState) {
            session.discoveryState = {
                currentStage: "trust_building",
                questionsAsked: [],
                identifiedNeeds: [],
                concernsShared: [],
                readyForVisit: false,
                visitScheduled: false
            };
        }
        
        Object.assign(session.discoveryState, updates);
        session.lastUpdated = new Date().toISOString();
        userSessions.set(userId, session);
    }
    
    // Add Q&A entry to specific stage
    public addQAEntry(userId: string, stage: string, question: string, answer: string): void {
        const qaEntry: QAEntry = {
            question,
            answer,
            stage,
            timestamp: new Date().toISOString()
        };
        
        const session = this.getUserSession(userId);
        if (!session.comprehensiveRecord) {
            session.comprehensiveRecord = {
                contact_info: { collected_at: new Date().toISOString() },
                situation_discovery: [],
                lifestyle_discovery: [],
                readiness_discovery: [],
                priorities_discovery: [],
                visit_scheduling: [],
                last_updated: new Date().toISOString()
            };
        }
        
        const record = session.comprehensiveRecord;
        
        switch (stage) {
            case "situation_discovery":
                record.situation_discovery.push(qaEntry);
                break;
            case "lifestyle_discovery":
                record.lifestyle_discovery.push(qaEntry);
                break;
            case "readiness_discovery":
                record.readiness_discovery.push(qaEntry);
                break;
            case "priorities_discovery":
                record.priorities_discovery.push(qaEntry);
                break;
            case "schedule_visit":
                record.visit_scheduling.push(qaEntry);
                break;
        }

        console.log("@chris_record:", record);
        console.log("@chris_qaEntry", stage, qaEntry)
        
        record.last_updated = new Date().toISOString();
        session.lastUpdated = new Date().toISOString();
        userSessions.set(userId, session);
    }
    
    // Get answered questions for a specific stage
    public getAnsweredQuestions(userId: string, stage: string): string[] {
        const record = this.getComprehensiveRecord(userId);
        if (!record) return [];
        
        let entries: QAEntry[] = [];
        switch (stage) {
            case "situation_discovery":
                entries = record.situation_discovery;
                break;
            case "lifestyle_discovery":
                entries = record.lifestyle_discovery;
                break;
            case "readiness_discovery":
                entries = record.readiness_discovery;
                break;
            case "priorities_discovery":
                entries = record.priorities_discovery;
                break;
            case "schedule_visit":
                entries = record.visit_scheduling;
                break;
        }
        
        return entries.map(entry => entry.question);
    }
    
    // Get contact info
    public getContactInfo(userId: string): ContactInfo | null {
        const record = this.getComprehensiveRecord(userId);
        return record?.contact_info || null;
    }
    
    // Update contact info
    public updateContactInfo(userId: string, contactInfo: Partial<ContactInfo>): void {
        const session = this.getUserSession(userId);
        if (!session.comprehensiveRecord) {
            session.comprehensiveRecord = {
                contact_info: { collected_at: new Date().toISOString() },
                situation_discovery: [],
                lifestyle_discovery: [],
                readiness_discovery: [],
                priorities_discovery: [],
                visit_scheduling: [],
                last_updated: new Date().toISOString()
            };
        }
        
        session.comprehensiveRecord.contact_info = {
            ...session.comprehensiveRecord.contact_info,
            ...contactInfo
        };
        
        session.comprehensiveRecord.last_updated = new Date().toISOString();
        session.lastUpdated = new Date().toISOString();
        userSessions.set(userId, session);
    }
    
    // Get user's first name
    public getUserFirstName(userId: string): string {
        const contactInfo = this.getContactInfo(userId);
        if (contactInfo?.name) {
            const cleanName = contactInfo.name.trim();
            if (cleanName) {
                return cleanName.split(/\s+/)[0];
            }
        }
        return "";
    }
    
    // Check if all questions are answered for a stage
    public areAllQuestionsAnswered(userId: string, stage: string, requiredQuestions: string[]): boolean {
        const answeredQuestions = this.getAnsweredQuestions(userId, stage);
        return requiredQuestions.every(question => answeredQuestions.includes(question));
    }
    
    // Get visit step status
    public getVisitStepStatus(userId: string): { currentStep: number; isInitial: boolean } {
        const record = this.getComprehensiveRecord(userId);
        if (!record) return { currentStep: 1, isInitial: true };
        
        const visitEntries = record.visit_scheduling;
        const hasAgreedToVisit = visitEntries.some(entry => entry.question === "visit_agreement");
        const hasConfirmedTime = visitEntries.some(entry => entry.question === "time_confirmation");
        const hasProvidedEmail = visitEntries.some(entry => entry.question === "email_collection");
        const hasProvidedReferral = visitEntries.some(entry => entry.question === "referral_source");
        
        if (hasProvidedReferral) return { currentStep: 5, isInitial: false };
        if (hasProvidedEmail) return { currentStep: 4, isInitial: false };
        if (hasConfirmedTime) return { currentStep: 3, isInitial: false };
        if (hasAgreedToVisit) return { currentStep: 2, isInitial: false };
        
        return { currentStep: 1, isInitial: true };
    }
    
    // Clear user session (for testing or reset)
    public clearUserSession(userId: string): void {
        userSessions.delete(userId);
    }
    
    // Reset user session to initial state (clears and recreates)
    public resetUserSession(userId: string, userName?: string): UserSession {
        // Clear existing session
        userSessions.delete(userId);
        // Create fresh session
        return this.getUserSession(userId, userName);
    }
    
    // Get all user sessions (for debugging)
    public getAllSessions(): Map<string, UserSession> {
        return new Map(userSessions);
    }
}
