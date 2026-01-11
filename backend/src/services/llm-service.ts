/**
 * LLM Service for generating trading signals and market analysis
 * Provides mock implementation for development and testing
 */

import { v4 as uuidv4 } from 'uuid';
import {
  LLMServiceInterface,
  LLMResponse,
  LLMUsageStats
} from '../../../shared/src/types/interfaces';
import {
  MarketData
} from '../../../shared/src/types/market-data';
import {
  Trade
} from '../../../shared/src/types/trading';
import {
  Portfolio
} from '../../../shared/src/types/portfolio';
import {
  TradingSignal
} from '../../../shared/src/types/trading';
import {
  LLMInteraction
} from '../../../shared/src/types/logging';
import { LoggingService } from './logging-service';

export class LLMServiceError extends Error {
  constructor(message: string, public readonly code: string, public readonly retryable: boolean = false) {
    super(message);
    this.name = 'LLMServiceError';
  }
}

export interface LLMServiceConfig {
  provider: 'mock' | 'aws-bedrock' | 'openai';
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export class LLMService implements LLMServiceInterface {
  private logger: LoggingService;
  private config: LLMServiceConfig;
  private usageStats: LLMUsageStats;
  private healthStatus: boolean = true;

  constructor(logger: LoggingService, config: LLMServiceConfig) {
    this.logger = logger;
    this.config = config;
    this.usageStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      averageResponseTime: 0,
      lastRequest: new Date()
    };

    this.logger.info('LLM Service initialized', { 
      provider: config.provider, 
      model: config.model 
    });
  }

  /**
   * Generate trading signal based on prompt and market data
   */
  async generateTradingSignal(prompt: string, marketData: MarketData): Promise<LLMResponse> {
    const startTime = Date.now();
    const interactionId = uuidv4();

    try {
      // Validate inputs
      if (!prompt || prompt.trim().length === 0) {
        throw new LLMServiceError('Prompt cannot be empty', 'INVALID_PROMPT');
      }

      if (!marketData || !marketData.quote || !marketData.quote.symbol) {
        throw new LLMServiceError('Market data is required', 'INVALID_MARKET_DATA');
      }

      this.logger.info('Generating trading signal', { 
        interactionId, 
        symbol: marketData.quote.symbol,
        promptLength: prompt.length 
      });

      // Mock implementation - simulate processing time
      await this.simulateProcessingDelay();

      const response = await this.mockGenerateTradingSignal(prompt, marketData);
      const processingTime = Date.now() - startTime;

      // Update usage stats
      this.updateUsageStats(true, processingTime, response.metadata.tokens);

      // Log LLM interaction
      await this.logInteraction({
        id: interactionId,
        timestamp: new Date(),
        prompt,
        response: response.content,
        model: this.config.model,
        processingTime,
        tokenUsage: {
          promptTokens: Math.floor(prompt.length / 4), // Rough estimate
          completionTokens: Math.floor(response.content.length / 4),
          totalTokens: response.metadata.tokens,
          cost: response.metadata.cost || 0
        },
        success: response.success,
        retryCount: 0
      });

      this.logger.info('Trading signal generated successfully', {
        interactionId,
        confidence: response.confidence,
        processingTime
      });

      return response;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateUsageStats(false, processingTime, 0);

      // Log failed interaction
      await this.logInteraction({
        id: interactionId,
        timestamp: new Date(),
        prompt,
        response: '',
        model: this.config.model,
        processingTime,
        tokenUsage: {
          promptTokens: Math.floor(prompt.length / 4),
          completionTokens: 0,
          totalTokens: Math.floor(prompt.length / 4)
        },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryCount: 0
      });

      this.logger.error('Failed to generate trading signal', error as Error, { interactionId });

      if (error instanceof LLMServiceError) {
        throw error;
      }

      throw new LLMServiceError(
        `Failed to generate trading signal: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GENERATION_FAILED',
        true
      );
    }
  }

  /**
   * Analyze market conditions using LLM
   */
  async analyzeMarketConditions(marketData: MarketData[]): Promise<LLMResponse> {
    const startTime = Date.now();
    const interactionId = uuidv4();

    this.logger.info('Analyzing market conditions', { 
      interactionId, 
      symbolCount: marketData.length 
    });

    try {
      if (!marketData || marketData.length === 0) {
        throw new LLMServiceError('Market data array cannot be empty', 'INVALID_MARKET_DATA');
      }

      await this.simulateProcessingDelay();

      const response = await this.mockAnalyzeMarketConditions(marketData);
      const processingTime = Date.now() - startTime;

      this.updateUsageStats(true, processingTime, response.metadata.tokens);

      const prompt = `Analyze market conditions for ${marketData.length} symbols`;
      await this.logInteraction({
        id: interactionId,
        timestamp: new Date(),
        prompt,
        response: response.content,
        model: this.config.model,
        processingTime,
        tokenUsage: {
          promptTokens: Math.floor(prompt.length / 4),
          completionTokens: Math.floor(response.content.length / 4),
          totalTokens: response.metadata.tokens,
          cost: response.metadata.cost || 0
        },
        success: response.success,
        retryCount: 0
      });

      this.logger.info('Market conditions analyzed successfully', {
        interactionId,
        confidence: response.confidence,
        processingTime
      });

      return response;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateUsageStats(false, processingTime, 0);

      this.logger.error('Failed to analyze market conditions', error as Error, { interactionId });

      if (error instanceof LLMServiceError) {
        throw error;
      }

      throw new LLMServiceError(
        `Failed to analyze market conditions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ANALYSIS_FAILED',
        true
      );
    }
  }

