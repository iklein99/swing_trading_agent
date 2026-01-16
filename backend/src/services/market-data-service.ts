/**
 * Market Data Service - Basic implementation with mock data provider
 * Provides market data functionality for development and testing
 */

import {
  MarketDataServiceInterface,
  MarketStatus,
  Quote,
  HistoricalData,
  TechnicalIndicators,
  MarketData,
  ScreeningCriteria,
  TimePeriod,
  OHLCV,
  Interval
} from '@shared/types';

export class MarketDataServiceError extends Error {
  constructor(message: string, public code: string, public symbol?: string) {
    super(message);
    this.name = 'MarketDataServiceError';
  }
}

export class MockMarketDataProvider {
  private readonly symbols = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'AMD', 'CRM',
    'ADBE', 'PYPL', 'INTC', 'CSCO', 'ORCL', 'IBM', 'QCOM', 'TXN', 'AVGO', 'MU'
  ];

  private generateRandomPrice(basePrice: number = 100, volatility: number = 0.02): number {
    const change = (Math.random() - 0.5) * 2 * volatility;
    return Math.max(basePrice * (1 + change), 0.01);
  }

  private generateRandomVolume(baseVolume: number = 1000000): number {
    const multiplier = 0.5 + Math.random() * 1.5; // 0.5x to 2x base volume
    return Math.floor(baseVolume * multiplier);
  }

  generateQuote(symbol: string): Quote {
    if (!this.isValidSymbol(symbol)) {
      throw new MarketDataServiceError(`Invalid symbol: ${symbol}`, 'INVALID_SYMBOL', symbol);
    }

    const basePrice = this.getBasePriceForSymbol(symbol);
    const price = this.generateRandomPrice(basePrice);
    const spread = price * 0.001; // 0.1% spread
    const bid = price - spread / 2;
    const ask = price + spread / 2;
    const dayOpen = this.generateRandomPrice(basePrice, 0.01);
    const previousClose = this.generateRandomPrice(basePrice, 0.005);
    const change = price - previousClose;
    const changePercent = (change / previousClose) * 100;

    return {
      symbol,
      price,
      volume: this.generateRandomVolume(),
      timestamp: new Date(),
      bid,
      ask,
      dayHigh: Math.max(price, dayOpen) * (1 + Math.random() * 0.02),
      dayLow: Math.min(price, dayOpen) * (1 - Math.random() * 0.02),
      dayOpen,
      previousClose,
      change,
      changePercent,
      marketCap: price * 1000000000, // Mock market cap
      averageVolume: this.generateRandomVolume()
    };
  }

  generateHistoricalData(symbol: string, period: TimePeriod): HistoricalData {
    if (!this.isValidSymbol(symbol)) {
      throw new MarketDataServiceError(`Invalid symbol: ${symbol}`, 'INVALID_SYMBOL', symbol);
    }

    const days = this.getDaysFromPeriod(period);
    const basePrice = this.getBasePriceForSymbol(symbol);
    const data: OHLCV[] = [];
    
    let currentPrice = basePrice;
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const open = currentPrice;
      const volatility = 0.02;
      const high = open * (1 + Math.random() * volatility);
      const low = open * (1 - Math.random() * volatility);
      const close = this.generateRandomPrice(open, volatility * 0.8);
      const volume = this.generateRandomVolume();

      data.push({
        timestamp: date,
        open,
        high: Math.max(open, high, close),
        low: Math.min(open, low, close),
        close,
        volume,
        adjustedClose: close
      });

      currentPrice = close;
    }

    return {
      symbol,
      data,
      period,
      interval: '1d' as Interval,
      lastUpdated: new Date()
    };
  }

  generateTechnicalIndicators(symbol: string): TechnicalIndicators {
    if (!this.isValidSymbol(symbol)) {
      throw new MarketDataServiceError(`Invalid symbol: ${symbol}`, 'INVALID_SYMBOL', symbol);
    }

    const basePrice = this.getBasePriceForSymbol(symbol);
    
    return {
      symbol,
      timestamp: new Date(),
      rsi: 30 + Math.random() * 40, // RSI between 30-70
      macd: {
        value: (Math.random() - 0.5) * 2,
        signal: (Math.random() - 0.5) * 1.5,
        histogram: (Math.random() - 0.5) * 0.5
      },
      movingAverages: {
        sma20: basePrice * (0.98 + Math.random() * 0.04),
        sma50: basePrice * (0.95 + Math.random() * 0.1),
        sma200: basePrice * (0.9 + Math.random() * 0.2),
        ema20: basePrice * (0.98 + Math.random() * 0.04),
        ema50: basePrice * (0.95 + Math.random() * 0.1),
        ema200: basePrice * (0.9 + Math.random() * 0.2)
      },
      atr: basePrice * (0.01 + Math.random() * 0.02),
      atr14: basePrice * (0.015 + Math.random() * 0.025),
      bollinger: {
        upper: basePrice * (1.02 + Math.random() * 0.02),
        middle: basePrice,
        lower: basePrice * (0.98 - Math.random() * 0.02)
      },
      stochastic: {
        k: Math.random() * 100,
        d: Math.random() * 100
      },
      williams: -100 + Math.random() * 100,
      vwap: basePrice * (0.99 + Math.random() * 0.02),
      obv: Math.floor(Math.random() * 10000000)
    };
  }

  screenStocks(criteria: ScreeningCriteria): string[] {
    // Simple mock screening - return random subset of symbols
    const filtered = this.symbols.filter(symbol => {
      const quote = this.generateQuote(symbol);
      
      if (criteria.minPrice && quote.price < criteria.minPrice) return false;
      if (criteria.maxPrice && quote.price > criteria.maxPrice) return false;
      if (criteria.minVolume && quote.volume < criteria.minVolume) return false;
      if (criteria.minMarketCap && quote.marketCap && quote.marketCap < criteria.minMarketCap) return false;
      
      return true;
    });

    // Return random subset (3-8 symbols)
    const count = Math.min(3 + Math.floor(Math.random() * 6), filtered.length);
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  private isValidSymbol(symbol: string): boolean {
    return this.symbols.includes(symbol.toUpperCase());
  }

  private getBasePriceForSymbol(symbol: string): number {
    // Generate consistent base prices for symbols
    const prices: Record<string, number> = {
      'AAPL': 175, 'MSFT': 380, 'GOOGL': 140, 'AMZN': 155, 'TSLA': 250,
      'META': 320, 'NVDA': 480, 'NFLX': 450, 'AMD': 110, 'CRM': 220,
      'ADBE': 580, 'PYPL': 65, 'INTC': 45, 'CSCO': 50, 'ORCL': 115,
      'IBM': 140, 'QCOM': 160, 'TXN': 180, 'AVGO': 920, 'MU': 85
    };
    return prices[symbol.toUpperCase()] || 100;
  }

  private getDaysFromPeriod(period: TimePeriod): number {
    const periodMap: Record<TimePeriod, number> = {
      '1D': 1, '5D': 5, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '2Y': 730, '5Y': 1825
    };
    return periodMap[period] || 30;
  }
}

