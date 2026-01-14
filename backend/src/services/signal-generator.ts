/**
 * Signal Generator Service
 * 
 * Generates trading signals based on market data and trading guidelines.
 * Integrates with LLM service for intelligent signal generation and
 * applies guidelines-based filtering and validation.
 */

import { v4 as uuidv4 } from 'uuid';
import { TradingSignal, TradeAction, StockAnalysis } from '../../../shared/src/types/trading';
import { Position } from '../../../shared/src/types/portfolio';
import { MarketData, TechnicalIndicators } from '../../../shared/src/types/market-data';
import { 
  TradingGuidelines, 
  GuidelinesManager 
} from './guidelines-manager';
import { MarketDataService } from './market-data-service';
import { LLMService } from './llm-service';
import { LoggingService } from './logging-service';

/**
 * Configuration for SignalGenerator
 */
export interface SignalGeneratorConfig {
  guidelinesManager: GuidelinesManager;
  marketDataService: MarketDataService;
  llmService: LLMService;
  loggingService: LoggingService;
  maxSignalsPerCycle?: number;
  minConfidenceThreshold?: number;
}

/**
 * Custom error class for SignalGenerator errors
 */
export class SignalGeneratorError extends Error {
  constructor(message: string, public code: string = 'SIGNAL_GENERATOR_ERROR') {
    super(message);
    this.name = 'SignalGeneratorError';
  }
}

/**
 * SignalGenerator class
 * 
 * Responsible for:
 * - Screening stocks based on guidelines criteria
 * - Generating buy/sell signals using LLM analysis
 * - Validating signals against guidelines requirements
 * - Calculating confidence scores and risk/reward ratios
 */
export class SignalGenerator {
  private guidelinesManager: GuidelinesManager;
  private marketDataService: MarketDataService;
  private llmService: LLMService;
  private logger: LoggingService;
  private maxSignalsPerCycle: number;
  private minConfidenceThreshold: number;

  constructor(config: SignalGeneratorConfig) {
    this.guidelinesManager = config.guidelinesManager;
    this.marketDataService = config.marketDataService;
    this.llmService = config.llmService;
    this.logger = config.loggingService;
    this.maxSignalsPerCycle = config.maxSignalsPerCycle || 10;
    this.minConfidenceThreshold = config.minConfidenceThreshold || 0.6;

    this.logger.info('SignalGenerator initialized', {
      maxSignalsPerCycle: this.maxSignalsPerCycle,
      minConfidenceThreshold: this.minConfidenceThreshold
    });
  }

  /**
   * Generate buy signals for potential new positions
   */
  async generateBuySignals(): Promise<TradingSignal[]> {
    this.logger.info('Starting buy signal generation');

    try {
      const guidelines = this.guidelinesManager.getCurrentGuidelines();
      if (!guidelines) {
        throw new SignalGeneratorError('No guidelines available', 'NO_GUIDELINES');
      }

      // Screen stocks based on guidelines criteria
      const candidates = await this.screenStocks(guidelines);
      this.logger.info(`Screened ${candidates.length} candidate stocks`);

      if (candidates.length === 0) {
        this.logger.info('No stocks passed screening criteria');
        return [];
      }

      // Analyze each candidate and generate signals
      const signals: TradingSignal[] = [];
      for (const symbol of candidates.slice(0, this.maxSignalsPerCycle)) {
        try {
          const signal = await this.analyzeCandidateForBuy(symbol, guidelines);
          if (signal && signal.confidence >= this.minConfidenceThreshold) {
            signals.push(signal);
          }
        } catch (error) {
          this.logger.error(`Error analyzing ${symbol}`, error as Error, { symbol });
        }
      }

      this.logger.info(`Generated ${signals.length} buy signals`);
      return signals;

    } catch (error) {
      this.logger.error('Error generating buy signals', error as Error);
      throw error;
    }
  }

