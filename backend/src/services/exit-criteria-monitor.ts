/**
 * Exit Criteria Monitor Service
 * 
 * Monitors open positions for exit conditions based on stop losses,
 * profit targets, and time-based exits defined in trading guidelines.
 * Generates exit signals when criteria are met.
 */

import { v4 as uuidv4 } from 'uuid';
import { TradingSignal, ExitCriteria } from '../../../shared/src/types/trading';
import { Position } from '../../../shared/src/types/portfolio';
import { MarketData } from '../../../shared/src/types/market-data';
import { TradingGuidelines, GuidelinesManager } from './guidelines-manager';
import { MarketDataService } from './market-data-service';
import { LoggingService } from './logging-service';

/**
 * Configuration for ExitCriteriaMonitor
 */
export interface ExitCriteriaMonitorConfig {
  guidelinesManager: GuidelinesManager;
  marketDataService: MarketDataService;
  loggingService: LoggingService;
  checkIntervalMs?: number; // How often to check exit criteria
}

/**
 * Result of checking exit criteria for positions
 */
export interface ExitCheckResult {
  exitSignals: TradingSignal[];
  positionsChecked: number;
  criteriaTriggered: number;
  errors: string[];
  checkTime: number;
}

/**
 * Custom error class for ExitCriteriaMonitor errors
 */
export class ExitCriteriaMonitorError extends Error {
  constructor(message: string, public code: string = 'EXIT_MONITOR_ERROR') {
    super(message);
    this.name = 'ExitCriteriaMonitorError';
  }
}

/**
 * ExitCriteriaMonitor class
 * 
 * Responsible for:
 * - Establishing exit criteria when positions are opened
 * - Continuously monitoring positions for exit conditions
 * - Prioritizing stop losses over profit targets
 * - Generating exit signals when criteria are met
 * - Integrating with guidelines for dynamic rule updates
 */
export class ExitCriteriaMonitor {
  private guidelinesManager: GuidelinesManager;
  private marketDataService: MarketDataService;
  private logger: LoggingService;
  private checkIntervalMs: number;
  private monitoringInterval: NodeJS.Timeout | undefined;
  private isMonitoring: boolean = false;

  constructor(config: ExitCriteriaMonitorConfig) {
    this.guidelinesManager = config.guidelinesManager;
    this.marketDataService = config.marketDataService;
    this.logger = config.loggingService;
    this.checkIntervalMs = config.checkIntervalMs || 60000; // Default: 1 minute

    this.logger.info('ExitCriteriaMonitor initialized', {
      checkIntervalMs: this.checkIntervalMs
    });
  }

  /**
   * Establish exit criteria for a newly opened position
   */
  establishExitCriteria(position: Position, entryPrice: number, marketData: MarketData): ExitCriteria[] {
    this.logger.info(`Establishing exit criteria for ${position.symbol}`, { position });

    try {
      const guidelines = this.guidelinesManager.getCurrentGuidelines();
      if (!guidelines) {
        throw new ExitCriteriaMonitorError('No guidelines available', 'NO_GUIDELINES');
      }

      const exitCriteria: ExitCriteria[] = [];
      const exitRules = guidelines.exitCriteria;

      // Establish stop loss criteria
      const stopLossCriteria = this.createStopLossCriteria(
        position.symbol,
        entryPrice,
        marketData,
        exitRules.stopLosses
      );
      exitCriteria.push(...stopLossCriteria);

      // Establish profit target criteria
      const profitTargetCriteria = this.createProfitTargetCriteria(
        position.symbol,
        entryPrice,
        marketData,
        exitRules.profitTargets
      );
      exitCriteria.push(...profitTargetCriteria);

      // Establish time-based exit criteria
      if (exitRules.timeBasedExits) {
        const timeBasedCriteria = this.createTimeBasedCriteria(
          position.symbol,
          position.entryDate,
          exitRules.timeBasedExits
        );
        if (timeBasedCriteria) {
          exitCriteria.push(timeBasedCriteria);
        }
      }

      this.logger.info(`Established ${exitCriteria.length} exit criteria for ${position.symbol}`, {
        symbol: position.symbol,
        criteriaCount: exitCriteria.length
      });

      return exitCriteria;

    } catch (error) {
      this.logger.error(`Error establishing exit criteria for ${position.symbol}`, error as Error, {
        symbol: position.symbol
      });
      return [];
    }
  }

