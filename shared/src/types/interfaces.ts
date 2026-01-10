/**
 * Core service interfaces for the trading system
 */

import { 
  TradingSignal, 
  Trade, 
  TradeResult, 
  TradingCycleResult, 
  StockAnalysis,
  ExitCriteria
} from './trading';
import { 
  Portfolio, 
  Position, 
  PortfolioMetrics, 
  PerformanceStats,
  PortfolioSnapshot
} from './portfolio';
import { 
  Quote, 
  HistoricalData, 
  TechnicalIndicators, 
  MarketData, 
  ScreeningCriteria, 
  TimePeriod 
} from './market-data';
import { 
  RiskValidation
} from './risk';
import { 
  EngineStatus, 
  SystemHealth, 
  ConfigValidationResult,
  SystemConfig
} from './config';
import {
  ExecutionLog,
  LLMInteraction,
  LogQuery
} from './logging';

// Trading Engine Interface
export interface TradingEngineInterface {
  start(): Promise<void>;
  stop(): Promise<void>;
  executeTradingCycle(): Promise<TradingCycleResult>;
  getStatus(): EngineStatus;
  getHealth(): Promise<SystemHealth>;
  pause(): Promise<void>;
  resume(): Promise<void>;
}

// Signal Generator Interface
export interface SignalGeneratorInterface {
  generateBuySignals(marketData: MarketData[]): Promise<TradingSignal[]>;
  generateSellSignals(positions: Position[]): Promise<TradingSignal[]>;
  analyzeStock(symbol: string, criteria: ScreeningCriteria): Promise<StockAnalysis>;
  screenStocks(criteria: ScreeningCriteria): Promise<string[]>;
  validateSignal(signal: TradingSignal): boolean;
}

// Portfolio Manager Interface
export interface PortfolioManagerInterface {
  getCurrentPositions(): Position[];
  getPortfolio(): Portfolio;
  executeTradeOrder(signal: TradingSignal): Promise<TradeResult>;
  calculatePositionSize(signal: TradingSignal): number;
  updatePortfolioMetrics(): Promise<PortfolioMetrics>;
  getPerformanceStats(): PerformanceStats;
  addPosition(trade: Trade): Promise<Position>;
  updatePosition(positionId: string, updates: Partial<Position>): Promise<Position>;
  closePosition(positionId: string, price: number, reason: string): Promise<Trade>;
  rebalancePortfolio(): Promise<void>;
}

// Market Data Service Interface
export interface MarketDataServiceInterface {
  getRealtimeQuote(symbol: string): Promise<Quote>;
  getHistoricalData(symbol: string, period: TimePeriod): Promise<HistoricalData>;
  getTechnicalIndicators(symbol: string): Promise<TechnicalIndicators>;
  getMarketData(symbol: string): Promise<MarketData>;
  screenStocks(criteria: ScreeningCriteria): Promise<string[]>;
  isMarketOpen(): boolean;
  getMarketStatus(): Promise<MarketStatus>;
  subscribeToQuotes(symbols: string[], callback: (quote: Quote) => void): void;
  unsubscribeFromQuotes(symbols: string[]): void;
}

export interface MarketStatus {
  isOpen: boolean;
  nextOpen?: Date;
  nextClose?: Date;
  timezone: string;
  session: 'PRE_MARKET' | 'REGULAR' | 'AFTER_HOURS' | 'CLOSED';
}

// Exit Criteria Monitor Interface
export interface ExitCriteriaMonitorInterface {
  checkExitCriteria(positions: Position[]): Promise<TradingSignal[]>;
  addExitCriteria(positionId: string, criteria: ExitCriteria[]): Promise<void>;
  updateExitCriteria(positionId: string, criteriaId: string, updates: Partial<ExitCriteria>): Promise<void>;
  removeExitCriteria(positionId: string, criteriaId: string): Promise<void>;
  getActiveExitCriteria(positionId: string): ExitCriteria[];
}

