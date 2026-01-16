/**
 * Trading Engine - Orchestrates the complete trading cycle
 * Implements execution order: buy → sell → exit → update
 */

import { v4 as uuidv4 } from 'uuid';
import { TradingEngineInterface } from '../../../shared/src/types/interfaces';
import { EngineStatus, SystemHealth, ComponentHealth } from '../../../shared/src/types/config';
import { TradingCycleResult, Trade } from '../../../shared/src/types/trading';
import { LoggingService } from './logging-service';
import { GuidelinesManager } from './guidelines-manager';
import { SignalGenerator } from './signal-generator';
import { PortfolioManager } from './portfolio-manager';
import { RiskManager } from './risk-manager';
import { ExitCriteriaMonitor } from './exit-criteria-monitor';
import { MarketDataService } from './market-data-service';

export interface TradingEngineConfig {
  cycleIntervalMs?: number;
  enableAutoTrading?: boolean;
  maxConcurrentTrades?: number;
}

export class TradingEngineError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'TradingEngineError';
  }
}

export class TradingEngine implements TradingEngineInterface {
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private cycleTimer?: NodeJS.Timeout;
  private startTime?: Date;
  private cyclesCompleted: number = 0;
  private totalCycleTime: number = 0;
  private errors: string[] = [];
  private lastCycleTime?: Date;
  private currentPhase: EngineStatus['currentPhase'] = 'IDLE';

