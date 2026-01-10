/**
 * Basic test to verify the backend package setup
 */

import { TRADING_CONSTANTS, TradingSignal, Portfolio } from '@shared/index';

describe('Backend Package Setup', () => {
  it('should pass basic test', () => {
    expect(true).toBe(true);
  });

  it('should have access to shared constants', () => {
    expect(TRADING_CONSTANTS.MAX_POSITION_PERCENTAGE).toBe(10);
    expect(TRADING_CONSTANTS.MAX_DAILY_LOSS_PERCENTAGE).toBe(3);
  });

  it('should have access to shared types', () => {
    const mockSignal: Partial<TradingSignal> = {
      symbol: 'AAPL',
      action: 'BUY',
      confidence: 0.8,
    };
    
    const mockPortfolio: Partial<Portfolio> = {
      totalValue: 100000,
      cashBalance: 50000,
      positions: [],
    };

    expect(mockSignal.symbol).toBe('AAPL');
    expect(mockPortfolio.totalValue).toBe(100000);
  });
});