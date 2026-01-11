/**
 * Trading Guidelines types and interfaces
 * Defines the structure for trading guidelines loaded from configuration files
 */

export interface TradingGuidelines {
  stockSelection: {
    liquidityRequirements: LiquidityRequirements;
    volatilityMetrics: VolatilityMetrics;
    priceRange: PriceRange;
    technicalSetupRequirements: TechnicalSetupRequirements;
    fundamentalFilters: FundamentalFilters;
  };
  entrySignals: {
    longEntries: EntrySignal[];
    shortEntries: EntrySignal[];
    timingRules: TimingRules;
    positionSizing: PositionSizingRules;
  };
  exitCriteria: {
    profitTargets: ProfitTargetMethods[];
    stopLosses: StopLossRules;
    trailingStops: TrailingStopRules;
    timeBasedExits: TimeBasedExitRules;
  };
  riskManagement: {
    portfolioRules: PortfolioRiskRules;
    tradeManagement: TradeManagementRules;
    marketEnvironment: MarketEnvironmentRules;
  };
  lastUpdated: Date;
  version: string;
  filePath: string;
}

export interface LiquidityRequirements {
  minimumAverageDailyVolume: number;
  minimumMarketCap: number;
  maxBidAskSpreadPercent: number;
}

export interface VolatilityMetrics {
  atrRange: { min: number; max: number };
  historicalVolatilityRange: { min: number; max: number };
  betaRange: { min: number; max: number };
}

export interface PriceRange {
  minPrice: number;
  maxPrice: number;
}

export interface TechnicalSetupRequirements {
  requireClearTrend: boolean;
  requireSupportResistance: boolean;
  requireVolumeConfirmation: boolean;
  maxATRExtension: number;
}

export interface FundamentalFilters {
  avoidEarningsWithinDays: number;
  checkMajorNews: boolean;
  requirePositiveSectorStrength: boolean;
  avoidFinancialDistress: boolean;
}

export interface EntrySignal {
  name: string;
  type: 'BREAKOUT' | 'PULLBACK' | 'MOVING_AVERAGE_BOUNCE' | 'MOMENTUM';
  conditions: string[];
  volumeRequirement: number;
  confirmationRequired: boolean;
  riskRewardRatio: number;
}

export interface TimingRules {
  avoidFirstMinutes: number;
  avoidLastMinutes: number;
  optimalWindowStart: string;
  optimalWindowEnd: string;
}

export interface PositionSizingRules {
  riskPerTradePercent: number;
  maxPositionPercent: number;
  maxCorrelatedPositions: number;
  maxSectorPositions: number;
}

export interface ProfitTargetMethods {
  name: string;
  method: 'ATR_BASED' | 'SUPPORT_RESISTANCE' | 'PERCENTAGE' | 'RISK_REWARD';
  targets: ProfitTarget[];
  partialExitStrategy: PartialExitStrategy;
}

export interface ProfitTarget {
  level: number;
  calculation: string;
  exitPercentage: number;
}

export interface PartialExitStrategy {
  scaleOutApproach: boolean;
  target1ExitPercent: number;
  target2ExitPercent: number;
  trailRemainder: boolean;
}

export interface StopLossRules {
  methods: StopLossMethod[];
  maxRiskPercent: number;
  breakEvenRule: BreakEvenRule;
  timeBasedStop: TimeBasedStop;
}

export interface StopLossMethod {
  name: string;
  type: 'BELOW_SUPPORT' | 'ATR_BASED' | 'PERCENTAGE' | 'SWING_LOW';
  calculation: string;
  bufferPercent: number;
}

export interface BreakEvenRule {
  activateAtRiskRewardRatio: number;
  moveToBreakEven: boolean;
}

export interface TimeBasedStop {
  maxHoldingDays: number;
  evaluateAtTimeLimit: boolean;
}

export interface TrailingStopRules {
  activationTrigger: string;
  trailingAmount: string;
  adjustmentFrequency: 'DAILY' | 'INTRADAY';
  lockInProfitsAt: number;
}

export interface TimeBasedExitRules {
  maxHoldingPeriod: number;
  evaluationCriteria: string[];
}

export interface PortfolioRiskRules {
  maxDailyLossPercent: number;
  maxWeeklyLossPercent: number;
  maxDrawdownPercent: number;
  maxOpenPositions: number;
  maxSectorExposurePercent: number;
  maxPositionSizePercent: number;
  riskPerTradePercent: number;
}

export interface TradeManagementRules {
  noRevengeTrading: boolean;
  noAveragingDown: boolean;
  scaleInCarefully: boolean;
  reviewEachTrade: boolean;
}

export interface MarketEnvironmentRules {
  trendingMarketStrategy: string;
  rangeBoundMarketStrategy: string;
  highVolatilityAdjustments: string;
  lowVolatilityAdjustments: string;
}

export interface GuidelinesValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingRequiredSections: string[];
}

export interface GuidelinesManagerConfig {
  guidelinesFilePath: string;
  watchForChanges: boolean;
  backupOnLoad: boolean;
  validateOnLoad: boolean;
}