  /**
   * Check exit criteria for all positions and generate exit signals
   */
  async checkExitCriteria(positions: Position[]): Promise<ExitCheckResult> {
    const startTime = Date.now();
    this.logger.info('Checking exit criteria for positions', { positionCount: positions.length });

    const result: ExitCheckResult = {
      exitSignals: [],
      positionsChecked: 0,
      criteriaTriggered: 0,
      errors: [],
      checkTime: 0
    };

    try {
      const guidelines = this.guidelinesManager.getCurrentGuidelines();
      if (!guidelines) {
        throw new ExitCriteriaMonitorError('No guidelines available', 'NO_GUIDELINES');
      }

      for (const position of positions) {
        try {
          // Get current market data
          const marketData = await this.marketDataService.getMarketData(position.symbol);
          const currentPrice = marketData.quote.price;

          // Check each exit criterion
          const triggeredCriteria = this.evaluateExitCriteria(
            position,
            currentPrice,
            marketData,
            guidelines
          );

          if (triggeredCriteria.length > 0) {
            // Prioritize stop losses over profit targets (Requirement 3.3)
            const prioritizedCriterion = this.prioritizeCriteria(triggeredCriteria);
            
            // Generate exit signal
            const exitSignal = this.createExitSignal(
              position,
              currentPrice,
              prioritizedCriterion,
              marketData
            );

            result.exitSignals.push(exitSignal);
            result.criteriaTriggered += triggeredCriteria.length;

            this.logger.info(`Exit criteria triggered for ${position.symbol}`, {
              symbol: position.symbol,
              criterionType: prioritizedCriterion.type,
              currentPrice,
              criterionValue: prioritizedCriterion.value
            });
          }

          result.positionsChecked++;

        } catch (error) {
          const errorMsg = `Error checking ${position.symbol}: ${error}`;
          result.errors.push(errorMsg);
          this.logger.error(`Error checking exit criteria for ${position.symbol}`, error as Error, {
            symbol: position.symbol
          });
        }
      }

      result.checkTime = Date.now() - startTime;
      this.logger.info('Exit criteria check complete', {
        positionsChecked: result.positionsChecked,
        exitSignals: result.exitSignals.length,
        criteriaTriggered: result.criteriaTriggered,
        checkTime: result.checkTime
      });

      return result;

    } catch (error) {
      result.checkTime = Date.now() - startTime;
      result.errors.push(`Exit criteria check failed: ${error}`);
      this.logger.error('Error checking exit criteria', error as Error);
      return result;
    }
  }

  /**
   * Start continuous monitoring of positions
   */
  startMonitoring(getPositions: () => Promise<Position[]>): void {
    if (this.isMonitoring) {
      this.logger.warn('Monitoring already started');
      return;
    }

    this.isMonitoring = true;
    this.logger.info('Starting continuous exit criteria monitoring', {
      intervalMs: this.checkIntervalMs
    });

    this.monitoringInterval = setInterval(async () => {
      try {
        const positions = await getPositions();
        if (positions.length > 0) {
          await this.checkExitCriteria(positions);
        }
      } catch (error) {
        this.logger.error('Error in monitoring interval', error as Error);
      }
    }, this.checkIntervalMs);
  }

  /**
   * Stop continuous monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
    this.logger.info('Stopped exit criteria monitoring');
  }

  /**
   * Create stop loss exit criteria
   */
  private createStopLossCriteria(
    _symbol: string,
    entryPrice: number,
    marketData: MarketData,
    stopLossRules: any
  ): ExitCriteria[] {
    const criteria: ExitCriteria[] = [];
    const technical = marketData.technical;

    // Use ATR-based stop loss as primary method
    const atrMethod = stopLossRules.methods.find((m: any) => m.type === 'ATR_BASED');
    if (atrMethod) {
      // Entry - (1.0-1.5 × ATR)
      const stopLossPrice = entryPrice - (1.25 * technical.atr);
      criteria.push({
        id: uuidv4(),
        type: 'STOP_LOSS',
        value: stopLossPrice,
        isActive: true,
        priority: 1, // Highest priority
        createdAt: new Date()
      });
    }

    // Add percentage-based stop loss as backup
    const percentMethod = stopLossRules.methods.find((m: any) => m.type === 'PERCENTAGE');
    if (percentMethod) {
      const stopLossPrice = entryPrice * (1 - percentMethod.bufferPercent / 100);
      criteria.push({
        id: uuidv4(),
        type: 'STOP_LOSS',
        value: stopLossPrice,
        isActive: true,
        priority: 2,
        createdAt: new Date()
      });
    }

    return criteria;
  }

  /**
   * Create profit target exit criteria
   */
  private createProfitTargetCriteria(
    _symbol: string,
    entryPrice: number,
    marketData: MarketData,
    profitTargetMethods: any[]
  ): ExitCriteria[] {
    const criteria: ExitCriteria[] = [];
    const technical = marketData.technical;

    // Use ATR-based targets
    const atrMethod = profitTargetMethods.find(m => m.method === 'ATR_BASED');
    if (atrMethod && atrMethod.targets) {
      atrMethod.targets.forEach((target: any, index: number) => {
        const calculation = target.calculation || '';
        const match = calculation.match(/Entry \+ \(([\d.]+) × ATR\)/);
        if (match && match[1]) {
          const multiplier = parseFloat(match[1]);
          const targetPrice = entryPrice + (multiplier * technical.atr);
          
          criteria.push({
            id: uuidv4(),
            type: 'PROFIT_TARGET',
            value: targetPrice,
            isActive: true,
            priority: 10 + index, // Lower priority than stop losses
            createdAt: new Date()
          });
        }
      });
    }

    return criteria;
  }

