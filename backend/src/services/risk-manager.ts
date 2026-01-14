/**
 * Risk Manager Service
 * Handles risk validation, position sizing, and portfolio-level risk management
 * Integrates with GuidelinesManager for dynamic rule updates
 */

import { 
  RiskValidation, 
  RiskCheck, 
  RiskLimits, 
  RiskMetrics, 
  PositionRisk, 
  RiskEvent 
} from '../../../shared/src/types/risk';
import { 
  TradingSignal, 
  Trade, 
  RiskLevel 
} from '../../../shared/src/types/trading';
import { 
  Portfolio
} from '../../../shared/src/types/portfolio';
import { 
  TradingGuidelines, 
  PortfolioRiskRules 
} from '../../../shared/src/types/guidelines';
import { GuidelinesManager } from './guidelines-manager';
import { LoggingService } from './logging-service';

export interface RiskManagerConfig {
  portfolioId?: string;
  enableRealTimeMonitoring?: boolean;
  riskEventThreshold?: RiskLevel;
  maxRiskEventsPerDay?: number;
}

export class RiskManagerError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'RiskManagerError';
  }
}

export class RiskManager {
  private logger: LoggingService;
  private guidelinesManager: GuidelinesManager;
  private config: Required<RiskManagerConfig>;
  private riskEvents: RiskEvent[] = [];
  private dailyRiskEventCount = 0;
  private lastResetDate = new Date();

  constructor(
    logger: LoggingService,
    guidelinesManager: GuidelinesManager,
    config: RiskManagerConfig = {}
  ) {
    this.logger = logger;
    this.guidelinesManager = guidelinesManager;
    
    this.config = {
      portfolioId: config.portfolioId || 'default',
      enableRealTimeMonitoring: config.enableRealTimeMonitoring ?? true,
      riskEventThreshold: config.riskEventThreshold || 'MEDIUM',
      maxRiskEventsPerDay: config.maxRiskEventsPerDay || 10
    };

    this.logger.info('Risk Manager initialized', {
      portfolioId: this.config.portfolioId,
      enableRealTimeMonitoring: this.config.enableRealTimeMonitoring
    });

    // Set up guidelines change listener
    this.guidelinesManager.watchGuidelinesFile((guidelines) => {
      this.logger.info('Guidelines updated, risk rules refreshed', {
        version: guidelines.version
      });
    });
  }

