/**
 * Portfolio Manager Service
 * Handles portfolio state, position tracking, performance metrics, and trade execution
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  Portfolio, 
  Position, 
  PortfolioMetrics, 
  PerformanceStats, 
  PortfolioSnapshot,
  PositionSnapshot
} from '../../../shared/src/types/portfolio';
import { 
  Trade, 
  TradingSignal, 
  TradeResult
} from '../../../shared/src/types/trading';
import { DatabaseService } from '../database/database-service';
import { PortfolioRepository } from '../database/repositories/portfolio-repository';
import { PositionRepository } from '../database/repositories/position-repository';
import { TradeRepository } from '../database/repositories/trade-repository';
import { LoggingService } from './logging-service';

export interface PortfolioManagerConfig {
  portfolioId?: string;
  initialCash?: number;
  mockBrokerEnabled?: boolean;
  snapshotInterval?: number; // minutes
}

export interface MockBrokerConfig {
  latencyMs?: number;
  slippagePercent?: number;
  feePerTrade?: number;
  failureRate?: number; // 0-1, probability of trade failure
}

export class PortfolioManagerError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'PortfolioManagerError';
  }
}

export class PortfolioManager {
  private portfolioRepo: PortfolioRepository;
  private positionRepo: PositionRepository;
  private tradeRepo: TradeRepository;
  private logger: LoggingService;
  private config: Required<PortfolioManagerConfig>;
  private mockBrokerConfig: MockBrokerConfig;
  private portfolio: Portfolio | null = null;
  private positions: Position[] = [];
  private lastSnapshotTime: Date = new Date(0);

  constructor(
    db: DatabaseService,
    logger: LoggingService,
    config: PortfolioManagerConfig = {},
    mockBrokerConfig: MockBrokerConfig = {}
  ) {
    this.portfolioRepo = db.getPortfolioRepository();
    this.positionRepo = db.getPositionRepository();
    this.tradeRepo = db.getTradeRepository();
    this.logger = logger;
    
    this.config = {
      portfolioId: config.portfolioId || 'default',
      initialCash: config.initialCash || 100000,
      mockBrokerEnabled: config.mockBrokerEnabled ?? true,
      snapshotInterval: config.snapshotInterval || 60 // 1 hour
    };

    this.mockBrokerConfig = {
      latencyMs: mockBrokerConfig.latencyMs || 100,
      slippagePercent: mockBrokerConfig.slippagePercent || 0.01, // 0.01%
      feePerTrade: mockBrokerConfig.feePerTrade || 1.0,
      failureRate: mockBrokerConfig.failureRate || 0.01 // 1% failure rate
    };
  }

  /**
   * Initialize the portfolio manager
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Portfolio Manager', { portfolioId: this.config.portfolioId });
      
      // Load or create portfolio
      await this.loadPortfolio();
      
      // Load positions
      await this.loadPositions();
      
      // Update portfolio metrics
      await this.updatePortfolioMetrics();
      
      this.logger.info('Portfolio Manager initialized successfully', {
        portfolioId: this.config.portfolioId,
        totalValue: this.portfolio?.totalValue,
        positionCount: this.positions.length
      });
    } catch (error) {
      this.logger.error('Failed to initialize Portfolio Manager', error instanceof Error ? error : new Error(String(error)));
      throw new PortfolioManagerError(`Failed to initialize portfolio manager: ${error}`);
    }
  }

  /**
   * Get current portfolio state
   */
  getPortfolio(): Portfolio {
    if (!this.portfolio) {
      throw new PortfolioManagerError('Portfolio not initialized');
    }
    return { ...this.portfolio, positions: [...this.positions] };
  }

  /**
   * Get current positions
   */
  getCurrentPositions(): Position[] {
    return [...this.positions];
  }

  /**
   * Get open positions (quantity > 0)
   */
  getOpenPositions(): Position[] {
    return this.positions.filter(pos => pos.quantity > 0);
  }

  /**
   * Get position by symbol
   */
  getPositionBySymbol(symbol: string): Position | null {
    return this.positions.find(pos => pos.symbol === symbol && pos.quantity > 0) || null;
  }

  /**
   * Execute a trade order based on trading signal
   */
  async executeTradeOrder(signal: TradingSignal): Promise<TradeResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Executing trade order', { 
        signal: {
          id: signal.id,
          symbol: signal.symbol,
          action: signal.action,
          recommendedSize: signal.recommendedSize
        }
      });

      // Validate signal
      this.validateTradingSignal(signal);

      // Calculate position size
      const positionSize = this.calculatePositionSize(signal);
      
      if (positionSize <= 0) {
        throw new PortfolioManagerError('Invalid position size calculated');
      }

      // Create trade record
      const trade: Omit<Trade, 'id'> = {
        symbol: signal.symbol,
        action: signal.action,
        quantity: positionSize,
        price: signal.entryPrice || 0, // Will be set by mock broker
        timestamp: new Date(),
        reasoning: signal.reasoning,
        signalId: signal.id,
        fees: this.mockBrokerConfig.feePerTrade || 0,
        status: 'PENDING'
      };

      // Execute through mock broker
      const executedTrade = await this.executeMockTrade(trade);

      // Update portfolio based on executed trade
      await this.processExecutedTrade(executedTrade);

      // Save trade to database
      const savedTrade = await this.tradeRepo.create(executedTrade);

      const executionTime = Date.now() - startTime;
      
      this.logger.info('Trade executed successfully', {
        tradeId: savedTrade.id,
        symbol: savedTrade.symbol,
        action: savedTrade.action,
        quantity: savedTrade.quantity,
        price: savedTrade.price,
        executionTime
      });

      return {
        success: true,
        trade: savedTrade,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.logger.error('Trade execution failed', error instanceof Error ? error : new Error(String(error)), { 
        signalId: signal.id,
        executionTime
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime
      };
    }
  }

  /**
   * Calculate position size based on signal and portfolio state
   */
  calculatePositionSize(signal: TradingSignal): number {
    if (!this.portfolio) {
      throw new PortfolioManagerError('Portfolio not initialized');
    }

    // Use recommended size from signal, but apply portfolio constraints
    let positionSize = signal.recommendedSize;

    // Ensure we have enough cash for buy orders
    if (signal.action === 'BUY') {
      const estimatedPrice = signal.entryPrice || 100; // Default price if not provided
      const maxAffordableShares = Math.floor(this.portfolio.cashBalance / estimatedPrice);
      positionSize = Math.min(positionSize, maxAffordableShares);
    }

    // For sell orders, ensure we don't sell more than we own
    if (signal.action === 'SELL') {
      const position = this.getPositionBySymbol(signal.symbol);
      if (position) {
        positionSize = Math.min(positionSize, position.quantity);
      } else {
        positionSize = 0; // Can't sell what we don't own
      }
    }

    return Math.max(0, positionSize);
  }

  /**
   * Update portfolio metrics and performance stats
   */
  async updatePortfolioMetrics(): Promise<PortfolioMetrics> {
    if (!this.portfolio) {
      throw new PortfolioManagerError('Portfolio not initialized');
    }

    try {
      // Calculate total position value
      const totalPositionValue = this.positions.reduce((sum, pos) => {
        return sum + (pos.quantity * pos.currentPrice);
      }, 0);

      // Update portfolio totals
      const newTotalValue = this.portfolio.cashBalance + totalPositionValue;
      const newTotalPnL = newTotalValue - this.config.initialCash;

      // Calculate daily PnL (simplified - would need historical data for accurate calculation)
      const newDailyPnL = this.positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);

      // Update portfolio in database
      this.portfolio = await this.portfolioRepo.updateMetrics(
        this.portfolio.id,
        newTotalValue,
        this.portfolio.cashBalance,
        newDailyPnL,
        newTotalPnL
      );

      // Calculate sector exposure
      const sectorExposure = this.calculateSectorExposure();

      // Find largest position
      const largestPosition = this.findLargestPosition();

      const metrics: PortfolioMetrics = {
        totalValue: newTotalValue,
        totalPnL: newTotalPnL,
        dailyPnL: newDailyPnL,
        weeklyPnL: 0, // Would need historical data
        monthlyPnL: 0, // Would need historical data
        positionCount: this.getOpenPositions().length,
        cashPercentage: (this.portfolio.cashBalance / newTotalValue) * 100,
        largestPosition: largestPosition || { symbol: '', percentage: 0 },
        sectorExposure,
        lastUpdated: new Date()
      };

      // Take snapshot if enough time has passed
      await this.takeSnapshotIfNeeded();

      this.logger.debug('Portfolio metrics updated', { metrics });

      return metrics;

    } catch (error) {
      this.logger.error('Failed to update portfolio metrics', error instanceof Error ? error : new Error(String(error)));
      throw new PortfolioManagerError(`Failed to update portfolio metrics: ${error}`);
    }
  }

  /**
   * Get performance statistics
   */
  async getPerformanceStats(): Promise<PerformanceStats> {
    try {
      // Get trade statistics
      const tradeStats = await this.tradeRepo.getTradeStats();
      
      // Calculate performance metrics
      const executedTrades = await this.tradeRepo.getTradeHistory({ status: 'EXECUTED' });
      
      // Group trades by symbol to calculate wins/losses
      const tradesBySymbol = new Map<string, Trade[]>();
      executedTrades.forEach(trade => {
        const trades = tradesBySymbol.get(trade.symbol) || [];
        trades.push(trade);
        tradesBySymbol.set(trade.symbol, trades);
      });

      let winningTrades = 0;
      let losingTrades = 0;
      let totalWinAmount = 0;
      let totalLossAmount = 0;
      let maxConsecutiveWins = 0;
      let maxConsecutiveLosses = 0;
      let currentConsecutiveWins = 0;
      let currentConsecutiveLosses = 0;

      // Calculate win/loss statistics (simplified)
      for (const trades of tradesBySymbol.values()) {
        if (trades.length >= 2) {
          // Find buy/sell pairs
          const buyTrades = trades.filter(t => t.action === 'BUY').sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          const sellTrades = trades.filter(t => t.action === 'SELL').sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          
          const pairs = Math.min(buyTrades.length, sellTrades.length);
          
          for (let i = 0; i < pairs; i++) {
            const buyTrade = buyTrades[i]!;
            const sellTrade = sellTrades[i]!;
            const pnl = (sellTrade.price - buyTrade.price) * Math.min(buyTrade.quantity, sellTrade.quantity) - buyTrade.fees - sellTrade.fees;
            
            if (pnl > 0) {
              winningTrades++;
              totalWinAmount += pnl;
              currentConsecutiveWins++;
              currentConsecutiveLosses = 0;
              maxConsecutiveWins = Math.max(maxConsecutiveWins, currentConsecutiveWins);
            } else {
              losingTrades++;
              totalLossAmount += Math.abs(pnl);
              currentConsecutiveLosses++;
              currentConsecutiveWins = 0;
              maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentConsecutiveLosses);
            }
          }
        }
      }

      const totalCompletedTrades = winningTrades + losingTrades;
      const winRate = totalCompletedTrades > 0 ? (winningTrades / totalCompletedTrades) * 100 : 0;
      const averageWin = winningTrades > 0 ? totalWinAmount / winningTrades : 0;
      const averageLoss = losingTrades > 0 ? totalLossAmount / losingTrades : 0;
      const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : 0;

      // Calculate drawdown (simplified)
      const currentValue = this.portfolio?.totalValue || this.config.initialCash;
      const maxDrawdown = Math.max(0, ((this.config.initialCash - currentValue) / this.config.initialCash) * 100);
      const currentDrawdown = maxDrawdown; // Simplified

      const stats: PerformanceStats = {
        totalTrades: tradeStats.totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        averageWin,
        averageLoss,
        profitFactor,
        maxDrawdown,
        currentDrawdown,
        sharpeRatio: 0, // Would need historical returns data
        sortino: 0, // Would need historical returns data
        calmarRatio: 0, // Would need historical returns data
        maxConsecutiveWins,
        maxConsecutiveLosses,
        averageHoldingPeriod: 0, // Would need to calculate from trade pairs
        totalFees: tradeStats.totalFees,
        netProfit: this.portfolio?.totalPnL || 0,
        grossProfit: totalWinAmount,
        grossLoss: totalLossAmount,
        lastUpdated: new Date()
      };

      this.logger.debug('Performance stats calculated', { stats });

      return stats;

    } catch (error) {
      this.logger.error('Failed to calculate performance stats', error instanceof Error ? error : new Error(String(error)));
      throw new PortfolioManagerError(`Failed to calculate performance stats: ${error}`);
    }
  }

  /**
   * Update position prices (would be called by market data service)
   */
  async updatePositionPrices(priceUpdates: Array<{ symbol: string; price: number }>): Promise<void> {
    try {
      for (const update of priceUpdates) {
        const position = this.positions.find(pos => pos.symbol === update.symbol);
        if (position && position.quantity > 0) {
          const oldPrice = position.currentPrice;
          position.currentPrice = update.price;
          position.unrealizedPnL = (position.currentPrice - position.entryPrice) * position.quantity;
          position.lastUpdated = new Date();

          // Update in database
          await this.positionRepo.updatePrice(position.id, position.currentPrice, position.unrealizedPnL);

          this.logger.debug('Position price updated', {
            symbol: position.symbol,
            oldPrice,
            newPrice: position.currentPrice,
            unrealizedPnL: position.unrealizedPnL
          });
        }
      }

      // Update portfolio metrics after price updates
      await this.updatePortfolioMetrics();

    } catch (error) {
      this.logger.error('Failed to update position prices', error instanceof Error ? error : new Error(String(error)));
      throw new PortfolioManagerError(`Failed to update position prices: ${error}`);
    }
  }

  /**
   * Get portfolio snapshot history
   */
  async getSnapshotHistory(days: number = 30): Promise<PortfolioSnapshot[]> {
    if (!this.portfolio) {
      throw new PortfolioManagerError('Portfolio not initialized');
    }

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return await this.portfolioRepo.getSnapshots(this.portfolio.id, startDate, undefined, 100);
    } catch (error) {
      this.logger.error('Failed to get snapshot history', error instanceof Error ? error : new Error(String(error)));
      throw new PortfolioManagerError(`Failed to get snapshot history: ${error}`);
    }
  }

  /**
   * Private helper methods
   */

  private async loadPortfolio(): Promise<void> {
    try {
      this.portfolio = await this.portfolioRepo.getDefault();
      
      if (!this.portfolio) {
        // Create default portfolio
        this.portfolio = await this.portfolioRepo.create({
          totalValue: this.config.initialCash,
          cashBalance: this.config.initialCash,
          positions: [],
          dailyPnL: 0,
          totalPnL: 0,
          lastUpdated: new Date(),
          createdAt: new Date()
        });
      }
    } catch (error) {
      throw new PortfolioManagerError(`Failed to load portfolio: ${error}`);
    }
  }

  private async loadPositions(): Promise<void> {
    if (!this.portfolio) {
      throw new PortfolioManagerError('Portfolio not initialized');
    }

    try {
      this.positions = await this.positionRepo.getByPortfolio(this.portfolio.id);
    } catch (error) {
      throw new PortfolioManagerError(`Failed to load positions: ${error}`);
    }
  }

  private validateTradingSignal(signal: TradingSignal): void {
    if (!signal.symbol || signal.symbol.trim() === '') {
      throw new PortfolioManagerError('Invalid signal: symbol is required');
    }

    if (!['BUY', 'SELL'].includes(signal.action)) {
      throw new PortfolioManagerError('Invalid signal: action must be BUY or SELL');
    }

    if (signal.recommendedSize <= 0) {
      throw new PortfolioManagerError('Invalid signal: recommended size must be positive');
    }

    if (signal.confidence < 0 || signal.confidence > 1) {
      throw new PortfolioManagerError('Invalid signal: confidence must be between 0 and 1');
    }
  }

  private async executeMockTrade(trade: Omit<Trade, 'id'>): Promise<Omit<Trade, 'id'>> {
    // Simulate broker latency
    await new Promise(resolve => setTimeout(resolve, this.mockBrokerConfig.latencyMs));

    // Simulate trade failure
    if (Math.random() < (this.mockBrokerConfig.failureRate || 0)) {
      throw new PortfolioManagerError('Mock broker: Trade execution failed');
    }

    // Simulate price slippage
    const basePrice = trade.price || 100; // Default price if not set
    const slippage = (this.mockBrokerConfig.slippagePercent || 0) * basePrice;
    const slippageDirection = trade.action === 'BUY' ? 1 : -1; // Buy higher, sell lower
    const executionPrice = basePrice + (slippage * slippageDirection);

    return {
      ...trade,
      price: Math.max(0.01, executionPrice), // Ensure positive price
      fees: this.mockBrokerConfig.feePerTrade || 0,
      status: 'EXECUTED',
      timestamp: new Date()
    };
  }

  private async processExecutedTrade(trade: Omit<Trade, 'id'>): Promise<void> {
    if (!this.portfolio) {
      throw new PortfolioManagerError('Portfolio not initialized');
    }

    const tradeValue = trade.quantity * trade.price;
    const totalCost = tradeValue + trade.fees;

    if (trade.action === 'BUY') {
      // Decrease cash balance
      this.portfolio.cashBalance -= totalCost;

      // Update or create position
      let position = this.positions.find(pos => pos.symbol === trade.symbol);
      
      if (position) {
        // Update existing position (average cost)
        const totalShares = position.quantity + trade.quantity;
        const totalCost = (position.quantity * position.entryPrice) + tradeValue;
        position.entryPrice = totalCost / totalShares;
        position.quantity = totalShares;
        position.currentPrice = trade.price;
        position.unrealizedPnL = (position.currentPrice - position.entryPrice) * position.quantity;
        position.lastUpdated = new Date();

        await this.positionRepo.update(position.id, {
          quantity: position.quantity,
          entryPrice: position.entryPrice,
          currentPrice: position.currentPrice,
          unrealizedPnL: position.unrealizedPnL
        });
      } else {
        // Create new position
        const newPosition: Omit<Position, 'id'> = {
          symbol: trade.symbol,
          quantity: trade.quantity,
          entryPrice: trade.price,
          currentPrice: trade.price,
          entryDate: trade.timestamp,
          stopLoss: 0, // Will be set by risk manager
          profitTargets: [],
          unrealizedPnL: 0,
          realizedPnL: 0,
          exitCriteria: [],
          lastUpdated: new Date()
        };

        const createdPosition = await this.positionRepo.create(newPosition);
        this.positions.push(createdPosition);
      }

    } else if (trade.action === 'SELL') {
      // Increase cash balance
      this.portfolio.cashBalance += (tradeValue - trade.fees);

      // Update position
      const position = this.positions.find(pos => pos.symbol === trade.symbol);
      if (position) {
        const realizedPnL = (trade.price - position.entryPrice) * trade.quantity - trade.fees;
        position.quantity -= trade.quantity;
        position.realizedPnL += realizedPnL;
        position.lastUpdated = new Date();

        if (position.quantity <= 0) {
          // Close position
          await this.positionRepo.closePosition(position.id, position.realizedPnL);
          position.quantity = 0;
        } else {
          // Update position
          await this.positionRepo.update(position.id, {
            quantity: position.quantity,
            realizedPnL: position.realizedPnL
          });
        }
      }
    }

    // Update portfolio in database
    await this.portfolioRepo.updateMetrics(
      this.portfolio.id,
      this.portfolio.totalValue, // Will be recalculated in updatePortfolioMetrics
      this.portfolio.cashBalance,
      this.portfolio.dailyPnL,
      this.portfolio.totalPnL
    );
  }

  private calculateSectorExposure(): Record<string, number> {
    const sectorExposure: Record<string, number> = {};
    const totalValue = this.portfolio?.totalValue || 1;

    for (const position of this.positions) {
      if (position.quantity > 0 && position.sector) {
        const positionValue = position.quantity * position.currentPrice;
        const percentage = (positionValue / totalValue) * 100;
        sectorExposure[position.sector] = (sectorExposure[position.sector] || 0) + percentage;
      }
    }

    return sectorExposure;
  }

  private findLargestPosition(): { symbol: string; percentage: number } | null {
    if (!this.portfolio || this.positions.length === 0) {
      return null;
    }

    let largestPosition: { symbol: string; percentage: number } | null = null;
    let maxValue = 0;

    for (const position of this.positions) {
      if (position.quantity > 0) {
        const positionValue = position.quantity * position.currentPrice;
        const percentage = (positionValue / this.portfolio.totalValue) * 100;
        
        if (positionValue > maxValue) {
          maxValue = positionValue;
          largestPosition = { symbol: position.symbol, percentage };
        }
      }
    }

    return largestPosition;
  }

  private async takeSnapshotIfNeeded(): Promise<void> {
    if (!this.portfolio) return;

    const now = new Date();
    const timeSinceLastSnapshot = now.getTime() - this.lastSnapshotTime.getTime();
    const snapshotIntervalMs = this.config.snapshotInterval * 60 * 1000; // Convert minutes to ms

    if (timeSinceLastSnapshot >= snapshotIntervalMs) {
      await this.takeSnapshot();
      this.lastSnapshotTime = now;
    }
  }

  private async takeSnapshot(): Promise<void> {
    if (!this.portfolio) return;

    try {
      const positionSnapshots: PositionSnapshot[] = this.positions
        .filter(pos => pos.quantity > 0)
        .map(pos => ({
          symbol: pos.symbol,
          quantity: pos.quantity,
          price: pos.currentPrice,
          value: pos.quantity * pos.currentPrice,
          unrealizedPnL: pos.unrealizedPnL,
          percentage: ((pos.quantity * pos.currentPrice) / this.portfolio!.totalValue) * 100
        }));

      const snapshot: PortfolioSnapshot = {
        id: uuidv4(),
        portfolioId: this.portfolio.id,
        timestamp: new Date(),
        totalValue: this.portfolio.totalValue,
        cashBalance: this.portfolio.cashBalance,
        positionCount: positionSnapshots.length,
        dailyPnL: this.portfolio.dailyPnL,
        totalPnL: this.portfolio.totalPnL,
        positions: positionSnapshots
      };

      await this.portfolioRepo.saveSnapshot(snapshot);
      
      this.logger.debug('Portfolio snapshot saved', {
        snapshotId: snapshot.id,
        totalValue: snapshot.totalValue,
        positionCount: snapshot.positionCount
      });

    } catch (error) {
      this.logger.error('Failed to take portfolio snapshot', error instanceof Error ? error : new Error(String(error)));
    }
  }
}

/**
 * Factory function to create a PortfolioManager instance
 */
export function createPortfolioManager(
  db: DatabaseService,
  logger: LoggingService,
  config?: PortfolioManagerConfig,
  mockBrokerConfig?: MockBrokerConfig
): PortfolioManager {
  return new PortfolioManager(db, logger, config, mockBrokerConfig);
}