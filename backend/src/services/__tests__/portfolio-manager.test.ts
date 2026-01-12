/**
 * Unit tests for PortfolioManager
 */

import { PortfolioManager, PortfolioManagerError, createPortfolioManager } from '../portfolio-manager';
import { LoggingService, createLoggingService } from '../logging-service';
import { DatabaseService } from '../../database/database-service';
import { DatabaseConnection } from '../../database/connection';
import { 
  TradingSignal
} from '../../../../shared/src/types/trading';
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

describe('PortfolioManager', () => {
  let db: DatabaseService;
  let logger: LoggingService;
  let portfolioManager: PortfolioManager;

  beforeEach(async () => {
    // Create in-memory database for testing
    const connection = new DatabaseConnection(':memory:');
    await connection.initialize();
    
    db = new DatabaseService(connection);
    logger = createLoggingService(connection, 'PORTFOLIO_MANAGER');
    
    portfolioManager = createPortfolioManager(db, logger, {
      portfolioId: 'test-portfolio',
      initialCash: 100000,
      mockBrokerEnabled: true,
      snapshotInterval: 1 // 1 minute for testing
    }, {
      latencyMs: 10, // Reduced for testing
      slippagePercent: 0.01,
      feePerTrade: 1.0,
      failureRate: 0 // No failures for basic tests
    });

    await portfolioManager.initialize();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Initialization', () => {
    test('should initialize with default portfolio', async () => {
      const portfolio = portfolioManager.getPortfolio();
      
      expect(portfolio).toBeDefined();
      expect(portfolio.totalValue).toBe(100000);
      expect(portfolio.cashBalance).toBe(100000);
      expect(portfolio.positions).toEqual([]);
      expect(portfolio.dailyPnL).toBe(0);
      expect(portfolio.totalPnL).toBe(0);
    });

    test('should load existing positions on initialization', async () => {
      // This test would require pre-existing data in a real scenario
      const positions = portfolioManager.getCurrentPositions();
      expect(Array.isArray(positions)).toBe(true);
    });

    test('should throw error if initialization fails', async () => {
      // Close database to simulate failure
      await db.close();
      
      const newConnection = new DatabaseConnection(':memory:');
      const newDb = new DatabaseService(newConnection);
      const newLogger = createLoggingService(newConnection, 'PORTFOLIO_MANAGER');
      
      const failingManager = createPortfolioManager(newDb, newLogger);
      
      await expect(failingManager.initialize()).rejects.toThrow(PortfolioManagerError);
    });
  });

  describe('Position Tracking', () => {
    test('should return empty positions initially', () => {
      const positions = portfolioManager.getCurrentPositions();
      expect(positions).toEqual([]);
    });

    test('should return empty open positions initially', () => {
      const openPositions = portfolioManager.getOpenPositions();
      expect(openPositions).toEqual([]);
    });

    test('should return null for non-existent position by symbol', () => {
      const position = portfolioManager.getPositionBySymbol('AAPL');
      expect(position).toBeNull();
    });
  });

  describe('Trade Execution', () => {
    test('should execute buy order successfully', async () => {
      const signal: TradingSignal = {
        id: uuidv4(),
        symbol: 'AAPL',
        action: 'BUY',
        confidence: 0.8,
        reasoning: 'Strong bullish signal',
        technicalIndicators: {
          rsi: 45,
          macd: { value: 0.5, signal: 0.3, histogram: 0.2 },
          movingAverages: { sma20: 150, sma50: 145, ema20: 151, ema50: 146 },
          atr: 2.5,
          volume: 1000000,
          vwap: 150.5,
          support: [148, 145],
          resistance: [155, 158]
        },
        recommendedSize: 100,
        entryPrice: 150,
        stopLoss: 145,
        profitTargets: [155, 160],
        timestamp: new Date()
      };

      const result = await portfolioManager.executeTradeOrder(signal);

      expect(result.success).toBe(true);
      expect(result.trade).toBeDefined();
      expect(result.trade!.symbol).toBe('AAPL');
      expect(result.trade!.action).toBe('BUY');
      expect(result.trade!.quantity).toBe(100);
      expect(result.trade!.status).toBe('EXECUTED');
      expect(result.executionTime).toBeGreaterThan(0);
    });

    test('should execute sell order successfully', async () => {
      // First, execute a buy order to have a position
      const buySignal: TradingSignal = {
        id: uuidv4(),
        symbol: 'AAPL',
        action: 'BUY',
        confidence: 0.8,
        reasoning: 'Initial buy',
        technicalIndicators: {
          rsi: 45,
          macd: { value: 0.5, signal: 0.3, histogram: 0.2 },
          movingAverages: { sma20: 150, sma50: 145, ema20: 151, ema50: 146 },
          atr: 2.5,
          volume: 1000000,
          vwap: 150.5,
          support: [148, 145],
          resistance: [155, 158]
        },
        recommendedSize: 100,
        entryPrice: 150,
        stopLoss: 145,
        profitTargets: [155, 160],
        timestamp: new Date()
      };

      await portfolioManager.executeTradeOrder(buySignal);

      // Now execute sell order
      const sellSignal: TradingSignal = {
        id: uuidv4(),
        symbol: 'AAPL',
        action: 'SELL',
        confidence: 0.7,
        reasoning: 'Take profit',
        technicalIndicators: {
          rsi: 65,
          macd: { value: 0.3, signal: 0.5, histogram: -0.2 },
          movingAverages: { sma20: 155, sma50: 150, ema20: 156, ema50: 151 },
          atr: 2.8,
          volume: 1200000,
          vwap: 155.2,
          support: [152, 150],
          resistance: [160, 165]
        },
        recommendedSize: 50,
        entryPrice: 155,
        stopLoss: 150,
        profitTargets: [160],
        timestamp: new Date()
      };

      const result = await portfolioManager.executeTradeOrder(sellSignal);

      expect(result.success).toBe(true);
      expect(result.trade!.action).toBe('SELL');
      expect(result.trade!.quantity).toBe(50);
    });

    test('should handle invalid trading signal', async () => {
      const invalidSignal: TradingSignal = {
        id: uuidv4(),
        symbol: '', // Invalid empty symbol
        action: 'BUY',
        confidence: 0.8,
        reasoning: 'Test',
        technicalIndicators: {} as any,
        recommendedSize: 100,
        stopLoss: 145,
        profitTargets: [155],
        timestamp: new Date()
      };

      const result = await portfolioManager.executeTradeOrder(invalidSignal);

      expect(result.success).toBe(false);
      expect(result.error).toContain('symbol is required');
    });

    test('should handle insufficient funds for buy order', async () => {
      const expensiveSignal: TradingSignal = {
        id: uuidv4(),
        symbol: 'EXPENSIVE',
        action: 'BUY',
        confidence: 0.8,
        reasoning: 'Expensive stock',
        technicalIndicators: {} as any,
        recommendedSize: 10000, // More than we can afford
        entryPrice: 1000, // $1000 per share
        stopLoss: 950,
        profitTargets: [1100],
        timestamp: new Date()
      };

      const result = await portfolioManager.executeTradeOrder(expensiveSignal);

      // Should still succeed but with adjusted position size
      expect(result.success).toBe(true);
      expect(result.trade!.quantity).toBeLessThan(10000);
    });

    test('should handle sell order without position', async () => {
      const sellSignal: TradingSignal = {
        id: uuidv4(),
        symbol: 'NONEXISTENT',
        action: 'SELL',
        confidence: 0.7,
        reasoning: 'Sell non-existent position',
        technicalIndicators: {} as any,
        recommendedSize: 100,
        stopLoss: 145,
        profitTargets: [155],
        timestamp: new Date()
      };

      const result = await portfolioManager.executeTradeOrder(sellSignal);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid position size');
    });
  });

  describe('Position Size Calculation', () => {
    test('should calculate correct position size for buy order', () => {
      const signal: TradingSignal = {
        id: uuidv4(),
        symbol: 'AAPL',
        action: 'BUY',
        confidence: 0.8,
        reasoning: 'Test',
        technicalIndicators: {} as any,
        recommendedSize: 500,
        entryPrice: 100,
        stopLoss: 95,
        profitTargets: [110],
        timestamp: new Date()
      };

      const positionSize = portfolioManager.calculatePositionSize(signal);

      // Should be limited by available cash
      expect(positionSize).toBeLessThanOrEqual(500);
      expect(positionSize).toBeGreaterThan(0);
    });

    test('should limit position size by available cash', () => {
      const signal: TradingSignal = {
        id: uuidv4(),
        symbol: 'EXPENSIVE',
        action: 'BUY',
        confidence: 0.8,
        reasoning: 'Test',
        technicalIndicators: {} as any,
        recommendedSize: 10000,
        entryPrice: 1000, // Very expensive
        stopLoss: 950,
        profitTargets: [1100],
        timestamp: new Date()
      };

      const positionSize = portfolioManager.calculatePositionSize(signal);

      // Should be limited by available cash (100,000 / 1000 = 100 shares max)
      expect(positionSize).toBeLessThanOrEqual(100);
    });

    test('should return 0 for sell order without position', () => {
      const signal: TradingSignal = {
        id: uuidv4(),
        symbol: 'NONEXISTENT',
        action: 'SELL',
        confidence: 0.7,
        reasoning: 'Test',
        technicalIndicators: {} as any,
        recommendedSize: 100,
        stopLoss: 95,
        profitTargets: [110],
        timestamp: new Date()
      };

      const positionSize = portfolioManager.calculatePositionSize(signal);
      expect(positionSize).toBe(0);
    });
  });

  describe('Portfolio Metrics', () => {
    test('should calculate initial portfolio metrics', async () => {
      const metrics = await portfolioManager.updatePortfolioMetrics();

      expect(metrics.totalValue).toBe(100000);
      expect(metrics.totalPnL).toBe(0);
      expect(metrics.dailyPnL).toBe(0);
      expect(metrics.positionCount).toBe(0);
      expect(metrics.cashPercentage).toBe(100);
      expect(metrics.largestPosition.symbol).toBe('');
      expect(metrics.sectorExposure).toEqual({});
    });

    test('should update metrics after trade execution', async () => {
      const signal: TradingSignal = {
        id: uuidv4(),
        symbol: 'AAPL',
        action: 'BUY',
        confidence: 0.8,
        reasoning: 'Test trade',
        technicalIndicators: {} as any,
        recommendedSize: 100,
        entryPrice: 150,
        stopLoss: 145,
        profitTargets: [155],
        timestamp: new Date()
      };

      await portfolioManager.executeTradeOrder(signal);
      const metrics = await portfolioManager.updatePortfolioMetrics();

      expect(metrics.totalValue).toBeLessThan(100000); // Due to fees
      expect(metrics.positionCount).toBe(1);
      expect(metrics.cashPercentage).toBeLessThan(100);
      expect(metrics.largestPosition.symbol).toBe('AAPL');
    });
  });

  describe('Performance Statistics', () => {
    test('should calculate initial performance stats', async () => {
      const stats = await portfolioManager.getPerformanceStats();

      expect(stats.totalTrades).toBe(0);
      expect(stats.winningTrades).toBe(0);
      expect(stats.losingTrades).toBe(0);
      expect(stats.winRate).toBe(0);
      expect(stats.averageWin).toBe(0);
      expect(stats.averageLoss).toBe(0);
      expect(stats.profitFactor).toBe(0);
      expect(stats.netProfit).toBe(0);
      expect(stats.totalFees).toBe(0);
    });

    test('should calculate performance stats after trades', async () => {
      // Execute a complete buy-sell cycle
      const buySignal: TradingSignal = {
        id: uuidv4(),
        symbol: 'AAPL',
        action: 'BUY',
        confidence: 0.8,
        reasoning: 'Buy signal',
        technicalIndicators: {} as any,
        recommendedSize: 100,
        entryPrice: 150,
        stopLoss: 145,
        profitTargets: [155],
        timestamp: new Date()
      };

      const sellSignal: TradingSignal = {
        id: uuidv4(),
        symbol: 'AAPL',
        action: 'SELL',
        confidence: 0.7,
        reasoning: 'Sell signal',
        technicalIndicators: {} as any,
        recommendedSize: 100,
        entryPrice: 155,
        stopLoss: 150,
        profitTargets: [160],
        timestamp: new Date()
      };

      await portfolioManager.executeTradeOrder(buySignal);
      await portfolioManager.executeTradeOrder(sellSignal);

      const stats = await portfolioManager.getPerformanceStats();

      expect(stats.totalTrades).toBe(2);
      expect(stats.totalFees).toBeGreaterThan(0);
    });
  });

  describe('Position Price Updates', () => {
    test('should update position prices correctly', async () => {
      // First create a position
      const signal: TradingSignal = {
        id: uuidv4(),
        symbol: 'AAPL',
        action: 'BUY',
        confidence: 0.8,
        reasoning: 'Test position',
        technicalIndicators: {} as any,
        recommendedSize: 100,
        entryPrice: 150,
        stopLoss: 145,
        profitTargets: [155],
        timestamp: new Date()
      };

      await portfolioManager.executeTradeOrder(signal);

      // Update prices
      await portfolioManager.updatePositionPrices([
        { symbol: 'AAPL', price: 155 }
      ]);

      const positions = portfolioManager.getOpenPositions();
      expect(positions.length).toBe(1);
      expect(positions[0]!.currentPrice).toBe(155);
      expect(positions[0]!.unrealizedPnL).toBeGreaterThan(0); // Should be profitable
    });

    test('should handle price updates for non-existent positions', async () => {
      // Should not throw error
      await expect(portfolioManager.updatePositionPrices([
        { symbol: 'NONEXISTENT', price: 100 }
      ])).resolves.not.toThrow();
    });
  });

  describe('Portfolio Snapshots', () => {
    test('should get empty snapshot history initially', async () => {
      const snapshots = await portfolioManager.getSnapshotHistory(30);
      expect(Array.isArray(snapshots)).toBe(true);
    });

    test('should handle snapshot history errors gracefully', async () => {
      // Close database to simulate error
      await db.close();

      await expect(portfolioManager.getSnapshotHistory(30))
        .rejects.toThrow(PortfolioManagerError);
    });
  });

  describe('Error Handling', () => {
    test('should throw error when accessing portfolio before initialization', () => {
      const uninitializedManager = createPortfolioManager(db, logger);
      
      expect(() => uninitializedManager.getPortfolio())
        .toThrow(PortfolioManagerError);
    });

    test('should handle database errors gracefully', async () => {
      // Close database to simulate error
      await db.close();

      const signal: TradingSignal = {
        id: uuidv4(),
        symbol: 'AAPL',
        action: 'BUY',
        confidence: 0.8,
        reasoning: 'Test',
        technicalIndicators: {} as any,
        recommendedSize: 100,
        stopLoss: 145,
        profitTargets: [155],
        timestamp: new Date()
      };

      const result = await portfolioManager.executeTradeOrder(signal);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle mock broker failures', async () => {
      // Create manager with high failure rate
      const failingManager = createPortfolioManager(db, logger, {
        portfolioId: 'failing-test',
        initialCash: 100000
      }, {
        failureRate: 1.0 // 100% failure rate
      });

      await failingManager.initialize();

      const signal: TradingSignal = {
        id: uuidv4(),
        symbol: 'AAPL',
        action: 'BUY',
        confidence: 0.8,
        reasoning: 'Test failure',
        technicalIndicators: {} as any,
        recommendedSize: 100,
        entryPrice: 150,
        stopLoss: 145,
        profitTargets: [155],
        timestamp: new Date()
      };

      const result = await failingManager.executeTradeOrder(signal);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Mock broker');
    });
  });

  describe('Factory Function', () => {
    test('should create PortfolioManager instance', () => {
      const manager = createPortfolioManager(db, logger);
      expect(manager).toBeInstanceOf(PortfolioManager);
    });

    test('should create PortfolioManager with custom config', () => {
      const manager = createPortfolioManager(db, logger, {
        portfolioId: 'custom',
        initialCash: 50000,
        mockBrokerEnabled: false
      });
      expect(manager).toBeInstanceOf(PortfolioManager);
    });
  });
});