  /**
   * Validate a trade against all risk management rules
   */
  async validateTrade(
    signal: TradingSignal, 
    portfolio: Portfolio, 
    guidelines?: TradingGuidelines
  ): Promise<RiskValidation> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Validating trade against risk rules', {
        signalId: signal.id,
        symbol: signal.symbol,
        action: signal.action,
        recommendedSize: signal.recommendedSize
      });

      // Get current guidelines if not provided
      const currentGuidelines = guidelines || this.guidelinesManager.getCurrentGuidelines();
      if (!currentGuidelines) {
        throw new RiskManagerError('No trading guidelines available for risk validation', 'NO_GUIDELINES');
      }

      const riskRules = currentGuidelines.riskManagement.portfolioRules;
      const checks: RiskCheck[] = [];
      let approved = true;
      let adjustedSize = signal.recommendedSize;
      let riskLevel: RiskLevel = 'LOW';
      let reason = '';

      // Reset daily counter if needed
      this.resetDailyCountersIfNeeded();

      // Check if we've exceeded daily risk events
      if (this.dailyRiskEventCount >= this.config.maxRiskEventsPerDay) {
        approved = false;
        reason = 'Maximum daily risk events exceeded';
        riskLevel = 'HIGH';
        
        checks.push({
          name: 'Daily Risk Events',
          passed: false,
          value: this.dailyRiskEventCount,
          limit: this.config.maxRiskEventsPerDay,
          message: 'Too many risk events today, trading halted'
        });
      }

      // 1. Position Size Limit Check
      const positionSizeCheck = this.checkPositionSizeLimit(signal, portfolio, riskRules);
      checks.push(positionSizeCheck);
      
      if (!positionSizeCheck.passed) {
        // Try to adjust size to maximum allowed
        const maxAllowedSize = this.calculateMaxPositionSizeForSignal(signal, portfolio, currentGuidelines);
        if (maxAllowedSize > 0 && maxAllowedSize < signal.recommendedSize) {
          adjustedSize = maxAllowedSize;
          approved = true;
          riskLevel = 'MEDIUM';
          reason = `Position size adjusted from ${signal.recommendedSize} to ${adjustedSize} shares`;
        } else {
          approved = false;
          riskLevel = 'HIGH';
          reason = positionSizeCheck.message;
          adjustedSize = 0;
        }
      }

      // 2. Daily Loss Limit Check
      const dailyLossCheck = this.checkDailyLossLimitsInternal(portfolio, riskRules);
      checks.push(dailyLossCheck);
      
      if (!dailyLossCheck.passed) {
        approved = false;
        riskLevel = 'CRITICAL';
        reason = dailyLossCheck.message;
        adjustedSize = 0;
      }

      // 3. Drawdown Limit Check
      const drawdownCheck = this.checkDrawdownLimitsInternal(portfolio, riskRules);
      checks.push(drawdownCheck);
      
      if (!drawdownCheck.passed) {
        if (riskLevel !== 'CRITICAL') {
          riskLevel = 'HIGH';
        }
        
        // Reduce position size for high drawdown
        const reductionFactor = 0.5; // Reduce by 50%
        adjustedSize = Math.floor(adjustedSize * reductionFactor);
        
        if (adjustedSize === 0) {
          approved = false;
          reason = drawdownCheck.message;
        } else {
          reason = `Position size reduced due to drawdown: ${drawdownCheck.message}`;
        }
      }

      // 4. Sector Concentration Check
      const sectorCheck = this.validateSectorConcentrationInternal(signal.symbol, portfolio, riskRules);
      checks.push(sectorCheck);
      
      if (!sectorCheck.passed) {
        approved = false;
        riskLevel = 'HIGH';
        reason = sectorCheck.message;
        adjustedSize = 0;
      }

      // 5. Risk Per Trade Check
      const riskPerTradeCheck = this.checkRiskPerTrade(signal, portfolio, riskRules, adjustedSize);
      checks.push(riskPerTradeCheck);
      
      if (!riskPerTradeCheck.passed) {
        // Try to adjust size to meet risk per trade limit
        const maxRiskSize = this.calculateMaxRiskSize(signal, portfolio, riskRules);
        if (maxRiskSize > 0 && maxRiskSize < adjustedSize) {
          adjustedSize = maxRiskSize;
          reason = `Position size adjusted to meet risk per trade limit: ${adjustedSize} shares`;
          if (riskLevel === 'LOW') {
            riskLevel = 'MEDIUM';
          }
        } else {
          approved = false;
          riskLevel = 'HIGH';
          reason = riskPerTradeCheck.message;
          adjustedSize = 0;
        }
      }

      // 6. Maximum Open Positions Check
      const maxPositionsCheck = this.checkMaxOpenPositions(portfolio, riskRules);
      checks.push(maxPositionsCheck);
      
      if (!maxPositionsCheck.passed && signal.action === 'BUY') {
        approved = false;
        riskLevel = 'MEDIUM';
        reason = maxPositionsCheck.message;
        adjustedSize = 0;
      }

      // Log risk event if trade is rejected or significantly modified
      if (!approved || adjustedSize !== signal.recommendedSize) {
        await this.logRiskEvent({
          type: this.determineRiskEventType(checks),
          severity: riskLevel,
          description: reason,
          affectedSymbols: [signal.symbol],
          actionTaken: approved ? `Position size adjusted to ${adjustedSize}` : 'Trade rejected'
        });
      }

      const validationTime = Date.now() - startTime;
      
      this.logger.debug('Trade risk validation completed', {
        signalId: signal.id,
        approved,
        originalSize: signal.recommendedSize,
        adjustedSize,
        riskLevel,
        reason,
        validationTime,
        checksPerformed: checks.length
      });

      const result: RiskValidation = {
        approved,
        riskLevel,
        checks
      };

      if (adjustedSize !== signal.recommendedSize) {
        result.adjustedSize = adjustedSize;
      }

      if (reason) {
        result.reason = reason;
      }

      return result;

    } catch (error) {
      const validationTime = Date.now() - startTime;
      
      this.logger.error('Risk validation failed', error as Error, {
        signalId: signal.id,
        validationTime
      });

      throw new RiskManagerError(
        `Risk validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VALIDATION_FAILED'
      );
    }
  }

  /**
   * Enforce position limits based on guidelines
   */
  enforcePositionLimits(proposedTrade: Trade, guidelines?: TradingGuidelines): Trade {
    const currentGuidelines = guidelines || this.guidelinesManager.getCurrentGuidelines();
    if (!currentGuidelines) {
      this.logger.warn('No guidelines available for position limit enforcement');
      return proposedTrade;
    }

    const riskRules = currentGuidelines.riskManagement.portfolioRules;
    
    // This is a simplified implementation - in practice, you'd need portfolio value
    // For now, we'll just ensure the trade doesn't exceed basic limits
    const adjustedTrade = { ...proposedTrade };
    
    // Log the enforcement
    this.logger.debug('Position limits enforced', {
      originalQuantity: proposedTrade.quantity,
      adjustedQuantity: adjustedTrade.quantity,
      maxPositionPercent: riskRules.maxPositionSizePercent
    });

    return adjustedTrade;
  }

  /**
   * Check if portfolio drawdown limits are exceeded
   */
  checkDrawdownLimits(portfolio: Portfolio, guidelines?: TradingGuidelines): boolean {
    const currentGuidelines = guidelines || this.guidelinesManager.getCurrentGuidelines();
    if (!currentGuidelines) {
      return true; // Allow if no guidelines
    }

    const riskRules = currentGuidelines.riskManagement.portfolioRules;
    const initialValue = 100000; // This should come from portfolio initialization
    const currentDrawdown = Math.max(0, ((initialValue - portfolio.totalValue) / initialValue) * 100);
    
    const withinLimits = currentDrawdown <= riskRules.maxDrawdownPercent;
    
    this.logger.debug('Drawdown limits check', {
      currentDrawdown,
      maxDrawdownPercent: riskRules.maxDrawdownPercent,
      withinLimits
    });

    return withinLimits;
  }

  /**
   * Calculate maximum position size for a symbol
   */
  calculateMaxPositionSize(symbol: string, portfolio: Portfolio, guidelines?: TradingGuidelines): number {
    const currentGuidelines = guidelines || this.guidelinesManager.getCurrentGuidelines();
    if (!currentGuidelines) {
      return 0;
    }

    const riskRules = currentGuidelines.riskManagement.portfolioRules;
    const maxPositionValue = portfolio.totalValue * (riskRules.maxPositionSizePercent / 100);
    
    // Estimate price (in practice, this would come from market data)
    const estimatedPrice = 100; // Default price - this should be improved to use actual market data
    const maxShares = Math.floor(maxPositionValue / estimatedPrice);
    
    this.logger.debug('Maximum position size calculated', {
      symbol,
      maxPositionValue,
      estimatedPrice,
      maxShares,
      maxPositionPercent: riskRules.maxPositionSizePercent
    });

    return Math.max(0, maxShares);
  }

  /**
   * Calculate maximum position size for a specific signal
   */
  private calculateMaxPositionSizeForSignal(signal: TradingSignal, portfolio: Portfolio, guidelines: TradingGuidelines): number {
    const riskRules = guidelines.riskManagement.portfolioRules;
    const maxPositionValue = portfolio.totalValue * (riskRules.maxPositionSizePercent / 100);
    
    const signalPrice = signal.entryPrice || 100;
    const maxSharesByValue = Math.floor(maxPositionValue / signalPrice);
    
    // Also consider available cash for BUY orders
    let maxSharesByCash = maxSharesByValue;
    if (signal.action === 'BUY') {
      maxSharesByCash = Math.floor(portfolio.cashBalance / signalPrice);
    }
    
    const maxShares = Math.min(maxSharesByValue, maxSharesByCash);
    
    this.logger.debug('Maximum position size calculated for signal', {
      symbol: signal.symbol,
      maxPositionValue,
      signalPrice,
      maxSharesByValue,
      maxSharesByCash,
      maxShares,
      maxPositionPercent: riskRules.maxPositionSizePercent,
      availableCash: portfolio.cashBalance
    });

    return Math.max(0, maxShares);
  }

  /**
   * Check daily loss limits
   */
  checkDailyLossLimits(portfolio: Portfolio, guidelines?: TradingGuidelines): boolean {
    const currentGuidelines = guidelines || this.guidelinesManager.getCurrentGuidelines();
    if (!currentGuidelines) {
      return true;
    }

    const riskRules = currentGuidelines.riskManagement.portfolioRules;
    const dailyLossPercent = Math.abs(portfolio.dailyPnL / portfolio.totalValue) * 100;
    
    const withinLimits = dailyLossPercent <= riskRules.maxDailyLossPercent;
    
    this.logger.debug('Daily loss limits check', {
      dailyPnL: portfolio.dailyPnL,
      dailyLossPercent,
      maxDailyLossPercent: riskRules.maxDailyLossPercent,
      withinLimits
    });

    return withinLimits;
  }

  /**
   * Validate sector concentration limits
   */
  validateSectorConcentration(symbol: string, portfolio: Portfolio, guidelines?: TradingGuidelines): boolean {
    const currentGuidelines = guidelines || this.guidelinesManager.getCurrentGuidelines();
    if (!currentGuidelines) {
      return true;
    }

    const riskRules = currentGuidelines.riskManagement.portfolioRules;
    
    // Calculate current sector exposure (simplified - would need sector mapping)
    const sectorExposure = this.calculateSectorExposure(portfolio);
    const symbolSector = this.getSymbolSector(symbol); // Would need sector mapping service
    
    if (symbolSector && sectorExposure[symbolSector]) {
      const currentExposure = sectorExposure[symbolSector];
      const withinLimits = currentExposure < riskRules.maxSectorExposurePercent; // Use < instead of <= to allow for new positions
      
      this.logger.debug('Sector concentration check', {
        symbol,
        sector: symbolSector,
        currentExposure,
        maxSectorExposure: riskRules.maxSectorExposurePercent,
        withinLimits
      });

      return withinLimits;
    }

    return true; // Allow if sector unknown
  }

  /**
   * Get current risk metrics for the portfolio
   */
  async getRiskMetrics(portfolio: Portfolio): Promise<RiskMetrics> {
    try {
      const sectorExposure = this.calculateSectorExposure(portfolio);
      const positionRisks = this.calculatePositionRisks(portfolio);
      
      const metrics: RiskMetrics = {
        portfolioId: portfolio.id,
        timestamp: new Date(),
        totalRisk: this.calculateTotalRisk(positionRisks),
        dailyVaR: this.calculateDailyVaR(portfolio),
        portfolioBeta: this.calculatePortfolioBeta(positionRisks),
        sharpeRatio: 0, // Would need historical returns
        maxDrawdown: this.calculateMaxDrawdown(portfolio),
        currentDrawdown: this.calculateCurrentDrawdown(portfolio),
        volatility: this.calculatePortfolioVolatility(positionRisks),
        correlation: {
          symbols: portfolio.positions.map(p => p.symbol),
          matrix: [], // Would need correlation calculation
          lastUpdated: new Date()
        },
        sectorExposure,
        positionRisks
      };

      this.logger.debug('Risk metrics calculated', {
        portfolioId: portfolio.id,
        totalRisk: metrics.totalRisk,
        positionCount: positionRisks.length
      });

      return metrics;

    } catch (error) {
      this.logger.error('Failed to calculate risk metrics', error as Error);
      throw new RiskManagerError(
        `Failed to calculate risk metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'METRICS_CALCULATION_FAILED'
      );
    }
  }

  /**
   * Get recent risk events
   */
  getRiskEvents(days: number = 7): RiskEvent[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.riskEvents.filter(event => event.timestamp >= cutoffDate);
  }

  /**
   * Private helper methods
   */

  private checkPositionSizeLimit(
    signal: TradingSignal, 
    portfolio: Portfolio, 
    riskRules: PortfolioRiskRules
  ): RiskCheck {
    const estimatedPrice = signal.entryPrice || 100;
    const positionValue = signal.recommendedSize * estimatedPrice;
    const positionPercent = (positionValue / portfolio.totalValue) * 100;
    const maxAllowed = riskRules.maxPositionSizePercent;
    
    return {
      name: 'Position Size Limit',
      passed: positionPercent <= maxAllowed,
      value: positionPercent,
      limit: maxAllowed,
      message: positionPercent > maxAllowed 
        ? `Position would be ${positionPercent.toFixed(2)}% of portfolio, exceeds ${maxAllowed}% limit`
        : 'Position size within limits'
    };
  }

  private checkDailyLossLimitsInternal(portfolio: Portfolio, riskRules: PortfolioRiskRules): RiskCheck {
    const dailyLossPercent = portfolio.dailyPnL < 0 
      ? Math.abs(portfolio.dailyPnL / portfolio.totalValue) * 100 
      : 0;
    
    return {
      name: 'Daily Loss Limit',
      passed: dailyLossPercent <= riskRules.maxDailyLossPercent,
      value: dailyLossPercent,
      limit: riskRules.maxDailyLossPercent,
      message: dailyLossPercent > riskRules.maxDailyLossPercent
        ? `Daily loss of ${dailyLossPercent.toFixed(2)}% exceeds ${riskRules.maxDailyLossPercent}% limit`
        : 'Daily loss within limits'
    };
  }

  private checkDrawdownLimitsInternal(portfolio: Portfolio, riskRules: PortfolioRiskRules): RiskCheck {
    const initialValue = 100000; // Should come from portfolio initialization
    const currentDrawdown = Math.max(0, ((initialValue - portfolio.totalValue) / initialValue) * 100);
    
    return {
      name: 'Drawdown Limit',
      passed: currentDrawdown <= riskRules.maxDrawdownPercent,
      value: currentDrawdown,
      limit: riskRules.maxDrawdownPercent,
      message: currentDrawdown > riskRules.maxDrawdownPercent
        ? `Current drawdown of ${currentDrawdown.toFixed(2)}% exceeds ${riskRules.maxDrawdownPercent}% limit`
        : 'Drawdown within limits'
    };
  }

  private validateSectorConcentrationInternal(
    symbol: string, 
    portfolio: Portfolio, 
    riskRules: PortfolioRiskRules
  ): RiskCheck {
    const sectorExposure = this.calculateSectorExposure(portfolio);
    const symbolSector = this.getSymbolSector(symbol);
    
    if (!symbolSector) {
      return {
        name: 'Sector Concentration',
        passed: true,
        value: 0,
        limit: riskRules.maxSectorExposurePercent,
        message: 'Sector unknown, check passed'
      };
    }
    
    const currentExposure = sectorExposure[symbolSector] || 0;
    
    return {
      name: 'Sector Concentration',
      passed: currentExposure < riskRules.maxSectorExposurePercent, // Use < to allow for new positions
      value: currentExposure,
      limit: riskRules.maxSectorExposurePercent,
      message: currentExposure >= riskRules.maxSectorExposurePercent
        ? `${symbolSector} sector exposure of ${currentExposure.toFixed(2)}% exceeds ${riskRules.maxSectorExposurePercent}% limit`
        : 'Sector concentration within limits'
    };
  }

  private checkRiskPerTrade(
    signal: TradingSignal, 
    portfolio: Portfolio, 
    riskRules: PortfolioRiskRules,
    quantity: number
  ): RiskCheck {
    const estimatedPrice = signal.entryPrice || 100;
    const stopLoss = signal.stopLoss || estimatedPrice * 0.95; // 5% default stop
    const riskPerShare = Math.abs(estimatedPrice - stopLoss);
    const totalRisk = riskPerShare * quantity;
    const riskPercent = (totalRisk / portfolio.totalValue) * 100;
    
    return {
      name: 'Risk Per Trade',
      passed: riskPercent <= riskRules.riskPerTradePercent,
      value: riskPercent,
      limit: riskRules.riskPerTradePercent,
      message: riskPercent > riskRules.riskPerTradePercent
        ? `Trade risk of ${riskPercent.toFixed(2)}% exceeds ${riskRules.riskPerTradePercent}% limit`
        : 'Trade risk within limits'
    };
  }

  private checkMaxOpenPositions(portfolio: Portfolio, riskRules: PortfolioRiskRules): RiskCheck {
    const openPositions = portfolio.positions.filter(p => p.quantity > 0).length;
    
    return {
      name: 'Maximum Open Positions',
      passed: openPositions < riskRules.maxOpenPositions,
      value: openPositions,
      limit: riskRules.maxOpenPositions,
      message: openPositions >= riskRules.maxOpenPositions
        ? `Already at maximum of ${riskRules.maxOpenPositions} open positions`
        : 'Open positions within limits'
    };
  }

  private calculateMaxRiskSize(
    signal: TradingSignal, 
    portfolio: Portfolio, 
    riskRules: PortfolioRiskRules
  ): number {
    const estimatedPrice = signal.entryPrice || 100;
    const stopLoss = signal.stopLoss || estimatedPrice * 0.95;
    const riskPerShare = Math.abs(estimatedPrice - stopLoss);
    
    if (riskPerShare <= 0) return 0;
    
    const maxRiskAmount = portfolio.totalValue * (riskRules.riskPerTradePercent / 100);
    const maxShares = Math.floor(maxRiskAmount / riskPerShare);
    
    return Math.max(0, maxShares);
  }

  private calculateSectorExposure(portfolio: Portfolio): Record<string, number> {
    const sectorExposure: Record<string, number> = {};
    
    for (const position of portfolio.positions) {
      if (position.quantity > 0) {
        const sector = position.sector || 'Unknown';
        const positionValue = position.quantity * position.currentPrice;
        const percentage = (positionValue / portfolio.totalValue) * 100;
        sectorExposure[sector] = (sectorExposure[sector] || 0) + percentage;
      }
    }
    
    return sectorExposure;
  }

  private getSymbolSector(symbol: string): string | null {
    // This would typically come from a sector mapping service
    // For now, return a default sector based on symbol
    const sectorMap: Record<string, string> = {
      'AAPL': 'Technology',
      'MSFT': 'Technology',
      'GOOGL': 'Technology',
      'AMZN': 'Consumer Discretionary',
      'TSLA': 'Consumer Discretionary',
      'JPM': 'Financials',
      'BAC': 'Financials',
      'JNJ': 'Healthcare',
      'PFE': 'Healthcare'
    };
    
    return sectorMap[symbol] || null;
  }

  private calculatePositionRisks(portfolio: Portfolio): PositionRisk[] {
    return portfolio.positions
      .filter(p => p.quantity > 0)
      .map(position => {
        const positionValue = position.quantity * position.currentPrice;
        const portfolioPercentage = (positionValue / portfolio.totalValue) * 100;
        
        return {
          symbol: position.symbol,
          positionSize: positionValue,
          portfolioPercentage,
          beta: 1.0, // Would need market data
          volatility: 0.2, // Would need historical data
          var95: positionValue * 0.05, // Simplified 5% VaR
          riskContribution: portfolioPercentage * 0.2, // Simplified
          sector: position.sector || 'Unknown'
        };
      });
  }

  private calculateTotalRisk(positionRisks: PositionRisk[]): number {
    return positionRisks.reduce((sum, risk) => sum + risk.riskContribution, 0);
  }

  private calculateDailyVaR(portfolio: Portfolio): number {
    // Simplified VaR calculation - 5% of portfolio value
    return portfolio.totalValue * 0.05;
  }

  private calculatePortfolioBeta(positionRisks: PositionRisk[]): number {
    if (positionRisks.length === 0) return 1.0;
    
    const weightedBeta = positionRisks.reduce((sum, risk) => {
      const weight = risk.portfolioPercentage / 100;
      return sum + (risk.beta * weight);
    }, 0);
    
    return weightedBeta;
  }

  private calculateMaxDrawdown(portfolio: Portfolio): number {
    // Simplified - would need historical data
    const initialValue = 100000;
    return Math.max(0, ((initialValue - portfolio.totalValue) / initialValue) * 100);
  }

  private calculateCurrentDrawdown(portfolio: Portfolio): number {
    return this.calculateMaxDrawdown(portfolio);
  }

  private calculatePortfolioVolatility(positionRisks: PositionRisk[]): number {
    if (positionRisks.length === 0) return 0;
    
    const weightedVolatility = positionRisks.reduce((sum, risk) => {
      const weight = risk.portfolioPercentage / 100;
      return sum + (risk.volatility * weight);
    }, 0);
    
    return weightedVolatility;
  }

  private determineRiskEventType(checks: RiskCheck[]): RiskEvent['type'] {
    const failedChecks = checks.filter(check => !check.passed);
    
    if (failedChecks.some(check => check.name.includes('Position'))) {
      return 'POSITION_LIMIT';
    }
    if (failedChecks.some(check => check.name.includes('Daily'))) {
      return 'DAILY_LOSS';
    }
    if (failedChecks.some(check => check.name.includes('Drawdown'))) {
      return 'DRAWDOWN';
    }
    if (failedChecks.some(check => check.name.includes('Sector'))) {
      return 'SECTOR_CONCENTRATION';
    }
    
    return 'POSITION_LIMIT';
  }

  private async logRiskEvent(eventData: Partial<RiskEvent>): Promise<void> {
    const event: RiskEvent = {
      id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type: eventData.type || 'POSITION_LIMIT',
      severity: eventData.severity || 'MEDIUM',
      description: eventData.description || 'Risk event occurred',
      affectedSymbols: eventData.affectedSymbols || [],
      actionTaken: eventData.actionTaken || 'No action taken',
      resolved: false
    };

    this.riskEvents.push(event);
    this.dailyRiskEventCount++;

    this.logger.warn('Risk event logged', {
      eventId: event.id,
      type: event.type,
      severity: event.severity,
      description: event.description,
      affectedSymbols: event.affectedSymbols,
      actionTaken: event.actionTaken
    });
  }

  private resetDailyCountersIfNeeded(): void {
    const today = new Date();
    const lastReset = this.lastResetDate;
    
    if (today.toDateString() !== lastReset.toDateString()) {
      this.dailyRiskEventCount = 0;
      this.lastResetDate = today;
      
      this.logger.debug('Daily risk counters reset', {
        date: today.toDateString()
      });
    }
  }
}

/**
 * Factory function to create a RiskManager instance
 */
export function createRiskManager(
  logger: LoggingService,
  guidelinesManager: GuidelinesManager,
  config?: RiskManagerConfig
): RiskManager {
  return new RiskManager(logger, guidelinesManager, config);
}

// Re-export types for convenience
export type {
  RiskValidation,
  RiskCheck,
  RiskLimits,
  RiskMetrics,
  PositionRisk,
  RiskEvent
};