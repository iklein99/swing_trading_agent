/**
 * Property-based tests for configuration validation
 * **Feature: swing-trading-agent, Property 10: Configuration validation**
 */

import * as fc from 'fast-check';
import { validateSystemConfig } from '../validation/config-schema';

describe('Configuration Validation Property Tests', () => {
  /**
   * **Feature: swing-trading-agent, Property 10: Configuration validation**
   * **Validates: Requirements 7.5**
   * 
   * Property: For any system initialization or configuration update, 
   * all parameters should be validated and invalid settings should be 
   * reported without causing system failure
   */
  it('should validate all configuration parameters without system failure', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary configuration objects
        fc.record({
          server: fc.record({
            port: fc.integer(),
            host: fc.string(),
            environment: fc.oneof(
              fc.constant('development'),
              fc.constant('staging'), 
              fc.constant('production'),
              fc.string() // Invalid environment values
            ),
            cors: fc.record({
              origin: fc.array(fc.string()),
              credentials: fc.boolean(),
            }),
            rateLimit: fc.record({
              windowMs: fc.integer(),
              max: fc.integer(),
            }),
          }),
          database: fc.record({
            type: fc.oneof(
              fc.constant('sqlite'),
              fc.constant('postgresql'),
              fc.constant('mysql'),
              fc.string() // Invalid database types
            ),
            path: fc.option(fc.string()),
            host: fc.option(fc.string()),
            port: fc.option(fc.integer()),
            database: fc.option(fc.string()),
            username: fc.option(fc.string()),
            password: fc.option(fc.string()),
            ssl: fc.option(fc.boolean()),
            pool: fc.record({
              min: fc.integer(),
              max: fc.integer(),
            }),
            migrations: fc.record({
              directory: fc.string(),
              autoRun: fc.boolean(),
            }),
          }),
          trading: fc.record({
            initialPortfolioValue: fc.float(),
            paperTrading: fc.boolean(),
            brokerConfig: fc.option(fc.record({
              name: fc.string(),
              apiKey: fc.string(),
              apiSecret: fc.string(),
              baseUrl: fc.string(),
              sandbox: fc.boolean(),
            })),
            tradingHours: fc.record({
              start: fc.string(),
              end: fc.string(),
              timezone: fc.string(),
            }),
            executionDelay: fc.integer(),
            maxConcurrentTrades: fc.integer(),
          }),
          risk: fc.record({
            maxPositionPercentage: fc.float(),
            maxDailyLossPercentage: fc.float(),
            maxDrawdownPercentage: fc.float(),
            maxSectorConcentration: fc.float(),
            maxOpenPositions: fc.integer(),
            maxRiskPerTrade: fc.float(),
            maxCorrelatedPositions: fc.integer(),
          }),
          marketData: fc.record({
            provider: fc.record({
              name: fc.string(),
              baseUrl: fc.string(),
              apiKey: fc.option(fc.string()),
              rateLimit: fc.record({
                requestsPerMinute: fc.integer(),
                requestsPerHour: fc.integer(),
                requestsPerDay: fc.integer(),
              }),
              endpoints: fc.record({
                quote: fc.string(),
                historical: fc.string(),
                technical: fc.string(),
                screening: fc.string(),
              }),
            }),
            backup: fc.option(fc.record({
              name: fc.string(),
              baseUrl: fc.string(),
              apiKey: fc.option(fc.string()),
              rateLimit: fc.record({
                requestsPerMinute: fc.integer(),
                requestsPerHour: fc.integer(),
                requestsPerDay: fc.integer(),
              }),
              endpoints: fc.record({
                quote: fc.string(),
                historical: fc.string(),
                technical: fc.string(),
                screening: fc.string(),
              }),
            })),
            caching: fc.record({
              enabled: fc.boolean(),
              ttl: fc.integer(),
              maxSize: fc.integer(),
            }),
            retries: fc.record({
              maxAttempts: fc.integer(),
              backoffMs: fc.integer(),
            }),
          }),
          llm: fc.record({
            provider: fc.oneof(
              fc.constant('aws-bedrock'),
              fc.constant('openai'),
              fc.constant('anthropic'),
              fc.constant('ollama'),
              fc.string() // Invalid provider values
            ),
            model: fc.string(),
            region: fc.option(fc.string()),
            apiKey: fc.option(fc.string()),
            baseUrl: fc.option(fc.string()),
            maxTokens: fc.integer(),
            temperature: fc.float(),
            timeout: fc.integer(),
            retries: fc.record({
              maxAttempts: fc.integer(),
              backoffMs: fc.integer(),
            }),
            rateLimits: fc.record({
              requestsPerMinute: fc.integer(),
              tokensPerMinute: fc.integer(),
            }),
          }),
          logging: fc.record({
            level: fc.oneof(
              fc.constant('debug'),
              fc.constant('info'),
              fc.constant('warn'),
              fc.constant('error'),
              fc.string() // Invalid log levels
            ),
            console: fc.boolean(),
            file: fc.record({
              enabled: fc.boolean(),
              path: fc.string(),
              maxSize: fc.string(),
              maxFiles: fc.integer(),
            }),
            database: fc.record({
              enabled: fc.boolean(),
              retention: fc.integer(),
            }),
          }),
          scheduler: fc.record({
            enabled: fc.boolean(),
            tradingCycleInterval: fc.integer(),
            marketDataUpdateInterval: fc.integer(),
            portfolioUpdateInterval: fc.integer(),
            riskCheckInterval: fc.integer(),
            logCleanupInterval: fc.integer(),
          }),
        }),
        (config) => {
          // The property: validation should never cause system failure
          let result: ReturnType<typeof validateSystemConfig> | undefined;
          let threwException = false;
          
          try {
            result = validateSystemConfig(config);
          } catch (error) {
            threwException = true;
          }
          
          // Property 1: Validation should never throw exceptions (no system failure)
          expect(threwException).toBe(false);
          
          // Property 2: Result should always have a valid boolean field
          expect(result).toBeDefined();
          if (result) {
            expect(typeof result.valid).toBe('boolean');
            
            // Property 3: If invalid, should provide error message
            if (!result.valid) {
              expect(result.error).toBeDefined();
              expect(typeof result.error).toBe('string');
              expect(result.error!.length).toBeGreaterThan(0);
            }
            
            // Property 4: If valid, should provide parsed value
            if (result.valid) {
              expect(result.value).toBeDefined();
              expect(typeof result.value).toBe('object');
            }
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });

  /**
   * Test that valid configurations are properly accepted
   */
  it('should accept valid configuration objects', () => {
    const validConfig = {
      server: {
        port: 3000,
        host: 'localhost',
        environment: 'development' as const,
        cors: {
          origin: ['http://localhost:3000'],
          credentials: true,
        },
        rateLimit: {
          windowMs: 15000,
          max: 100,
        },
      },
      database: {
        type: 'sqlite' as const,
        path: './data/trading.db',
        pool: {
          min: 0,
          max: 10,
        },
        migrations: {
          directory: './migrations',
          autoRun: true,
        },
      },
      trading: {
        initialPortfolioValue: 100000,
        paperTrading: true,
        tradingHours: {
          start: '09:30',
          end: '16:00',
          timezone: 'America/New_York',
        },
        executionDelay: 1000,
        maxConcurrentTrades: 5,
      },
      risk: {
        maxPositionPercentage: 10,
        maxDailyLossPercentage: 3,
        maxDrawdownPercentage: 8,
        maxSectorConcentration: 30,
        maxOpenPositions: 10,
        maxRiskPerTrade: 2,
        maxCorrelatedPositions: 3,
      },
      marketData: {
        provider: {
          name: 'massive',
          baseUrl: 'https://api.massive.com',
          apiKey: 'test-key',
          rateLimit: {
            requestsPerMinute: 60,
            requestsPerHour: 1000,
            requestsPerDay: 10000,
          },
          endpoints: {
            quote: '/quote',
            historical: '/historical',
            technical: '/technical',
            screening: '/screening',
          },
        },
        caching: {
          enabled: true,
          ttl: 300,
          maxSize: 1000,
        },
        retries: {
          maxAttempts: 3,
          backoffMs: 1000,
        },
      },
      llm: {
        provider: 'openai' as const,
        model: 'gpt-4',
        apiKey: 'test-api-key',
        maxTokens: 4000,
        temperature: 0.7,
        timeout: 30000,
        retries: {
          maxAttempts: 3,
          backoffMs: 1000,
        },
        rateLimits: {
          requestsPerMinute: 60,
          tokensPerMinute: 10000,
        },
      },
      logging: {
        level: 'info' as const,
        console: true,
        file: {
          enabled: true,
          path: './logs/trading.log',
          maxSize: '10MB',
          maxFiles: 5,
        },
        database: {
          enabled: true,
          retention: 30,
        },
      },
      scheduler: {
        enabled: true,
        tradingCycleInterval: 5,
        marketDataUpdateInterval: 1,
        portfolioUpdateInterval: 5,
        riskCheckInterval: 1,
        logCleanupInterval: 24,
      },
    };

    const result = validateSystemConfig(validConfig);
    expect(result.valid).toBe(true);
    expect(result.value).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  /**
   * Test that invalid configurations are properly rejected
   */
  it('should reject invalid configuration objects with proper error messages', () => {
    fc.assert(
      fc.property(
        // Generate invalid configuration objects
        fc.oneof(
          // Invalid port numbers
          fc.record({
            server: fc.record({
              port: fc.oneof(fc.integer({ max: 0 }), fc.integer({ min: 65536 })),
              host: fc.string({ minLength: 1 }),
              environment: fc.constant('development'),
              cors: fc.record({
                origin: fc.array(fc.string({ minLength: 1 })),
                credentials: fc.boolean(),
              }),
              rateLimit: fc.record({
                windowMs: fc.integer({ min: 1000 }),
                max: fc.integer({ min: 1 }),
              }),
            }),
          }),
          // Invalid environment
          fc.record({
            server: fc.record({
              port: fc.integer({ min: 1, max: 65535 }),
              host: fc.string({ minLength: 1 }),
              environment: fc.string().filter(s => !['development', 'staging', 'production'].includes(s)),
              cors: fc.record({
                origin: fc.array(fc.string({ minLength: 1 })),
                credentials: fc.boolean(),
              }),
              rateLimit: fc.record({
                windowMs: fc.integer({ min: 1000 }),
                max: fc.integer({ min: 1 }),
              }),
            }),
          }),
          // Invalid portfolio value
          fc.record({
            trading: fc.record({
              initialPortfolioValue: fc.float({ max: Math.fround(999) }), // Below minimum
              paperTrading: fc.boolean(),
              tradingHours: fc.record({
                start: fc.constant('09:30'),
                end: fc.constant('16:00'),
                timezone: fc.constant('America/New_York'),
              }),
              executionDelay: fc.integer({ min: 0 }),
              maxConcurrentTrades: fc.integer({ min: 1, max: 20 }),
            }),
          })
        ),
        (invalidConfig) => {
          const result = validateSystemConfig(invalidConfig);
          
          // Invalid configurations should be rejected
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
          expect(result.error!.length).toBeGreaterThan(0);
          expect(result.value).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});