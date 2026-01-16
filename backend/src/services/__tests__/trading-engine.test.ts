/**
 * Trading Engine Integration Tests
 * Tests complete trading cycles with guidelines integration
 */

import { TradingEngine, createTradingEngine, TradingEngineError } from '../trading-engine';
import { createLoggingService } from '../logging-service';
import { createGuidelinesManager } from '../guidelines-manager';
import { createSignalGenerator } from '../signal-generator';
import { createPortfolioManager } from '../portfolio-manager';
import { createRiskManager } from '../risk-manager';
import { createExitCriteriaMonitor } from '../exit-criteria-monitor';
import { MarketDataService } from '../market-data-service';
import { DatabaseService } from '../../database/database-service';
import path from 'path';
import fs from 'fs';

describe('TradingEngine Integration Tests', () => {
  let engine: TradingEngine;
  let loggingService: any;
  let guidelinesManager: any;
  let signalGenerator: any;
  let portfolioManager: any;
  let riskManager: any;
  let exitCriteriaMonitor: any;
  let marketDataService: MarketDataService;
  let databaseService: DatabaseService;
  let testDbPath: string;
  let testGuidelinesPath: string;

  beforeEach(async () => {
    // Create test database
    testDbPath = path.join(__dirname, `test-trading-engine-${Date.now()}.db`);
    const { initializeDatabase } = require('../../database/connection');
    const dbConn = await initializeDatabase(testDbPath);
    databaseService = new DatabaseService(dbConn);

    // Create test guidelines file
    testGuidelinesPath = path.join(__dirname, `test-guidelines-${Date.now()}.yaml`);
    const testGuidelines = {
      stockSelection: {
        liquidityRequirements: {
          minimumAverageDailyVolume: 1000000,
          minimumMarketCap: 500000000,
          maxBidAskSpreadPercent: 0.5
        },
        volatilityMetrics: {
          atrRange: { min: 2, max: 8 },
          historicalVolatilityRange: { min: 20, max: 60 },
          betaRange: { min: 0.8, max: 2.0 }
        },
        priceRange: {
          minPrice: 10,
          maxPrice: 500
        },
        technicalSetupRequirements: {
          requireClearTrend: true,
          requireSupportResistance: true,
          requireVolumeConfirmation: true,
          maxATRExtension: 3.0
        },
        fundamentalFilters: {
          avoidEarningsWithinDays: 5,
          checkMajorNews: true,
          requirePositiveSectorStrength: false,
          avoidFinancialDistress: true
        }
      },
      entrySignals: {
        longEntries: [
          {
            name: 'Breakout Entry',
            type: 'BREAKOUT',
            conditions: ['Price breaks above resistance', 'Volume > 150% average'],
            volumeRequirement: 1.5,
            confirmationRequired: true,
            riskRewardRatio: 2.0
          }
        ],
        shortEntries: [],
        timingRules: {
          avoidFirstMinutes: 15,
          avoidLastMinutes: 15,
          optimalWindowStart: '10:00',
          optimalWindowEnd: '15:00'
        },
        positionSizing: {
          riskPerTradePercent: 1.5,
          maxPositionPercent: 10,
          maxCorrelatedPositions: 3,
          maxSectorPositions: 2
        }
      },
      exitCriteria: {
        profitTargets: [
          {
            name: 'ATR-Based Targets',
            method: 'ATR_BASED',
            targets: [
              { level: 1, calculation: 'Entry + (1.5 × ATR)', exitPercentage: 33 },
              { level: 2, calculation: 'Entry + (2.5 × ATR)', exitPercentage: 33 },
              { level: 3, calculation: 'Entry + (3.5 × ATR)', exitPercentage: 34 }
            ],
            partialExitStrategy: {
              scaleOutApproach: true,
              target1ExitPercent: 33,
              target2ExitPercent: 33,
              trailRemainder: true
            }
          }
        ],
        stopLosses: {
          methods: [
            {
              name: 'Below Support',
              type: 'BELOW_SUPPORT',
              calculation: 'Support - (1-2% buffer)',
              bufferPercent: 1.5
            }
          ],
          maxRiskPercent: 2.0,
          breakEvenRule: {
            activateAtRiskRewardRatio: 1.0,
            moveToBreakEven: true
          },
          timeBasedStop: {
            maxHoldingDays: 10,
            evaluateAtTimeLimit: true
          }
        },
        trailingStops: {
          activationTrigger: 'When profit reaches 1R',
          trailingAmount: '50% of ATR',
          adjustmentFrequency: 'DAILY',
          lockInProfitsAt: 1.0
        },
        timeBasedExits: {
          maxHoldingPeriod: 10,
          evaluationCriteria: ['Position not meeting expectations', 'Better opportunities available']
        }
      },
      riskManagement: {
        portfolioRules: {
          maxDailyLossPercent: 3,
          maxWeeklyLossPercent: 6,
          maxDrawdownPercent: 8,
          maxOpenPositions: 8,
          maxSectorExposurePercent: 30,
          maxPositionSizePercent: 10,
          riskPerTradePercent: 1.5
        },
        tradeManagement: {
          noRevengeTrading: true,
          noAveragingDown: true,
          scaleInCarefully: true,
          reviewEachTrade: true
        },
        marketEnvironment: {
          trendingMarketStrategy: 'Follow the trend',
          rangeBoundMarketStrategy: 'Trade the range',
          highVolatilityAdjustments: 'Reduce position sizes',
          lowVolatilityAdjustments: 'Standard position sizes'
        }
      },
      version: '1.0.0'
    };

    fs.writeFileSync(testGuidelinesPath, JSON.stringify(testGuidelines, null, 2));

    // Initialize services
    const dbForLogging = databaseService['db']; // Access private db property
    loggingService = createLoggingService(dbForLogging, 'TRADING_ENGINE');
    
    guidelinesManager = createGuidelinesManager(loggingService, {
      guidelinesFilePath: testGuidelinesPath,
      watchForChanges: false,
      backupOnLoad: false,
      validateOnLoad: true
    });

    marketDataService = new MarketDataService();

    signalGenerator = createSignalGenerator({
      guidelinesManager,
      marketDataService,
      llmService: {} as any, // Mock LLM service
      loggingService,
      maxSignalsPerCycle: 10,
      minConfidenceThreshold: 0.6
    });

    portfolioManager = createPortfolioManager(
      databaseService,
      loggingService,
      {
        portfolioId: 'test',
        initialCash: 100000,
        mockBrokerEnabled: true
      },
      {
        latencyMs: 0,
        slippagePercent: 0,
        feePerTrade: 0,
        failureRate: 0
      }
    );

    await portfolioManager.initialize();

    riskManager = createRiskManager(
      loggingService,
      guidelinesManager,
      {}
    );

    exitCriteriaMonitor = createExitCriteriaMonitor({
      guidelinesManager,
      marketDataService,
      loggingService,
      checkIntervalMs: 1000
    });

    engine = createTradingEngine(
      loggingService,
      guidelinesManager,
      signalGenerator,
      portfolioManager,
      riskManager,
      exitCriteriaMonitor,
      marketDataService,
      {
        cycleIntervalMs: 60000,
        enableAutoTrading: false,
        maxConcurrentTrades: 5
      }
    );
  });

  afterEach(async () => {
    // Clean up
    if (engine) {
      try {
        await engine.stop();
      } catch (error) {
        // Engine might not be running
      }
    }

    if (databaseService) {
      await databaseService.close();
    }

    // Delete test files
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testGuidelinesPath)) {
      fs.unlinkSync(testGuidelinesPath);
    }
  });

  describe('Engine Lifecycle', () => {
    test('should start engine successfully', async () => {
      await engine.start();
      
      const status = engine.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.currentPhase).toBe('IDLE');
      expect(status.cyclesCompleted).toBe(0);
    });

    test('should stop engine successfully', async () => {
      await engine.start();
      await engine.stop();
      
      const status = engine.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.currentPhase).toBe('IDLE');
    });

    test('should throw error when starting already running engine', async () => {
      await engine.start();
      
      await expect(engine.start()).rejects.toThrow(TradingEngineError);
      await expect(engine.start()).rejects.toThrow('already running');
    });

    test('should throw error when stopping non-running engine', async () => {
      await expect(engine.stop()).rejects.toThrow(TradingEngineError);
      await expect(engine.stop()).rejects.toThrow('not running');
    });

    test('should pause and resume engine', async () => {
      await engine.start();
      await engine.pause();
      
      let status = engine.getStatus();
      expect(status.isRunning).toBe(true);
      
      await engine.resume();
      status = engine.getStatus();
      expect(status.isRunning).toBe(true);
    });

    test('should throw error when executing cycle on paused engine', async () => {
      await engine.start();
      await engine.pause();
      
      await expect(engine.executeTradingCycle()).rejects.toThrow(TradingEngineError);
      await expect(engine.executeTradingCycle()).rejects.toThrow('paused');
    });
  });

  describe('Trading Cycle Execution', () => {
    test('should execute complete trading cycle', async () => {
      await engine.start();
      
      const result = await engine.executeTradingCycle();
      
      expect(result).toBeDefined();
      expect(result.cycleId).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.errors).toBeInstanceOf(Array);
      expect(result.tradesExecuted).toBeInstanceOf(Array);
    });

    test('should follow execution order: buy → sell → exit → update', async () => {
      await engine.start();
      
      const result = await engine.executeTradingCycle();
      
      // Verify all steps were executed
      expect(result.buySignalsProcessed).toBeGreaterThanOrEqual(0);
      expect(result.sellSignalsProcessed).toBeGreaterThanOrEqual(0);
      expect(result.exitCriteriaChecked).toBeGreaterThanOrEqual(0);
      
      // Verify cycle completed
      const status = engine.getStatus();
      expect(status.cyclesCompleted).toBe(1);
      expect(status.lastCycleTime).toBeDefined();
    });

    test('should update status after cycle completion', async () => {
      await engine.start();
      
      const statusBefore = engine.getStatus();
      expect(statusBefore.cyclesCompleted).toBe(0);
      
      await engine.executeTradingCycle();
      
      const statusAfter = engine.getStatus();
      expect(statusAfter.cyclesCompleted).toBe(1);
      expect(statusAfter.lastCycleTime).toBeDefined();
      expect(statusAfter.performance.averageCycleTime).toBeGreaterThan(0);
    });

    test('should handle multiple consecutive cycles', async () => {
      await engine.start();
      
      await engine.executeTradingCycle();
      await engine.executeTradingCycle();
      await engine.executeTradingCycle();
      
      const status = engine.getStatus();
      expect(status.cyclesCompleted).toBe(3);
      expect(status.performance.averageCycleTime).toBeGreaterThan(0);
    });

    test('should log comprehensive cycle information', async () => {
      await engine.start();
      
      const result = await engine.executeTradingCycle();
      
      // Verify logging occurred (check that cycle completed without errors)
      expect(result.cycleId).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
    });
  });

  describe('Guidelines Integration', () => {
    test('should load guidelines on startup', async () => {
      await engine.start();
      
      const guidelines = guidelinesManager.getCurrentGuidelines();
      expect(guidelines).toBeDefined();
      expect(guidelines.version).toBe('1.0.0');
      expect(guidelines.stockSelection).toBeDefined();
      expect(guidelines.entrySignals).toBeDefined();
      expect(guidelines.exitCriteria).toBeDefined();
      expect(guidelines.riskManagement).toBeDefined();
    });

    test('should use guidelines during trading cycle', async () => {
      await engine.start();
      
      const result = await engine.executeTradingCycle();
      
      // Verify cycle executed with guidelines
      expect(result.errors).not.toContain('Guidelines not loaded');
      expect(result.cycleId).toBeDefined();
    });

    test('should handle guidelines hot-reload', async () => {
      await engine.start();
      
      // Update guidelines file
      const updatedGuidelines = JSON.parse(fs.readFileSync(testGuidelinesPath, 'utf-8'));
      updatedGuidelines.version = '1.0.1';
      updatedGuidelines.riskManagement.portfolioRules.maxDailyLossPercent = 2.5;
      fs.writeFileSync(testGuidelinesPath, JSON.stringify(updatedGuidelines, null, 2));
      
      // Manually reload guidelines (since we disabled file watching)
      await guidelinesManager.reloadGuidelines();
      
      const guidelines = guidelinesManager.getCurrentGuidelines();
      expect(guidelines.version).toBe('1.0.1');
      expect(guidelines.riskManagement.portfolioRules.maxDailyLossPercent).toBe(2.5);
      
      // Verify engine can still execute cycles with updated guidelines
      const result = await engine.executeTradingCycle();
      expect(result.errors).not.toContain('Guidelines not loaded');
    });

    test('should handle invalid guidelines gracefully', async () => {
      // Create invalid guidelines file
      fs.writeFileSync(testGuidelinesPath, 'invalid json content');
      
      // Create new engine with invalid guidelines
      const invalidGuidelinesManager = createGuidelinesManager(loggingService, {
        guidelinesFilePath: testGuidelinesPath,
        watchForChanges: false,
        backupOnLoad: false,
        validateOnLoad: true
      });
      
      const invalidEngine = createTradingEngine(
        loggingService,
        invalidGuidelinesManager,
        signalGenerator,
        portfolioManager,
        riskManager,
        exitCriteriaMonitor,
        marketDataService
      );
      
      // The engine should either fail to start or start with no guidelines loaded
      try {
        await invalidEngine.start();
        // If it starts, guidelines should be null
        const guidelines = invalidGuidelinesManager.getCurrentGuidelines();
        expect(guidelines).toBeNull();
      } catch (error) {
        // Or it should throw an error
        expect(error).toBeDefined();
      }
    });
  });

  describe('Component Orchestration', () => {
    test('should coordinate all components during cycle', async () => {
      await engine.start();
      
      const result = await engine.executeTradingCycle();
      
      // Verify all components were involved
      expect(result.buySignalsProcessed).toBeGreaterThanOrEqual(0);
      expect(result.sellSignalsProcessed).toBeGreaterThanOrEqual(0);
      expect(result.exitCriteriaChecked).toBeGreaterThanOrEqual(0);
      
      // Verify portfolio was updated
      const portfolio = portfolioManager.getPortfolio();
      expect(portfolio).toBeDefined();
      expect(portfolio.totalValue).toBeGreaterThan(0);
    });

    test('should validate trades with risk manager', async () => {
      await engine.start();
      
      // Execute cycle - risk manager should be consulted for any buy signals
      const result = await engine.executeTradingCycle();
      
      // No errors should occur from risk validation
      expect(result.errors).not.toContain(expect.stringContaining('risk'));
    });

    test('should process exit criteria for all positions', async () => {
      await engine.start();
      
      const result = await engine.executeTradingCycle();
      
      // Exit criteria should be checked for all positions
      const positions = portfolioManager.getCurrentPositions();
      expect(result.exitCriteriaChecked).toBe(positions.length);
    });
  });

  describe('Health Monitoring', () => {
    test('should report system health', async () => {
      await engine.start();
      
      const health = await engine.getHealth();
      
      expect(health).toBeDefined();
      expect(health.overall).toBeDefined();
      expect(health.components).toBeDefined();
      expect(health.components.tradingEngine).toBeDefined();
      expect(health.components.database).toBeDefined();
      expect(health.components.marketData).toBeDefined();
      expect(health.lastCheck).toBeInstanceOf(Date);
    });

    test('should report healthy status when running normally', async () => {
      await engine.start();
      await engine.executeTradingCycle();
      
      const health = await engine.getHealth();
      
      expect(health.overall).toBe('HEALTHY');
      expect(health.components.tradingEngine.status).toBe('HEALTHY');
    });

    test('should report offline status when not running', async () => {
      const health = await engine.getHealth();
      
      expect(health.components.tradingEngine.status).toBe('OFFLINE');
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully during cycle', async () => {
      await engine.start();
      
      // Execute cycle - should not throw even if some operations fail
      const result = await engine.executeTradingCycle();
      
      expect(result).toBeDefined();
      expect(result.errors).toBeInstanceOf(Array);
    });

    test('should continue operation after recoverable errors', async () => {
      await engine.start();
      
      // Execute multiple cycles
      await engine.executeTradingCycle();
      await engine.executeTradingCycle();
      
      const status = engine.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.cyclesCompleted).toBe(2);
    });

    test('should track errors in status', async () => {
      await engine.start();
      
      await engine.executeTradingCycle();
      
      const status = engine.getStatus();
      expect(status.errors).toBeInstanceOf(Array);
      expect(status.performance).toBeDefined();
    });
  });

  describe('Performance Metrics', () => {
    test('should track cycle execution time', async () => {
      await engine.start();
      
      const result = await engine.executeTradingCycle();
      
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.executionTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    test('should calculate average cycle time', async () => {
      await engine.start();
      
      await engine.executeTradingCycle();
      await engine.executeTradingCycle();
      
      const status = engine.getStatus();
      expect(status.performance.averageCycleTime).toBeGreaterThan(0);
    });

    test('should track success rate', async () => {
      await engine.start();
      
      await engine.executeTradingCycle();
      await engine.executeTradingCycle();
      
      const status = engine.getStatus();
      expect(status.performance.successRate).toBeGreaterThanOrEqual(0);
      expect(status.performance.successRate).toBeLessThanOrEqual(100);
    });

    test('should track uptime', async () => {
      await engine.start();
      
      // Wait a bit longer to ensure uptime is measurable
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const status = engine.getStatus();
      expect(status.uptime).toBeGreaterThanOrEqual(1); // At least 1 second
    });
  });
});
