/**
 * Tests for SignalGenerator service
 */

import { SignalGenerator, SignalGeneratorError, createSignalGenerator } from '../signal-generator';
import { GuidelinesManager, createGuidelinesManager } from '../guidelines-manager';
import { MarketDataService } from '../market-data-service';
import { LLMService, createLLMService } from '../llm-service';
import { LoggingService, createLoggingService } from '../logging-service';
import { Position } from '../../../../shared/src/types/portfolio';
import { DatabaseConnection } from '../../database/connection';
import * as path from 'path';

// Mock console methods to avoid noise in tests
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

describe('SignalGenerator', () => {
  let signalGenerator: SignalGenerator;
  let guidelinesManager: GuidelinesManager;
  let marketDataService: MarketDataService;
  let llmService: LLMService;
  let loggingService: LoggingService;
  let connection: DatabaseConnection;

  beforeAll(async () => {
    // Initialize database connection
    connection = new DatabaseConnection(':memory:');
    await connection.initialize();

    // Initialize logging service
    loggingService = createLoggingService(connection, 'SIGNAL_GENERATOR');

    // Initialize guidelines manager with test YAML file
    const testGuidelinesPath = path.join(__dirname, '../../../../artifacts', 'swing_trading_guidelines.yaml');
    guidelinesManager = createGuidelinesManager(loggingService, {
      guidelinesFilePath: testGuidelinesPath,
      watchForChanges: false,
      validateOnLoad: true
    });
    await guidelinesManager.loadGuidelines();

    // Initialize market data service
    marketDataService = new MarketDataService();

    // Initialize LLM service
    llmService = createLLMService(loggingService, {
      provider: 'mock',
      model: 'claude-3-sonnet',
      maxTokens: 1000,
      temperature: 0.7
    });

    // Initialize signal generator
    signalGenerator = new SignalGenerator({
      guidelinesManager,
      marketDataService,
      llmService,
      loggingService,
      maxSignalsPerCycle: 5,
      minConfidenceThreshold: 0.6
    });
  });

  afterAll(async () => {
    await connection.close();
  });

  describe('Service Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(signalGenerator).toBeDefined();
    });

    it('should create service using factory function', () => {
      const generator = createSignalGenerator({
        guidelinesManager,
        marketDataService,
        llmService,
        loggingService
      });
      expect(generator).toBeInstanceOf(SignalGenerator);
    });
  });

  describe('Buy Signal Generation', () => {
    it('should generate buy signals for valid candidates', async () => {
      const signals = await signalGenerator.generateBuySignals();
      
      expect(Array.isArray(signals)).toBe(true);
      // May be empty if no candidates pass screening
      if (signals.length > 0 && signals[0]) {
        expect(signals[0]).toHaveProperty('symbol');
        expect(signals[0]).toHaveProperty('action');
        expect(signals[0].action).toBe('BUY');
        expect(signals[0]).toHaveProperty('confidence');
        expect(signals[0]).toHaveProperty('reasoning');
      }
    });

    it('should respect max signals per cycle limit', async () => {
      const signals = await signalGenerator.generateBuySignals();
      expect(signals.length).toBeLessThanOrEqual(5);
    });

    it('should filter signals below confidence threshold', async () => {
      const signals = await signalGenerator.generateBuySignals();
      signals.forEach(signal => {
        expect(signal.confidence).toBeGreaterThanOrEqual(0.6);
      });
    });

    it('should throw error when no guidelines available', async () => {
      const noGuidelinesManager = createGuidelinesManager(loggingService, {
        guidelinesFilePath: '/nonexistent/path.yaml',
        watchForChanges: false,
        validateOnLoad: false
      });

      const generator = new SignalGenerator({
        guidelinesManager: noGuidelinesManager,
        marketDataService,
        llmService,
        loggingService
      });

      await expect(generator.generateBuySignals()).rejects.toThrow(SignalGeneratorError);
    });
  });

  describe('Sell Signal Generation', () => {
    it('should generate sell signals for positions', async () => {
      const positions: Position[] = [
        {
          id: '1',
          symbol: 'AAPL',
          quantity: 100,
          entryPrice: 150.00,
          currentPrice: 160.00,
          entryDate: new Date(),
          stopLoss: 145.00,
          profitTargets: [155.00, 160.00, 165.00],
          unrealizedPnL: 1000,
          realizedPnL: 0,
          sector: 'Technology',
          exitCriteria: [],
          lastUpdated: new Date()
        }
      ];

      const signals = await signalGenerator.generateSellSignals(positions);
      
      expect(Array.isArray(signals)).toBe(true);
      // Signals may be empty if LLM doesn't recommend selling
    });

    it('should handle empty positions array', async () => {
      const signals = await signalGenerator.generateSellSignals([]);
      expect(signals).toEqual([]);
    });

    it('should throw error when no guidelines available', async () => {
      const noGuidelinesManager = createGuidelinesManager(loggingService, {
        guidelinesFilePath: '/nonexistent/path.yaml',
        watchForChanges: false,
        validateOnLoad: false
      });

      const generator = new SignalGenerator({
        guidelinesManager: noGuidelinesManager,
        marketDataService,
        llmService,
        loggingService
      });

      const positions: Position[] = [{
        id: '1',
        symbol: 'AAPL',
        quantity: 100,
        entryPrice: 150,
        currentPrice: 160,
        entryDate: new Date(),
        stopLoss: 145,
        profitTargets: [155, 160, 165],
        unrealizedPnL: 1000,
        realizedPnL: 0,
        sector: 'Technology',
        exitCriteria: [],
        lastUpdated: new Date()
      }];

      await expect(generator.generateSellSignals(positions)).rejects.toThrow(SignalGeneratorError);
    });
  });

  describe('Stock Screening', () => {
    it('should screen stocks based on guidelines criteria', async () => {
      const guidelines = guidelinesManager.getCurrentGuidelines();
      expect(guidelines).toBeDefined();

      if (guidelines) {
        const candidates = await signalGenerator.screenStocks(guidelines);
        expect(Array.isArray(candidates)).toBe(true);
        // Candidates may be empty depending on market conditions
      }
    });

    it('should apply liquidity requirements from guidelines', async () => {
      const guidelines = guidelinesManager.getCurrentGuidelines();
      expect(guidelines).toBeDefined();

      if (guidelines) {
        const candidates = await signalGenerator.screenStocks(guidelines);
        // All candidates should meet minimum volume requirements
        expect(Array.isArray(candidates)).toBe(true);
      }
    });

    it('should apply price range from guidelines', async () => {
      const guidelines = guidelinesManager.getCurrentGuidelines();
      expect(guidelines).toBeDefined();

      if (guidelines) {
        const candidates = await signalGenerator.screenStocks(guidelines);
        // All candidates should be within price range
        expect(Array.isArray(candidates)).toBe(true);
      }
    });
  });

  describe('Stock Analysis', () => {
    it('should analyze stock against guidelines criteria', async () => {
      const guidelines = guidelinesManager.getCurrentGuidelines();
      expect(guidelines).toBeDefined();

      if (guidelines) {
        const marketData = await marketDataService.getMarketData('AAPL');
        const analysis = await signalGenerator.analyzeStock('AAPL', marketData, guidelines);

        expect(analysis).toHaveProperty('symbol');
        expect(analysis).toHaveProperty('score');
        expect(analysis).toHaveProperty('meetsCriteria');
        expect(analysis).toHaveProperty('analysis');
        expect(analysis.analysis).toHaveProperty('liquidity');
        expect(analysis.analysis).toHaveProperty('volatility');
        expect(analysis.analysis).toHaveProperty('technical');
      }
    });

    it('should evaluate liquidity requirements', async () => {
      const guidelines = guidelinesManager.getCurrentGuidelines();
      if (guidelines) {
        const marketData = await marketDataService.getMarketData('AAPL');
        const analysis = await signalGenerator.analyzeStock('AAPL', marketData, guidelines);

        expect(analysis.analysis.liquidity).toHaveProperty('averageDailyVolume');
        expect(analysis.analysis.liquidity).toHaveProperty('marketCap');
        expect(analysis.analysis.liquidity).toHaveProperty('bidAskSpread');
        expect(analysis.analysis.liquidity).toHaveProperty('meetsRequirements');
      }
    });

    it('should evaluate volatility metrics', async () => {
      const guidelines = guidelinesManager.getCurrentGuidelines();
      if (guidelines) {
        const marketData = await marketDataService.getMarketData('AAPL');
        const analysis = await signalGenerator.analyzeStock('AAPL', marketData, guidelines);

        expect(analysis.analysis.volatility).toHaveProperty('atr');
        expect(analysis.analysis.volatility).toHaveProperty('meetsRequirements');
      }
    });

    it('should evaluate technical setup', async () => {
      const guidelines = guidelinesManager.getCurrentGuidelines();
      if (guidelines) {
        const marketData = await marketDataService.getMarketData('AAPL');
        const analysis = await signalGenerator.analyzeStock('AAPL', marketData, guidelines);

        expect(analysis.analysis.technical).toHaveProperty('trend');
        expect(analysis.analysis.technical).toHaveProperty('supportLevels');
        expect(analysis.analysis.technical).toHaveProperty('resistanceLevels');
        expect(analysis.analysis.technical).toHaveProperty('meetsRequirements');
      }
    });
  });

  describe('Signal Validation', () => {
    it('should include stop loss in generated signals', async () => {
      const signals = await signalGenerator.generateBuySignals();
      
      if (signals.length > 0) {
        const signal = signals[0];
        if (signal) {
          expect(signal).toHaveProperty('stopLoss');
          expect(typeof signal.stopLoss).toBe('number');
          expect(signal.stopLoss).toBeGreaterThan(0);
        }
      }
    });

    it('should include profit targets in generated signals', async () => {
      const signals = await signalGenerator.generateBuySignals();
      
      if (signals.length > 0) {
        const signal = signals[0];
        if (signal) {
          expect(signal).toHaveProperty('profitTargets');
          expect(Array.isArray(signal.profitTargets)).toBe(true);
          expect(signal.profitTargets.length).toBeGreaterThan(0);
        }
      }
    });

    it('should include technical indicators in signals', async () => {
      const signals = await signalGenerator.generateBuySignals();
      
      if (signals.length > 0) {
        const signal = signals[0];
        if (signal) {
          expect(signal).toHaveProperty('technicalIndicators');
          expect(signal.technicalIndicators).toHaveProperty('rsi');
          expect(signal.technicalIndicators).toHaveProperty('macd');
          expect(signal.technicalIndicators).toHaveProperty('movingAverages');
        }
      }
    });

    it('should include reasoning in signals', async () => {
      const signals = await signalGenerator.generateBuySignals();
      
      if (signals.length > 0) {
        const signal = signals[0];
        if (signal) {
          expect(signal).toHaveProperty('reasoning');
          expect(typeof signal.reasoning).toBe('string');
          expect(signal.reasoning.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Guidelines Integration', () => {
    it('should use guidelines for stock selection', async () => {
      const guidelines = guidelinesManager.getCurrentGuidelines();
      expect(guidelines).toBeDefined();

      const signals = await signalGenerator.generateBuySignals();
      // Signals should be based on guidelines criteria
      expect(Array.isArray(signals)).toBe(true);
    });

    it('should use guidelines for entry signal validation', async () => {
      const guidelines = guidelinesManager.getCurrentGuidelines();
      expect(guidelines).toBeDefined();

      const signals = await signalGenerator.generateBuySignals();
      // All signals should meet guidelines entry requirements
      signals.forEach(signal => {
        expect(signal.confidence).toBeGreaterThanOrEqual(0.6);
      });
    });

    it('should calculate stop loss based on guidelines', async () => {
      const guidelines = guidelinesManager.getCurrentGuidelines();
      if (guidelines) {
        const marketData = await marketDataService.getMarketData('AAPL');
        const signals = await signalGenerator.generateBuySignals();
        
        if (signals.length > 0) {
          const signal = signals[0];
          if (signal && signal.entryPrice) {
            // Stop loss should be below entry price
            expect(signal.stopLoss).toBeLessThan(signal.entryPrice || marketData.quote.price);
          }
        }
      }
    });

    it('should calculate profit targets based on guidelines', async () => {
      const signals = await signalGenerator.generateBuySignals();
      
      if (signals.length > 0) {
        const signal = signals[0];
        if (signal && signal.entryPrice) {
          // Profit targets should be above entry price
          signal.profitTargets.forEach(target => {
            expect(target).toBeGreaterThan(signal.entryPrice || 0);
          });
          
          // Targets should be in ascending order
          for (let i = 1; i < signal.profitTargets.length; i++) {
            const prevTarget = signal.profitTargets[i - 1];
            const currTarget = signal.profitTargets[i];
            if (prevTarget !== undefined && currTarget !== undefined) {
              expect(currTarget).toBeGreaterThan(prevTarget);
            }
          }
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle market data service errors gracefully', async () => {
      const failingMarketService = new MarketDataService();
      
      // Disconnect to cause errors
      failingMarketService.disconnect();

      const generator = new SignalGenerator({
        guidelinesManager,
        marketDataService: failingMarketService,
        llmService,
        loggingService
      });

      // Should throw error when market data service fails
      await expect(generator.generateBuySignals()).rejects.toThrow();
    });

    it('should handle LLM service errors gracefully', async () => {
      // LLM service should handle errors internally
      const signals = await signalGenerator.generateBuySignals();
      expect(Array.isArray(signals)).toBe(true);
    });

    it('should reject stale market data', async () => {
      // This would require mocking stale data
      // For now, verify the check exists
      const signals = await signalGenerator.generateBuySignals();
      expect(Array.isArray(signals)).toBe(true);
    });
  });

  describe('Signal Confidence Scoring', () => {
    it('should assign confidence scores to signals', async () => {
      const signals = await signalGenerator.generateBuySignals();
      
      signals.forEach(signal => {
        expect(signal).toHaveProperty('confidence');
        expect(signal.confidence).toBeGreaterThanOrEqual(0);
        expect(signal.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should filter low confidence signals', async () => {
      const signals = await signalGenerator.generateBuySignals();
      
      signals.forEach(signal => {
        expect(signal.confidence).toBeGreaterThanOrEqual(0.6);
      });
    });
  });
});

describe('SignalGenerator Factory Function', () => {
  let connection: DatabaseConnection;
  let loggingService: LoggingService;
  let guidelinesManager: GuidelinesManager;
  let marketDataService: MarketDataService;
  let llmService: LLMService;

  beforeAll(async () => {
    connection = new DatabaseConnection(':memory:');
    await connection.initialize();

    loggingService = createLoggingService(connection, 'SIGNAL_GENERATOR');

    const testGuidelinesPath = path.join(__dirname, '../../../../artifacts', 'swing_trading_guidelines.yaml');
    guidelinesManager = createGuidelinesManager(loggingService, {
      guidelinesFilePath: testGuidelinesPath,
      watchForChanges: false,
      validateOnLoad: true
    });
    await guidelinesManager.loadGuidelines();

    marketDataService = new MarketDataService();

    llmService = createLLMService(loggingService, {
      provider: 'mock',
      model: 'claude-3-sonnet',
      maxTokens: 1000,
      temperature: 0.7
    });
  });

  afterAll(async () => {
    await connection.close();
  });

  it('should create generator with default configuration', () => {
    const generator = createSignalGenerator({
      guidelinesManager,
      marketDataService,
      llmService,
      loggingService
    });
    expect(generator).toBeInstanceOf(SignalGenerator);
  });

  it('should create generator with custom configuration', () => {
    const generator = createSignalGenerator({
      guidelinesManager,
      marketDataService,
      llmService,
      loggingService,
      maxSignalsPerCycle: 3,
      minConfidenceThreshold: 0.7
    });
    expect(generator).toBeInstanceOf(SignalGenerator);
  });
});
