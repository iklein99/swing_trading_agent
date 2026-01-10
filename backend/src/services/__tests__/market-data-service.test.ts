/**
 * Market Data Service Tests
 * Tests for data fetching, error handling, and mock data provider functionality
 */

import { MarketDataService, MockMarketDataProvider, MarketDataServiceError } from '../market-data-service';
import { TimePeriod, ScreeningCriteria } from '@shared/types';

describe('MockMarketDataProvider', () => {
  let provider: MockMarketDataProvider;

  beforeEach(() => {
    provider = new MockMarketDataProvider();
  });

  describe('generateQuote', () => {
    it('should generate valid quote for known symbol', () => {
      const quote = provider.generateQuote('AAPL');
      
      expect(quote).toMatchObject({
        symbol: 'AAPL',
        price: expect.any(Number),
        volume: expect.any(Number),
        timestamp: expect.any(Date),
        bid: expect.any(Number),
        ask: expect.any(Number),
        dayHigh: expect.any(Number),
        dayLow: expect.any(Number),
        dayOpen: expect.any(Number),
        previousClose: expect.any(Number),
        change: expect.any(Number),
        changePercent: expect.any(Number),
        marketCap: expect.any(Number),
        averageVolume: expect.any(Number)
      });

      // Validate price relationships
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.bid).toBeLessThan(quote.ask);
      expect(quote.dayHigh).toBeGreaterThanOrEqual(quote.price);
      expect(quote.dayLow).toBeLessThanOrEqual(quote.price);
      expect(quote.volume).toBeGreaterThan(0);
      expect(quote.marketCap).toBeGreaterThan(0);
    });

    it('should throw error for invalid symbol', () => {
      expect(() => provider.generateQuote('INVALID')).toThrow(MarketDataServiceError);
      expect(() => provider.generateQuote('INVALID')).toThrow('Invalid symbol: INVALID');
    });

    it('should generate consistent base prices for same symbol', () => {
      const quote1 = provider.generateQuote('AAPL');
      const quote2 = provider.generateQuote('AAPL');
      
      // Prices should be in similar range (within 10% due to volatility)
      const priceDiff = Math.abs(quote1.price - quote2.price) / quote1.price;
      expect(priceDiff).toBeLessThan(0.1);
    });
  });

  describe('generateHistoricalData', () => {
    it('should generate valid historical data', () => {
      const historical = provider.generateHistoricalData('MSFT', '1M');
      
      expect(historical).toMatchObject({
        symbol: 'MSFT',
        data: expect.any(Array),
        period: '1M',
        interval: '1d',
        lastUpdated: expect.any(Date)
      });

      expect(historical.data).toHaveLength(30); // 1 month = 30 days
      
      // Validate OHLCV data structure
      historical.data.forEach(candle => {
        expect(candle).toMatchObject({
          timestamp: expect.any(Date),
          open: expect.any(Number),
          high: expect.any(Number),
          low: expect.any(Number),
          close: expect.any(Number),
          volume: expect.any(Number),
          adjustedClose: expect.any(Number)
        });

        // Validate OHLC relationships
        expect(candle.high).toBeGreaterThanOrEqual(candle.open);
        expect(candle.high).toBeGreaterThanOrEqual(candle.close);
        expect(candle.low).toBeLessThanOrEqual(candle.open);
        expect(candle.low).toBeLessThanOrEqual(candle.close);
        expect(candle.volume).toBeGreaterThan(0);
      });
    });

    it('should throw error for invalid symbol', () => {
      expect(() => provider.generateHistoricalData('INVALID', '1M')).toThrow(MarketDataServiceError);
    });

    it('should generate correct number of data points for different periods', () => {
      const periods: TimePeriod[] = ['1D', '5D', '1M', '3M'];
      const expectedDays = [1, 5, 30, 90];

      periods.forEach((period, index) => {
        const historical = provider.generateHistoricalData('AAPL', period);
        expect(historical.data).toHaveLength(expectedDays[index]!);
      });
    });
  });

  describe('generateTechnicalIndicators', () => {
    it('should generate valid technical indicators', () => {
      const indicators = provider.generateTechnicalIndicators('GOOGL');
      
      expect(indicators).toMatchObject({
        symbol: 'GOOGL',
        timestamp: expect.any(Date),
        rsi: expect.any(Number),
        macd: {
          value: expect.any(Number),
          signal: expect.any(Number),
          histogram: expect.any(Number)
        },
        movingAverages: {
          sma20: expect.any(Number),
          sma50: expect.any(Number),
          sma200: expect.any(Number),
          ema20: expect.any(Number),
          ema50: expect.any(Number),
          ema200: expect.any(Number)
        },
        atr: expect.any(Number),
        atr14: expect.any(Number),
        bollinger: {
          upper: expect.any(Number),
          middle: expect.any(Number),
          lower: expect.any(Number)
        },
        stochastic: {
          k: expect.any(Number),
          d: expect.any(Number)
        },
        williams: expect.any(Number),
        vwap: expect.any(Number),
        obv: expect.any(Number)
      });

      // Validate indicator ranges
      expect(indicators.rsi).toBeGreaterThanOrEqual(0);
      expect(indicators.rsi).toBeLessThanOrEqual(100);
      expect(indicators.bollinger.upper).toBeGreaterThan(indicators.bollinger.middle);
      expect(indicators.bollinger.middle).toBeGreaterThan(indicators.bollinger.lower);
      expect(indicators.stochastic.k).toBeGreaterThanOrEqual(0);
      expect(indicators.stochastic.k).toBeLessThanOrEqual(100);
      expect(indicators.williams).toBeGreaterThanOrEqual(-100);
      expect(indicators.williams).toBeLessThanOrEqual(0);
    });

    it('should throw error for invalid symbol', () => {
      expect(() => provider.generateTechnicalIndicators('INVALID')).toThrow(MarketDataServiceError);
    });
  });

  describe('screenStocks', () => {
    it('should return array of symbols', () => {
      const criteria: ScreeningCriteria = {
        minPrice: 50,
        maxPrice: 500,
        minVolume: 100000
      };
      
      const symbols = provider.screenStocks(criteria);
      
      expect(Array.isArray(symbols)).toBe(true);
      expect(symbols.length).toBeGreaterThan(0);
      expect(symbols.length).toBeLessThanOrEqual(8);
      
      symbols.forEach(symbol => {
        expect(typeof symbol).toBe('string');
        expect(symbol.length).toBeGreaterThan(0);
      });
    });

    it('should filter by price criteria', () => {
      const criteria: ScreeningCriteria = {
        minPrice: 1000, // Very high price to filter most stocks
        maxPrice: 2000
      };
      
      const symbols = provider.screenStocks(criteria);
      
      // Should return fewer symbols due to high price filter
      expect(symbols.length).toBeLessThanOrEqual(3);
    });

    it('should handle empty criteria', () => {
      const symbols = provider.screenStocks({});
      
      expect(Array.isArray(symbols)).toBe(true);
      expect(symbols.length).toBeGreaterThan(0);
    });
  });
});

