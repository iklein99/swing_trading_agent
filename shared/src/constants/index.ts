/**
 * Shared constants for the Swing Trading Agent
 */

// Trading Constants
export const TRADING_CONSTANTS = {
  // Position Limits
  MAX_POSITION_PERCENTAGE: 10, // 10% max per position
  MAX_RISK_PER_TRADE: 2, // 2% max risk per trade
  MIN_RISK_PER_TRADE: 1, // 1% min risk per trade
  
  // Risk Management
  MAX_DAILY_LOSS_PERCENTAGE: 3, // 3% max daily loss
  MAX_DRAWDOWN_PERCENTAGE: 8, // 8% max drawdown
  MAX_SECTOR_CONCENTRATION: 30, // 30% max per sector
  MAX_OPEN_POSITIONS: 8,
  MAX_CORRELATED_POSITIONS: 3,
  
  // Stock Selection Criteria
  MIN_DAILY_VOLUME: 1_000_000, // 1M shares
  MIN_MARKET_CAP: 500_000_000, // $500M
  MAX_BID_ASK_SPREAD: 0.5, // 0.5% of stock price
  MIN_STOCK_PRICE: 10,
  MAX_STOCK_PRICE: 500,
  MIN_ATR_PERCENTAGE: 2,
  MAX_ATR_PERCENTAGE: 8,
  MIN_BETA: 0.8,
  MAX_BETA: 2.0,
  
  // Technical Analysis
  RSI_OVERSOLD: 30,
  RSI_OVERBOUGHT: 70,
  RSI_NEUTRAL_LOW: 40,
  RSI_NEUTRAL_HIGH: 60,
  
  // Exit Criteria
  MIN_RISK_REWARD_RATIO: 2.0,
  PREFERRED_RISK_REWARD_RATIO: 3.0,
  MAX_HOLDING_PERIOD_DAYS: 15,
  BREAK_EVEN_MULTIPLIER: 1.5,
  
  // Profit Targets (ATR multipliers)
  PROFIT_TARGET_1: 1.5,
  PROFIT_TARGET_2: 2.5,
  PROFIT_TARGET_3: 4.0,
  
  // Stop Loss (ATR multipliers)
  STOP_LOSS_MULTIPLIER: 1.0,
  MAX_STOP_LOSS_MULTIPLIER: 1.5,
  
  // Trading Hours (ET)
  MARKET_OPEN: '09:30',
  MARKET_CLOSE: '16:00',
  AVOID_FIRST_MINUTES: 15,
  AVOID_LAST_MINUTES: 15,
  OPTIMAL_TRADING_START: '10:00',
  OPTIMAL_TRADING_END: '15:30',
} as const;

// System Constants
export const SYSTEM_CONSTANTS = {
  // Database
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 1000,
  LOG_RETENTION_DAYS: 90,
  BACKUP_RETENTION_DAYS: 30,
  
  // API
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  RETRY_BACKOFF_MS: 1000,
  RATE_LIMIT_WINDOW_MS: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 100,
  
  // Caching
  QUOTE_CACHE_TTL: 5, // 5 seconds
  HISTORICAL_CACHE_TTL: 300, // 5 minutes
  TECHNICAL_CACHE_TTL: 60, // 1 minute
  
  // Scheduling
  TRADING_CYCLE_INTERVAL_MINUTES: 5,
  MARKET_DATA_UPDATE_INTERVAL_MINUTES: 1,
  PORTFOLIO_UPDATE_INTERVAL_MINUTES: 1,
  RISK_CHECK_INTERVAL_MINUTES: 5,
  LOG_CLEANUP_INTERVAL_HOURS: 24,
  
  // LLM
  DEFAULT_MAX_TOKENS: 4000,
  DEFAULT_TEMPERATURE: 0.1,
  LLM_TIMEOUT_MS: 30000,
  MAX_LLM_RETRIES: 2,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  // Trading Errors
  INSUFFICIENT_FUNDS: 'Insufficient funds for trade execution',
  POSITION_LIMIT_EXCEEDED: 'Position would exceed maximum position limit',
  DAILY_LOSS_LIMIT_EXCEEDED: 'Daily loss limit has been exceeded',
  DRAWDOWN_LIMIT_EXCEEDED: 'Maximum drawdown limit has been exceeded',
  SECTOR_CONCENTRATION_EXCEEDED: 'Sector concentration limit would be exceeded',
  INVALID_SIGNAL: 'Trading signal validation failed',
  MARKET_CLOSED: 'Market is currently closed',
  
  // Data Errors
  STALE_DATA: 'Market data is stale or unavailable',
  INVALID_SYMBOL: 'Invalid or unsupported stock symbol',
  DATA_PROVIDER_ERROR: 'Market data provider error',
  RATE_LIMIT_EXCEEDED: 'API rate limit exceeded',
  
  // System Errors
  DATABASE_ERROR: 'Database operation failed',
  CONFIG_VALIDATION_ERROR: 'Configuration validation failed',
  LLM_SERVICE_ERROR: 'LLM service error',
  NETWORK_ERROR: 'Network connection error',
  AUTHENTICATION_ERROR: 'Authentication failed',
  
  // Validation Errors
  REQUIRED_FIELD_MISSING: 'Required field is missing',
  INVALID_FORMAT: 'Invalid data format',
  OUT_OF_RANGE: 'Value is out of acceptable range',
  DUPLICATE_ENTRY: 'Duplicate entry detected',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  TRADE_EXECUTED: 'Trade executed successfully',
  POSITION_OPENED: 'Position opened successfully',
  POSITION_CLOSED: 'Position closed successfully',
  PORTFOLIO_UPDATED: 'Portfolio updated successfully',
  SIGNAL_GENERATED: 'Trading signal generated successfully',
  RISK_CHECK_PASSED: 'Risk validation passed',
  DATA_UPDATED: 'Market data updated successfully',
  SYSTEM_STARTED: 'Trading system started successfully',
  SYSTEM_STOPPED: 'Trading system stopped successfully',
} as const;

// Event Types
export const EVENT_TYPES = {
  // Trading Events
  TRADE_EXECUTED: 'trade.executed',
  POSITION_OPENED: 'position.opened',
  POSITION_CLOSED: 'position.closed',
  SIGNAL_GENERATED: 'signal.generated',
  EXIT_CRITERIA_TRIGGERED: 'exit_criteria.triggered',
  
  // Risk Events
  RISK_LIMIT_BREACHED: 'risk.limit_breached',
  DRAWDOWN_WARNING: 'risk.drawdown_warning',
  POSITION_LIMIT_WARNING: 'risk.position_limit_warning',
  
  // System Events
  SYSTEM_STARTED: 'system.started',
  SYSTEM_STOPPED: 'system.stopped',
  TRADING_CYCLE_COMPLETED: 'trading_cycle.completed',
  ERROR_OCCURRED: 'system.error',
  
  // Data Events
  MARKET_DATA_UPDATED: 'market_data.updated',
  DATA_PROVIDER_ERROR: 'market_data.provider_error',
  LLM_INTERACTION: 'llm.interaction',
} as const;