/**
 * Tests for REST API Server
 * Tests all API endpoints including guidelines management
 */

import request from 'supertest';
import { Express } from 'express';
import { ApiServer, createApiServer } from '../server';
import { TradingEngine } from '../../services/trading-engine';
import { PortfolioManager } from '../../services/portfolio-manager';
import { GuidelinesManager } from '../../services/guidelines-manager';
import { LoggingService } from '../../services/logging-service';
import { DatabaseConnection } from '../../database/connection';
import { EngineStatus, SystemHealth } from '../../../../shared/src/types/config';
import { Portfolio } from '../../../../shared/src/types/portfolio';
import { TradingGuidelines, GuidelinesValidationResult } from '../../../../shared/src/types/guidelines';

// Mock dependencies
jest.mock('../../services/trading-engine');
jest.mock('../../services/portfolio-manager');
jest.mock('../../services/guidelines-manager');
jest.mock('../../services/logging-service');

describe('ApiServer', () => {
  let app: Express;
  let apiServer: ApiServer;
  let mockTradingEngine: jest.Mocked<TradingEngine>;
  let mockPortfolioManager: jest.Mocked<PortfolioManager>;
  let mockGuidelinesManager: jest.Mocked<GuidelinesManager>;
  let mockLogger: jest.Mocked<LoggingService>;

  beforeEach(() => {
    // Create mock instances
    const mockDb = {} as DatabaseConnection;
    mockLogger = new LoggingService(mockDb, 'API_SERVER') as jest.Mocked<LoggingService>;
    mockTradingEngine = new TradingEngine(
      mockLogger,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    ) as jest.Mocked<TradingEngine>;
    mockPortfolioManager = new PortfolioManager(
      {} as any,
      mockLogger
    ) as jest.Mocked<PortfolioManager>;
    mockGuidelinesManager = new GuidelinesManager(
      mockLogger,
      { 
        guidelinesFilePath: 'test.yaml',
        watchForChanges: false,
        backupOnLoad: false,
        validateOnLoad: true
      }
    ) as jest.Mocked<GuidelinesManager>;

    // Setup mock implementations
    mockLogger.debug = jest.fn();
    mockLogger.info = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.query = jest.fn().mockResolvedValue([]);
    mockLogger.getSummary = jest.fn().mockResolvedValue({
      totalLogs: 0,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      debugCount: 0,
      componentBreakdown: {},
      timeRange: { start: new Date(), end: new Date() },
      topErrors: []
    });
    mockLogger.getLLMInteractions = jest.fn().mockResolvedValue([]);
    mockLogger.getTradingCycleLogs = jest.fn().mockResolvedValue([]);

    // Create API server
    apiServer = createApiServer(
      { port: 3001, corsOrigins: ['http://localhost:3000'] },
      mockLogger,
      mockTradingEngine,
      mockPortfolioManager,
      mockGuidelinesManager
    );

    app = apiServer.getApp();
  });

  describe('Health Check', () => {
    it('should return ok status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('System Status Endpoints', () => {
    it('GET /api/status should return engine status', async () => {
      const mockStatus: EngineStatus = {
        isRunning: true,
        currentPhase: 'IDLE',
        uptime: 3600,
        cyclesCompleted: 10,
        errors: [],
        performance: {
          averageCycleTime: 1500,
          successRate: 100
        }
      };

      mockTradingEngine.getStatus = jest.fn().mockReturnValue(mockStatus);

      const response = await request(app).get('/api/status');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStatus);
      expect(mockTradingEngine.getStatus).toHaveBeenCalled();
    });

    it('GET /api/health should return system health', async () => {
      const mockHealth: SystemHealth = {
        overall: 'HEALTHY',
        components: {
          tradingEngine: { status: 'HEALTHY', message: 'OK', lastCheck: new Date() },
          database: { status: 'HEALTHY', message: 'OK', lastCheck: new Date() },
          marketData: { status: 'HEALTHY', message: 'OK', lastCheck: new Date() },
          llmService: { status: 'HEALTHY', message: 'OK', lastCheck: new Date() },
          riskManager: { status: 'HEALTHY', message: 'OK', lastCheck: new Date() }
        },
        lastCheck: new Date()
      };

      mockTradingEngine.getHealth = jest.fn().mockResolvedValue(mockHealth);

      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body.overall).toBe('HEALTHY');
      expect(mockTradingEngine.getHealth).toHaveBeenCalled();
    });
  });

  describe('Portfolio Endpoints', () => {
    it('GET /api/portfolio should return portfolio data', async () => {
      const mockPortfolio: Portfolio = {
        id: 'test-portfolio',
        totalValue: 100000,
        cashBalance: 50000,
        positions: [],
        dailyPnL: 500,
        totalPnL: 5000,
        lastUpdated: new Date(),
        createdAt: new Date()
      };

      mockPortfolioManager.getPortfolio = jest.fn().mockReturnValue(mockPortfolio);

      const response = await request(app).get('/api/portfolio');
      
      expect(response.status).toBe(200);
      expect(response.body.totalValue).toBe(100000);
      expect(mockPortfolioManager.getPortfolio).toHaveBeenCalled();
    });

    it('GET /api/portfolio/positions should return current positions', async () => {
      const mockPositions = [
        {
          id: 'pos-1',
          symbol: 'AAPL',
          quantity: 100,
          entryPrice: 150,
          currentPrice: 155,
          entryDate: new Date(),
          stopLoss: 145,
          profitTargets: [160, 165],
          unrealizedPnL: 500,
          realizedPnL: 0,
          exitCriteria: [],
          lastUpdated: new Date()
        }
      ];

      mockPortfolioManager.getCurrentPositions = jest.fn().mockReturnValue(mockPositions);

      const response = await request(app).get('/api/portfolio/positions');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]?.symbol).toBe('AAPL');
      expect(mockPortfolioManager.getCurrentPositions).toHaveBeenCalled();
    });

    it('GET /api/portfolio/metrics should return portfolio metrics', async () => {
      const mockMetrics = {
        totalValue: 100000,
        totalPnL: 5000,
        dailyPnL: 500,
        weeklyPnL: 2000,
        monthlyPnL: 5000,
        positionCount: 3,
        cashPercentage: 50,
        largestPosition: { symbol: 'AAPL', percentage: 15 },
        sectorExposure: { Technology: 30, Healthcare: 20 },
        lastUpdated: new Date()
      };

      mockPortfolioManager.updatePortfolioMetrics = jest.fn().mockResolvedValue(mockMetrics);

      const response = await request(app).get('/api/portfolio/metrics');
      
      expect(response.status).toBe(200);
      expect(response.body.totalValue).toBe(100000);
      expect(mockPortfolioManager.updatePortfolioMetrics).toHaveBeenCalled();
    });

    it('GET /api/portfolio/performance should return performance stats', async () => {
      const mockStats = {
        totalTrades: 50,
        winningTrades: 30,
        losingTrades: 20,
        winRate: 60,
        averageWin: 500,
        averageLoss: 300,
        profitFactor: 1.67,
        maxDrawdown: 5,
        currentDrawdown: 2,
        sharpeRatio: 1.5,
        sortino: 2.0,
        calmarRatio: 3.0,
        maxConsecutiveWins: 5,
        maxConsecutiveLosses: 3,
        averageHoldingPeriod: 3,
        totalFees: 500,
        netProfit: 5000,
        grossProfit: 15000,
        grossLoss: 10000,
        lastUpdated: new Date()
      };

      mockPortfolioManager.getPerformanceStats = jest.fn().mockResolvedValue(mockStats);

      const response = await request(app).get('/api/portfolio/performance');
      
      expect(response.status).toBe(200);
      expect(response.body.winRate).toBe(60);
      expect(mockPortfolioManager.getPerformanceStats).toHaveBeenCalled();
    });
  });

  describe('Trade History Endpoints', () => {
    it('GET /api/trades should return trade history', async () => {
      const response = await request(app).get('/api/trades');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('trades');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('limit');
    });

    it('GET /api/trades with filters should apply filters', async () => {
      const response = await request(app)
        .get('/api/trades')
        .query({ symbol: 'AAPL', action: 'BUY', limit: 50 });
      
      expect(response.status).toBe(200);
      expect(response.body.filters).toEqual({ symbol: 'AAPL', action: 'BUY' });
      expect(response.body.limit).toBe(50);
    });

    it('GET /api/trades/:id should return 404 for non-existent trade', async () => {
      const response = await request(app).get('/api/trades/non-existent-id');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Log Viewing Endpoints', () => {
    it('GET /api/logs should return logs', async () => {
      const response = await request(app).get('/api/logs');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('logs');
      expect(response.body).toHaveProperty('total');
      expect(mockLogger.query).toHaveBeenCalled();
    });

    it('GET /api/logs with filters should apply filters', async () => {
      const response = await request(app)
        .get('/api/logs')
        .query({ 
          level: 'ERROR',
          component: 'TRADING_ENGINE',
          limit: 50
        });
      
      expect(response.status).toBe(200);
      expect(mockLogger.query).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'ERROR',
          component: 'TRADING_ENGINE',
          limit: 50
        })
      );
    });

    it('GET /api/logs/summary should return log summary', async () => {
      const response = await request(app).get('/api/logs/summary');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalLogs');
      expect(response.body).toHaveProperty('errorCount');
      expect(mockLogger.getSummary).toHaveBeenCalled();
    });

    it('GET /api/logs/llm should return LLM interactions', async () => {
      const response = await request(app).get('/api/logs/llm');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('interactions');
      expect(mockLogger.getLLMInteractions).toHaveBeenCalled();
    });

    it('GET /api/logs/cycles should return trading cycle logs', async () => {
      const response = await request(app).get('/api/logs/cycles');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('cycles');
      expect(mockLogger.getTradingCycleLogs).toHaveBeenCalled();
    });
  });

  describe('Guidelines Management Endpoints', () => {
    const mockGuidelines: TradingGuidelines = {
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
          maxATRExtension: 3
        },
        fundamentalFilters: {
          avoidEarningsWithinDays: 5,
          checkMajorNews: true,
          requirePositiveSectorStrength: false,
          avoidFinancialDistress: true
        }
      },
      entrySignals: {
        longEntries: [],
        shortEntries: [],
        timingRules: {
          avoidFirstMinutes: 15,
          avoidLastMinutes: 15,
          optimalWindowStart: '10:00',
          optimalWindowEnd: '15:30'
        },
        positionSizing: {
          riskPerTradePercent: 2,
          maxPositionPercent: 10,
          maxCorrelatedPositions: 3,
          maxSectorPositions: 2
        }
      },
      exitCriteria: {
        profitTargets: [],
        stopLosses: {
          methods: [],
          maxRiskPercent: 2,
          breakEvenRule: {
            activateAtRiskRewardRatio: 1.5,
            moveToBreakEven: true
          },
          timeBasedStop: {
            maxHoldingDays: 10,
            evaluateAtTimeLimit: true
          }
        },
        trailingStops: {
          activationTrigger: '1R profit',
          trailingAmount: '0.5 ATR',
          adjustmentFrequency: 'DAILY',
          lockInProfitsAt: 1.5
        },
        timeBasedExits: {
          maxHoldingPeriod: 10,
          evaluationCriteria: ['No progress toward target', 'Weakening momentum']
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
          riskPerTradePercent: 2
        },
        tradeManagement: {
          noRevengeTrading: true,
          noAveragingDown: true,
          scaleInCarefully: true,
          reviewEachTrade: true
        },
        marketEnvironment: {
          trendingMarketStrategy: 'Follow trend with momentum',
          rangeBoundMarketStrategy: 'Trade support/resistance',
          highVolatilityAdjustments: 'Reduce position size',
          lowVolatilityAdjustments: 'Increase position size'
        }
      },
      lastUpdated: new Date(),
      version: '1.0.0',
      filePath: 'test.yaml'
    };

    it('GET /api/guidelines should return current guidelines', async () => {
      mockGuidelinesManager.getCurrentGuidelines = jest.fn().mockReturnValue(mockGuidelines);

      const response = await request(app).get('/api/guidelines');
      
      expect(response.status).toBe(200);
      expect(response.body.version).toBe('1.0.0');
      expect(mockGuidelinesManager.getCurrentGuidelines).toHaveBeenCalled();
    });

    it('GET /api/guidelines should return 404 when guidelines not loaded', async () => {
      mockGuidelinesManager.getCurrentGuidelines = jest.fn().mockReturnValue(null);

      const response = await request(app).get('/api/guidelines');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('POST /api/guidelines/reload should reload guidelines', async () => {
      mockGuidelinesManager.reloadGuidelines = jest.fn().mockResolvedValue(mockGuidelines);

      const response = await request(app).post('/api/guidelines/reload');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.guidelines.version).toBe('1.0.0');
      expect(mockGuidelinesManager.reloadGuidelines).toHaveBeenCalled();
    });

    it('POST /api/guidelines/reload should handle errors', async () => {
      mockGuidelinesManager.reloadGuidelines = jest.fn().mockRejectedValue(
        new Error('Failed to load file')
      );

      const response = await request(app).post('/api/guidelines/reload');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
    });

    it('POST /api/guidelines/validate should validate guidelines', async () => {
      const mockValidation: GuidelinesValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        missingRequiredSections: []
      };

      mockGuidelinesManager.getCurrentGuidelines = jest.fn().mockReturnValue(mockGuidelines);
      mockGuidelinesManager.validateGuidelines = jest.fn().mockReturnValue(mockValidation);

      const response = await request(app).post('/api/guidelines/validate');
      
      expect(response.status).toBe(200);
      expect(response.body.validation.isValid).toBe(true);
      expect(mockGuidelinesManager.validateGuidelines).toHaveBeenCalled();
    });

    it('POST /api/guidelines/validate should validate provided guidelines', async () => {
      const mockValidation: GuidelinesValidationResult = {
        isValid: false,
        errors: ['Missing required section: stockSelection'],
        warnings: [],
        missingRequiredSections: ['stockSelection']
      };

      mockGuidelinesManager.validateGuidelines = jest.fn().mockReturnValue(mockValidation);

      const response = await request(app)
        .post('/api/guidelines/validate')
        .send({ guidelines: { version: '1.0.0' } });
      
      expect(response.status).toBe(200);
      expect(response.body.validation.isValid).toBe(false);
      expect(response.body.validation.errors).toHaveLength(1);
    });

    it('GET /api/guidelines/status should return guidelines status', async () => {
      const mockValidation: GuidelinesValidationResult = {
        isValid: true,
        errors: [],
        warnings: ['No short entry signals defined'],
        missingRequiredSections: []
      };

      mockGuidelinesManager.getCurrentGuidelines = jest.fn().mockReturnValue(mockGuidelines);
      mockGuidelinesManager.validateGuidelines = jest.fn().mockReturnValue(mockValidation);

      const response = await request(app).get('/api/guidelines/status');
      
      expect(response.status).toBe(200);
      expect(response.body.loaded).toBe(true);
      expect(response.body.valid).toBe(true);
      expect(response.body.version).toBe('1.0.0');
    });

    it('GET /api/guidelines/status should handle unloaded guidelines', async () => {
      mockGuidelinesManager.getCurrentGuidelines = jest.fn().mockReturnValue(null);

      const response = await request(app).get('/api/guidelines/status');
      
      expect(response.status).toBe(200);
      expect(response.body.loaded).toBe(false);
    });
  });

  describe('Trading Engine Control Endpoints', () => {
    it('POST /api/engine/start should start the engine', async () => {
      mockTradingEngine.start = jest.fn().mockResolvedValue(undefined);

      const response = await request(app).post('/api/engine/start');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockTradingEngine.start).toHaveBeenCalled();
    });

    it('POST /api/engine/stop should stop the engine', async () => {
      mockTradingEngine.stop = jest.fn().mockResolvedValue(undefined);

      const response = await request(app).post('/api/engine/stop');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockTradingEngine.stop).toHaveBeenCalled();
    });

    it('POST /api/engine/pause should pause the engine', async () => {
      mockTradingEngine.pause = jest.fn().mockResolvedValue(undefined);

      const response = await request(app).post('/api/engine/pause');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockTradingEngine.pause).toHaveBeenCalled();
    });

    it('POST /api/engine/resume should resume the engine', async () => {
      mockTradingEngine.resume = jest.fn().mockResolvedValue(undefined);

      const response = await request(app).post('/api/engine/resume');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockTradingEngine.resume).toHaveBeenCalled();
    });

    it('POST /api/engine/cycle should execute a trading cycle', async () => {
      const mockResult = {
        buySignalsProcessed: 2,
        sellSignalsProcessed: 1,
        exitCriteriaChecked: 3,
        tradesExecuted: [],
        errors: [],
        executionTime: 1500,
        cycleId: 'test-cycle',
        timestamp: new Date()
      };

      mockTradingEngine.executeTradingCycle = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app).post('/api/engine/cycle');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result.buySignalsProcessed).toBe(2);
      expect(mockTradingEngine.executeTradingCycle).toHaveBeenCalled();
    });

    it('should handle engine control errors', async () => {
      mockTradingEngine.start = jest.fn().mockRejectedValue(
        new Error('Engine already running')
      );

      const response = await request(app).post('/api/engine/start');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/unknown-endpoint');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle internal server errors', async () => {
      mockTradingEngine.getStatus = jest.fn().mockImplementation(() => {
        throw new Error('Internal error');
      });

      const response = await request(app).get('/api/status');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Request Validation', () => {
    it('should parse date query parameters correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await request(app)
        .get('/api/logs/summary')
        .query({ 
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
      
      expect(mockLogger.getSummary).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date)
      );
    });

    it('should handle missing query parameters with defaults', async () => {
      await request(app).get('/api/logs');
      
      expect(mockLogger.query).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
          offset: 0
        })
      );
    });
  });
});