  /**
   * Explain a trade decision using LLM
   */
  async explainTrade(trade: Trade, marketData: MarketData): Promise<LLMResponse> {
    const startTime = Date.now();
    const interactionId = uuidv4();

    this.logger.info('Explaining trade', { 
      interactionId, 
      tradeId: trade.id,
      symbol: trade.symbol,
      action: trade.action 
    });

    try {
      if (!trade || !trade.id) {
        throw new LLMServiceError('Valid trade object is required', 'INVALID_TRADE');
      }

      if (!marketData || !marketData.quote || !marketData.quote.symbol) {
        throw new LLMServiceError('Market data is required', 'INVALID_MARKET_DATA');
      }

      await this.simulateProcessingDelay();

      const response = await this.mockExplainTrade(trade, marketData);
      const processingTime = Date.now() - startTime;

      this.updateUsageStats(true, processingTime, response.metadata.tokens);

      const prompt = `Explain ${trade.action} trade for ${trade.symbol} at $${trade.price}`;
      await this.logInteraction({
        id: interactionId,
        timestamp: new Date(),
        prompt,
        response: response.content,
        model: this.config.model,
        processingTime,
        tokenUsage: {
          promptTokens: Math.floor(prompt.length / 4),
          completionTokens: Math.floor(response.content.length / 4),
          totalTokens: response.metadata.tokens,
          cost: response.metadata.cost || 0
        },
        associatedTradeId: trade.id,
        success: response.success,
        retryCount: 0
      });

      this.logger.info('Trade explanation generated successfully', {
        interactionId,
        tradeId: trade.id,
        processingTime
      });

      return response;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateUsageStats(false, processingTime, 0);

      this.logger.error('Failed to explain trade', error as Error, { 
        interactionId, 
        tradeId: trade.id 
      });

      if (error instanceof LLMServiceError) {
        throw error;
      }

      throw new LLMServiceError(
        `Failed to explain trade: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXPLANATION_FAILED',
        true
      );
    }
  }

  /**
   * Assess risk for a trading signal using LLM
   */
  async assessRisk(signal: TradingSignal, portfolio: Portfolio): Promise<LLMResponse> {
    const startTime = Date.now();
    const interactionId = uuidv4();

    this.logger.info('Assessing risk', { 
      interactionId, 
      signalId: signal.id,
      symbol: signal.symbol,
      action: signal.action 
    });

    try {
      if (!signal || !signal.id) {
        throw new LLMServiceError('Valid trading signal is required', 'INVALID_SIGNAL');
      }

      if (!portfolio) {
        throw new LLMServiceError('Portfolio data is required', 'INVALID_PORTFOLIO');
      }

      await this.simulateProcessingDelay();

      const response = await this.mockAssessRisk(signal, portfolio);
      const processingTime = Date.now() - startTime;

      this.updateUsageStats(true, processingTime, response.metadata.tokens);

      const prompt = `Assess risk for ${signal.action} signal on ${signal.symbol}`;
      await this.logInteraction({
        id: interactionId,
        timestamp: new Date(),
        prompt,
        response: response.content,
        model: this.config.model,
        processingTime,
        tokenUsage: {
          promptTokens: Math.floor(prompt.length / 4),
          completionTokens: Math.floor(response.content.length / 4),
          totalTokens: response.metadata.tokens,
          cost: response.metadata.cost || 0
        },
        associatedSignalId: signal.id,
        success: response.success,
        retryCount: 0
      });

      this.logger.info('Risk assessment completed successfully', {
        interactionId,
        signalId: signal.id,
        processingTime
      });

      return response;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateUsageStats(false, processingTime, 0);

      this.logger.error('Failed to assess risk', error as Error, { 
        interactionId, 
        signalId: signal.id 
      });

      if (error instanceof LLMServiceError) {
        throw error;
      }

      throw new LLMServiceError(
        `Failed to assess risk: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RISK_ASSESSMENT_FAILED',
        true
      );
    }
  }

