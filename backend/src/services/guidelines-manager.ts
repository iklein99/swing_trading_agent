/**
 * Trading Guidelines Manager
 * Loads, validates, and manages trading guidelines from markdown configuration files
 */

import { promises as fs } from 'fs';
import { watch, FSWatcher } from 'chokidar';
import path from 'path';
import { LoggingService } from './logging-service';
import {
  TradingGuidelines,
  LiquidityRequirements,
  VolatilityMetrics,
  PriceRange,
  TechnicalSetupRequirements,
  FundamentalFilters,
  EntrySignal,
  TimingRules,
  PositionSizingRules,
  ProfitTargetMethods,
  StopLossRules,
  TrailingStopRules,
  TimeBasedExitRules,
  PortfolioRiskRules,
  TradeManagementRules,
  MarketEnvironmentRules,
  GuidelinesValidationResult,
  GuidelinesManagerConfig
} from '@shared/types';

export class GuidelinesManagerError extends Error {
  constructor(message: string, public readonly code: string, public readonly filePath?: string) {
    super(message);
    this.name = 'GuidelinesManagerError';
  }
}

export class GuidelinesManager {
  private logger: LoggingService;
  private config: GuidelinesManagerConfig;
  private currentGuidelines: TradingGuidelines | null = null;
  private fileWatcher: FSWatcher | null = null;
  private changeCallbacks: Array<(guidelines: TradingGuidelines) => void> = [];
  private lastValidGuidelines: TradingGuidelines | null = null;

  constructor(logger: LoggingService, config: GuidelinesManagerConfig) {
    this.logger = logger;
    this.config = config;

    this.logger.info('Guidelines Manager initialized', {
      filePath: config.guidelinesFilePath,
      watchForChanges: config.watchForChanges
    });
  }