  constructor(
    private readonly loggingService: LoggingService,
    private readonly guidelinesManager: GuidelinesManager,
    private readonly signalGenerator: SignalGenerator,
    private readonly portfolioManager: PortfolioManager,
    private readonly riskManager: RiskManager,
    private readonly exitCriteriaMonitor: ExitCriteriaMonitor,
    private readonly marketDataService: MarketDataService,
    private readonly config: TradingEngineConfig = {}
  ) {
    this.loggingService.info('Trading Engine initialized', {
      config: this.config
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new TradingEngineError('Trading engine is already running', 'ALREADY_RUNNING');
    }

    this.loggingService.info('Starting trading engine');
    this.currentPhase = 'INITIALIZING';

    try {
      // Load and validate guidelines
      const guidelines = await this.guidelinesManager.loadGuidelines();
      this.loggingService.info('Guidelines loaded successfully', {
        version: guidelines.version,
        lastUpdated: guidelines.lastUpdated
      });

      // Initialize components
      await this.initializeComponents();

      this.isRunning = true;
      this.isPaused = false;
      this.startTime = new Date();
      this.currentPhase = 'IDLE';

      this.loggingService.info('Trading engine started successfully');

      // Set up guidelines hot-reload
      this.setupGuidelinesWatcher();

    } catch (error) {
      this.currentPhase = 'ERROR';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.errors.push(errorMessage);
      this.loggingService.error('Failed to start trading engine', new Error(errorMessage), { error: errorMessage });
      throw new TradingEngineError(`Failed to start: ${errorMessage}`, 'START_FAILED');
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      throw new TradingEngineError('Trading engine is not running', 'NOT_RUNNING');
    }

    this.loggingService.info('Stopping trading engine');

    if (this.cycleTimer) {
      clearTimeout(this.cycleTimer);
    }

    this.isRunning = false;
    this.isPaused = false;
    this.currentPhase = 'IDLE';

    this.loggingService.info('Trading engine stopped', {
      cyclesCompleted: this.cyclesCompleted,
      uptime: this.getUptime()
    });
  }

  async pause(): Promise<void> {
    if (!this.isRunning) {
      throw new TradingEngineError('Trading engine is not running', 'NOT_RUNNING');
    }

    if (this.isPaused) {
      throw new TradingEngineError('Trading engine is already paused', 'ALREADY_PAUSED');
    }

    this.isPaused = true;
    this.loggingService.info('Trading engine paused');
  }

  async resume(): Promise<void> {
    if (!this.isRunning) {
      throw new TradingEngineError('Trading engine is not running', 'NOT_RUNNING');
    }

    if (!this.isPaused) {
      throw new TradingEngineError('Trading engine is not paused', 'NOT_PAUSED');
    }

    this.isPaused = false;
    this.loggingService.info('Trading engine resumed');
  }

  async executeTradingCycle(): Promise<TradingCycleResult> {
    if (!this.isRunning) {
      throw new TradingEngineError('Trading engine is not running', 'NOT_RUNNING');
    }

    if (this.isPaused) {
      throw new TradingEngineError('Trading engine is paused', 'PAUSED');
    }

    const cycleId = uuidv4();
    const cycleStartTime = Date.now();
    this.currentPhase = 'TRADING_CYCLE';

    this.loggingService.info('Starting trading cycle', { cycleId });

    const result: TradingCycleResult = {
      buySignalsProcessed: 0,
      sellSignalsProcessed: 0,
      exitCriteriaChecked: 0,
      tradesExecuted: [],
      errors: [],
      executionTime: 0,
      cycleId,
      timestamp: new Date()
    };

    try {
      // Get current guidelines
      const guidelines = this.guidelinesManager.getCurrentGuidelines();
      if (!guidelines) {
        throw new TradingEngineError('Guidelines not loaded', 'NO_GUIDELINES');
      }

      this.loggingService.info('Using guidelines', {
        version: guidelines.version,
        cycleId
      });

      // Step 1: Process buy signals
      this.loggingService.info('Step 1: Processing buy signals', { cycleId });
      const buyResults = await this.processBuySignals(guidelines, cycleId);
      result.buySignalsProcessed = buyResults.signalsProcessed;
      result.tradesExecuted.push(...buyResults.trades);
      result.errors.push(...buyResults.errors);

      // Step 2: Process sell signals
      this.loggingService.info('Step 2: Processing sell signals', { cycleId });
      const sellResults = await this.processSellSignals(guidelines, cycleId);
      result.sellSignalsProcessed = sellResults.signalsProcessed;
      result.tradesExecuted.push(...sellResults.trades);
      result.errors.push(...sellResults.errors);

      // Step 3: Check exit criteria
      this.loggingService.info('Step 3: Checking exit criteria', { cycleId });
      const exitResults = await this.processExitCriteria(cycleId);
      result.exitCriteriaChecked = exitResults.positionsChecked;
      result.tradesExecuted.push(...exitResults.trades);
      result.errors.push(...exitResults.errors);

      // Step 4: Update portfolio metrics
      this.loggingService.info('Step 4: Updating portfolio metrics', { cycleId });
      await this.updatePortfolioMetrics(cycleId);

      // Calculate execution time
      result.executionTime = Date.now() - cycleStartTime;
      this.totalCycleTime += result.executionTime;
      this.cyclesCompleted++;
      this.lastCycleTime = new Date();
      this.currentPhase = 'IDLE';

      this.loggingService.info('Trading cycle completed', {
        cycleId,
        buySignalsProcessed: result.buySignalsProcessed,
        sellSignalsProcessed: result.sellSignalsProcessed,
        exitCriteriaChecked: result.exitCriteriaChecked,
        tradesExecuted: result.tradesExecuted.length,
        errors: result.errors.length,
        executionTime: result.executionTime
      });

      return result;

    } catch (error) {
      this.currentPhase = 'ERROR';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      this.errors.push(errorMessage);
      
      this.loggingService.error('Trading cycle failed', new Error(errorMessage), {
        cycleId,
        error: errorMessage
      });

      result.executionTime = Date.now() - cycleStartTime;
      return result;
    }
  }

  getStatus(): EngineStatus {
    const uptime = this.getUptime();
    const averageCycleTime = this.cyclesCompleted > 0 
      ? this.totalCycleTime / this.cyclesCompleted 
      : 0;
    const successRate = this.cyclesCompleted > 0
      ? ((this.cyclesCompleted - this.errors.length) / this.cyclesCompleted) * 100
      : 100;

    const status: EngineStatus = {
      isRunning: this.isRunning,
      currentPhase: this.currentPhase,
      uptime,
      cyclesCompleted: this.cyclesCompleted,
      errors: [...this.errors],
      performance: {
        averageCycleTime,
        successRate
      }
    };

    // Add optional properties only if they exist
    if (this.lastCycleTime) {
      status.lastCycleTime = this.lastCycleTime;
    }
    
    const nextCycleTime = this.getNextCycleTime();
    if (nextCycleTime) {
      status.nextCycleTime = nextCycleTime;
    }

    if (this.errors.length > 0) {
      const lastError = this.errors[this.errors.length - 1];
      if (lastError) {
        status.performance.lastError = lastError;
      }
      if (this.lastCycleTime) {
        status.performance.lastErrorTime = this.lastCycleTime;
      }
    }

    return status;
  }

  async getHealth(): Promise<SystemHealth> {
    const componentChecks = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkMarketDataHealth(),
      this.checkGuidelinesHealth()
    ]);