  /**
   * Check if the LLM service is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      // For mock implementation, simulate a simple health check
      await this.simulateProcessingDelay(100); // Short delay for health check
      
      this.logger.debug('LLM service health check completed', { healthy: this.healthStatus });
      return this.healthStatus;
    } catch (error) {
      this.logger.error('LLM service health check failed', error as Error);
      this.healthStatus = false;
      return false;
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): LLMUsageStats {
    return { ...this.usageStats };
  }

  /**
   * Set service health status (for testing)
   */
  setHealthy(healthy: boolean): void {
    this.healthStatus = healthy;
    this.logger.info('LLM service health status changed', { healthy });
  }

  /**
   * Mock implementation for generating trading signals
   */
  private async mockGenerateTradingSignal(prompt: string, marketData: MarketData): Promise<LLMResponse> {
    // Simulate different types of responses based on market data
    const price = marketData.quote?.price || 100;
    const volume = marketData.quote?.volume || 1000000;
    
    let action: 'BUY' | 'SELL' = 'BUY';
    let confidence = 0.7;
    let reasoning = '';

    // Simple mock logic based on price and volume
    if (price > 200 && volume > 2000000) {
      action = 'SELL';
      confidence = 0.8;
      reasoning = 'High price with strong volume suggests potential resistance level. Consider taking profits.';
    } else if (price < 50 && volume > 1500000) {
      action = 'BUY';
      confidence = 0.85;
      reasoning = 'Low price with high volume indicates potential value opportunity with strong interest.';
    } else {
      confidence = 0.6;
      reasoning = 'Moderate market conditions. Standard position sizing recommended.';
    }

    const content = `${action} signal for ${marketData.quote.symbol} at $${price}. Confidence: ${confidence}. ${reasoning}`;

    return {
      content,
      confidence,
      reasoning,
      metadata: {
        model: this.config.model,
        tokens: Math.floor(content.length / 4) + Math.floor(prompt.length / 4),
        processingTime: 0, // Will be set by caller
        cost: 0.001 // Mock cost
      },
      success: true
    };
  }

  /**
   * Mock implementation for market analysis
   */
  private async mockAnalyzeMarketConditions(marketData: MarketData[]): Promise<LLMResponse> {
    const symbolCount = marketData.length;
    const avgPrice = marketData.reduce((sum, data) => sum + (data.quote?.price || 0), 0) / symbolCount;
    const totalVolume = marketData.reduce((sum, data) => sum + (data.quote?.volume || 0), 0);

    let sentiment = 'NEUTRAL';
    let confidence = 0.7;

    if (avgPrice > 150 && totalVolume > 10000000) {
      sentiment = 'BULLISH';
      confidence = 0.8;
    } else if (avgPrice < 75 && totalVolume < 5000000) {
      sentiment = 'BEARISH';
      confidence = 0.75;
    }

    const reasoning = `Market analysis of ${symbolCount} symbols shows ${sentiment} sentiment. Average price: $${avgPrice.toFixed(2)}, Total volume: ${totalVolume.toLocaleString()}.`;
    const content = `Market Sentiment: ${sentiment}. ${reasoning} Recommended strategy: ${sentiment === 'BULLISH' ? 'Consider increasing position sizes' : sentiment === 'BEARISH' ? 'Reduce exposure and focus on defensive positions' : 'Maintain current allocation with selective opportunities'}.`;

    return {
      content,
      confidence,
      reasoning,
      metadata: {
        model: this.config.model,
        tokens: Math.floor(content.length / 4) + 50, // Base prompt tokens
        processingTime: 0,
        cost: 0.002
      },
      success: true
    };
  }

