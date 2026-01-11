# Swing Trading Agent Design Document

## Overview

The Swing Trading Agent is a TypeScript-based autonomous trading system that combines large language model reasoning with systematic trading rules to execute swing trades. The system operates as a background service with a React web interface, using AWS Bedrock (Claude) for signal generation, Massive.com API for market data, and a local database for portfolio management. The architecture emphasizes modularity, comprehensive logging, and risk management while maintaining full transparency through detailed UI reporting.

## Architecture

### High-Level Architecture

The system follows a modular, event-driven architecture with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Interface │    │  Trading Agent  │    │ Market Data API │
│   (React/TS)    │◄──►│   (Node.js/TS)  │◄──►│  (Massive.com)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Local Database  │    │   LLM Service   │
                       │   (SQLite)      │    │ (AWS Bedrock)   │
                       └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │Trading Guidelines│
                       │     (.md file)  │
                       └─────────────────┘
```

### Core Components

1. **Trading Engine**: Orchestrates the trading cycle and manages component interactions
2. **Guidelines Manager**: Loads, validates, and manages trading guidelines from configuration files
3. **Signal Generator**: LLM-powered component for market analysis and trade signal generation based on loaded guidelines
4. **Portfolio Manager**: Handles position tracking, performance calculation, and risk management
5. **Market Data Service**: Interfaces with external data providers for real-time and historical data
6. **Trade Executor**: Processes trading signals and executes mock trades
7. **Exit Criteria Monitor**: Continuously monitors positions for stop loss and profit target conditions defined in guidelines
8. **Risk Manager**: Enforces portfolio-level risk limits and position sizing based on guidelines rules
9. **Logging Service**: Comprehensive logging system for all activities and LLM interactions
10. **Web API**: RESTful API serving the React frontend
11. **Database Layer**: Data persistence and retrieval operations

## Components and Interfaces

### Trading Engine
```typescript
interface TradingEngine {
  start(): Promise<void>;
  stop(): Promise<void>;
  executeTradingCycle(): Promise<TradingCycleResult>;
  getStatus(): EngineStatus;
}

interface TradingCycleResult {
  buySignalsProcessed: number;
  sellSignalsProcessed: number;
  exitCriteriaChecked: number;
  tradesExecuted: Trade[];
  errors: string[];
  executionTime: number;
}
```

### Guidelines Manager
```typescript
interface GuidelinesManager {
  loadGuidelines(): Promise<TradingGuidelines>;
  reloadGuidelines(): Promise<TradingGuidelines>;
  validateGuidelines(guidelines: TradingGuidelines): GuidelinesValidationResult;
  getStockSelectionCriteria(): StockSelectionCriteria;
  getEntrySignalRules(): EntrySignalRules;
  getExitCriteriaRules(): ExitCriteriaRules;
  getRiskManagementRules(): RiskManagementRules;
  watchGuidelinesFile(callback: (guidelines: TradingGuidelines) => void): void;
}

interface TradingGuidelines {
  stockSelection: {
    liquidityRequirements: LiquidityRequirements;
    volatilityMetrics: VolatilityMetrics;
    priceRange: PriceRange;
    technicalSetupRequirements: TechnicalSetupRequirements;
    fundamentalFilters: FundamentalFilters;
  };
  entrySignals: {
    longEntries: EntrySignal[];
    shortEntries: EntrySignal[];
    timingRules: TimingRules;
    positionSizing: PositionSizingRules;
  };
  exitCriteria: {
    profitTargets: ProfitTargetMethods[];
    stopLosses: StopLossRules;
    trailingStops: TrailingStopRules;
    timeBasedExits: TimeBasedExitRules;
  };
  riskManagement: {
    portfolioRules: PortfolioRiskRules;
    tradeManagement: TradeManagementRules;
    marketEnvironment: MarketEnvironmentRules;
  };
  lastUpdated: Date;
  version: string;
}