// Risk Manager Interface
export interface RiskManagerInterface {
  validateTrade(signal: TradingSignal, portfolio: Portfolio): RiskValidation;
  enforcePositionLimits(proposedTrade: Trade): Trade;
  checkDrawdownLimits(portfolio: Portfolio): boolean;
  calculateMaxPositionSize(symbol: string, portfolio: Portfolio): number;
  updateRiskMetrics(portfolio: Portfolio): Promise<void>;
  checkRiskLimits(portfolio: Portfolio): string[];
  calculatePortfolioRisk(positions: Position[]): number;
  getSectorExposure(positions: Position[]): Record<string, number>;
}

// LLM Service Interface
export interface LLMServiceInterface {
  generateTradingSignal(prompt: string, marketData: MarketData): Promise<LLMResponse>;
  analyzeMarketConditions(marketData: MarketData[]): Promise<LLMResponse>;
  explainTrade(trade: Trade, marketData: MarketData): Promise<LLMResponse>;
  assessRisk(signal: TradingSignal, portfolio: Portfolio): Promise<LLMResponse>;
  isHealthy(): Promise<boolean>;
  getUsageStats(): LLMUsageStats;
}

export interface LLMResponse {
  content: string;
  confidence: number;
  reasoning: string;
  metadata: {
    model: string;
    tokens: number;
    processingTime: number;
    cost?: number;
  };
  success: boolean;
  error?: string;
}

export interface LLMUsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  totalCost: number;
  averageResponseTime: number;
  lastRequest: Date;
}

// Database Interface
export interface DatabaseInterface {
  // Generic CRUD operations
  create<T>(table: string, data: Omit<T, 'id'>): Promise<T>;
  findById<T>(table: string, id: string): Promise<T | null>;
  findMany<T>(table: string, query?: Record<string, unknown>): Promise<T[]>;
  update<T>(table: string, id: string, updates: Partial<T>): Promise<T>;
  delete(table: string, id: string): Promise<boolean>;
  
  // Trading-specific operations
  saveTrade(trade: Trade): Promise<Trade>;
  savePosition(position: Position): Promise<Position>;
  savePortfolioSnapshot(snapshot: PortfolioSnapshot): Promise<void>;
  getTradeHistory(filters?: TradeHistoryFilter): Promise<Trade[]>;
  getPositionHistory(symbol?: string): Promise<Position[]>;
  
  // Logging operations
  saveLog(log: ExecutionLog): Promise<void>;
  saveLLMInteraction(interaction: LLMInteraction): Promise<void>;
  getLogs(query: LogQuery): Promise<ExecutionLog[]>;
  
  // Maintenance
  cleanup(retentionDays: number): Promise<void>;
  backup(): Promise<string>;
  migrate(): Promise<void>;
}

export interface TradeHistoryFilter {
  symbol?: string;
  action?: 'BUY' | 'SELL';
  startDate?: Date;
  endDate?: Date;
  status?: 'PENDING' | 'EXECUTED' | 'FAILED';
  limit?: number;
  offset?: number;
}

// Configuration Manager Interface
export interface ConfigManagerInterface {
  loadConfig(): Promise<SystemConfig>;
  validateConfig(config: SystemConfig): ConfigValidationResult;
  updateConfig(updates: Partial<SystemConfig>): Promise<SystemConfig>;
  getConfig<T>(path: string): T;
  setConfig(path: string, value: unknown): Promise<void>;
  reloadConfig(): Promise<void>;
  watchConfig(callback: (config: SystemConfig) => void): void;
}

// Scheduler Interface
export interface SchedulerInterface {
  start(): Promise<void>;
  stop(): Promise<void>;
  scheduleTask(name: string, cronExpression: string, task: () => Promise<void>): void;
  unscheduleTask(name: string): void;
  getScheduledTasks(): ScheduledTask[];
  isRunning(): boolean;
}

export interface ScheduledTask {
  name: string;
  cronExpression: string;
  nextRun: Date;
  lastRun?: Date;
  isActive: boolean;
  runCount: number;
  errorCount: number;
  lastError?: string;
}