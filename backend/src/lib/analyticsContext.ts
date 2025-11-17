/**
 * Context Management for Conversational Analytics
 * 
 * Tracks conversation history, user preferences, and analytical threads
 */

export interface AnalyticsMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    queryType?: string;
    dataSource?: string;
    visualizationType?: string;
    filters?: Record<string, any>;
  };
}

export interface AnalyticsContext {
  threadId: string;
  messages: AnalyticsMessage[];
  userPreferences?: {
    defaultDateRange?: string;
    preferredVisualization?: 'chart' | 'table' | 'both';
    defaultOwner?: string;
    defaultLane?: string;
  };
  currentFocus?: {
    query?: string;
    timeframe?: string;
    filters?: Record<string, any>;
    lastVisualization?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// In-memory store (in production, use Redis or database)
const contextStore = new Map<string, AnalyticsContext>();

/**
 * Get or create analytics context for a thread
 */
export function getAnalyticsContext(threadId: string): AnalyticsContext {
  if (!contextStore.has(threadId)) {
    const context: AnalyticsContext = {
      threadId,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    contextStore.set(threadId, context);
  }
  
  const context = contextStore.get(threadId)!;
  context.updatedAt = new Date().toISOString();
  return context;
}

/**
 * Add a message to the context
 */
export function addMessage(threadId: string, message: AnalyticsMessage): void {
  const context = getAnalyticsContext(threadId);
  context.messages.push(message);
  context.updatedAt = new Date().toISOString();
}

/**
 * Update user preferences
 */
export function updateUserPreferences(threadId: string, preferences: Partial<AnalyticsContext['userPreferences']>): void {
  const context = getAnalyticsContext(threadId);
  context.userPreferences = { ...context.userPreferences, ...preferences };
  context.updatedAt = new Date().toISOString();
}

/**
 * Update current focus
 */
export function updateCurrentFocus(threadId: string, focus: Partial<AnalyticsContext['currentFocus']>): void {
  const context = getAnalyticsContext(threadId);
  context.currentFocus = { ...context.currentFocus, ...focus };
  context.updatedAt = new Date().toISOString();
}

/**
 * Get conversation history for LLM context
 */
export function getConversationHistory(threadId: string, maxMessages: number = 20): AnalyticsMessage[] {
  const context = getAnalyticsContext(threadId);
  return context.messages.slice(-maxMessages);
}

/**
 * Clear context (useful for testing or reset)
 */
export function clearContext(threadId: string): void {
  contextStore.delete(threadId);
}