interface GuidelinesValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingRequiredSections: string[];
}
```

### Signal Generator
```typescript
interface SignalGenerator {
  generateBuySignals(marketData: MarketData[], guidelines: TradingGuidelines): Promise<TradingSignal[]>;
  generateSellSignals(positions: Position[], guidelines: TradingGuidelines): Promise<TradingSignal[]>;
  analyzeStock(symbol: string, criteria: StockSelectionCriteria): Promise<StockAnalysis>;
  screenStocks(guidelines: TradingGuidelines): Promise<string[]>;
  validateSignalAgainstGuidelines(signal: TradingSignal, guidelines: TradingGuidelines): boolean;
}

interface TradingSignal {
  symbol: string;
  action: 'BUY' | 'SELL';
  confidence: number;
  reasoning: string;
  technicalIndicators: TechnicalData;
  recommendedSize: number;
  stopLoss: number;
  profitTargets: number[];
  timestamp: Date;
  guidelinesRulesMet: string[]; // Which guidelines rules triggered this signal
  riskRewardRatio: number;
}
```

### Portfolio Manager
```typescript
interface PortfolioManager {
  getCurrentPositions(): Position[];
  executeTradeOrder(signal: TradingSignal): Promise<TradeResult>;
  calculatePositionSize(signal: TradingSignal): number;
  updatePortfolioMetrics(): Promise<PortfolioMetrics>;
  getPerformanceStats(): PerformanceStats;
}

interface Position {
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  entryDate: Date;
  stopLoss: number;
  profitTargets: number[];
  unrealizedPnL: number;
  exitCriteria: ExitCriteria[];
}
```

### Market Data Service
```typescript
interface MarketDataService {
  getRealtimeQuote(symbol: string): Promise<Quote>;
  getHistoricalData(symbol: string, period: TimePeriod): Promise<HistoricalData>;
  getTechnicalIndicators(symbol: string): Promise<TechnicalIndicators>;
  screenStocks(criteria: ScreeningCriteria): Promise<string[]>;
}

interface Quote {
  symbol: string;
  price: number;
  volume: number;
  timestamp: Date;
  bid: number;
  ask: number;
  dayHigh: number;
  dayLow: number;
}
```

### Risk Manager
```typescript
interface RiskManager {
  validateTrade(signal: TradingSignal, portfolio: Portfolio, guidelines: TradingGuidelines): RiskValidation;
  enforcePositionLimits(proposedTrade: Trade, guidelines: TradingGuidelines): Trade;
  checkDrawdownLimits(portfolio: Portfolio, guidelines: TradingGuidelines): boolean;
  calculateMaxPositionSize(symbol: string, portfolio: Portfolio, guidelines: TradingGuidelines): number;
  checkDailyLossLimits(portfolio: Portfolio, guidelines: TradingGuidelines): boolean;
  validateSectorConcentration(symbol: string, portfolio: Portfolio, guidelines: TradingGuidelines): boolean;
}

interface RiskValidation {
  approved: boolean;
  adjustedSize?: number;
  reason?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  guidelinesViolations: string[]; // Which guidelines rules were violated
  maxAllowedSize: number;
}
```

## Data Models

### Core Trading Models
```typescript
interface Trade {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: Date;
  reasoning: string;
  signalId: string;
  fees: number;
  status: 'PENDING' | 'EXECUTED' | 'FAILED';
}

interface Portfolio {
  totalValue: number;
  cashBalance: number;
  positions: Position[];
  dailyPnL: number;
  totalPnL: number;
  lastUpdated: Date;
}

interface PerformanceStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
}
```

### Logging Models
```typescript
interface ExecutionLog {
  id: string;
  timestamp: Date;
  component: string;
  action: string;
  details: any;
  level: 'INFO' | 'WARN' | 'ERROR';
  executionCycleId: string;
}

interface LLMInteraction {
  id: string;
  timestamp: Date;
  prompt: string;
  response: string;
  model: string;
  processingTime: number;
  tokenUsage: TokenUsage;
  associatedSignalId?: string;
}
```

### Trading Guidelines Models
```typescript
interface LiquidityRequirements {
  minimumAverageDailyVolume: number; // e.g., 1,000,000 shares
  minimumMarketCap: number; // e.g., $500M
  maxBidAskSpreadPercent: number; // e.g., 0.5%
}