  /**
   * Create time-based exit criteria
   */
  private createTimeBasedCriteria(
    _symbol: string,
    entryDate: Date,
    timeBasedRules: any
  ): ExitCriteria | null {
    if (!timeBasedRules.maxHoldingPeriod) {
      return null;
    }

    // Calculate exit date based on max holding period
    const maxHoldingDays = timeBasedRules.maxHoldingPeriod;
    const exitDate = new Date(entryDate);
    exitDate.setDate(exitDate.getDate() + maxHoldingDays);

    return {
      id: uuidv4(),
      type: 'TIME_BASED',
      value: exitDate.getTime(), // Store as timestamp
      isActive: true,
      priority: 20, // Lowest priority
      createdAt: new Date()
    };
  }

  /**
   * Evaluate exit criteria for a position
   */
  private evaluateExitCriteria(
    position: Position,
    currentPrice: number,
    _marketData: MarketData,
    _guidelines: TradingGuidelines
  ): ExitCriteria[] {
    const triggeredCriteria: ExitCriteria[] = [];

    for (const criterion of position.exitCriteria) {
      if (!criterion.isActive) {
        continue;
      }

      let isTriggered = false;

      switch (criterion.type) {
        case 'STOP_LOSS':
          // Triggered if current price is at or below stop loss
          isTriggered = currentPrice <= criterion.value;
          break;

        case 'PROFIT_TARGET':
          // Triggered if current price is at or above profit target
          isTriggered = currentPrice >= criterion.value;
          break;

        case 'TIME_BASED':
          // Triggered if current time is past the exit time
          isTriggered = Date.now() >= criterion.value;
          break;

        case 'TECHNICAL':
          // Would need more sophisticated technical analysis
          // For now, not implemented
          break;
      }

      if (isTriggered) {
        triggeredCriteria.push(criterion);
      }
    }

    return triggeredCriteria;
  }

  /**
   * Prioritize criteria (stop losses before profit targets)
   */
  private prioritizeCriteria(criteria: ExitCriteria[]): ExitCriteria {
    // Sort by priority (lower number = higher priority)
    const sorted = [...criteria].sort((a, b) => a.priority - b.priority);
    if (sorted.length === 0) {
      throw new ExitCriteriaMonitorError('No criteria to prioritize', 'NO_CRITERIA');
    }
    return sorted[0]!;
  }

  /**
   * Create exit signal from triggered criterion
   */
  private createExitSignal(
    position: Position,
    currentPrice: number,
    criterion: ExitCriteria,
    marketData: MarketData
  ): TradingSignal {
    const reasoning = this.generateExitReasoning(position, currentPrice, criterion);

    return {
      id: uuidv4(),
      symbol: position.symbol,
      action: 'SELL',
      confidence: 1.0, // Exit criteria are definitive
      reasoning,
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
      entryPrice: currentPrice,
      stopLoss: 0, // Not applicable for exit
      profitTargets: [],
      timestamp: new Date()
    };
  }

  /**
   * Generate reasoning for exit signal
   */
  private generateExitReasoning(
    position: Position,
    currentPrice: number,
    criterion: ExitCriteria
  ): string {
    const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    const pnlAmount = (currentPrice - position.entryPrice) * position.quantity;

    switch (criterion.type) {
      case 'STOP_LOSS':
        return `Stop loss triggered at $${currentPrice.toFixed(2)}. ` +
               `Entry was $${position.entryPrice.toFixed(2)}, ` +
               `loss of ${Math.abs(pnlPercent).toFixed(2)}% ($${Math.abs(pnlAmount).toFixed(2)}). ` +
               `Exiting to limit losses as per risk management rules.`;

      case 'PROFIT_TARGET':
        return `Profit target reached at $${currentPrice.toFixed(2)}. ` +
               `Entry was $${position.entryPrice.toFixed(2)}, ` +
               `gain of ${pnlPercent.toFixed(2)}% ($${pnlAmount.toFixed(2)}). ` +
               `Taking profits as planned.`;

      case 'TIME_BASED':
        const holdingDays = Math.floor((Date.now() - position.entryDate.getTime()) / (1000 * 60 * 60 * 24));
        return `Time-based exit triggered after ${holdingDays} days. ` +
               `Current P&L: ${pnlPercent.toFixed(2)}% ($${pnlAmount.toFixed(2)}). ` +
               `Exiting per maximum holding period rule.`;

      case 'TECHNICAL':
        return `Technical exit signal triggered at $${currentPrice.toFixed(2)}. ` +
               `Current P&L: ${pnlPercent.toFixed(2)}% ($${pnlAmount.toFixed(2)}).`;

      default:
        return `Exit criteria met at $${currentPrice.toFixed(2)}.`;
    }
  }

  /**
   * Get monitoring status
   */
  isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }
}

/**
 * Factory function to create ExitCriteriaMonitor instance
 */
export function createExitCriteriaMonitor(config: ExitCriteriaMonitorConfig): ExitCriteriaMonitor {
  return new ExitCriteriaMonitor(config);
}