  /**
   * Load guidelines from the configured file
   */
  async loadGuidelines(): Promise<TradingGuidelines> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Loading trading guidelines', { 
        filePath: this.config.guidelinesFilePath 
      });

      // Check if file exists
      const filePath = path.resolve(this.config.guidelinesFilePath);
      
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new GuidelinesManagerError(
          `Guidelines file not found: ${filePath}`,
          'FILE_NOT_FOUND',
          filePath
        );
      }

      // Read file content
      const fileContent = await fs.readFile(filePath, 'utf-8');
      
      // Parse guidelines from markdown
      const guidelines = await this.parseGuidelinesFromMarkdown(fileContent, filePath);
      
      // Validate guidelines if configured
      if (this.config.validateOnLoad) {
        const validation = this.validateGuidelines(guidelines);
        if (!validation.isValid) {
          this.logger.warn('Guidelines validation failed', {
            errors: validation.errors,
            warnings: validation.warnings,
            missingRequiredSections: validation.missingRequiredSections
          });
          
          // If we have last valid guidelines, use those instead
          if (this.lastValidGuidelines) {
            this.logger.info('Using last valid guidelines due to validation failure');
            return this.lastValidGuidelines;
          }
          
          throw new GuidelinesManagerError(
            `Guidelines validation failed: ${validation.errors.join(', ')}`,
            'VALIDATION_FAILED',
            filePath
          );
        }
      }

      // Backup if configured
      if (this.config.backupOnLoad) {
        await this.backupGuidelines(guidelines);
      }

      // Store as current and last valid
      this.currentGuidelines = guidelines;
      this.lastValidGuidelines = guidelines;

      // Set up file watching if configured
      if (this.config.watchForChanges && !this.fileWatcher) {
        this.setupFileWatcher();
      }

      const loadTime = Date.now() - startTime;
      this.logger.info('Guidelines loaded successfully', {
        version: guidelines.version,
        loadTime,
        sectionsLoaded: Object.keys(guidelines).length
      });

      return guidelines;

    } catch (error) {
      const loadTime = Date.now() - startTime;
      this.logger.error('Failed to load guidelines', error as Error, {
        filePath: this.config.guidelinesFilePath,
        loadTime
      });

      if (error instanceof GuidelinesManagerError) {
        throw error;
      }

      throw new GuidelinesManagerError(
        `Failed to load guidelines: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LOAD_FAILED',
        this.config.guidelinesFilePath
      );
    }
  }

  /**
   * Reload guidelines from file
   */
  async reloadGuidelines(): Promise<TradingGuidelines> {
    this.logger.info('Reloading trading guidelines');
    
    const guidelines = await this.loadGuidelines();
    
    // Notify all registered callbacks
    this.changeCallbacks.forEach(callback => {
      try {
        callback(guidelines);
      } catch (error) {
        this.logger.error('Error in guidelines change callback', error as Error);
      }
    });

    return guidelines;
  }

  /**
   * Get current loaded guidelines
   */
  getCurrentGuidelines(): TradingGuidelines | null {
    return this.currentGuidelines;
  }

  /**
   * Validate guidelines structure and content
   */
  validateGuidelines(guidelines: TradingGuidelines): GuidelinesValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingRequiredSections: string[] = [];

    try {
      // Check required top-level sections
      const requiredSections = ['stockSelection', 'entrySignals', 'exitCriteria', 'riskManagement'];
      
      for (const section of requiredSections) {
        if (!guidelines[section as keyof TradingGuidelines]) {
          missingRequiredSections.push(section);
          errors.push(`Missing required section: ${section}`);
        }
      }

      // Validate stock selection criteria
      if (guidelines.stockSelection) {
        const { liquidityRequirements, volatilityMetrics, priceRange } = guidelines.stockSelection;
        
        if (liquidityRequirements) {
          if (liquidityRequirements.minimumAverageDailyVolume <= 0) {
            errors.push('Minimum average daily volume must be positive');
          }
          if (liquidityRequirements.minimumMarketCap <= 0) {
            errors.push('Minimum market cap must be positive');
          }
          if (liquidityRequirements.maxBidAskSpreadPercent <= 0 || liquidityRequirements.maxBidAskSpreadPercent > 100) {
            errors.push('Max bid-ask spread percent must be between 0 and 100');
          }
        }

        if (volatilityMetrics) {
          if (volatilityMetrics.atrRange.min >= volatilityMetrics.atrRange.max) {
            errors.push('ATR range minimum must be less than maximum');
          }
          if (volatilityMetrics.betaRange.min >= volatilityMetrics.betaRange.max) {
            errors.push('Beta range minimum must be less than maximum');
          }
        }

        if (priceRange) {
          if (priceRange.minPrice >= priceRange.maxPrice) {
            errors.push('Price range minimum must be less than maximum');
          }
          if (priceRange.minPrice <= 0) {
            errors.push('Minimum price must be positive');
          }
        }
      }

      // Validate risk management rules
      if (guidelines.riskManagement?.portfolioRules) {
        const rules = guidelines.riskManagement.portfolioRules;
        
        if (rules.maxDailyLossPercent <= 0 || rules.maxDailyLossPercent > 100) {
          errors.push('Max daily loss percent must be between 0 and 100');
        }
        if (rules.maxDrawdownPercent <= 0 || rules.maxDrawdownPercent > 100) {
          errors.push('Max drawdown percent must be between 0 and 100');
        }
        if (rules.maxPositionSizePercent <= 0 || rules.maxPositionSizePercent > 100) {
          errors.push('Max position size percent must be between 0 and 100');
        }
        if (rules.riskPerTradePercent <= 0 || rules.riskPerTradePercent > 100) {
          errors.push('Risk per trade percent must be between 0 and 100');
        }
        if (rules.maxOpenPositions <= 0) {
          errors.push('Max open positions must be positive');
        }
      }

      // Validate entry signals
      if (guidelines.entrySignals?.longEntries) {
        guidelines.entrySignals.longEntries.forEach((signal, index) => {
          if (!signal.name || signal.name.trim().length === 0) {
            errors.push(`Long entry signal ${index + 1} must have a name`);
          }
          if (signal.riskRewardRatio <= 0) {
            errors.push(`Long entry signal "${signal.name}" must have positive risk/reward ratio`);
          }
          if (signal.volumeRequirement <= 0) {
            errors.push(`Long entry signal "${signal.name}" must have positive volume requirement`);
          }
        });
      }

      // Add warnings for missing optional sections
      if (!guidelines.entrySignals?.shortEntries || guidelines.entrySignals.shortEntries.length === 0) {
        warnings.push('No short entry signals defined');
      }
      
      if (!guidelines.exitCriteria?.trailingStops) {
        warnings.push('No trailing stop rules defined');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        missingRequiredSections
      };

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        isValid: false,
        errors,
        warnings,
        missingRequiredSections
      };
    }
  }

  /**
   * Watch guidelines file for changes
   */
  watchGuidelinesFile(callback: (guidelines: TradingGuidelines) => void): void {
    this.changeCallbacks.push(callback);
    
    if (!this.fileWatcher && this.config.watchForChanges) {
      this.setupFileWatcher();
    }
  }

  /**
   * Stop watching guidelines file
   */
  stopWatching(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
      this.logger.info('Stopped watching guidelines file');
    }
  }

  /**
   * Get specific guidelines sections
   */
  getStockSelectionCriteria(): TradingGuidelines['stockSelection'] | null {
    return this.currentGuidelines?.stockSelection || null;
  }

  getEntrySignalRules(): TradingGuidelines['entrySignals'] | null {
    return this.currentGuidelines?.entrySignals || null;
  }

  getExitCriteriaRules(): TradingGuidelines['exitCriteria'] | null {
    return this.currentGuidelines?.exitCriteria || null;
  }

  getRiskManagementRules(): TradingGuidelines['riskManagement'] | null {
    return this.currentGuidelines?.riskManagement || null;
  }

  /**
   * Parse guidelines from markdown content
   */
  private async parseGuidelinesFromMarkdown(content: string, filePath: string): Promise<TradingGuidelines> {
    try {
      // This is a simplified parser - in a real implementation, you might want to use a proper markdown parser
      // For now, we'll extract key values from the markdown content using regex patterns
      
      const guidelines: TradingGuidelines = {
        stockSelection: {
          liquidityRequirements: this.extractLiquidityRequirements(content),
          volatilityMetrics: this.extractVolatilityMetrics(content),
          priceRange: this.extractPriceRange(content),
          technicalSetupRequirements: this.extractTechnicalSetupRequirements(content),
          fundamentalFilters: this.extractFundamentalFilters(content)
        },
        entrySignals: {
          longEntries: this.extractLongEntrySignals(content),
          shortEntries: this.extractShortEntrySignals(content),
          timingRules: this.extractTimingRules(content),
          positionSizing: this.extractPositionSizingRules(content)
        },
        exitCriteria: {
          profitTargets: this.extractProfitTargetMethods(content),
          stopLosses: this.extractStopLossRules(content),
          trailingStops: this.extractTrailingStopRules(content),
          timeBasedExits: this.extractTimeBasedExitRules(content)
        },
        riskManagement: {
          portfolioRules: this.extractPortfolioRiskRules(content),
          tradeManagement: this.extractTradeManagementRules(content),
          marketEnvironment: this.extractMarketEnvironmentRules(content)
        },
        lastUpdated: new Date(),
        version: this.extractVersion(content) || '1.0.0',
        filePath
      };

      return guidelines;

    } catch (error) {
      throw new GuidelinesManagerError(
        `Failed to parse guidelines from markdown: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_FAILED',
        filePath
      );
    }
  }

  /**
   * Extract liquidity requirements from markdown content
   */
  private extractLiquidityRequirements(content: string): LiquidityRequirements {
    // Extract values using regex patterns
    const volumeMatch = content.match(/Minimum Average Daily Volume.*?([0-9,]+)/i);
    const marketCapMatch = content.match(/Minimum Market Cap.*?\$([0-9]+)M/i);
    const spreadMatch = content.match(/Bid-Ask Spread.*?< ([0-9.]+)%/i);

    return {
      minimumAverageDailyVolume: volumeMatch?.[1] ? parseInt(volumeMatch[1].replace(/,/g, '')) : 1000000,
      minimumMarketCap: marketCapMatch?.[1] ? parseInt(marketCapMatch[1]) * 1000000 : 500000000,
      maxBidAskSpreadPercent: spreadMatch?.[1] ? parseFloat(spreadMatch[1]) : 0.5
    };
  }

  /**
   * Extract volatility metrics from markdown content
   */
  private extractVolatilityMetrics(content: string): VolatilityMetrics {
    const atrMatch = content.match(/Average True Range.*?([0-9.]+)-([0-9.]+)%/i);
    const volatilityMatch = content.match(/Historical Volatility.*?([0-9.]+)-([0-9.]+)%/i);
    const betaMatch = content.match(/Beta.*?([0-9.]+) - ([0-9.]+)/i);

    return {
      atrRange: {
        min: atrMatch?.[1] ? parseFloat(atrMatch[1]) : 2,
        max: atrMatch?.[2] ? parseFloat(atrMatch[2]) : 8
      },
      historicalVolatilityRange: {
        min: volatilityMatch?.[1] ? parseFloat(volatilityMatch[1]) : 20,
        max: volatilityMatch?.[2] ? parseFloat(volatilityMatch[2]) : 60
      },
      betaRange: {
        min: betaMatch?.[1] ? parseFloat(betaMatch[1]) : 0.8,
        max: betaMatch?.[2] ? parseFloat(betaMatch[2]) : 2.0
      }
    };
  }

  /**
   * Extract price range from markdown content
   */
  private extractPriceRange(content: string): PriceRange {
    const priceMatch = content.match(/Stock Price.*?\$([0-9]+) - \$([0-9]+)/i);

    return {
      minPrice: priceMatch?.[1] ? parseInt(priceMatch[1]) : 10,
      maxPrice: priceMatch?.[2] ? parseInt(priceMatch[2]) : 500
    };
  }

  /**
   * Extract technical setup requirements from markdown content
   */
  private extractTechnicalSetupRequirements(content: string): TechnicalSetupRequirements {
    return {
      requireClearTrend: content.includes('Clear Trend'),
      requireSupportResistance: content.includes('Support/Resistance'),
      requireVolumeConfirmation: content.includes('Volume Confirmation'),
      maxATRExtension: content.includes('3 ATR') ? 3 : 2
    };
  }

  /**
   * Extract fundamental filters from markdown content
   */
  private extractFundamentalFilters(content: string): FundamentalFilters {
    const earningsMatch = content.match(/earnings within ([0-9]+)-([0-9]+) days/i);

    return {
      avoidEarningsWithinDays: earningsMatch?.[2] ? parseInt(earningsMatch[2]) : 5,
      checkMajorNews: content.includes('major news'),
      requirePositiveSectorStrength: content.includes('sector performance'),
      avoidFinancialDistress: content.includes('bankruptcy risk')
    };
  }

  /**
   * Extract long entry signals from markdown content
   */
  private extractLongEntrySignals(content: string): EntrySignal[] {
    const signals: EntrySignal[] = [];

    // Extract breakout entry
    if (content.includes('Breakout Entry')) {
      signals.push({
        name: 'Breakout Entry',
        type: 'BREAKOUT',
        conditions: ['Price breaks above resistance', 'Volume >150% of average', 'Close above resistance for 2 periods'],
        volumeRequirement: 1.5,
        confirmationRequired: true,
        riskRewardRatio: 2.0
      });
    }

    // Extract pullback entry
    if (content.includes('Pullback Entry')) {
      signals.push({
        name: 'Pullback Entry',
        type: 'PULLBACK',
        conditions: ['Stock in uptrend', 'Price pulls back to support', 'Reversal signal present'],
        volumeRequirement: 1.0,
        confirmationRequired: true,
        riskRewardRatio: 2.0
      });
    }

    // Extract moving average bounce
    if (content.includes('Moving Average Bounce')) {
      signals.push({
        name: 'Moving Average Bounce',
        type: 'MOVING_AVERAGE_BOUNCE',
        conditions: ['Price approaches MA', 'RSI oversold', 'Price moves away from MA'],
        volumeRequirement: 1.0,
        confirmationRequired: false,
        riskRewardRatio: 2.0
      });
    }

    // Extract momentum entry
    if (content.includes('Momentum Entry')) {
      signals.push({
        name: 'Momentum Entry',
        type: 'MOMENTUM',
        conditions: ['MACD crosses above signal', 'RSI crosses above 50', 'Price above VWAP'],
        volumeRequirement: 1.0,
        confirmationRequired: false,
        riskRewardRatio: 2.0
      });
    }

    return signals;
  }

  /**
   * Extract short entry signals from markdown content
   */
  private extractShortEntrySignals(content: string): EntrySignal[] {
    const signals: EntrySignal[] = [];

    // Extract breakdown entry
    if (content.includes('Breakdown Entry')) {
      signals.push({
        name: 'Breakdown Entry',
        type: 'BREAKOUT',
        conditions: ['Price breaks below support', 'Volume >150% of average', 'Close below support for 2 periods'],
        volumeRequirement: 1.5,
        confirmationRequired: true,
        riskRewardRatio: 2.0
      });
    }

    return signals;
  }

  /**
   * Extract timing rules from markdown content
   */
  private extractTimingRules(content: string): TimingRules {
    const firstMinutesMatch = content.match(/first ([0-9]+) minutes/i);
    const lastMinutesMatch = content.match(/last ([0-9]+) minutes/i);
    const optimalMatch = content.match(/([0-9:]+) AM - ([0-9:]+) PM/i);

    return {
      avoidFirstMinutes: firstMinutesMatch?.[1] ? parseInt(firstMinutesMatch[1]) : 15,
      avoidLastMinutes: lastMinutesMatch?.[1] ? parseInt(lastMinutesMatch[1]) : 15,
      optimalWindowStart: optimalMatch?.[1] ? optimalMatch[1] + ' AM' : '10:00 AM',
      optimalWindowEnd: optimalMatch?.[2] ? optimalMatch[2] + ' PM' : '3:30 PM'
    };
  }

  /**
   * Extract position sizing rules from markdown content
   */
  private extractPositionSizingRules(content: string): PositionSizingRules {
    const riskMatch = content.match(/([0-9]+)-([0-9]+)% of total portfolio/i);
    const maxPositionMatch = content.match(/exceed ([0-9]+)% of portfolio/i);

    return {
      riskPerTradePercent: riskMatch?.[2] ? parseInt(riskMatch[2]) : 2,
      maxPositionPercent: maxPositionMatch?.[1] ? parseInt(maxPositionMatch[1]) : 10,
      maxCorrelatedPositions: 3,
      maxSectorPositions: 3
    };
  }

  /**
   * Extract profit target methods from markdown content
   */
  private extractProfitTargetMethods(content: string): ProfitTargetMethods[] {
    const methods: ProfitTargetMethods[] = [];

    // ATR-based targets
    if (content.includes('ATR-Based Targets')) {
      methods.push({
        name: 'ATR-Based Targets',
        method: 'ATR_BASED',
        targets: [
          { level: 1, calculation: 'Entry + (1.5 × ATR)', exitPercentage: 33 },
          { level: 2, calculation: 'Entry + (2.5 × ATR)', exitPercentage: 33 },
          { level: 3, calculation: 'Entry + (4.0 × ATR)', exitPercentage: 34 }
        ],
        partialExitStrategy: {
          scaleOutApproach: true,
          target1ExitPercent: 33,
          target2ExitPercent: 33,
          trailRemainder: true
        }
      });
    }

    // Risk/Reward ratio
    if (content.includes('Risk/Reward Ratio')) {
      methods.push({
        name: 'Risk/Reward Ratio',
        method: 'RISK_REWARD',
        targets: [
          { level: 1, calculation: '2:1 R:R minimum', exitPercentage: 50 },
          { level: 2, calculation: '3:1 R:R preferred', exitPercentage: 50 }
        ],
        partialExitStrategy: {
          scaleOutApproach: true,
          target1ExitPercent: 50,
          target2ExitPercent: 50,
          trailRemainder: true
        }
      });
    }

    return methods;
  }

  /**
   * Extract stop loss rules from markdown content
   */
  private extractStopLossRules(content: string): StopLossRules {
    const maxRiskMatch = content.match(/([0-9]+)% account risk/i);

    return {
      methods: [
        {
          name: 'Below Support',
          type: 'BELOW_SUPPORT',
          calculation: '1-2% below support level',
          bufferPercent: 2
        },
        {
          name: 'ATR-Based',
          type: 'ATR_BASED',
          calculation: 'Entry - (1.0-1.5 × ATR)',
          bufferPercent: 0
        },
        {
          name: 'Percentage',
          type: 'PERCENTAGE',
          calculation: '5-8% below entry',
          bufferPercent: 8
        }
      ],
      maxRiskPercent: maxRiskMatch?.[1] ? parseInt(maxRiskMatch[1]) : 2,
      breakEvenRule: {
        activateAtRiskRewardRatio: 1.5,
        moveToBreakEven: true
      },
      timeBasedStop: {
        maxHoldingDays: 15,
        evaluateAtTimeLimit: true
      }
    };
  }

  /**
   * Extract trailing stop rules from markdown content
   */
  private extractTrailingStopRules(_content: string): TrailingStopRules {
    return {
      activationTrigger: 'After Target 1 or Target 2 hit',
      trailingAmount: '1.5-2.0 × ATR below current high',
      adjustmentFrequency: 'DAILY',
      lockInProfitsAt: 1.5
    };
  }

  /**
   * Extract time-based exit rules from markdown content
   */
  private extractTimeBasedExitRules(content: string): TimeBasedExitRules {
    const holdingMatch = content.match(/Maximum ([0-9]+)-([0-9]+) trading days/i);

    return {
      maxHoldingPeriod: holdingMatch?.[2] ? parseInt(holdingMatch[2]) : 15,
      evaluationCriteria: ['No progress toward targets', 'Positive movement with trail stop']
    };
  }

  /**
   * Extract portfolio risk rules from markdown content
   */
  private extractPortfolioRiskRules(content: string): PortfolioRiskRules {
    const dailyLossMatch = content.match(/Maximum Daily Loss.*?([0-9]+)%/i);
    const weeklyLossMatch = content.match(/Maximum Weekly Loss.*?([0-9]+)%/i);
    const drawdownMatch = content.match(/([0-9]+)-([0-9]+)% from peak/i);
    const maxPositionsMatch = content.match(/([0-9]+)-([0-9]+) positions/i);
    const sectorMatch = content.match(/([0-9]+)% of portfolio.*sector/i);

    return {
      maxDailyLossPercent: dailyLossMatch?.[1] ? parseInt(dailyLossMatch[1]) : 3,
      maxWeeklyLossPercent: weeklyLossMatch?.[1] ? parseInt(weeklyLossMatch[1]) : 6,
      maxDrawdownPercent: drawdownMatch?.[2] ? parseInt(drawdownMatch[2]) : 8,
      maxOpenPositions: maxPositionsMatch?.[2] ? parseInt(maxPositionsMatch[2]) : 8,
      maxSectorExposurePercent: sectorMatch?.[1] ? parseInt(sectorMatch[1]) : 30,
      maxPositionSizePercent: 10,
      riskPerTradePercent: 2
    };
  }

  /**
   * Extract trade management rules from markdown content
   */
  private extractTradeManagementRules(content: string): TradeManagementRules {
    return {
      noRevengeTrading: content.includes('No Revenge Trading'),
      noAveragingDown: content.includes('No Averaging Down'),
      scaleInCarefully: content.includes('Scale In Carefully'),
      reviewEachTrade: content.includes('Review Each Trade')
    };
  }

  /**
   * Extract market environment rules from markdown content
   */
  private extractMarketEnvironmentRules(_content: string): MarketEnvironmentRules {
    return {
      trendingMarketStrategy: 'Favor breakout/breakdown strategies, wider targets',
      rangeBoundMarketStrategy: 'Favor pullback strategies, tighter targets',
      highVolatilityAdjustments: 'Reduce position sizes, widen stops, quicker profit-taking',
      lowVolatilityAdjustments: 'Can use tighter stops, but expect smaller moves'
    };
  }

  /**
   * Extract version from markdown content
   */
  private extractVersion(content: string): string | null {
    const versionMatch = content.match(/version[:\s]+([0-9.]+)/i);
    return versionMatch?.[1] || null;
  }

  /**
   * Setup file watcher for guidelines file
   */
  private setupFileWatcher(): void {
    try {
      this.fileWatcher = watch(this.config.guidelinesFilePath, {
        persistent: true,
        ignoreInitial: true
      });

      this.fileWatcher.on('change', async () => {
        this.logger.info('Guidelines file changed, reloading...');
        
        try {
          await this.reloadGuidelines();
        } catch (error) {
          this.logger.error('Failed to reload guidelines after file change', error as Error);
        }
      });

      this.fileWatcher.on('error', (error) => {
        this.logger.error('File watcher error', error);
      });

      this.logger.info('File watcher setup for guidelines file');

    } catch (error) {
      this.logger.error('Failed to setup file watcher', error as Error);
    }
  }

  /**
   * Backup current guidelines
   */
  private async backupGuidelines(guidelines: TradingGuidelines): Promise<void> {
    try {
      const backupPath = `${guidelines.filePath}.backup.${Date.now()}.json`;
      const backupContent = JSON.stringify(guidelines, null, 2);
      
      await fs.writeFile(backupPath, backupContent, 'utf-8');
      
      this.logger.info('Guidelines backed up', { backupPath });
    } catch (error) {
      this.logger.warn('Failed to backup guidelines', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopWatching();
    this.changeCallbacks = [];
    this.currentGuidelines = null;
    this.lastValidGuidelines = null;
    
    this.logger.info('Guidelines Manager disposed');
  }
}

/**
 * Factory function to create guidelines manager instances
 */
export function createGuidelinesManager(
  logger: LoggingService, 
  config?: Partial<GuidelinesManagerConfig>
): GuidelinesManager {
  const defaultConfig: GuidelinesManagerConfig = {
    guidelinesFilePath: 'artifacts/swing_trading_guidelines.md',
    watchForChanges: true,
    backupOnLoad: true,
    validateOnLoad: true
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new GuidelinesManager(logger, finalConfig);
}

// Re-export types for convenience
export type {
  TradingGuidelines,
  GuidelinesManagerConfig,
  GuidelinesValidationResult,
  LiquidityRequirements,
  VolatilityMetrics,
  PriceRange,
  EntrySignal,
  PortfolioRiskRules,
  StopLossRules,
  ProfitTargetMethods
};