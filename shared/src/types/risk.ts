/**
 * Risk management types and interfaces
 */

import { RiskLevel } from './trading';

export interface RiskValidation {
  approved: boolean;
  adjustedSize?: number;
  reason?: string;
  riskLevel: RiskLevel;
  checks: RiskCheck[];
}

export interface RiskCheck {
  name: string;
  passed: boolean;
  value: number;
  limit: number;
  message: string;
}

export interface RiskLimits {
  maxPositionPercentage: number; // 10%
  maxDailyLossPercentage: number; // 3%
  maxDrawdownPercentage: number; // 8%
  maxSectorConcentration: number; // 30%
  maxOpenPositions: number; // 5-8
  maxRiskPerTrade: number; // 1-2%
  maxCorrelatedPositions: number; // 3
}

export interface RiskMetrics {
  portfolioId: string;
  timestamp: Date;
  totalRisk: number;
  dailyVaR: number; // Value at Risk
  portfolioBeta: number;
  sharpeRatio: number;
  maxDrawdown: number;
  currentDrawdown: number;
  volatility: number;
  correlation: CorrelationMatrix;
  sectorExposure: Record<string, number>;
  positionRisks: PositionRisk[];
}

export interface PositionRisk {
  symbol: string;
  positionSize: number;
  portfolioPercentage: number;
  beta: number;
  volatility: number;
  var95: number; // 95% Value at Risk
  riskContribution: number;
  sector: string;
}

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][];
  lastUpdated: Date;
}

export interface DrawdownPeriod {
  startDate: Date;
  endDate?: Date;
  peakValue: number;
  troughValue: number;
  drawdownPercentage: number;
  recoveryDate?: Date;
  duration: number; // days
  isActive: boolean;
}

export interface RiskEvent {
  id: string;
  timestamp: Date;
  type: 'POSITION_LIMIT' | 'DAILY_LOSS' | 'DRAWDOWN' | 'SECTOR_CONCENTRATION' | 'CORRELATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  affectedSymbols: string[];
  actionTaken: string;
  resolved: boolean;
  resolvedAt?: Date;
}