interface VolatilityMetrics {
  atrRange: { min: number; max: number }; // e.g., 2-8% of stock price
  historicalVolatilityRange: { min: number; max: number }; // e.g., 20-60% annualized
  betaRange: { min: number; max: number }; // e.g., 0.8-2.0
}

interface PriceRange {
  minPrice: number; // e.g., $10
  maxPrice: number; // e.g., $500
}

interface EntrySignal {
  name: string; // e.g., "Breakout Entry", "Pullback Entry"
  conditions: string[]; // Technical conditions that must be met
  volumeRequirement: number; // e.g., 150% of average volume
  confirmationRequired: boolean;
  riskRewardRatio: number; // Minimum R:R ratio
}

interface ProfitTargetMethod {
  name: string; // e.g., "ATR-Based", "Support/Resistance"
  targets: ProfitTarget[];
  partialExitStrategy: PartialExitStrategy;
}

interface ProfitTarget {
  level: number; // 1, 2, 3
  calculation: string; // e.g., "Entry + (1.5 × ATR)"
  exitPercentage: number; // e.g., 33% of position
}

interface StopLossRules {
  methods: StopLossMethod[];
  maxRiskPercent: number; // e.g., 2% of account
  breakEvenRule: BreakEvenRule;
  timeBasedStop: TimeBasedStop;
}

interface StopLossMethod {
  name: string; // e.g., "Below Support", "ATR-Based"
  calculation: string; // e.g., "Entry - (1.0-1.5 × ATR)"
  bufferPercent: number; // e.g., 1-2% below support
}