export class MarketDataService implements MarketDataServiceInterface {
  private mockProvider: MockMarketDataProvider;
  private isConnected: boolean = true;
  private errorCount: number = 0;
  private readonly maxErrors: number = 5;

  constructor() {
    this.mockProvider = new MockMarketDataProvider();
  }

  async getRealtimeQuote(symbol: string): Promise<Quote> {
    this.validateConnection();
    
    try {
      const quote = this.mockProvider.generateQuote(symbol);
      this.resetErrorCount();
      return quote;
    } catch (error) {
      this.handleError(error, 'getRealtimeQuote', symbol);
      throw error;
    }
  }

  async getHistoricalData(symbol: string, period: TimePeriod): Promise<HistoricalData> {
    this.validateConnection();
    
    try {
      const data = this.mockProvider.generateHistoricalData(symbol, period);
      this.resetErrorCount();
      return data;
    } catch (error) {
      this.handleError(error, 'getHistoricalData', symbol);
      throw error;
    }
  }

  async getTechnicalIndicators(symbol: string): Promise<TechnicalIndicators> {
    this.validateConnection();
    
    try {
      const indicators = this.mockProvider.generateTechnicalIndicators(symbol);
      this.resetErrorCount();
      return indicators;
    } catch (error) {
      this.handleError(error, 'getTechnicalIndicators', symbol);
      throw error;
    }
  }

  async getMarketData(symbol: string): Promise<MarketData> {
    this.validateConnection();
    
    try {
      const [quote, historical, technical] = await Promise.all([
        this.getRealtimeQuote(symbol),
        this.getHistoricalData(symbol, '1M'),
        this.getTechnicalIndicators(symbol)
      ]);

      return {
        quote,
        historical,
        technical,
        lastUpdated: new Date()
      };
    } catch (error) {
      this.handleError(error, 'getMarketData', symbol);
      throw error;
    }
  }