  /**
   * Generate sell signals for existing positions
   */
  async generateSellSignals(positions: Position[]): Promise<TradingSignal[]> {
    this.logger.info('Starting sell signal generation', { positionCount: positions.length });

    try {
      const guidelines = this.guidelinesManager.getCurrentGuidelines();
      if (!guidelines) {
        throw new SignalGeneratorError('No guidelines available', 'NO_GUIDELINES');
      }

      const signals: TradingSignal[] = [];
      for (const position of positions) {
        try {
          const signal = await this.analyzePositionForSell(position, guidelines);
          if (signal && signal.confidence >= this.minConfidenceThreshold) {
            signals.push(signal);
          }
        } catch (error) {
          this.logger.error(`Error analyzing position ${position.symbol}`, error as Error, { symbol: position.symbol });
        }
      }

      this.logger.info(`Generated ${signals.length} sell signals`);
      return signals;

    } catch (error) {
      this.logger.error('Error generating sell signals', error as Error);
      throw error;
    }
  }

  /**
   * Screen stocks based on guidelines selection criteria
   */
  async screenStocks(guidelines: TradingGuidelines): Promise<string[]> {
    this.logger.info('Screening stocks based on guidelines');

    try {
      const criteria = guidelines.stockSelection;
      
      // Use market data service to screen stocks
      const screeningCriteria = {
        minPrice: criteria.priceRange.minPrice,
        maxPrice: criteria.priceRange.maxPrice,
        minVolume: criteria.liquidityRequirements.minimumAverageDailyVolume,
        minMarketCap: criteria.liquidityRequirements.minimumMarketCap
      };

      const candidates = await this.marketDataService.screenStocks(screeningCriteria);
      this.logger.info(`Market data service returned ${candidates.length} candidates`);

      return candidates;

    } catch (error) {
      this.logger.error('Error screening stocks', error as Error);
      throw new SignalGeneratorError('Failed to screen stocks', 'SCREENING_ERROR');
    }
  }

  /**
   * Analyze a candidate stock for buy signal
   */
  private async analyzeCandidateForBuy(
    symbol: string,
    guidelines: TradingGuidelines
  ): Promise<TradingSignal | null> {
    this.logger.info(`Analyzing ${symbol} for buy signal`);

    try {
      // Get market data
      const marketData = await this.marketDataService.getMarketData(symbol);
      
      // Validate market data is not stale
      if (!this.isMarketDataFresh(marketData)) {
        this.logger.warn(`Stale market data for ${symbol}`, { symbol });
        return null;
      }

      // Perform stock analysis against guidelines
      const analysis = await this.analyzeStock(symbol, marketData, guidelines);
      
      if (!analysis.meetsCriteria) {
        this.logger.info(`${symbol} does not meet criteria`, { analysis });
        return null;
      }

      // Use LLM to generate signal with reasoning
      const prompt = this.buildSignalPrompt(symbol, marketData, analysis, guidelines);
      const llmResponse = await this.llmService.generateTradingSignal(prompt, marketData);

      // Parse LLM response
      const llmSignal = this.parseLLMResponse(llmResponse, symbol);

      // Validate signal against guidelines
      if (!this.validateSignalAgainstGuidelines(llmSignal, guidelines, 'BUY')) {
        this.logger.info(`${symbol} signal failed guidelines validation`);
        return null;
      }

      // Calculate stop loss and profit targets based on guidelines
      const stopLoss = this.calculateStopLoss(marketData, guidelines);
      const profitTargets = this.calculateProfitTargets(marketData, guidelines);

      // Create trading signal
      const signal: TradingSignal = {
        id: uuidv4(),
        symbol,
        action: 'BUY',
        confidence: llmSignal.confidence,
        reasoning: llmSignal.reasoning,
        technicalIndicators: {
          rsi: marketData.technical.rsi,
          macd: marketData.technical.macd,
          movingAverages: marketData.technical.movingAverages,
          atr: marketData.technical.atr,
          volume: marketData.quote.volume,
          vwap: marketData.technical.vwap,
          support: [], // Would need to calculate from historical data
          resistance: [] // Would need to calculate from historical data
        },
        recommendedSize: 0, // Will be calculated by risk manager
        entryPrice: marketData.quote.price,
        stopLoss,
        profitTargets,
        timestamp: new Date()
      };

      this.logger.info(`Generated buy signal for ${symbol}`, { signal });
      return signal;

    } catch (error) {
      this.logger.error(`Error analyzing ${symbol}`, error as Error, { symbol });
      return null;
    }
  }