interface PortfolioRiskRules {
  maxDailyLossPercent: number; // e.g., 3%
  maxWeeklyLossPercent: number; // e.g., 6%
  maxDrawdownPercent: number; // e.g., 5-8%
  maxOpenPositions: number; // e.g., 5-8
  maxSectorExposurePercent: number; // e.g., 30%
  maxPositionSizePercent: number; // e.g., 10%
  riskPerTradePercent: number; // e.g., 1-2%
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis and property reflection to eliminate redundancy, the following correctness properties ensure the system operates according to specifications:

### Property 1: Portfolio Position Limit Enforcement
*For any* trading signal and current portfolio state, executing a trade should never result in a single position exceeding 10% of total portfolio value, with position size automatically adjusted or trade rejected if minimum size cannot be achieved
**Validates: Requirements 1.3**

### Property 2: Risk Management Consistency  
*For any* trade execution, the position size should never exceed the calculated risk limit of 1-2% of portfolio value as defined in the loaded trading guidelines
**Validates: Requirements 9.1**

### Property 3: Execution Order Invariant
*For any* trading cycle execution, the sequence must be: buy signals first, then sell signals, then exit criteria evaluation, then portfolio updates, with each step completing before the next begins
**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 4: Exit Criteria Processing Completeness
*For any* open position with defined exit criteria, when stop loss or profit target conditions are met, an exit trade must be generated within the same execution cycle, with stop losses evaluated before profit targets
**Validates: Requirements 3.2, 3.3**

### Property 5: Comprehensive Logging Invariant
*For any* executed trade, LLM interaction, or trading cycle step, a corresponding log entry must be created with all required fields populated and stored persistently
**Validates: Requirements 4.6, 7.1, 7.2, 10.1, 10.2**

### Property 6: Portfolio State Consistency
*For any* sequence of trades and portfolio updates, the sum of position values plus cash balance should equal the total portfolio value, and all position data should be immediately persisted
**Validates: Requirements 1.4, 3.5, 7.1**

### Property 7: Risk Limit Protection
*For any* trading day, when portfolio daily loss reaches the maximum daily loss limit or drawdown reaches the maximum drawdown threshold defined in the trading guidelines, the risk manager should halt new trading or reduce position sizes respectively
**Validates: Requirements 9.2, 9.4**

### Property 8: Signal Generation Data Dependency
*For any* signal generation request, if market data is unavailable or stale, no trading signals should be produced and the data issue should be logged
**Validates: Requirements 5.4**

### Property 9: Sector Concentration Limits
*For any* new trade evaluation, trades that would create sector concentration exceeding the maximum sector exposure defined in the trading guidelines should be prevented by the risk manager
**Validates: Requirements 9.3**

### Property 10: Configuration Validation
*For any* system initialization or configuration update, all parameters should be validated and invalid settings should be reported without causing system failure
**Validates: Requirements 8.5**

### Property 11: Guidelines Loading and Validation
*For any* system startup or guidelines file update, the guidelines manager should successfully load and validate the trading guidelines, and all components should reference the loaded guidelines for their decision-making processes
**Validates: Requirements 2.1, 2.2, 2.3, 2.5, 2.6**

## Error Handling

### Trading Guidelines Failures
- **File Not Found**: Use default fallback guidelines, log error, notify through UI
- **Invalid Format**: Continue with last valid guidelines, log validation errors with specific line numbers
- **Missing Required Sections**: Use defaults for missing sections, warn user through logs and UI
- **File Corruption**: Attempt to restore from backup, fallback to defaults if restoration fails
- **File Watch Errors**: Implement periodic polling as fallback, log file system issues

### Market Data Failures
- **Connection Loss**: Retry with exponential backoff, fallback to cached data if available
- **Stale Data**: Prevent signal generation, log warning, wait for fresh data
- **API Rate Limits**: Implement request queuing and throttling
- **Invalid Responses**: Validate all data, reject malformed responses, log errors

### LLM Service Failures  
- **API Timeouts**: Retry with shorter timeout, fallback to rule-based signals if configured
- **Invalid Responses**: Parse and validate LLM output, request regeneration for malformed responses
- **Rate Limiting**: Queue requests, implement backoff strategies
- **Model Unavailability**: Switch to backup model if configured, halt signal generation otherwise

### Trade Execution Failures
- **Order Rejection**: Log reason, notify through UI, do not retry automatically
- **Partial Fills**: Handle partial execution, update position accordingly
- **System Errors**: Rollback incomplete transactions, maintain data consistency

### Database Failures
- **Connection Loss**: Implement connection pooling and retry logic
- **Corruption**: Validate data integrity on startup, backup before critical operations
- **Disk Space**: Monitor storage, implement log rotation and cleanup

### Risk Management Violations
- **Position Limit Exceeded**: Automatically adjust position size or reject trade
- **Drawdown Limits**: Halt trading, send alerts, require manual intervention
- **Correlation Limits**: Track sector exposure, prevent overconcentration

## Testing Strategy

### Unit Testing Approach
The system will use Jest for unit testing with the following focus areas:
- **Component Isolation**: Test each component independently with mocked dependencies
- **Business Logic Validation**: Verify trading rules, risk calculations, and portfolio management
- **Error Handling**: Test failure scenarios and recovery mechanisms
- **Data Validation**: Ensure proper handling of malformed or missing data

### Property-Based Testing Approach
The system will use fast-check for property-based testing with a minimum of 100 iterations per property:
- **Universal Properties**: Test correctness properties that should hold across all valid inputs
- **Invariant Preservation**: Verify system invariants are maintained through all operations
- **Edge Case Discovery**: Use generators to find edge cases in trading logic and risk management
- **State Consistency**: Ensure portfolio and position states remain consistent through all operations

Each property-based test will be tagged with comments explicitly referencing the correctness property from this design document using the format: **Feature: swing-trading-agent, Property {number}: {property_text}**

### Integration Testing
- **End-to-End Workflows**: Test complete trading cycles from signal generation to execution
- **External API Integration**: Test market data and LLM service integrations with mock services
- **Database Operations**: Verify data persistence and retrieval across system restarts
- **Web Interface Integration**: Test API endpoints and data flow to frontend

### Performance Testing
- **Signal Generation Latency**: Ensure LLM interactions complete within acceptable timeframes
- **Database Query Performance**: Optimize queries for portfolio and logging operations
- **Memory Usage**: Monitor memory consumption during extended operation
- **Concurrent Operations**: Test system behavior under multiple simultaneous requests

The testing strategy emphasizes both concrete examples (unit tests) and universal correctness (property tests) to provide comprehensive coverage and confidence in system reliability.