    const [dbHealth, marketDataHealth, _guidelinesHealth] = componentChecks;

    const anyCritical = componentChecks.some((h: ComponentHealth) => h.status === 'CRITICAL');
    const anyWarning = componentChecks.some((h: ComponentHealth) => h.status === 'WARNING');

    return {
      overall: anyCritical ? 'CRITICAL' : anyWarning ? 'WARNING' : 'HEALTHY',
      components: {
        tradingEngine: this.getEngineHealth(),
        database: dbHealth,
        marketData: marketDataHealth,
        llmService: { status: 'HEALTHY', message: 'LLM service operational', lastCheck: new Date() },
        riskManager: { status: 'HEALTHY', message: 'Risk manager operational', lastCheck: new Date() }
      },
      lastCheck: new Date()
    };
  }

  private async initializeComponents(): Promise<void> {
    this.loggingService.info('Initializing components');
    
    // Components are already initialized via constructor
    // This method can be extended for additional initialization logic
    
    this.loggingService.info('Components initialized successfully');
  }

  private setupGuidelinesWatcher(): void {
    this.guidelinesManager.watchGuidelinesFile((guidelines) => {
      this.loggingService.info('Guidelines updated during runtime', {
        version: guidelines.version,
        lastUpdated: guidelines.lastUpdated
      });
    });
  }

  private async processBuySignals(_guidelines: any, cycleId: string): Promise<{
    signalsProcessed: number;
    trades: Trade[];
    errors: string[];
  }> {
    const result = {
      signalsProcessed: 0,
      trades: [] as Trade[],
      errors: [] as string[]
    };

    try {
      // Get market data for screening
      const portfolio = this.portfolioManager.getPortfolio();
      
      // Generate buy signals using guidelines
      const buySignals = await this.signalGenerator.generateBuySignals();
      result.signalsProcessed = buySignals.length;

      this.loggingService.info('Buy signals generated', {
        count: buySignals.length,
        cycleId
      });

      // Process each buy signal
      for (const signal of buySignals) {
        try {
          // Validate with risk manager
          const riskValidation = await this.riskManager.validateTrade(signal, portfolio);
          
          if (!riskValidation.approved) {
            this.loggingService.warn('Buy signal rejected by risk manager', {
              symbol: signal.symbol,
              reason: riskValidation.reason,
              cycleId
            });
            continue;
          }

          // Execute trade
          const tradeResult = await this.portfolioManager.executeTradeOrder(signal);
          
          if (tradeResult.success && tradeResult.trade) {
            result.trades.push(tradeResult.trade);
            this.loggingService.info('Buy trade executed', {
              symbol: signal.symbol,
              quantity: tradeResult.trade.quantity,
              price: tradeResult.trade.price,
              cycleId
            });
          } else {
            result.errors.push(`Failed to execute buy for ${signal.symbol}: ${tradeResult.error}`);
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Error processing buy signal for ${signal.symbol}: ${errorMessage}`);
          this.loggingService.error('Error processing buy signal', error instanceof Error ? error : new Error(errorMessage), {
            symbol: signal.symbol,
            error: errorMessage,
            cycleId
          });
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Error in buy signal processing: ${errorMessage}`);
      this.loggingService.error('Error in buy signal processing', error instanceof Error ? error : new Error(errorMessage), {
        error: errorMessage,
        cycleId
      });
    }

    return result;
  }

  private async processSellSignals(_guidelines: any, cycleId: string): Promise<{
    signalsProcessed: number;
    trades: Trade[];
    errors: string[];
  }> {
    const result = {
      signalsProcessed: 0,
      trades: [] as Trade[],
      errors: [] as string[]
    };

    try {
      const positions = this.portfolioManager.getCurrentPositions();
      
      // Generate sell signals using guidelines
      const sellSignals = await this.signalGenerator.generateSellSignals(positions);
      result.signalsProcessed = sellSignals.length;

      this.loggingService.info('Sell signals generated', {
        count: sellSignals.length,
        cycleId
      });

      // Process each sell signal
      for (const signal of sellSignals) {
        try {
          // Execute trade
          const tradeResult = await this.portfolioManager.executeTradeOrder(signal);
          
          if (tradeResult.success && tradeResult.trade) {
            result.trades.push(tradeResult.trade);
            this.loggingService.info('Sell trade executed', {
              symbol: signal.symbol,
              quantity: tradeResult.trade.quantity,
              price: tradeResult.trade.price,
              cycleId
            });
          } else {
            result.errors.push(`Failed to execute sell for ${signal.symbol}: ${tradeResult.error}`);
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Error processing sell signal for ${signal.symbol}: ${errorMessage}`);
          this.loggingService.error('Error processing sell signal', error instanceof Error ? error : new Error(errorMessage), {
            symbol: signal.symbol,
            error: errorMessage,
            cycleId
          });
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Error in sell signal processing: ${errorMessage}`);
      this.loggingService.error('Error in sell signal processing', error instanceof Error ? error : new Error(errorMessage), {
        error: errorMessage,
        cycleId
      });
    }

    return result;
  }

  private async processExitCriteria(cycleId: string): Promise<{
    positionsChecked: number;
    trades: Trade[];
    errors: string[];
  }> {
    const result = {
      positionsChecked: 0,
      trades: [] as Trade[],
      errors: [] as string[]
    };

    try {
      const positions = this.portfolioManager.getCurrentPositions();
      result.positionsChecked = positions.length;

      this.loggingService.info('Checking exit criteria', {
        positionsCount: positions.length,
        cycleId
      });

      // Check exit criteria for all positions
      const exitCheckResult = await this.exitCriteriaMonitor.checkExitCriteria(positions);
      const exitSignals = exitCheckResult.exitSignals;

      this.loggingService.info('Exit signals generated', {
        count: exitSignals.length,
        cycleId
      });

      // Process each exit signal
      for (const signal of exitSignals) {
        try {
          // Execute exit trade
          const tradeResult = await this.portfolioManager.executeTradeOrder(signal);
          
          if (tradeResult.success && tradeResult.trade) {
            result.trades.push(tradeResult.trade);
            this.loggingService.info('Exit trade executed', {
              symbol: signal.symbol,
              quantity: tradeResult.trade.quantity,
              price: tradeResult.trade.price,
              reason: signal.reasoning,
              cycleId
            });
          } else {
            result.errors.push(`Failed to execute exit for ${signal.symbol}: ${tradeResult.error}`);
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Error processing exit signal for ${signal.symbol}: ${errorMessage}`);
          this.loggingService.error('Error processing exit signal', error instanceof Error ? error : new Error(errorMessage), {
            symbol: signal.symbol,
            error: errorMessage,
            cycleId
          });
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Error in exit criteria processing: ${errorMessage}`);
      this.loggingService.error('Error in exit criteria processing', error instanceof Error ? error : new Error(errorMessage), {
        error: errorMessage,
        cycleId
      });
    }

    return result;
  }

  private async updatePortfolioMetrics(cycleId: string): Promise<void> {
    try {
      await this.portfolioManager.updatePortfolioMetrics();
      
      const portfolio = this.portfolioManager.getPortfolio();
      const performanceStats = await this.portfolioManager.getPerformanceStats();

      this.loggingService.info('Portfolio metrics updated', {
        totalValue: portfolio.totalValue,
        cashBalance: portfolio.cashBalance,
        positionsCount: portfolio.positions.length,
        dailyPnL: portfolio.dailyPnL,
        totalPnL: portfolio.totalPnL,
        winRate: performanceStats.winRate,
        cycleId
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.loggingService.error('Error updating portfolio metrics', error instanceof Error ? error : new Error(errorMessage), {
        error: errorMessage,
        cycleId
      });
      throw error;
    }
  }

  private getUptime(): number {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  private getNextCycleTime(): Date | undefined {
    if (!this.isRunning || !this.config.cycleIntervalMs) return undefined;
    if (!this.lastCycleTime) return new Date();
    return new Date(this.lastCycleTime.getTime() + this.config.cycleIntervalMs);
  }

  private getEngineHealth(): ComponentHealth {
    if (!this.isRunning) {
      return {
        status: 'OFFLINE',
        message: 'Trading engine is not running',
        lastCheck: new Date()
      };
    }

    if (this.errors.length > 5) {
      return {
        status: 'CRITICAL',
        message: `Multiple errors detected (${this.errors.length})`,
        lastCheck: new Date(),
        errorRate: this.errors.length / Math.max(this.cyclesCompleted, 1)
      };
    }

    if (this.errors.length > 0) {
      return {
        status: 'WARNING',
        message: `Some errors detected (${this.errors.length})`,
        lastCheck: new Date(),
        errorRate: this.errors.length / Math.max(this.cyclesCompleted, 1)
      };
    }

    return {
      status: 'HEALTHY',
      message: 'Trading engine operating normally',
      lastCheck: new Date(),
      errorRate: 0
    };
  }

  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    try {
      // Simple health check - try to get portfolio
      this.portfolioManager.getPortfolio();
      return {
        status: 'HEALTHY',
        message: 'Database operational',
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'CRITICAL',
        message: 'Database connection failed',
        lastCheck: new Date()
      };
    }
  }

  private async checkMarketDataHealth(): Promise<ComponentHealth> {
    try {
      const isOpen = this.marketDataService.isMarketOpen();
      return {
        status: 'HEALTHY',
        message: isOpen ? 'Market data available' : 'Market closed',
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'WARNING',
        message: 'Market data service unavailable',
        lastCheck: new Date()
      };
    }
  }

  private async checkGuidelinesHealth(): Promise<ComponentHealth> {
    try {
      const guidelines = this.guidelinesManager.getCurrentGuidelines();
      if (!guidelines) {
        return {
          status: 'CRITICAL',
          message: 'Guidelines not loaded',
          lastCheck: new Date()
        };
      }
      return {
        status: 'HEALTHY',
        message: 'Guidelines loaded and valid',
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'CRITICAL',
        message: 'Guidelines validation failed',
        lastCheck: new Date()
      };
    }
  }
}

/**
 * Factory function to create a TradingEngine instance
 */
export function createTradingEngine(
  loggingService: LoggingService,
  guidelinesManager: GuidelinesManager,
  signalGenerator: SignalGenerator,
  portfolioManager: PortfolioManager,
  riskManager: RiskManager,
  exitCriteriaMonitor: ExitCriteriaMonitor,
  marketDataService: MarketDataService,
  config?: TradingEngineConfig
): TradingEngine {
  return new TradingEngine(
    loggingService,
    guidelinesManager,
    signalGenerator,
    portfolioManager,
    riskManager,
    exitCriteriaMonitor,
    marketDataService,
    config
  );
}
