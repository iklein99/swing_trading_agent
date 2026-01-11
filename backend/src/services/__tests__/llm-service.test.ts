/**
 * Unit tests for LLMService
 * Tests LLM interaction logging, error handling, and mock response functionality
 */

import { LLMService, LLMServiceError, createLLMService, LLMServiceConfig } from '../llm-service';
import { LoggingService, createLoggingService } from '../logging-service';
import { DatabaseConnection } from '../../database/connection';
import {
  MarketData,
  Quote
} from '../../../../shared/src/types/market-data';
import {
  Trade,
  TradingSignal,
  TechnicalData
} from '../../../../shared/src/types/trading';
import {
  Portfolio,
  Position
} from '../../../../shared/src/types/portfolio';
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

describe('LLMService', () => {
  let db: DatabaseConnection;
  let loggingService: LoggingService;
  let llmService: LLMService;
  let mockMarketData: MarketData;
  let mockTrade: Trade;
  let mockSignal: TradingSignal;
  let mockPortfolio: Portfolio;

  beforeEach(async () => {
    // Create in-memory database for testing
    db = new DatabaseConnection(':memory:');
    await db.initialize();
    
    loggingService = createLoggingService(db, 'LLM_SERVICE');
    
    const config: LLMServiceConfig = {
      provider: 'mock',
      model: 'test-model',
      maxTokens: 1000,
      temperature: 0.7,
      timeout: 5000,
      retryAttempts: 2,
      retryDelay: 100
    };
    
    llmService = new LLMService(loggingService, config);

    // Setup mock data
    const mockQuote: Quote = {
      symbol: 'AAPL',
      price: 150.00,
      volume: 1000000,
      timestamp: new Date(),
      bid: 149.95,
      ask: 150.05,
      dayHigh: 152.00,
      dayLow: 148.00,
      dayOpen: 149.00,
      previousClose: 148.50,
      change: 1.50,
      changePercent: 1.01,
      marketCap: 2500000000000,
      averageVolume: 50000000
    };

    mockMarketData = {
      quote: mockQuote,
      historical: {
        symbol: 'AAPL',
        data: [],
        period: '1D',
        interval: '1d',
        lastUpdated: new Date()
      },
      technical: {
        symbol: 'AAPL',
        timestamp: new Date(),
        rsi: 65,
        macd: { value: 1.2, signal: 0.8, histogram: 0.4 },
        movingAverages: {
          sma20: 148,
          sma50: 145,
          sma200: 140,
          ema20: 149,
          ema50: 146,
          ema200: 141
        },
        atr: 2.5,
        atr14: 2.8,
        bollinger: { upper: 155, middle: 150, lower: 145 },
        stochastic: { k: 70, d: 65 },
        williams: -25,
        vwap: 150.5,
        obv: 1000000
      },
      lastUpdated: new Date()
    };

    const mockTechnicalData: TechnicalData = {
      rsi: 65,
      macd: { value: 1.2, signal: 0.8, histogram: 0.4 },
      movingAverages: {
        sma20: 148,
        sma50: 145,
        ema20: 149,
        ema50: 146
      },
      atr: 2.5,
      volume: 1000000,
      vwap: 150.5,
      support: [145, 140],
      resistance: [155, 160]
    };

    mockSignal = {
      id: uuidv4(),
      symbol: 'AAPL',
      action: 'BUY',
      confidence: 0.8,
      reasoning: 'Strong technical indicators',
      technicalIndicators: mockTechnicalData,
      recommendedSize: 100,
      entryPrice: 150.00,
      stopLoss: 145.00,
      profitTargets: [155.00, 160.00],
      timestamp: new Date()
    };

    mockTrade = {
      id: uuidv4(),
      symbol: 'AAPL',
      action: 'BUY',
      quantity: 100,
      price: 150.00,
      timestamp: new Date(),
      reasoning: 'LLM generated signal',
      signalId: mockSignal.id,
      fees: 1.00,
      status: 'EXECUTED'
    };

    const mockPosition: Position = {
      id: uuidv4(),
      symbol: 'AAPL',
      quantity: 100,
      entryPrice: 150.00,
      currentPrice: 152.00,
      entryDate: new Date(),
      stopLoss: 145.00,
      profitTargets: [155.00, 160.00],
      unrealizedPnL: 200.00,
      realizedPnL: 0.00,
      exitCriteria: [],
      sector: 'Technology',
      lastUpdated: new Date()
    };

    mockPortfolio = {
      id: uuidv4(),
      totalValue: 100000.00,
      cashBalance: 50000.00,
      positions: [mockPosition],
      dailyPnL: 200.00,
      totalPnL: 1000.00,
      lastUpdated: new Date(),
      createdAt: new Date()
    };
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Service Initialization', () => {
    test('should initialize with correct configuration', () => {
      const config: LLMServiceConfig = {
        provider: 'mock',
        model: 'test-model-2',
        maxTokens: 2000,
        temperature: 0.5,
        timeout: 10000,
        retryAttempts: 3,
        retryDelay: 200
      };

      const service = new LLMService(loggingService, config);
      expect(service).toBeDefined();

      const stats = service.getUsageStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
    });

    test('should create service using factory function', () => {
      const service = createLLMService(loggingService, { model: 'factory-test' });
      expect(service).toBeDefined();
    });
  });

  describe('generateTradingSignal', () => {
    test('should generate valid trading signal response', async () => {
      const prompt = 'Analyze AAPL for trading opportunity based on current market conditions';
      
      const response = await llmService.generateTradingSignal(prompt, mockMarketData);
      
      expect(response).toMatchObject({
        content: expect.any(String),
        confidence: expect.any(Number),
        reasoning: expect.any(String),
        metadata: {
          model: 'test-model',
          tokens: expect.any(Number),
          processingTime: expect.any(Number),
          cost: expect.any(Number)
        },
        success: true
      });

      expect(response.confidence).toBeGreaterThan(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
      expect(response.content).toContain('AAPL');
      expect(response.reasoning).toBeTruthy();
    });

    test('should log LLM interaction to database', async () => {
      const prompt = 'Test prompt for logging';
      
      await llmService.generateTradingSignal(prompt, mockMarketData);
      
      // Verify interaction was logged
      const interactions = await loggingService.getLLMInteractions();
      expect(interactions).toHaveLength(1);
      
      const interaction = interactions[0]!;
      expect(interaction.prompt).toBe(prompt);
      expect(interaction.model).toBe('test-model');
      expect(interaction.success).toBe(true);
      expect(interaction.processingTime).toBeGreaterThan(0);
      expect(interaction.tokenUsage.totalTokens).toBeGreaterThan(0);
    });

    test('should update usage statistics', async () => {
      const initialStats = llmService.getUsageStats();
      expect(initialStats.totalRequests).toBe(0);
      
      await llmService.generateTradingSignal('Test prompt', mockMarketData);
      
      const updatedStats = llmService.getUsageStats();
      expect(updatedStats.totalRequests).toBe(1);
      expect(updatedStats.successfulRequests).toBe(1);
      expect(updatedStats.failedRequests).toBe(0);
      expect(updatedStats.totalTokens).toBeGreaterThan(0);
      expect(updatedStats.averageResponseTime).toBeGreaterThan(0);
    });

    test('should handle empty prompt error', async () => {
      await expect(llmService.generateTradingSignal('', mockMarketData))
        .rejects.toThrow(LLMServiceError);
      
      await expect(llmService.generateTradingSignal('   ', mockMarketData))
        .rejects.toThrow('Prompt cannot be empty');
    });

    test('should handle invalid market data error', async () => {
      const invalidMarketData = { ...mockMarketData, quote: { ...mockMarketData.quote, symbol: '' } };
      
      await expect(llmService.generateTradingSignal('Test prompt', invalidMarketData))
        .rejects.toThrow(LLMServiceError);
      
      await expect(llmService.generateTradingSignal('Test prompt', invalidMarketData))
        .rejects.toThrow('Market data is required');
    });

    test('should log failed interactions', async () => {
      try {
        await llmService.generateTradingSignal('', mockMarketData);
      } catch (error) {
        // Expected to fail
      }
      
      const interactions = await loggingService.getLLMInteractions();
      expect(interactions).toHaveLength(1);
      
      const interaction = interactions[0]!;
      expect(interaction.success).toBe(false);
      expect(interaction.error).toBeTruthy();
    });
  });

  describe('analyzeMarketConditions', () => {
    test('should analyze multiple market data points', async () => {
      const marketDataArray = [mockMarketData, { 
        ...mockMarketData, 
        quote: { ...mockMarketData.quote, symbol: 'MSFT' },
        historical: { ...mockMarketData.historical, symbol: 'MSFT' },
        technical: { ...mockMarketData.technical, symbol: 'MSFT' }
      }];
      
      const response = await llmService.analyzeMarketConditions(marketDataArray);
      
      expect(response).toMatchObject({
        content: expect.any(String),
        confidence: expect.any(Number),
        reasoning: expect.any(String),
        success: true
      });

      expect(response.content).toContain('Market Sentiment');
      expect(response.reasoning).toContain('2 symbols');
    });

    test('should handle empty market data array', async () => {
      await expect(llmService.analyzeMarketConditions([]))
        .rejects.toThrow(LLMServiceError);
      
      await expect(llmService.analyzeMarketConditions([]))
        .rejects.toThrow('Market data array cannot be empty');
    });

    test('should generate different sentiment based on data', async () => {
      // Test with high price/volume data
      const bullishData = [{
        ...mockMarketData,
        quote: { ...mockMarketData.quote!, price: 200, volume: 15000000 }
      }];
      
      const bullishResponse = await llmService.analyzeMarketConditions(bullishData);
      expect(bullishResponse.content).toContain('BULLISH');
      
      // Test with low price/volume data
      const bearishData = [{
        ...mockMarketData,
        quote: { ...mockMarketData.quote!, price: 50, volume: 3000000 }
      }];
      
      const bearishResponse = await llmService.analyzeMarketConditions(bearishData);
      expect(bearishResponse.content).toContain('BEARISH');
    });
  });

  describe('explainTrade', () => {
    test('should explain trade decision', async () => {
      const response = await llmService.explainTrade(mockTrade, mockMarketData);
      
      expect(response).toMatchObject({
        content: expect.any(String),
        confidence: expect.any(Number),
        reasoning: expect.any(String),
        success: true
      });

      expect(response.content).toContain('Trade Explanation');
      expect(response.content).toContain(mockTrade.symbol);
      expect(response.content).toContain(mockTrade.action);
      expect(response.confidence).toBe(0.9); // High confidence for explanations
    });

    test('should log interaction with trade ID', async () => {
      await llmService.explainTrade(mockTrade, mockMarketData);
      
      const interactions = await loggingService.getLLMInteractions();
      expect(interactions).toHaveLength(1);
      
      const interaction = interactions[0]!;
      expect(interaction.associatedTradeId).toBe(mockTrade.id);
    });

    test('should handle invalid trade object', async () => {
      const invalidTrade = { ...mockTrade, id: '' };
      
      await expect(llmService.explainTrade(invalidTrade, mockMarketData))
        .rejects.toThrow(LLMServiceError);
      
      await expect(llmService.explainTrade(invalidTrade, mockMarketData))
        .rejects.toThrow('Valid trade object is required');
    });
  });

  describe('assessRisk', () => {
    test('should assess risk for trading signal', async () => {
      const response = await llmService.assessRisk(mockSignal, mockPortfolio);
      
      expect(response).toMatchObject({
        content: expect.any(String),
        confidence: expect.any(Number),
        reasoning: expect.any(String),
        success: true
      });

      expect(response.content).toContain('Risk Assessment');
      expect(response.content).toMatch(/LOW|MEDIUM|HIGH/);
      expect(response.reasoning).toContain('portfolio value');
    });

    test('should log interaction with signal ID', async () => {
      await llmService.assessRisk(mockSignal, mockPortfolio);
      
      const interactions = await loggingService.getLLMInteractions();
      expect(interactions).toHaveLength(1);
      
      const interaction = interactions[0]!;
      expect(interaction.associatedSignalId).toBe(mockSignal.id);
    });

    test('should assess different risk levels based on position size', async () => {
      // Test high risk scenario
      const highRiskSignal = {
        ...mockSignal,
        recommendedSize: 1000 // Large position
      };
      
      const highRiskResponse = await llmService.assessRisk(highRiskSignal, mockPortfolio);
      expect(highRiskResponse.content).toContain('HIGH RISK');
      
      // Test low risk scenario
      const lowRiskSignal = {
        ...mockSignal,
        recommendedSize: 10 // Small position
      };
      
      const lowRiskResponse = await llmService.assessRisk(lowRiskSignal, mockPortfolio);
      expect(lowRiskResponse.content).toContain('LOW RISK');
    });

    test('should handle invalid signal object', async () => {
      const invalidSignal = { ...mockSignal, id: '' };
      
      await expect(llmService.assessRisk(invalidSignal, mockPortfolio))
        .rejects.toThrow(LLMServiceError);
    });
  });

  describe('Health Check', () => {
    test('should return healthy status by default', async () => {
      const isHealthy = await llmService.isHealthy();
      expect(isHealthy).toBe(true);
    });

    test('should allow setting health status', async () => {
      llmService.setHealthy(false);
      
      const isHealthy = await llmService.isHealthy();
      expect(isHealthy).toBe(false);
      
      llmService.setHealthy(true);
      const isHealthyAgain = await llmService.isHealthy();
      expect(isHealthyAgain).toBe(true);
    });
  });

  describe('Usage Statistics', () => {
    test('should track successful and failed requests', async () => {
      // Make successful request
      await llmService.generateTradingSignal('Valid prompt', mockMarketData);
      
      // Make failed request
      try {
        await llmService.generateTradingSignal('', mockMarketData);
      } catch (error) {
        // Expected to fail
      }
      
      const stats = llmService.getUsageStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.successfulRequests).toBe(1);
      expect(stats.failedRequests).toBe(1);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.totalCost).toBeGreaterThan(0);
    });

    test('should calculate average response time', async () => {
      await llmService.generateTradingSignal('Test 1', mockMarketData);
      await llmService.generateTradingSignal('Test 2', mockMarketData);
      
      const stats = llmService.getUsageStats();
      expect(stats.averageResponseTime).toBeGreaterThan(0);
      expect(stats.lastRequest).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling and Fallback Mechanisms', () => {
    test('should handle service errors gracefully', async () => {
      // Simulate service being unhealthy
      llmService.setHealthy(false);
      
      // Service should still process requests (mock implementation)
      const response = await llmService.generateTradingSignal('Test prompt', mockMarketData);
      expect(response.success).toBe(true);
    });

    test('should wrap unknown errors in LLMServiceError', async () => {
      // Test with null market data to trigger unknown error path
      const nullMarketData = null as any;
      
      await expect(llmService.generateTradingSignal('Test', nullMarketData))
        .rejects.toThrow(LLMServiceError);
    });

    test('should handle database logging failures gracefully', async () => {
      // Close database to simulate logging failure
      await db.close();
      
      // Service should still work even if logging fails
      const response = await llmService.generateTradingSignal('Test prompt', mockMarketData);
      expect(response.success).toBe(true);
    });
  });

  describe('Mock Response Behavior', () => {
    test('should generate different responses based on market conditions', async () => {
      // High price, high volume scenario
      const highPriceData = {
        ...mockMarketData,
        quote: { ...mockMarketData.quote!, price: 250, volume: 3000000 }
      };
      
      const highPriceResponse = await llmService.generateTradingSignal('Test', highPriceData);
      expect(highPriceResponse.content).toContain('SELL');
      expect(highPriceResponse.confidence).toBeGreaterThan(0.7);
      
      // Low price, high volume scenario
      const lowPriceData = {
        ...mockMarketData,
        quote: { ...mockMarketData.quote!, price: 40, volume: 2000000 }
      };
      
      const lowPriceResponse = await llmService.generateTradingSignal('Test', lowPriceData);
      expect(lowPriceResponse.content).toContain('BUY');
      expect(lowPriceResponse.confidence).toBeGreaterThan(0.8);
    });

    test('should simulate processing delays', async () => {
      const startTime = Date.now();
      
      await llmService.generateTradingSignal('Test prompt', mockMarketData);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should have some delay (at least 100ms from mock implementation)
      expect(processingTime).toBeGreaterThan(100);
    });
  });

  describe('Prompt and Response Data Integrity', () => {
    test('should preserve prompt content in logs', async () => {
      const originalPrompt = 'Analyze AAPL stock with detailed technical analysis including RSI, MACD, and volume indicators';
      
      await llmService.generateTradingSignal(originalPrompt, mockMarketData);
      
      const interactions = await loggingService.getLLMInteractions();
      expect(interactions[0]!.prompt).toBe(originalPrompt);
    });

    test('should generate consistent response structure', async () => {
      const responses = [];
      
      for (let i = 0; i < 3; i++) {
        const response = await llmService.generateTradingSignal(`Test ${i}`, mockMarketData);
        responses.push(response);
      }
      
      responses.forEach(response => {
        expect(response).toHaveProperty('content');
        expect(response).toHaveProperty('confidence');
        expect(response).toHaveProperty('reasoning');
        expect(response).toHaveProperty('metadata');
        expect(response).toHaveProperty('success');
        
        expect(response.metadata).toHaveProperty('model');
        expect(response.metadata).toHaveProperty('tokens');
        expect(response.metadata).toHaveProperty('processingTime');
        expect(response.metadata).toHaveProperty('cost');
      });
    });

    test('should validate token usage calculations', async () => {
      const shortPrompt = 'Buy AAPL?';
      const longPrompt = 'Provide a comprehensive analysis of Apple Inc. stock including technical indicators, market sentiment, volume analysis, support and resistance levels, and risk assessment for a potential swing trade position';
      
      const shortResponse = await llmService.generateTradingSignal(shortPrompt, mockMarketData);
      const longResponse = await llmService.generateTradingSignal(longPrompt, mockMarketData);
      
      // Longer prompt should result in more tokens
      expect(longResponse.metadata.tokens).toBeGreaterThan(shortResponse.metadata.tokens);
      
      // Verify token usage is logged correctly
      const interactions = await loggingService.getLLMInteractions();
      expect(interactions).toHaveLength(2);
      
      const shortInteraction = interactions.find(i => i.prompt === shortPrompt);
      const longInteraction = interactions.find(i => i.prompt === longPrompt);
      
      expect(longInteraction!.tokenUsage.totalTokens).toBeGreaterThan(shortInteraction!.tokenUsage.totalTokens);
    });
  });
});

describe('LLMService Factory Function', () => {
  let db: DatabaseConnection;
  let loggingService: LoggingService;

  beforeEach(async () => {
    db = new DatabaseConnection(':memory:');
    await db.initialize();
    loggingService = createLoggingService(db, 'LLM_SERVICE');
  });

  afterEach(async () => {
    await db.close();
  });

  test('should create service with default configuration', () => {
    const service = createLLMService(loggingService);
    expect(service).toBeInstanceOf(LLMService);
    
    const stats = service.getUsageStats();
    expect(stats.totalRequests).toBe(0);
  });

  test('should create service with custom configuration', () => {
    const customConfig = {
      provider: 'mock' as const,
      model: 'custom-model',
      maxTokens: 5000,
      temperature: 0.3
    };
    
    const service = createLLMService(loggingService, customConfig);
    expect(service).toBeInstanceOf(LLMService);
  });

  test('should merge custom config with defaults', () => {
    const partialConfig = {
      model: 'partial-config-model'
    };
    
    const service = createLLMService(loggingService, partialConfig);
    expect(service).toBeInstanceOf(LLMService);
  });
});