/**
 * Basic test to verify the shared package setup
 */

import { TRADING_CONSTANTS, SYSTEM_CONSTANTS } from '../constants';
import { TradeAction, TradeStatus } from '../types';

describe('Shared Package Setup', () => {
  it('should export trading constants', () => {
    expect(TRADING_CONSTANTS.MAX_POSITION_PERCENTAGE).toBe(10);
    expect(TRADING_CONSTANTS.MAX_DAILY_LOSS_PERCENTAGE).toBe(3);
    expect(TRADING_CONSTANTS.MAX_DRAWDOWN_PERCENTAGE).toBe(8);
  });

  it('should export system constants', () => {
    expect(SYSTEM_CONSTANTS.DEFAULT_PAGE_SIZE).toBe(50);
    expect(SYSTEM_CONSTANTS.DEFAULT_TIMEOUT).toBe(30000);
  });

  it('should export trading types', () => {
    const buyAction: TradeAction = 'BUY';
    const sellAction: TradeAction = 'SELL';
    const executedStatus: TradeStatus = 'EXECUTED';
    
    expect(buyAction).toBe('BUY');
    expect(sellAction).toBe('SELL');
    expect(executedStatus).toBe('EXECUTED');
  });

  it('should pass basic test', () => {
    expect(true).toBe(true);
  });
});