describe('MarketDataService', () => {
  let service: MarketDataService;

  beforeEach(() => {
    service = new MarketDataService();
  });

  describe('getRealtimeQuote', () => {
    it('should return valid quote for known symbol', async () => {
      const quote = await service.getRealtimeQuote('AAPL');
      
      expect(quote.symbol).toBe('AAPL');
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.bid).toBeLessThan(quote.ask);
      expect(quote.timestamp).toBeInstanceOf(Date);
    });

    it('should throw error for invalid symbol', async () => {
      await expect(service.getRealtimeQuote('INVALID')).rejects.toThrow(MarketDataServiceError);
    });

    it('should throw error when disconnected', async () => {
      service.disconnect();
      
      await expect(service.getRealtimeQuote('AAPL')).rejects.toThrow('Market data service is not connected');
    });
  });

  describe('getHistoricalData', () => {
    it('should return valid historical data', async () => {
      const historical = await service.getHistoricalData('MSFT', '1M');
      
      expect(historical.symbol).toBe('MSFT');
      expect(historical.period).toBe('1M');
      expect(historical.data).toHaveLength(30);
      expect(historical.lastUpdated).toBeInstanceOf(Date);
    });

    it('should throw error for invalid symbol', async () => {
      await expect(service.getHistoricalData('INVALID', '1M')).rejects.toThrow(MarketDataServiceError);
    });
  });

  describe('getTechnicalIndicators', () => {
    it('should return valid technical indicators', async () => {
      const indicators = await service.getTechnicalIndicators('GOOGL');
      
      expect(indicators.symbol).toBe('GOOGL');
      expect(indicators.rsi).toBeGreaterThanOrEqual(0);
      expect(indicators.rsi).toBeLessThanOrEqual(100);
      expect(indicators.timestamp).toBeInstanceOf(Date);
    });

    it('should throw error for invalid symbol', async () => {
      await expect(service.getTechnicalIndicators('INVALID')).rejects.toThrow(MarketDataServiceError);
    });
  });

  describe('getMarketData', () => {
    it('should return complete market data', async () => {
      const marketData = await service.getMarketData('AMZN');
      
      expect(marketData).toMatchObject({
        quote: expect.objectContaining({ symbol: 'AMZN' }),
        historical: expect.objectContaining({ symbol: 'AMZN' }),
        technical: expect.objectContaining({ symbol: 'AMZN' }),
        lastUpdated: expect.any(Date)
      });
    });

    it('should throw error for invalid symbol', async () => {
      await expect(service.getMarketData('INVALID')).rejects.toThrow(MarketDataServiceError);
    });
  });

  describe('screenStocks', () => {
    it('should return filtered symbols', async () => {
      const criteria: ScreeningCriteria = {
        minPrice: 100,
        minVolume: 500000
      };
      
      const symbols = await service.screenStocks(criteria);
      
      expect(Array.isArray(symbols)).toBe(true);
      expect(symbols.length).toBeGreaterThan(0);
    });
  });

  describe('market status', () => {
    it('should return market status', async () => {
      const status = await service.getMarketStatus();
      
      expect(status).toMatchObject({
        isOpen: expect.any(Boolean),
        timezone: 'America/New_York',
        session: expect.stringMatching(/^(PRE_MARKET|REGULAR|AFTER_HOURS|CLOSED)$/)
      });
    });

    it('should determine market open status', () => {
      const isOpen = service.isMarketOpen();
      expect(typeof isOpen).toBe('boolean');
    });
  });

  describe('connection management', () => {
    it('should track connection status', () => {
      const status = service.getConnectionStatus();
      
      expect(status).toMatchObject({
        isConnected: expect.any(Boolean),
        errorCount: expect.any(Number)
      });
    });

    it('should allow reconnection', () => {
      service.disconnect();
      expect(service.getConnectionStatus().isConnected).toBe(false);
      
      service.reconnect();
      expect(service.getConnectionStatus().isConnected).toBe(true);
    });

    it('should handle error accumulation', async () => {
      // Force multiple errors by using invalid symbols
      for (let i = 0; i < 3; i++) {
        try {
          await service.getRealtimeQuote('INVALID');
        } catch (error) {
          // Expected to fail
        }
      }
      
      const status = service.getConnectionStatus();
      expect(status.errorCount).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle data unavailability', async () => {
      service.disconnect();
      
      await expect(service.getRealtimeQuote('AAPL')).rejects.toThrow(MarketDataServiceError);
      await expect(service.getHistoricalData('AAPL', '1M')).rejects.toThrow(MarketDataServiceError);
      await expect(service.getTechnicalIndicators('AAPL')).rejects.toThrow(MarketDataServiceError);
      
      // Test that the error has the correct code
      try {
        await service.getRealtimeQuote('AAPL');
      } catch (error) {
        expect(error).toBeInstanceOf(MarketDataServiceError);
        expect((error as MarketDataServiceError).code).toBe('CONNECTION_ERROR');
      }
    });

    it('should validate input parameters', async () => {
      await expect(service.getRealtimeQuote('')).rejects.toThrow();
      await expect(service.getHistoricalData('', '1M')).rejects.toThrow();
      await expect(service.getTechnicalIndicators('')).rejects.toThrow();
    });
  });

  describe('subscription methods', () => {
    it('should handle quote subscriptions (mock)', () => {
      const callback = jest.fn();
      
      // Should not throw errors
      expect(() => service.subscribeToQuotes(['AAPL', 'MSFT'], callback)).not.toThrow();
      expect(() => service.unsubscribeFromQuotes(['AAPL', 'MSFT'])).not.toThrow();
    });
  });
});