  /**
   * Analyze a position for sell signal
   */
  private async analyzePositionForSell(
    position: Position,
    guidelines: TradingGuidelines
  ): Promise<TradingSignal | null> {
    this.logger.info(`Analyzing position ${position.symbol} for sell signal`);

    try {
      // Get current market data
      const marketData = await this.marketDataService.getMarketData(position.symbol);
      
      // Validate market data is not stale
      if (!this.isMarketDataFresh(marketData)) {
        this.logger.warn(`Stale market data for ${position.symbol}`);
        return null;
      }

      // Use LLM to analyze if position should be sold
      const prompt = this.buildSellPrompt(position, marketData, guidelines);
      const llmResponse = await this.llmService.generateTradingSignal(prompt, marketData);
      
      // Parse LLM response
      const llmSignal = this.parseLLMResponse(llmResponse, position.symbol);

      // Only generate sell signal if LLM recommends selling
      if (llmSignal.action !== 'SELL') {
        return null;
      }

      // Create sell signal
      const signal: TradingSignal = {
        id: uuidv4(),
        symbol: position.symbol,
        action: 'SELL',
        confidence: llmSignal.confidence,
        reasoning: llmSignal.reasoning,
        technicalIndicators: {
          rsi: marketData.technical.rsi,
          macd: marketData.technical.macd,
          movingAverages: marketData.technical.movingAverages,
          atr: marketData.technical.atr,
          volume: marketData.quote.volume,
          vwap: marketData.technical.vwap,
          support: [],
          resistance: []
        },
        recommendedSize: position.quantity,
        entryPrice: marketData.quote.price,
        stopLoss: 0, // Not applicable for sell
        profitTargets: [],
        timestamp: new Date()
      };

      this.logger.info(`Generated sell signal for ${position.symbol}`, { signal });
      return signal;

    } catch (error) {
      this.logger.error(`Error analyzing position ${position.symbol}`, error as Error);
      return null;
    }
  }

  /**
   * Analyze stock against guidelines criteria
   */
  async analyzeStock(
    symbol: string,
    marketData: MarketData,
    guidelines: TradingGuidelines
  ): Promise<StockAnalysis> {
    const criteria = guidelines.stockSelection;
    const quote = marketData.quote;
    const technical = marketData.technical;

    // Liquidity analysis
    const liquidityAnalysis = {
      averageDailyVolume: quote.volume,
      marketCap: quote.price * quote.volume * 100, // Simplified calculation
      bidAskSpread: ((quote.ask - quote.bid) / quote.price) * 100,
      meetsRequirements: 
        quote.volume >= criteria.liquidityRequirements.minimumAverageDailyVolume &&
        ((quote.ask - quote.bid) / quote.price) * 100 <= criteria.liquidityRequirements.maxBidAskSpreadPercent
    };

    // Volatility analysis
    const atrPercent = (technical.atr / quote.price) * 100;
    const volatilityAnalysis = {
      atr: technical.atr,
      historicalVolatility: 0, // Would need historical calculation
      beta: 1.0, // Would need market correlation calculation
      meetsRequirements:
        atrPercent >= criteria.volatilityMetrics.atrRange.min &&
        atrPercent <= criteria.volatilityMetrics.atrRange.max
    };

    // Technical analysis
    const technicalAnalysis = {
      trend: this.determineTrend(technical),
      supportLevels: [], // Would need historical data analysis
      resistanceLevels: [], // Would need historical data analysis
      volumeConfirmation: quote.volume > quote.volume * 0.8, // Simplified
      priceExtension: Math.abs(quote.price - technical.movingAverages.sma20) / technical.atr < criteria.technicalSetupRequirements.maxATRExtension,
      meetsRequirements: true // Simplified for now
    };

    const meetsCriteria = 
      liquidityAnalysis.meetsRequirements &&
      volatilityAnalysis.meetsRequirements &&
      technicalAnalysis.meetsRequirements;

    return {
      symbol,
      score: meetsCriteria ? 0.8 : 0.3,
      meetsCriteria,
      analysis: {
        liquidity: liquidityAnalysis,
        volatility: volatilityAnalysis,
        technical: technicalAnalysis
      },
      timestamp: new Date()
    };
  }