  /**
   * Mock implementation for trade explanation
   */
  private async mockExplainTrade(trade: Trade, marketData: MarketData): Promise<LLMResponse> {
    const reasoning = `${trade.action} order for ${trade.quantity} shares of ${trade.symbol} at $${trade.price}. ` +
      `Market conditions: Current price $${marketData.quote?.price || trade.price}, Volume: ${marketData.quote?.volume?.toLocaleString() || 'N/A'}. ` +
      `Trade rationale: ${trade.reasoning || 'Standard systematic trading decision based on predefined criteria.'} ` +
      `Risk management: Position sized according to portfolio allocation rules.`;

    const content = `Trade Explanation: ${reasoning}`;

    return {
      content,
      confidence: 0.9, // High confidence for trade explanations
      reasoning,
      metadata: {
        model: this.config.model,
        tokens: Math.floor(content.length / 4) + 30,
        processingTime: 0,
        cost: 0.0015
      },
      success: true
    };
  }

  /**
   * Mock implementation for risk assessment
   */
  private async mockAssessRisk(signal: TradingSignal, portfolio: Portfolio): Promise<LLMResponse> {
    const positionValue = signal.recommendedSize * (signal.entryPrice || 100);
    const portfolioValue = portfolio.totalValue;
    const positionPercent = (positionValue / portfolioValue) * 100;

    let riskLevel = 'LOW';
    let confidence = 0.8;

    if (positionPercent > 8) {
      riskLevel = 'HIGH';
      confidence = 0.9;
    } else if (positionPercent > 5) {
      riskLevel = 'MEDIUM';
      confidence = 0.85;
    }

    const reasoning = `Position size represents ${positionPercent.toFixed(1)}% of portfolio value. ` +
      `Current portfolio has ${portfolio.positions.length} positions. ` +
      `Risk assessment: ${riskLevel} risk due to position sizing and portfolio concentration.`;

    const content = `Risk Assessment: ${riskLevel} RISK. ${reasoning} ` +
      `Recommendation: ${riskLevel === 'HIGH' ? 'Reduce position size' : riskLevel === 'MEDIUM' ? 'Proceed with caution' : 'Acceptable risk level'}.`;

    return {
      content,
      confidence,
      reasoning,
      metadata: {
        model: this.config.model,
        tokens: Math.floor(content.length / 4) + 40,
        processingTime: 0,
        cost: 0.0012
      },
      success: true
    };
  }

  /**
   * Simulate processing delay for mock implementation
   */
  private async simulateProcessingDelay(baseDelay: number = 500): Promise<void> {
    const delay = baseDelay + Math.random() * 300; // Add some randomness
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Update usage statistics
   */
  private updateUsageStats(success: boolean, processingTime: number, tokens: number): void {
    this.usageStats.totalRequests++;
    this.usageStats.lastRequest = new Date();

    if (success) {
      this.usageStats.successfulRequests++;
      this.usageStats.totalTokens += tokens;
      this.usageStats.totalCost += tokens * 0.00001; // Mock cost calculation
    } else {
      this.usageStats.failedRequests++;
    }

    // Update average response time
    const totalTime = this.usageStats.averageResponseTime * (this.usageStats.totalRequests - 1) + processingTime;
    this.usageStats.averageResponseTime = totalTime / this.usageStats.totalRequests;
  }

  /**
   * Log LLM interaction
   */
  private async logInteraction(interaction: LLMInteraction): Promise<void> {
    try {
      await this.logger.logLLMInteraction(interaction);
    } catch (error) {
      // Don't throw to avoid breaking the LLM service
      this.logger.error('Failed to log LLM interaction', error as Error, {
        interactionId: interaction.id
      });
    }
  }
}

/**
 * Factory function to create LLM service instances
 */
export function createLLMService(logger: LoggingService, config?: Partial<LLMServiceConfig>): LLMService {
  const defaultConfig: LLMServiceConfig = {
    provider: 'mock',
    model: 'mock-claude-3-sonnet',
    maxTokens: 4000,
    temperature: 0.7,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new LLMService(logger, finalConfig);
}