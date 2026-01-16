/**
 * Services module exports
 */

export { LoggingService, ScopedLogger, createLoggingService } from './logging-service';
export { LogViewer, createLogViewer } from './log-viewer';
export type { LogViewerOptions, LogFilter } from './log-viewer';
export { MarketDataService, MockMarketDataProvider, MarketDataServiceError } from './market-data-service';
export { LLMService, LLMServiceError, createLLMService } from './llm-service';
export type { LLMServiceConfig } from './llm-service';
export { 
  GuidelinesManager, 
  GuidelinesManagerError, 
  createGuidelinesManager 
} from './guidelines-manager';
export type { 
  TradingGuidelines, 
  GuidelinesManagerConfig, 
  GuidelinesValidationResult
} from './guidelines-manager';
export { 
  PortfolioManager, 
  PortfolioManagerError, 
  createPortfolioManager 
} from './portfolio-manager';
export type { 
  PortfolioManagerConfig, 
  MockBrokerConfig 
} from './portfolio-manager';
export {
  RiskManager,
  RiskManagerError,
  createRiskManager
} from './risk-manager';
export type {
  RiskManagerConfig,
  RiskValidation,
  RiskCheck,
  RiskLimits,
  RiskMetrics,
  PositionRisk,
  RiskEvent
} from './risk-manager';
export {
  SignalGenerator,
  SignalGeneratorError,
  createSignalGenerator
} from './signal-generator';
export type {
  SignalGeneratorConfig
} from './signal-generator';
export {
  ExitCriteriaMonitor,
  ExitCriteriaMonitorError,
  createExitCriteriaMonitor
} from './exit-criteria-monitor';
export type {
  ExitCriteriaMonitorConfig,
  ExitCheckResult
} from './exit-criteria-monitor';
export {
  TradingEngine,
  TradingEngineError,
  createTradingEngine
} from './trading-engine';
export type {
  TradingEngineConfig
} from './trading-engine';