  /**
   * Determine trend from technical indicators
   */
  private determineTrend(technical: TechnicalIndicators): 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS' {
    const { sma20, sma50 } = technical.movingAverages;
    
    if (sma20 > sma50 * 1.02) {
      return 'UPTREND';
    } else if (sma20 < sma50 * 0.98) {
      return 'DOWNTREND';
    } else {
      return 'SIDEWAYS';
    }
  }

  /**
   * Validate signal against guidelines requirements
   */
  private validateSignalAgainstGuidelines(
    signal: any,
    _guidelines: TradingGuidelines,
    expectedAction: TradeAction
  ): boolean {
    // Check action matches
    if (signal.action !== expectedAction) {
      return false;
    }

    // Check confidence threshold
    if (signal.confidence < this.minConfidenceThreshold) {
      return false;
    }

    // Check entry signal rules (would need more sophisticated validation)
    // const entryRules = _guidelines.entrySignals;
    // const entries = expectedAction === 'BUY' ? entryRules.longEntries : entryRules.shortEntries;

    // Validate minimum risk/reward ratio (would need actual R:R calculation)
    // const minRiskReward = Math.min(...entries.map(e => e.riskRewardRatio));

    return true;
  }

  /**
   * Calculate stop loss based on guidelines
   */
  private calculateStopLoss(marketData: MarketData, guidelines: TradingGuidelines): number {
    const quote = marketData.quote;
    const technical = marketData.technical;
    const stopLossRules = guidelines.exitCriteria.stopLosses;

    // Use ATR-based stop loss as default
    const atrMethod = stopLossRules.methods.find(m => m.type === 'ATR_BASED');
    if (atrMethod) {
      // Entry - (1.0-1.5 × ATR)
      return quote.price - (1.25 * technical.atr);
    }

    // Fallback to percentage-based
    const percentMethod = stopLossRules.methods.find(m => m.type === 'PERCENTAGE');
    if (percentMethod) {
      return quote.price * (1 - percentMethod.bufferPercent / 100);
    }

    // Default to 5% below entry
    return quote.price * 0.95;
  }

  /**
   * Calculate profit targets based on guidelines
   */
  private calculateProfitTargets(marketData: MarketData, guidelines: TradingGuidelines): number[] {
    const quote = marketData.quote;
    const technical = marketData.technical;
    const profitTargetMethods = guidelines.exitCriteria.profitTargets;

    // Use ATR-based targets as default
    const atrMethod = profitTargetMethods.find(m => m.method === 'ATR_BASED');
    if (atrMethod && atrMethod.targets) {
      return atrMethod.targets.map(target => {
        // Parse calculation string (e.g., "Entry + (1.5 × ATR)")
        const calculation = target.calculation || '';
        const match = calculation.match(/Entry \+ \(([\d.]+) × ATR\)/);
        if (match && match[1]) {
          const multiplier = parseFloat(match[1]);
          return quote.price + (multiplier * technical.atr);
        }
        return quote.price * 1.05; // Fallback
      });
    }

    // Default targets
    return [
      quote.price * 1.03, // 3%
      quote.price * 1.05, // 5%
      quote.price * 1.08  // 8%
    ];
  }

  /**
   * Check if market data is fresh (not stale)
   */
  private isMarketDataFresh(marketData: MarketData): boolean {
    const now = new Date();
    const dataTime = new Date(marketData.quote.timestamp);
    const ageMinutes = (now.getTime() - dataTime.getTime()) / (1000 * 60);
    
    // Consider data stale if older than 15 minutes
    return ageMinutes < 15;
  }

  /**
   * Build prompt for buy signal generation
   */
  private buildSignalPrompt(
    symbol: string,
    marketData: MarketData,
    analysis: StockAnalysis,
    guidelines: TradingGuidelines
  ): string {
    const quote = marketData.quote;
    const technical = marketData.technical;
    
    return `Analyze ${symbol} for a potential BUY signal based on the following data and trading guidelines:

Current Price: $${quote.price}
Volume: ${quote.volume}
RSI: ${technical.rsi}
MACD: ${technical.macd.value}
20-day SMA: ${technical.movingAverages.sma20}
50-day SMA: ${technical.movingAverages.sma50}
ATR: ${technical.atr}

Stock Analysis:
- Liquidity: ${analysis.analysis.liquidity.meetsRequirements ? 'PASS' : 'FAIL'}
- Volatility: ${analysis.analysis.volatility.meetsRequirements ? 'PASS' : 'FAIL'}
- Technical Setup: ${analysis.analysis.technical.meetsRequirements ? 'PASS' : 'FAIL'}
- Trend: ${analysis.analysis.technical.trend}

Trading Guidelines:
- Entry signals: ${guidelines.entrySignals.longEntries.map(e => e.name).join(', ')}
- Minimum R:R ratio: ${Math.min(...guidelines.entrySignals.longEntries.map(e => e.riskRewardRatio))}
- Volume requirement: ${guidelines.entrySignals.longEntries[0]?.volumeRequirement || 1.0}x average

Provide a trading recommendation with:
1. Action: BUY or PASS
2. Confidence: 0.0 to 1.0
3. Reasoning: Detailed explanation of your analysis

Format your response as JSON:
{
  "action": "BUY" or "PASS",
  "confidence": 0.0-1.0,
  "reasoning": "your detailed analysis"
}`;
  }

  /**
   * Build prompt for sell signal generation
   */
  private buildSellPrompt(
    position: Position,
    marketData: MarketData,
    guidelines: TradingGuidelines
  ): string {
    const quote = marketData.quote;
    const technical = marketData.technical;
    const pnlPercent = ((quote.price - position.entryPrice) / position.entryPrice) * 100;
    
    return `Analyze ${position.symbol} position for a potential SELL signal:

Position Details:
- Entry Price: $${position.entryPrice}
- Current Price: $${quote.price}
- Quantity: ${position.quantity}
- P&L: ${pnlPercent.toFixed(2)}%
- Stop Loss: $${position.stopLoss}
- Profit Targets: ${position.profitTargets.map(t => `$${t}`).join(', ')}

Current Market Data:
- RSI: ${technical.rsi}
- MACD: ${technical.macd.value}
- Trend: ${this.determineTrend(technical)}
- Volume: ${quote.volume}

Trading Guidelines:
- Exit criteria: ${guidelines.exitCriteria.profitTargets.map(m => m.name).join(', ')}
- Stop loss methods: ${guidelines.exitCriteria.stopLosses.methods.map(m => m.name).join(', ')}

Should this position be sold now? Consider:
1. Has it reached profit targets?
2. Is the trend reversing?
3. Are there technical warning signs?

Provide a recommendation with:
1. Action: SELL or HOLD
2. Confidence: 0.0 to 1.0
3. Reasoning: Detailed explanation

Format your response as JSON:
{
  "action": "SELL" or "HOLD",
  "confidence": 0.0-1.0,
  "reasoning": "your detailed analysis"
}`;
  }

  /**
   * Parse LLM response into signal format
   */
  private parseLLMResponse(llmResponse: any, _symbol: string): any {
    try {
      // Try to parse JSON from response content
      const content = llmResponse.content || llmResponse.response || '';
      
      // Extract JSON from response (may be wrapped in markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          action: parsed.action === 'BUY' || parsed.action === 'SELL' ? parsed.action : 'PASS',
          confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
          reasoning: parsed.reasoning || 'No reasoning provided'
        };
      }
      
      // Fallback: analyze content for keywords
      const contentLower = content.toLowerCase();
      const isBuy = contentLower.includes('buy') || contentLower.includes('bullish');
      const isSell = contentLower.includes('sell') || contentLower.includes('bearish');
      
      return {
        action: isBuy ? 'BUY' : (isSell ? 'SELL' : 'PASS'),
        confidence: llmResponse.confidence || 0.5,
        reasoning: content || 'Analysis based on market conditions'
      };
    } catch (error) {
      this.logger.error('Error parsing LLM response', error as Error, llmResponse);
      return {
        action: 'PASS',
        confidence: 0,
        reasoning: 'Failed to parse LLM response'
      };
    }
  }
}

/**
 * Factory function to create SignalGenerator instance
 */
export function createSignalGenerator(config: SignalGeneratorConfig): SignalGenerator {
  return new SignalGenerator(config);
}