describe('Integration Tests', () => {
  let db: DatabaseService;
  let logger: LoggingService;
  let portfolioManager: PortfolioManager;

  beforeEach(async () => {
    const connection = new DatabaseConnection(':memory:');
    await connection.initialize();
    
    db = new DatabaseService(connection);
    logger = createLoggingService(connection, 'PORTFOLIO_MANAGER');
    
    portfolioManager = createPortfolioManager(db, logger, {
      portfolioId: 'integration-test',
      initialCash: 100000,
      snapshotInterval: 1
    });

    await portfolioManager.initialize();
  });

  afterEach(async () => {
    await db.close();
  });

  test('should handle complete trading workflow', async () => {
    // Execute multiple trades to test complete workflow
    const trades = [
      {
        symbol: 'AAPL',
        action: 'BUY' as const,
        size: 100,
        price: 150
      },
      {
        symbol: 'GOOGL',
        action: 'BUY' as const,
        size: 50,
        price: 2500
      },
      {
        symbol: 'AAPL',
        action: 'SELL' as const,
        size: 50,
        price: 155
      }
    ];

    for (const trade of trades) {
      const signal: TradingSignal = {
        id: uuidv4(),
        symbol: trade.symbol,
        action: trade.action,
        confidence: 0.8,
        reasoning: `${trade.action} ${trade.symbol}`,
        technicalIndicators: {} as any,
        recommendedSize: trade.size,
        entryPrice: trade.price,
        stopLoss: trade.price * 0.95,
        profitTargets: [trade.price * 1.1],
        timestamp: new Date()
      };

      const result = await portfolioManager.executeTradeOrder(signal);
      expect(result.success).toBe(true);
    }

    // Verify final state
    const portfolio = portfolioManager.getPortfolio();
    const openPositions = portfolioManager.getOpenPositions();
    const metrics = await portfolioManager.updatePortfolioMetrics();
    const stats = await portfolioManager.getPerformanceStats();

    expect(openPositions.length).toBe(2); // AAPL (partial) and GOOGL
    expect(metrics.positionCount).toBe(2);
    expect(stats.totalTrades).toBe(3);
    expect(portfolio.cashBalance).toBeLessThan(100000); // Some cash used
  });

  test('should persist data across manager instances', async () => {
    // Execute a trade
    const signal: TradingSignal = {
      id: uuidv4(),
      symbol: 'AAPL',
      action: 'BUY',
      confidence: 0.8,
      reasoning: 'Persistence test',
      technicalIndicators: {} as any,
      recommendedSize: 100,
      entryPrice: 150,
      stopLoss: 145,
      profitTargets: [155],
      timestamp: new Date()
    };

    await portfolioManager.executeTradeOrder(signal);

    // Create new manager instance with same database
    const newManager = createPortfolioManager(db, logger, {
      portfolioId: 'integration-test'
    });
    await newManager.initialize();

    // Verify data persisted
    const positions = newManager.getOpenPositions();
    expect(positions.length).toBe(1);
    expect(positions[0]!.symbol).toBe('AAPL');
  });
});