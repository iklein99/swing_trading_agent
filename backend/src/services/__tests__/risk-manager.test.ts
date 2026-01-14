/**
 * Unit tests for RiskManager
 */

import { RiskManager, RiskManagerError, createRiskManager } from '../risk-manager';
import { GuidelinesManager, createGuidelinesManager } from '../guidelines-manager';
import { LoggingService, createLoggingService } from '../logging-service';
import { DatabaseConnection } from '../../database/connection';
import { 
  TradingSignal
} from '../../../../shared/src/types/trading';
import { 
  Portfolio, 
  Position 
} from '../../../../shared/src/types/portfolio';
import { 
  TradingGuidelines
} from '../../../../shared/src/types/guidelines';
import { v4 as uuidv4 } from 'uuid';

// Mock console methods to avoid noise in tests
const originalConsole = { ...console };
beforeAll(() => {
  console.debug = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

describe('RiskManager', () => {
  let logger: LoggingService;
  let guidelinesManager: GuidelinesManager;
  let riskManager: RiskManager;
  let mockGuidelines: TradingGuidelines;
  let mockPortfolio: Portfolio;

  beforeEach(async () => {
    // Create in-memory database for testing
    const connection = new DatabaseConnection(':memory:');
    await connection.initialize();
    
    logger = createLoggingService(connection, 'RISK_MANAGER');
    guidelinesManager = createGuidelinesManager(logger, {
      guidelinesFilePath: 'test-guidelines.md',
      watchForChanges: false,
      validateOnLoad: false
    });

    // Create mock guidelines
    mockGuidelines = createMockGuidelines();
    
    // Mock the guidelines manager to return our test guidelines
    jest.spyOn(guidelinesManager, 'getCurrentGuidelines').mockReturnValue(mockGuidelines);
    
    riskManager = createRiskManager(logger, guidelinesManager, {
      portfolioId: 'test-portfolio',
      enableRealTimeMonitoring: true,
      maxRiskEventsPerDay: 5
    });

    // Create mock portfolio
    mockPortfolio = createMockPortfolio();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validateTrade', () => {
    it('should approve a valid trade within all limits', async () => {
      const signal = createMockSignal({
        symbol: 'AAPL',
        action: 'BUY',
        recommendedSize: 50, // Small position: 50 * $150 = $7,500 = 7.5% of $100k portfolio
        entryPrice: 150,
        stopLoss: 145 // Small risk: $5 per share * 50 = $250 = 0.25% of portfolio
      });

      const result = await riskManager.validateTrade(signal, mockPortfolio, mockGuidelines);

      expect(result.approved).toBe(true);
      expect(result.riskLevel).toBe('LOW');
      expect(result.checks).toHaveLength(6);
      expect(result.checks.every(check => check.passed)).toBe(true);
    });

    it('should adjust position size when exceeding limits but adjustment is possible', async () => {
      const signal = createMockSignal({
        symbol: 'AAPL',
        action: 'BUY',
        recommendedSize: 2000, // Large position that will be adjusted
        entryPrice: 150,
        stopLoss: 140
      });

      const result = await riskManager.validateTrade(signal, mockPortfolio, mockGuidelines);

      expect(result.approved).toBe(true);
      expect(result.adjustedSize).toBeDefined();
      expect(result.adjustedSize).toBeLessThan(signal.recommendedSize);
      expect(result.riskLevel).toBe('MEDIUM');
    });

    it('should reject trade when no cash available', async () => {
      // Create a portfolio with no cash
      const portfolioNoCash = {
        ...mockPortfolio,
        cashBalance: 0
      };

      const signal = createMockSignal({
        symbol: 'AAPL',
        action: 'BUY',
        recommendedSize: 100,
        entryPrice: 150,
        stopLoss: 140
      });

      const result = await riskManager.validateTrade(signal, portfolioNoCash, mockGuidelines);

      expect(result.approved).toBe(false);
      expect(result.riskLevel).toBe('HIGH');
    });

    it('should reject trade when daily loss limit is exceeded', async () => {
      const portfolioWithLoss = {
        ...mockPortfolio,
        dailyPnL: -4000, // 4% loss on 100k portfolio
        totalValue: 96000
      };

      const signal = createMockSignal({
        symbol: 'AAPL',
        action: 'BUY',
        recommendedSize: 100,
        entryPrice: 150,
        stopLoss: 140
      });

      const result = await riskManager.validateTrade(signal, portfolioWithLoss, mockGuidelines);

      expect(result.approved).toBe(false);
      expect(result.riskLevel).toBe('CRITICAL');
      
      const dailyLossCheck = result.checks.find(check => check.name === 'Daily Loss Limit');
      expect(dailyLossCheck?.passed).toBe(false);
    });

    it('should reduce position size when drawdown limit is approached', async () => {
      const portfolioWithDrawdown = {
        ...mockPortfolio,
        totalValue: 92000 // 8% drawdown from initial 100k
      };

      const signal = createMockSignal({
        symbol: 'AAPL',
        action: 'BUY',
        recommendedSize: 100,
        entryPrice: 150,
        stopLoss: 140
      });

      const result = await riskManager.validateTrade(signal, portfolioWithDrawdown, mockGuidelines);

      expect(result.adjustedSize).toBeDefined();
      expect(result.adjustedSize).toBeLessThan(signal.recommendedSize);
      expect(result.riskLevel).toBe('MEDIUM'); // Changed from HIGH to MEDIUM since it's adjusted, not rejected
    });

    it('should reject trade when maximum open positions reached', async () => {
      const portfolioWithMaxPositions = {
        ...mockPortfolio,
        positions: Array.from({ length: 8 }, (_, i) => createMockPosition({
          symbol: `STOCK${i}`,
          quantity: 100
        }))
      };

      const signal = createMockSignal({
        symbol: 'NEWSTOCK',
        action: 'BUY',
        recommendedSize: 100,
        entryPrice: 150,
        stopLoss: 140
      });

      const result = await riskManager.validateTrade(signal, portfolioWithMaxPositions, mockGuidelines);

      expect(result.approved).toBe(false);
      expect(result.riskLevel).toBe('MEDIUM');
      
      const maxPositionsCheck = result.checks.find(check => check.name === 'Maximum Open Positions');
      expect(maxPositionsCheck?.passed).toBe(false);
    });

    it('should allow sell orders even when position limits are reached', async () => {
      const portfolioWithMaxPositions = {
        ...mockPortfolio,
        positions: Array.from({ length: 8 }, (_, i) => createMockPosition({
          symbol: `STOCK${i}`,
          quantity: 100
        }))
      };

      const signal = createMockSignal({
        symbol: 'STOCK0',
        action: 'SELL',
        recommendedSize: 50,
        entryPrice: 150,
        stopLoss: 140
      });

      const result = await riskManager.validateTrade(signal, portfolioWithMaxPositions, mockGuidelines);

      expect(result.approved).toBe(true);
    });

    it('should adjust position size based on risk per trade limit', async () => {
      const signal = createMockSignal({
        symbol: 'AAPL',
        action: 'BUY',
        recommendedSize: 500,
        entryPrice: 100,
        stopLoss: 80 // 20% risk per share
      });

      const result = await riskManager.validateTrade(signal, mockPortfolio, mockGuidelines);

      expect(result.adjustedSize).toBeDefined();
      expect(result.adjustedSize).toBeLessThan(signal.recommendedSize);
      expect(result.riskLevel).toBe('MEDIUM');
      
      const riskPerTradeCheck = result.checks.find(check => check.name === 'Risk Per Trade');
      expect(riskPerTradeCheck).toBeDefined();
    });

    it('should throw error when no guidelines are available', async () => {
      jest.spyOn(guidelinesManager, 'getCurrentGuidelines').mockReturnValue(null);

      const signal = createMockSignal({
        symbol: 'AAPL',
        action: 'BUY',
        recommendedSize: 100,
        entryPrice: 150,
        stopLoss: 140
      });

      await expect(riskManager.validateTrade(signal, mockPortfolio))
        .rejects.toThrow(RiskManagerError);
    });
  });

  describe('enforcePositionLimits', () => {
    it('should return trade unchanged when within limits', () => {
      const trade = {
        id: 'test-trade',
        symbol: 'AAPL',
        action: 'BUY' as const,
        quantity: 100,
        price: 150,
        timestamp: new Date(),
        reasoning: 'Test trade',
        signalId: 'test-signal',
        fees: 1,
        status: 'PENDING' as const
      };

      const result = riskManager.enforcePositionLimits(trade, mockGuidelines);

      expect(result).toEqual(trade);
    });

    it('should handle missing guidelines gracefully', () => {
      jest.spyOn(guidelinesManager, 'getCurrentGuidelines').mockReturnValue(null);

      const trade = {
        id: 'test-trade',
        symbol: 'AAPL',
        action: 'BUY' as const,
        quantity: 100,
        price: 150,
        timestamp: new Date(),
        reasoning: 'Test trade',
        signalId: 'test-signal',
        fees: 1,
        status: 'PENDING' as const
      };

      const result = riskManager.enforcePositionLimits(trade);

      expect(result).toEqual(trade);
    });
  });

  describe('checkDrawdownLimits', () => {
    it('should return true when drawdown is within limits', () => {
      const portfolio = {
        ...mockPortfolio,
        totalValue: 95000 // 5% drawdown
      };

      const result = riskManager.checkDrawdownLimits(portfolio, mockGuidelines);

      expect(result).toBe(true);
    });

    it('should return false when drawdown exceeds limits', () => {
      const portfolio = {
        ...mockPortfolio,
        totalValue: 90000 // 10% drawdown, exceeds 8% limit
      };

      const result = riskManager.checkDrawdownLimits(portfolio, mockGuidelines);

      expect(result).toBe(false);
    });

    it('should return true when no guidelines available', () => {
      jest.spyOn(guidelinesManager, 'getCurrentGuidelines').mockReturnValue(null);

      const result = riskManager.checkDrawdownLimits(mockPortfolio);

      expect(result).toBe(true);
    });
  });

  describe('calculateMaxPositionSize', () => {
    it('should calculate correct maximum position size', () => {
      const result = riskManager.calculateMaxPositionSize('AAPL', mockPortfolio, mockGuidelines);

      // 10% of 100k portfolio = 10k, at $100/share = 100 shares
      expect(result).toBe(100);
    });

    it('should return 0 when no guidelines available', () => {
      jest.spyOn(guidelinesManager, 'getCurrentGuidelines').mockReturnValue(null);

      const result = riskManager.calculateMaxPositionSize('AAPL', mockPortfolio);

      expect(result).toBe(0);
    });
  });

  describe('checkDailyLossLimits', () => {
    it('should return true when daily loss is within limits', () => {
      const portfolio = {
        ...mockPortfolio,
        dailyPnL: -2000 // 2% loss
      };

      const result = riskManager.checkDailyLossLimits(portfolio, mockGuidelines);

      expect(result).toBe(true);
    });

    it('should return false when daily loss exceeds limits', () => {
      const portfolio = {
        ...mockPortfolio,
        dailyPnL: -4000 // 4% loss, exceeds 3% limit
      };

      const result = riskManager.checkDailyLossLimits(portfolio, mockGuidelines);

      expect(result).toBe(false);
    });

    it('should return true when no guidelines available', () => {
      jest.spyOn(guidelinesManager, 'getCurrentGuidelines').mockReturnValue(null);

      const result = riskManager.checkDailyLossLimits(mockPortfolio);

      expect(result).toBe(true);
    });
  });

  describe('validateSectorConcentration', () => {
    it('should return true when sector concentration is within limits', () => {
      const portfolio = {
        ...mockPortfolio,
        positions: [
          createMockPosition({ symbol: 'AAPL', quantity: 100, sector: 'Technology', currentPrice: 100 }), // 10k = 10%
          createMockPosition({ symbol: 'MSFT', quantity: 100, sector: 'Technology', currentPrice: 100 }) // 10k = 10%, total 20%
        ]
      };

      // Test adding a Healthcare stock (different sector)
      const result = riskManager.validateSectorConcentration('JNJ', portfolio, mockGuidelines);

      expect(result).toBe(true);
    });

    it('should return true when sector is unknown', () => {
      const result = riskManager.validateSectorConcentration('UNKNOWN', mockPortfolio, mockGuidelines);

      expect(result).toBe(true);
    });

    it('should return true when no guidelines available', () => {
      jest.spyOn(guidelinesManager, 'getCurrentGuidelines').mockReturnValue(null);

      const result = riskManager.validateSectorConcentration('AAPL', mockPortfolio);

      expect(result).toBe(true);
    });
  });

  describe('getRiskMetrics', () => {
    it('should calculate risk metrics for portfolio', async () => {
      const portfolio = {
        ...mockPortfolio,
        positions: [
          createMockPosition({ symbol: 'AAPL', quantity: 100, currentPrice: 150 }),
          createMockPosition({ symbol: 'MSFT', quantity: 50, currentPrice: 200 })
        ]
      };

      const metrics = await riskManager.getRiskMetrics(portfolio);

      expect(metrics).toBeDefined();
      expect(metrics.portfolioId).toBe(portfolio.id);
      expect(metrics.positionRisks).toHaveLength(2);
      expect(metrics.sectorExposure).toBeDefined();
      expect(metrics.totalRisk).toBeGreaterThan(0);
    });

    it('should handle empty portfolio', async () => {
      const emptyPortfolio = {
        ...mockPortfolio,
        positions: []
      };

      const metrics = await riskManager.getRiskMetrics(emptyPortfolio);

      expect(metrics.positionRisks).toHaveLength(0);
      expect(metrics.totalRisk).toBe(0);
    });
  });

  describe('getRiskEvents', () => {
    it('should return empty array when no risk events', () => {
      const events = riskManager.getRiskEvents();

      expect(events).toEqual([]);
    });

    it('should filter events by date range', async () => {
      // Trigger a risk event by validating a trade that exceeds limits
      const signal = createMockSignal({
        symbol: 'AAPL',
        action: 'BUY',
        recommendedSize: 2000, // Very large position
        entryPrice: 150,
        stopLoss: 140
      });

      await riskManager.validateTrade(signal, mockPortfolio, mockGuidelines);

      const events = riskManager.getRiskEvents(7);
      expect(events.length).toBeGreaterThan(0);
    });
  });

  // Helper functions
  function createMockGuidelines(): TradingGuidelines {
    return {
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
          requirePositiveSectorStrength: true,
          avoidFinancialDistress: true
        }
      },
      entrySignals: {
        longEntries: [],
        shortEntries: [],
        timingRules: {
          avoidFirstMinutes: 15,
          avoidLastMinutes: 15,
          optimalWindowStart: '10:00 AM',
          optimalWindowEnd: '3:30 PM'
        },
        positionSizing: {
          riskPerTradePercent: 2,
          maxPositionPercent: 10,
          maxCorrelatedPositions: 3,
          maxSectorPositions: 3
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
            maxHoldingDays: 15,
            evaluateAtTimeLimit: true
          }
        },
        trailingStops: {
          activationTrigger: 'After Target 1 hit',
          trailingAmount: '1.5 ATR',
          adjustmentFrequency: 'DAILY',
          lockInProfitsAt: 1.5
        },
        timeBasedExits: {
          maxHoldingPeriod: 15,
          evaluationCriteria: []
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
          trendingMarketStrategy: 'Favor breakouts',
          rangeBoundMarketStrategy: 'Favor pullbacks',
          highVolatilityAdjustments: 'Reduce size',
          lowVolatilityAdjustments: 'Tighter stops'
        }
      },
      lastUpdated: new Date(),
      version: '1.0.0',
      filePath: 'test-guidelines.md'
    };
  }

  function createMockPortfolio(): Portfolio {
    return {
      id: 'test-portfolio',
      totalValue: 100000,
      cashBalance: 75000, // More cash, fewer existing positions
      positions: [
        createMockPosition({ symbol: 'AAPL', quantity: 100, currentPrice: 155, sector: 'Technology' }),
        createMockPosition({ symbol: 'MSFT', quantity: 50, currentPrice: 155, sector: 'Technology' })
      ],
      dailyPnL: 0,
      totalPnL: 0,
      lastUpdated: new Date(),
      createdAt: new Date()
    };
  }

  function createMockPosition(overrides: Partial<Position> = {}): Position {
    return {
      id: uuidv4(),
      symbol: 'AAPL',
      quantity: 100,
      entryPrice: 150,
      currentPrice: 155,
      entryDate: new Date(),
      stopLoss: 140,
      profitTargets: [160, 170],
      unrealizedPnL: 500,
      realizedPnL: 0,
      exitCriteria: [],
      sector: 'Technology',
      lastUpdated: new Date(),
      ...overrides
    };
  }

  function createMockSignal(overrides: Partial<TradingSignal> = {}): TradingSignal {
    return {
      id: uuidv4(),
      symbol: 'AAPL',
      action: 'BUY',
      confidence: 0.8,
      reasoning: 'Test signal',
      technicalIndicators: {
        rsi: 45,
        macd: { value: 0.5, signal: 0.3, histogram: 0.2 },
        movingAverages: { sma20: 150, sma50: 145, ema20: 151, ema50: 146 },
        atr: 3.5,
        volume: 1500000,
        vwap: 152,
        support: [145, 140],
        resistance: [160, 165]
      },
      recommendedSize: 100,
      entryPrice: 150,
      stopLoss: 140,
      profitTargets: [160, 170],
      timestamp: new Date(),
      ...overrides
    };
  }
});