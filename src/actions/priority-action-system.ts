import { Action, IAgentRuntime, Memory, State, HandlerCallback, elizaLogger } from "@elizaos/core";

export interface PriorityAction extends Action {
    priority: number;  // Higher numbers = higher priority
    triggerType: 'keyword' | 'ai' | 'always' | 'conditional';
    conditions?: (runtime: IAgentRuntime, message: Memory) => Promise<boolean>;
}

export class PriorityActionManager {
    private actions: PriorityAction[] = [];
    
    registerAction(action: PriorityAction) {
        this.actions.push(action);
        // Sort by priority (highest first)
        this.actions.sort((a, b) => b.priority - a.priority);
    }
    
    async evaluateActions(runtime: IAgentRuntime, message: Memory): Promise<PriorityAction[]> {
        const triggeredActions: PriorityAction[] = [];
        
        for (const action of this.actions) {
            let shouldTrigger = false;
            
            try {
                switch (action.triggerType) {
                    case 'always':
                        shouldTrigger = true;
                        break;
                        
                    case 'keyword':
                        shouldTrigger = await this.keywordMatch(action, message);
                        break;
                        
                    case 'ai':
                        shouldTrigger = await action.validate(runtime, message);
                        break;
                        
                    case 'conditional':
                        if (action.conditions) {
                            shouldTrigger = await action.conditions(runtime, message);
                        } else {
                            shouldTrigger = await action.validate(runtime, message);
                        }
                        break;
                }
                
                if (shouldTrigger) {
                    triggeredActions.push(action);
                    elizaLogger.info(`✅ Action triggered: ${action.name} (priority: ${action.priority})`);
                }
                
            } catch (error) {
                elizaLogger.error(`❌ Error evaluating action ${action.name}:`, error);
                // Continue to next action instead of failing completely
            }
        }
        
        // Guarantee at least one action triggers (fallback to highest priority)
        if (triggeredActions.length === 0 && this.actions.length > 0) {
            const fallbackAction = this.actions[0]; // Highest priority
            elizaLogger.warn(`⚠️ No actions triggered, falling back to: ${fallbackAction.name}`);
            triggeredActions.push(fallbackAction);
        }
        
        return triggeredActions;
    }
    
    private async keywordMatch(action: PriorityAction, message: Memory): Promise<boolean> {
        const messageText = message.content.text?.toLowerCase() || "";
        const keywords = action.similes.map(s => s.toLowerCase());
        
        return keywords.some(keyword => 
            messageText.includes(keyword.toLowerCase()) ||
            this.fuzzyMatch(messageText, keyword)
        );
    }
    
    private fuzzyMatch(text: string, keyword: string): boolean {
        // Simple fuzzy matching - you can enhance this
        const similarity = this.levenshteinDistance(text, keyword);
        const threshold = Math.floor(keyword.length * 0.3); // 30% difference allowed
        return similarity <= threshold;
    }
    
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }
} 