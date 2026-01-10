/**
 * Configuration validation schemas using Joi
 */

import Joi from 'joi';
import { SystemConfig } from '../types/config';

// Server Configuration Schema
const serverConfigSchema = Joi.object({
  port: Joi.number().integer().min(1).max(65535).required(),
  host: Joi.string().required(),
  environment: Joi.string().valid('development', 'staging', 'production').required(),
  cors: Joi.object({
    origin: Joi.array().items(Joi.string()).required(),
    credentials: Joi.boolean().required(),
  }).required(),
  rateLimit: Joi.object({
    windowMs: Joi.number().integer().min(1000).required(),
    max: Joi.number().integer().min(1).required(),
  }).required(),
});

// Database Configuration Schema
const databaseConfigSchema = Joi.object({
  type: Joi.string().valid('sqlite', 'postgresql', 'mysql').required(),
  path: Joi.string().when('type', { is: 'sqlite', then: Joi.required() }),
  host: Joi.string().when('type', { is: Joi.not('sqlite'), then: Joi.required() }),
  port: Joi.number().integer().min(1).max(65535).when('type', { is: Joi.not('sqlite'), then: Joi.required() }),
  database: Joi.string().when('type', { is: Joi.not('sqlite'), then: Joi.required() }),
  username: Joi.string().when('type', { is: Joi.not('sqlite'), then: Joi.required() }),
  password: Joi.string().when('type', { is: Joi.not('sqlite'), then: Joi.required() }),
  ssl: Joi.boolean(),
  pool: Joi.object({
    min: Joi.number().integer().min(0).required(),
    max: Joi.number().integer().min(1).required(),
  }).required(),
  migrations: Joi.object({
    directory: Joi.string().required(),
    autoRun: Joi.boolean().required(),
  }).required(),
});

// Trading Configuration Schema
const tradingConfigSchema = Joi.object({
  initialPortfolioValue: Joi.number().min(1000).required(),
  paperTrading: Joi.boolean().required(),
  brokerConfig: Joi.object({
    name: Joi.string().required(),
    apiKey: Joi.string().required(),
    apiSecret: Joi.string().required(),
    baseUrl: Joi.string().uri().required(),
    sandbox: Joi.boolean().required(),
  }).when('paperTrading', { is: false, then: Joi.required() }),
  tradingHours: Joi.object({
    start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    timezone: Joi.string().required(),
  }).required(),
  executionDelay: Joi.number().integer().min(0).required(),
  maxConcurrentTrades: Joi.number().integer().min(1).max(20).required(),
});

// Risk Limits Schema
const riskLimitsSchema = Joi.object({
  maxPositionPercentage: Joi.number().min(1).max(50).required(),
  maxDailyLossPercentage: Joi.number().min(0.1).max(20).required(),
  maxDrawdownPercentage: Joi.number().min(1).max(50).required(),
  maxSectorConcentration: Joi.number().min(5).max(100).required(),
  maxOpenPositions: Joi.number().integer().min(1).max(50).required(),
  maxRiskPerTrade: Joi.number().min(0.1).max(10).required(),
  maxCorrelatedPositions: Joi.number().integer().min(1).max(10).required(),
});

