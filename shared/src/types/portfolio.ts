/**
 * Portfolio and position management types
 */

import { ExitCriteria } from './trading';

export interface Position {
  id: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  entryDate: Date;
  stopLoss: number;
  profitTargets: number[];
  unrealizedPnL: number;
  realizedPnL: number;
  exitCriteria: ExitCriteria[];
  sector?: string;
  lastUpdated: Date;
}

export interface Portfolio {
  id: string;
  totalValue: number;
  cashBalance: number;
  positions: Position[];
  dailyPnL: number;
  totalPnL: number;
  lastUpdated: Date;
  createdAt: Date;
}

export interface PortfolioMetrics {
  totalValue: number;
  totalPnL: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  positionCount: number;
  cashPercentage: number;
  largestPosition: {
    symbol: string;
    percentage: number;
  };
  sectorExposure: Record<string, number>;
  lastUpdated: Date;
}

export interface PerformanceStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  currentDrawdown: number;
  sharpeRatio: number;
  sortino: number;
  calmarRatio: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  averageHoldingPeriod: number;
  totalFees: number;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  lastUpdated: Date;
}

export interface PortfolioSnapshot {
  id: string;
  portfolioId: string;
  timestamp: Date;
  totalValue: number;
  cashBalance: number;
  positionCount: number;
  dailyPnL: number;
  totalPnL: number;
  positions: PositionSnapshot[];
}

export interface PositionSnapshot {
  symbol: string;
  quantity: number;
  price: number;
  value: number;
  unrealizedPnL: number;
  percentage: number;
}