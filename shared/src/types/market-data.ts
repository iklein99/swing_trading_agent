/**
 * Market data and external API types
 */

export type TimePeriod = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y';
export type Interval = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M';

export interface Quote {
  symbol: string;
  price: number;
  volume: number;
  timestamp: Date;
  bid: number;
  ask: number;
  dayHigh: number;
  dayLow: number;
  dayOpen: number;
  previousClose: number;
  change: number;
  changePercent: number;
  marketCap?: number;
  averageVolume?: number;
}

export interface HistoricalData {
  symbol: string;
  data: OHLCV[];
  period: TimePeriod;
  interval: Interval;
  lastUpdated: Date;
}

export interface OHLCV {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose?: number;
}

export interface TechnicalIndicators {
  symbol: string;
  timestamp: Date;
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  movingAverages: {
    sma20: number;
    sma50: number;
    sma200: number;
    ema20: number;
    ema50: number;
    ema200: number;
  };
  atr: number;
  atr14: number;
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
  };
  stochastic: {
    k: number;
    d: number;
  };
  williams: number;
  vwap: number;
  obv: number;
}

export interface MarketData {
  quote: Quote;
  historical: HistoricalData;
  technical: TechnicalIndicators;
  lastUpdated: Date;
}

export interface ScreeningCriteria {
  minPrice?: number;
  maxPrice?: number;
  minVolume?: number;
  minMarketCap?: number;
  maxBidAskSpread?: number;
  minATR?: number;
  maxATR?: number;
  minBeta?: number;
  maxBeta?: number;
  sectors?: string[];
  excludeEarnings?: boolean;
  earningsBuffer?: number; // days
}

export interface MarketDataProvider {
  name: string;
  baseUrl: string;
  apiKey?: string;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  endpoints: {
    quote: string;
    historical: string;
    technical: string;
    screening: string;
  };
}

export interface DataFeed {
  provider: MarketDataProvider;
  isConnected: boolean;
  lastUpdate: Date;
  errorCount: number;
  requestCount: number;
}