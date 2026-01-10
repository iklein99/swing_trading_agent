/**
 * Configuration and system types
 */

import { RiskLimits } from './risk';
import { MarketDataProvider } from './market-data';

export interface SystemConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  trading: TradingConfig;
  risk: RiskLimits;
  marketData: MarketDataConfig;
  llm: LLMConfig;
  logging: LoggingConfig;
  scheduler: SchedulerConfig;
}

export interface ServerConfig {
  port: number;
  host: string;
  environment: 'development' | 'staging' | 'production';
  cors: {
    origin: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

export interface DatabaseConfig {
  type: 'sqlite' | 'postgresql' | 'mysql';
  path?: string; // for SQLite
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  pool: {
    min: number;
    max: number;
  };
  migrations: {
    directory: string;
    autoRun: boolean;
  };
}

export interface TradingConfig {
  initialPortfolioValue: number;
  paperTrading: boolean;
  brokerConfig?: BrokerConfig;
  tradingHours: {
    start: string; // HH:MM format
    end: string;
    timezone: string;
  };
  executionDelay: number; // milliseconds
  maxConcurrentTrades: number;
}

export interface BrokerConfig {
  name: string;
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  sandbox: boolean;
}

export interface MarketDataConfig {
  provider: MarketDataProvider;
  backup?: MarketDataProvider;
  caching: {
    enabled: boolean;
    ttl: number; // seconds
    maxSize: number;
  };
  retries: {
    maxAttempts: number;
    backoffMs: number;
  };
}

export interface LLMConfig {
  provider: 'aws-bedrock' | 'openai' | 'anthropic' | 'ollama';
  model: string;
  region?: string; // for AWS
  apiKey?: string;
  baseUrl?: string; // for custom endpoints
  maxTokens: number;
  temperature: number;
  timeout: number; // milliseconds
  retries: {
    maxAttempts: number;
    backoffMs: number;
  };
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  console: boolean;
  file: {
    enabled: boolean;
    path: string;
    maxSize: string; // e.g., '10MB'
    maxFiles: number;
  };
  database: {
    enabled: boolean;
    retention: number; // days
  };
}

export interface SchedulerConfig {
  enabled: boolean;
  tradingCycleInterval: number; // minutes
  marketDataUpdateInterval: number; // minutes
  portfolioUpdateInterval: number; // minutes
  riskCheckInterval: number; // minutes
  logCleanupInterval: number; // hours
}

export interface EngineStatus {
  isRunning: boolean;
  currentPhase: 'IDLE' | 'INITIALIZING' | 'TRADING_CYCLE' | 'MAINTENANCE' | 'ERROR';
  lastCycleTime?: Date;
  nextCycleTime?: Date;
  uptime: number; // seconds
  cyclesCompleted: number;
  errors: string[];
  performance: {
    averageCycleTime: number;
    successRate: number;
    lastError?: string;
    lastErrorTime?: Date;
  };
}

export interface SystemHealth {
  overall: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  components: {
    tradingEngine: ComponentHealth;
    database: ComponentHealth;
    marketData: ComponentHealth;
    llmService: ComponentHealth;
    riskManager: ComponentHealth;
  };
  lastCheck: Date;
}

export interface ComponentHealth {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE';
  message: string;
  lastCheck: Date;
  responseTime?: number;
  errorRate?: number;
}

// Configuration validation schemas
export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationWarning[];
}

export interface ConfigValidationError {
  path: string;
  message: string;
  value?: unknown;
}

export interface ConfigValidationWarning {
  path: string;
  message: string;
  value?: unknown;
  suggestion?: string;
}