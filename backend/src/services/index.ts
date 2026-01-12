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
  GuidelinesValidationResult,
  LiquidityRequirements,
  VolatilityMetrics,
  PriceRange,
  EntrySignal,
  PortfolioRiskRules,
  StopLossRules,
  ProfitTargetMethods
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