  async screenStocks(criteria: ScreeningCriteria): Promise<string[]> {
    this.validateConnection();
    
    try {
      const symbols = this.mockProvider.screenStocks(criteria);
      this.resetErrorCount();
      return symbols;
    } catch (error) {
      this.handleError(error, 'screenStocks');
      throw error;
    }
  }

  isMarketOpen(): boolean {
    // Mock market hours: 9:30 AM - 4:00 PM ET on weekdays
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    if (day === 0 || day === 6) {
      return false; // Weekend
    }

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;
    
    const marketOpen = 9 * 60 + 30; // 9:30 AM
    const marketClose = 16 * 60; // 4:00 PM
    
    return currentTime >= marketOpen && currentTime < marketClose;
  }

  async getMarketStatus(): Promise<MarketStatus> {
    const isOpen = this.isMarketOpen();
    const now = new Date();
    
    let nextOpen: Date;
    let nextClose: Date;
    let session: MarketStatus['session'];

    if (isOpen) {
      session = 'REGULAR';
      nextClose = new Date(now);
      nextClose.setHours(16, 0, 0, 0);
      nextOpen = new Date(now);
      nextOpen.setDate(nextOpen.getDate() + 1);
      nextOpen.setHours(9, 30, 0, 0);
    } else {
      session = 'CLOSED';
      nextOpen = new Date(now);
      
      // Calculate next market open
      if (now.getDay() === 6) { // Saturday
        nextOpen.setDate(nextOpen.getDate() + 2); // Monday
      } else if (now.getDay() === 0) { // Sunday
        nextOpen.setDate(nextOpen.getDate() + 1); // Monday
      } else if (now.getHours() >= 16) { // After market close
        nextOpen.setDate(nextOpen.getDate() + 1); // Next day
      }
      
      nextOpen.setHours(9, 30, 0, 0);
      
      nextClose = new Date(nextOpen);
      nextClose.setHours(16, 0, 0, 0);
    }

    return {
      isOpen,
      nextOpen,
      nextClose,
      timezone: 'America/New_York',
      session
    };
  }

  subscribeToQuotes(symbols: string[], _callback: (quote: Quote) => void): void {
    // Mock subscription - not implemented for basic version
    console.log(`Mock subscription to quotes for symbols: ${symbols.join(', ')}`);
  }

  unsubscribeFromQuotes(symbols: string[]): void {
    // Mock unsubscription - not implemented for basic version
    console.log(`Mock unsubscription from quotes for symbols: ${symbols.join(', ')}`);
  }

  // Connection and error handling methods
  private validateConnection(): void {
    if (!this.isConnected) {
      throw new MarketDataServiceError(
        'Market data service is not connected',
        'CONNECTION_ERROR'
      );
    }

    if (this.errorCount >= this.maxErrors) {
      this.isConnected = false;
      throw new MarketDataServiceError(
        `Too many errors (${this.errorCount}). Service disconnected.`,
        'MAX_ERRORS_EXCEEDED'
      );
    }
  }

  private handleError(error: unknown, method: string, symbol?: string): void {
    this.errorCount++;
    
    console.error(`MarketDataService.${method} error:`, {
      error: error instanceof Error ? error.message : String(error),
      symbol,
      errorCount: this.errorCount,
      timestamp: new Date().toISOString()
    });

    if (this.errorCount >= this.maxErrors) {
      this.isConnected = false;
      console.error('MarketDataService disconnected due to too many errors');
    }
  }

  private resetErrorCount(): void {
    if (this.errorCount > 0) {
      this.errorCount = 0;
    }
  }

  // Public methods for testing and monitoring
  public getConnectionStatus(): { isConnected: boolean; errorCount: number } {
    return {
      isConnected: this.isConnected,
      errorCount: this.errorCount
    };
  }

  public reconnect(): void {
    this.isConnected = true;
    this.errorCount = 0;
    console.log('MarketDataService reconnected');
  }

  public disconnect(): void {
    this.isConnected = false;
    console.log('MarketDataService disconnected');
  }
}

/**
 * Factory function to create a MarketDataService instance
 */
export function createMarketDataService(logger: LoggingService): MarketDataService {
  return new MarketDataService(logger);
}
