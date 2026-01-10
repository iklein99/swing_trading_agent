/**
 * Logging and audit trail types
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
export type ComponentType = 
  | 'TRADING_ENGINE' 
  | 'SIGNAL_GENERATOR' 
  | 'PORTFOLIO_MANAGER' 
  | 'RISK_MANAGER' 
  | 'MARKET_DATA_SERVICE' 
  | 'LLM_SERVICE' 
  | 'EXIT_CRITERIA_MONITOR'
  | 'DATABASE'
  | 'API_SERVER'
  | 'SCHEDULER';

export interface ExecutionLog {
  id: string;
  timestamp: Date;
  component: ComponentType;
  action: string;
  details: Record<string, unknown>;
  level: LogLevel;
  executionCycleId: string;
  duration?: number;
  success: boolean;
  error?: string;
}

export interface LLMInteraction {
  id: string;
  timestamp: Date;
  prompt: string;
  response: string;
  model: string;
  processingTime: number;
  tokenUsage: TokenUsage;
  associatedSignalId?: string;
  associatedTradeId?: string;
  success: boolean;
  error?: string;
  retryCount: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

export interface TradingCycleLog {
  id: string;
  cycleId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  phase: 'STARTING' | 'BUY_SIGNALS' | 'SELL_SIGNALS' | 'EXIT_CRITERIA' | 'PORTFOLIO_UPDATE' | 'COMPLETED' | 'FAILED';
  buySignalsGenerated: number;
  sellSignalsGenerated: number;
  exitCriteriaTriggered: number;
  tradesExecuted: number;
  errors: string[];
  success: boolean;
}

export interface SystemLog {
  id: string;
  timestamp: Date;
  level: LogLevel;
  component: ComponentType;
  message: string;
  metadata?: Record<string, unknown>;
  stackTrace?: string;
  userId?: string;
  sessionId?: string;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  resourceId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  reason?: string;
}

export interface LogQuery {
  startDate?: Date;
  endDate?: Date;
  level?: LogLevel;
  component?: ComponentType;
  executionCycleId?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'level' | 'component';
  sortOrder?: 'asc' | 'desc';
}

export interface LogSummary {
  totalLogs: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  debugCount: number;
  componentBreakdown: Record<ComponentType, number>;
  timeRange: {
    start: Date;
    end: Date;
  };
  topErrors: Array<{
    message: string;
    count: number;
    lastOccurrence: Date;
  }>;
}

// Logger Interface
export interface LoggerInterface {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error?: Error, metadata?: Record<string, unknown>): void;
  fatal(message: string, error?: Error, metadata?: Record<string, unknown>): void;
  
  logTradingCycle(cycleLog: TradingCycleLog): Promise<void>;
  logLLMInteraction(interaction: LLMInteraction): Promise<void>;
  logExecution(log: ExecutionLog): Promise<void>;
  logAudit(audit: AuditLog): Promise<void>;
  
  query(query: LogQuery): Promise<SystemLog[]>;
  getSummary(startDate: Date, endDate: Date): Promise<LogSummary>;
}