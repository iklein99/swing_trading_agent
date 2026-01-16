/**
 * Tests for ExitCriteriaMonitor service
 */

import { ExitCriteriaMonitor, createExitCriteriaMonitor } from '../exit-criteria-monitor';
import { GuidelinesManager, createGuidelinesManager } from '../guidelines-manager';
import { MarketDataService } from '../market-data-service';
import { LoggingService, createLoggingService } from '../logging-service';
import { Position } from '../../../../shared/src/types/portfolio';
import { DatabaseConnection } from '../../database/connection';
import * as path from 'path';

// Mock console methods
const originalConsole = { ...console };
beforeAll(() => {
  console.debug = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

describe('ExitCriteriaMonitor', () => {
  let exitMonitor: ExitCriteriaMonitor;
  let guidelinesManager: GuidelinesManager;
  let marketDataService: MarketDataService;
  let loggingService: LoggingService;
  let connection: DatabaseConnection;

  beforeAll(async () => {
    connection = new DatabaseConnection(':memory:');
    await connection.initialize();

    loggingService = createLoggingService(connection, 'EXIT_CRITERIA_MONITOR');

    const testGuidelinesPath = path.join(__dirname, '../../../../artifacts', 'swing_trading_guidelines.yaml');
    guidelinesManager = createGuidelinesManager(loggingService, {
      guidelinesFilePath: testGuidelinesPath,
      watchForChanges: false,
      validateOnLoad: true
    });
    await guidelinesManager.loadGuidelines();

    marketDataService = new MarketDataService();

    exitMonitor = new ExitCriteriaMonitor({
      guidelinesManager,
      marketDataService,
      loggingService,
      checkIntervalMs: 60000
    });
  });

  afterAll(async () => {
    exitMonitor.stopMonitoring();
    await connection.close();
  });

  describe('Service Initialization', () => {
    it('should initialize correctly', () => {
      expect(exitMonitor).toBeDefined();
      expect(exitMonitor.isCurrentlyMonitoring()).toBe(false);
    });

    it('should create using factory function', () => {
      const monitor = createExitCriteriaMonitor({
        guidelinesManager,
        marketDataService,
        loggingService
      });
      expect(monitor).toBeInstanceOf(ExitCriteriaMonitor);
    });
  });

  describe('Exit Criteria Establishment', () => {
    it('should establish exit criteria for new position', async () => {
      const marketData = await marketDataService.getMarketData('AAPL');
      const position: Position = {
        id: '1',
        symbol: 'AAPL',
        quantity: 100,
        entryPrice: 150.00,
        currentPrice: 150.00,
        entryDate: new Date(),
        stopLoss: 0,
        profitTargets: [],
        unrealizedPnL: 0,
        realizedPnL: 0,
        sector: 'Technology',
        exitCriteria: [],
        lastUpdated: new Date()
      };

      const criteria = exitMonitor.establishExitCriteria(position, 150.00, marketData);

      expect(Array.isArray(criteria)).toBe(true);
      expect(criteria.length).toBeGreaterThan(0);
    });

    it('should create stop loss criteria', async () => {
      const marketData = await marketDataService.getMarketData('AAPL');
      const position: Position = {
        id: '1',
        symbol: 'AAPL',
        quantity: 100,
        entryPrice: 150.00,
        currentPrice: 150.00,
        entryDate: new Date(),
        stopLoss: 0,
        profitTargets: [],
        unrealizedPnL: 0,
        realizedPnL: 0,
        sector: 'Technology',
        exitCriteria: [],
        lastUpdated: new Date()
      };

      const criteria = exitMonitor.establishExitCriteria(position, 150.00, marketData);
      const stopLossCriteria = criteria.filter(c => c.type === 'STOP_LOSS');

      expect(stopLossCriteria.length).toBeGreaterThan(0);
      stopLossCriteria.forEach(c => {
        expect(c.value).toBeLessThan(150.00);
        expect(c.isActive).toBe(true);
      });
    });

    it('should create profit target criteria', async () => {
      const marketData = await marketDataService.getMarketData('AAPL');
      const position: Position = {
        id: '1',
        symbol: 'AAPL',
        quantity: 100,
        entryPrice: 150.00,
        currentPrice: 150.00,
        entryDate: new Date(),
        stopLoss: 0,
        profitTargets: [],
        unrealizedPnL: 0,
        realizedPnL: 0,
        sector: 'Technology',
        exitCriteria: [],
        lastUpdated: new Date()
      };

      const criteria = exitMonitor.establishExitCriteria(position, 150.00, marketData);
      const profitTargets = criteria.filter(c => c.type === 'PROFIT_TARGET');

      expect(profitTargets.length).toBeGreaterThan(0);
      profitTargets.forEach(c => {
        expect(c.value).toBeGreaterThan(150.00);
        expect(c.isActive).toBe(true);
      });
    });
  });

  describe('Exit Criteria Checking', () => {
    it('should check exit criteria for positions', async () => {
      const position: Position = {
        id: '1',
        symbol: 'AAPL',
        quantity: 100,
        entryPrice: 150.00,
        currentPrice: 160.00,
        entryDate: new Date(),
        stopLoss: 145.00,
        profitTargets: [155.00],
        unrealizedPnL: 1000,
        realizedPnL: 0,
        sector: 'Technology',
        exitCriteria: [{
          id: '1',
          type: 'STOP_LOSS',
          value: 145.00,
          isActive: true,
          priority: 1,
          createdAt: new Date()
        }],
        lastUpdated: new Date()
      };

      const result = await exitMonitor.checkExitCriteria([position]);

      expect(result).toHaveProperty('exitSignals');
      expect(result).toHaveProperty('positionsChecked');
      expect(result.positionsChecked).toBe(1);
    });

    it('should detect triggered stop loss', async () => {
      // Get actual market price first
      const marketData = await marketDataService.getMarketData('AAPL');
      const currentPrice = marketData.quote.price;
      
      // Set stop loss above current price to ensure it triggers
      const stopLossPrice = currentPrice + 10;
      
      const position: Position = {
        id: '1',
        symbol: 'AAPL',
        quantity: 100,
        entryPrice: stopLossPrice + 10,
        currentPrice: currentPrice,
        entryDate: new Date(),
        stopLoss: stopLossPrice,
        profitTargets: [],
        unrealizedPnL: -1000,
        realizedPnL: 0,
        sector: 'Technology',
        exitCriteria: [{
          id: '1',
          type: 'STOP_LOSS',
          value: stopLossPrice,
          isActive: true,
          priority: 1,
          createdAt: new Date()
        }],
        lastUpdated: new Date()
      };

      const result = await exitMonitor.checkExitCriteria([position]);

      expect(result.exitSignals.length).toBeGreaterThan(0);
      if (result.exitSignals[0]) {
        expect(result.exitSignals[0].action).toBe('SELL');
        expect(result.exitSignals[0].reasoning).toContain('Stop loss');
      }
    });

    it('should detect triggered profit target', async () => {
      // Get actual market price first
      const marketData = await marketDataService.getMarketData('AAPL');
      const currentPrice = marketData.quote.price;
      
      // Set profit target below current price to ensure it triggers
      const profitTargetPrice = currentPrice - 10;
      
      const position: Position = {
        id: '1',
        symbol: 'AAPL',
        quantity: 100,
        entryPrice: profitTargetPrice - 10,
        currentPrice: currentPrice,
        entryDate: new Date(),
        stopLoss: profitTargetPrice - 20,
        profitTargets: [profitTargetPrice],
        unrealizedPnL: 1000,
        realizedPnL: 0,
        sector: 'Technology',
        exitCriteria: [{
          id: '2',
          type: 'PROFIT_TARGET',
          value: profitTargetPrice,
          isActive: true,
          priority: 10,
          createdAt: new Date()
        }],
        lastUpdated: new Date()
      };

      const result = await exitMonitor.checkExitCriteria([position]);

      expect(result.exitSignals.length).toBeGreaterThan(0);
      if (result.exitSignals[0]) {
        expect(result.exitSignals[0].action).toBe('SELL');
        expect(result.exitSignals[0].reasoning).toContain('Profit target');
      }
    });

    it('should prioritize stop losses over profit targets', async () => {
      // Get actual market price first
      const marketData = await marketDataService.getMarketData('AAPL');
      const currentPrice = marketData.quote.price;
      
      // Set both criteria to trigger, but stop loss should win
      const triggerPrice = currentPrice + 5;
      
      const position: Position = {
        id: '1',
        symbol: 'AAPL',
        quantity: 100,
        entryPrice: triggerPrice,
        currentPrice: currentPrice,
        entryDate: new Date(),
        stopLoss: triggerPrice,
        profitTargets: [triggerPrice],
        unrealizedPnL: -500,
        realizedPnL: 0,
        sector: 'Technology',
        exitCriteria: [
          {
            id: '1',
            type: 'STOP_LOSS',
            value: triggerPrice,
            isActive: true,
            priority: 1,
            createdAt: new Date()
          },
          {
            id: '2',
            type: 'PROFIT_TARGET',
            value: triggerPrice,
            isActive: true,
            priority: 10,
            createdAt: new Date()
          }
        ],
        lastUpdated: new Date()
      };

      const result = await exitMonitor.checkExitCriteria([position]);

      expect(result.exitSignals.length).toBeGreaterThan(0);
      if (result.exitSignals[0]) {
        expect(result.exitSignals[0].reasoning).toContain('Stop loss');
      }
    });

    it('should handle empty positions array', async () => {
      const result = await exitMonitor.checkExitCriteria([]);
      expect(result.positionsChecked).toBe(0);
      expect(result.exitSignals.length).toBe(0);
    });
  });

  describe('Continuous Monitoring', () => {
    it('should start and stop monitoring', () => {
      const getPositions = jest.fn().mockResolvedValue([]);
      
      exitMonitor.startMonitoring(getPositions);
      expect(exitMonitor.isCurrentlyMonitoring()).toBe(true);
      
      exitMonitor.stopMonitoring();
      expect(exitMonitor.isCurrentlyMonitoring()).toBe(false);
    });
  });
});

describe('ExitCriteriaMonitor Factory Function', () => {
  let connection: DatabaseConnection;
  let loggingService: LoggingService;
  let guidelinesManager: GuidelinesManager;
  let marketDataService: MarketDataService;

  beforeAll(async () => {
    connection = new DatabaseConnection(':memory:');
    await connection.initialize();

    loggingService = createLoggingService(connection, 'EXIT_CRITERIA_MONITOR');

    const testGuidelinesPath = path.join(__dirname, '../../../../artifacts', 'swing_trading_guidelines.yaml');
    guidelinesManager = createGuidelinesManager(loggingService, {
      guidelinesFilePath: testGuidelinesPath,
      watchForChanges: false,
      validateOnLoad: true
    });
    await guidelinesManager.loadGuidelines();

    marketDataService = new MarketDataService();
  });

  afterAll(async () => {
    await connection.close();
  });

  it('should create monitor with default configuration', () => {
    const monitor = createExitCriteriaMonitor({
      guidelinesManager,
      marketDataService,
      loggingService
    });
    expect(monitor).toBeInstanceOf(ExitCriteriaMonitor);
  });

  it('should create monitor with custom configuration', () => {
    const monitor = createExitCriteriaMonitor({
      guidelinesManager,
      marketDataService,
      loggingService,
      checkIntervalMs: 30000
    });
    expect(monitor).toBeInstanceOf(ExitCriteriaMonitor);
  });
});