// Market Data Configuration Schema
const marketDataConfigSchema = Joi.object({
  provider: Joi.object({
    name: Joi.string().required(),
    baseUrl: Joi.string().uri().required(),
    apiKey: Joi.string(),
    rateLimit: Joi.object({
      requestsPerMinute: Joi.number().integer().min(1).required(),
      requestsPerHour: Joi.number().integer().min(1).required(),
      requestsPerDay: Joi.number().integer().min(1).required(),
    }).required(),
    endpoints: Joi.object({
      quote: Joi.string().required(),
      historical: Joi.string().required(),
      technical: Joi.string().required(),
      screening: Joi.string().required(),
    }).required(),
  }).required(),
  backup: Joi.object({
    name: Joi.string().required(),
    baseUrl: Joi.string().uri().required(),
    apiKey: Joi.string(),
    rateLimit: Joi.object({
      requestsPerMinute: Joi.number().integer().min(1).required(),
      requestsPerHour: Joi.number().integer().min(1).required(),
      requestsPerDay: Joi.number().integer().min(1).required(),
    }).required(),
    endpoints: Joi.object({
      quote: Joi.string().required(),
      historical: Joi.string().required(),
      technical: Joi.string().required(),
      screening: Joi.string().required(),
    }).required(),
  }),
  caching: Joi.object({
    enabled: Joi.boolean().required(),
    ttl: Joi.number().integer().min(1).required(),
    maxSize: Joi.number().integer().min(1).required(),
  }).required(),
  retries: Joi.object({
    maxAttempts: Joi.number().integer().min(1).max(10).required(),
    backoffMs: Joi.number().integer().min(100).required(),
  }).required(),
});

// LLM Configuration Schema
const llmConfigSchema = Joi.object({
  provider: Joi.string().valid('aws-bedrock', 'openai', 'anthropic', 'ollama').required(),
  model: Joi.string().required(),
  region: Joi.string().when('provider', { is: 'aws-bedrock', then: Joi.required() }),
  apiKey: Joi.string().when('provider', { is: Joi.not('aws-bedrock'), then: Joi.required() }),
  baseUrl: Joi.string().uri(),
  maxTokens: Joi.number().integer().min(100).max(100000).required(),
  temperature: Joi.number().min(0).max(2).required(),
  timeout: Joi.number().integer().min(1000).required(),
  retries: Joi.object({
    maxAttempts: Joi.number().integer().min(1).max(5).required(),
    backoffMs: Joi.number().integer().min(100).required(),
  }).required(),
  rateLimits: Joi.object({
    requestsPerMinute: Joi.number().integer().min(1).required(),
    tokensPerMinute: Joi.number().integer().min(1).required(),
  }).required(),
});

// Logging Configuration Schema
const loggingConfigSchema = Joi.object({
  level: Joi.string().valid('debug', 'info', 'warn', 'error').required(),
  console: Joi.boolean().required(),
  file: Joi.object({
    enabled: Joi.boolean().required(),
    path: Joi.string().required(),
    maxSize: Joi.string().pattern(/^\d+[KMGT]?B$/).required(),
    maxFiles: Joi.number().integer().min(1).required(),
  }).required(),
  database: Joi.object({
    enabled: Joi.boolean().required(),
    retention: Joi.number().integer().min(1).required(),
  }).required(),
});

// Scheduler Configuration Schema
const schedulerConfigSchema = Joi.object({
  enabled: Joi.boolean().required(),
  tradingCycleInterval: Joi.number().integer().min(1).max(60).required(),
  marketDataUpdateInterval: Joi.number().integer().min(1).max(30).required(),
  portfolioUpdateInterval: Joi.number().integer().min(1).max(30).required(),
  riskCheckInterval: Joi.number().integer().min(1).max(60).required(),
  logCleanupInterval: Joi.number().integer().min(1).max(168).required(),
});

// Main System Configuration Schema
export const systemConfigSchema = Joi.object({
  server: serverConfigSchema.required(),
  database: databaseConfigSchema.required(),
  trading: tradingConfigSchema.required(),
  risk: riskLimitsSchema.required(),
  marketData: marketDataConfigSchema.required(),
  llm: llmConfigSchema.required(),
  logging: loggingConfigSchema.required(),
  scheduler: schedulerConfigSchema.required(),
});

// Validation function
export function validateSystemConfig(config: unknown): { 
  valid: boolean; 
  value?: SystemConfig; 
  error?: string; 
} {
  const { error, value } = systemConfigSchema.validate(config, {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true,
  });

  if (error) {
    return {
      valid: false,
      error: error.details.map(detail => detail.message).join('; '),
    };
  }

  return {
    valid: true,
    value: value as SystemConfig,
  };
}