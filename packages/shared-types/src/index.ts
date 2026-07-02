// AgentNet — umumiy TypeScript turlari (web va api o'rtasida ulashiladi)

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export type HalalCategory =
  | 'QIMOR'
  | 'RIBO'
  | 'NOJOYA_KONTENT'
  | 'FITNA'
  | 'XAVFSIZ'
  | 'NOANIQ';

export type HalalAction = 'BLOCK' | 'ALLOW' | 'HUMAN_REVIEW';

export interface HalalFilterResult {
  category: HalalCategory;
  confidence: number;
  reasoning: string;
  action: HalalAction;
  layer: 'keyword' | 'semantic' | 'llm';
}

export interface AgentSummary {
  id: string;
  name: string;
  model: string;
  halalFilterEnabled: boolean;
  isPublished: boolean;
  createdAt: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  halalFlag?: HalalAction;
  timestamp?: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}
