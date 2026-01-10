/**
 * Core trading types and interfaces
 */

// Trading Actions
export type TradeAction = 'BUY' | 'SELL';
export type TradeStatus = 'PENDING' | 'EXECUTED' | 'FAILED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

// Core Trading Models
export interface Trade {
  id: string;
  symbol: string;
  action: TradeAction;
  quantity: number;
  price: number;
  timestamp: Date;
  reasoning: string;
  signalId: string;
  fees: number;
  status: TradeStatus;
}

export interface TradingSignal {
  id: string;
  symbol: string;
  action: TradeAction;
  confidence: number;
  reasoning: string;
  technicalIndicators: TechnicalData;
  recommendedSize: number;
  stopLoss: number;
  profitTargets: number[];
  timestamp: Date;
}

export interface TechnicalData {
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  movingAverages: {
    sma20: number;
    sma50: number;
    ema20: number;
    ema50: number;
  };
  atr: number;
  volume: number;
  vwap: number;
  support: number[];
  resistance: number[];
}

export interface ExitCriteria {
  id: string;
  type: 'STOP_LOSS' | 'PROFIT_TARGET' | 'TIME_BASED' | 'TECHNICAL';
  value: number;
  isActive: boolean;
  priority: number;
  createdAt: Date;
}

export interface TradeResult {
  success: boolean;
  trade?: Trade;
  error?: string;
  executionTime: number;
}

export interface TradingCycleResult {
  buySignalsProcessed: number;
  sellSignalsProcessed: number;
  exitCriteriaChecked: number;
  tradesExecuted: Trade[];
  errors: string[];
  executionTime: number;
  cycleId: string;
  timestamp: Date;
}

// Stock Analysis Types
export interface StockAnalysis {
  symbol: string;
  score: number;
  meetsCriteria: boolean;
  analysis: {
    liquidity: LiquidityAnalysis;
    volatility: VolatilityAnalysis;
    technical: TechnicalAnalysis;
    fundamental?: FundamentalAnalysis;
  };
  timestamp: Date;
}

export interface LiquidityAnalysis {
  averageDailyVolume: number;
  marketCap: number;
  bidAskSpread: number;
  meetsRequirements: boolean;
}

export interface VolatilityAnalysis {
  atr: number;
  historicalVolatility: number;
  beta: number;
  meetsRequirements: boolean;
}

export interface TechnicalAnalysis {
  trend: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
  supportLevels: number[];
  resistanceLevels: number[];
  volumeConfirmation: boolean;
  priceExtension: boolean;
  meetsRequirements: boolean;
}

export interface FundamentalAnalysis {
  earningsDate?: Date;
  hasUpcomingNews: boolean;
  sectorStrength: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  financialHealth: 'STRONG' | 'MODERATE' | 'WEAK';
  meetsRequirements: boolean;
}