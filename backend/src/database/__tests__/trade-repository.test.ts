/**
 * Trade repository tests
 */

import { DatabaseConnection } from '../connection';
import { TradeRepository } from '../repositories/trade-repository';
import { Trade } from '../../../../shared/src/types/trading';
import fs from 'fs';
import path from 'path';

describe('TradeRepository', () => {
  let db: DatabaseConnection;
  let repository: TradeRepository;
  const testDbPath = path.join(__dirname, 'trade-test.db');

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
    repository = new TradeRepository(db);
  });

  afterEach(async () => {
    if (db.isConnected()) {
      await db.close();
    }
    
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('create and retrieve trades', () => {
    it('should create a new trade', async () => {
      const tradeData: Omit<Trade, 'id'> = {
        symbol: 'AAPL',
        action: 'BUY',
        quantity: 100,
        price: 150.00,
        timestamp: new Date(),
        reasoning: 'Strong technical breakout',
        signalId: 'signal-123',
        fees: 1.00,
        status: 'EXECUTED'
      };

      const trade = await repository.create(tradeData);

      expect(trade.id).toBeDefined();
      expect(trade.symbol).toBe('AAPL');
      expect(trade.action).toBe('BUY');
      expect(trade.quantity).toBe(100);
      expect(trade.status).toBe('EXECUTED');
    });

    it('should find trade by ID', async () => {
      const tradeData: Omit<Trade, 'id'> = {
        symbol: 'MSFT',
        action: 'SELL',
        quantity: 50,
        price: 300.00,
        timestamp: new Date(),
        reasoning: 'Profit target reached',
        signalId: 'signal-456',
        fees: 1.50,
        status: 'EXECUTED'
      };

      const created = await repository.create(tradeData);
      const found = await repository.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.symbol).toBe('MSFT');
      expect(found!.action).toBe('SELL');
    });
  });

  describe('trade history and filtering', () => {
    beforeEach(async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Create test trades
      await repository.create({
        symbol: 'AAPL',
        action: 'BUY',
        quantity: 100,
        price: 150.00,
        timestamp: yesterday,
        reasoning: 'Entry signal',
        signalId: 'signal-1',
        fees: 1.00,
        status: 'EXECUTED'
      });

      await repository.create({
        symbol: 'AAPL',
        action: 'SELL',
        quantity: 100,
        price: 160.00,
        timestamp: now,
        reasoning: 'Profit target',
        signalId: 'signal-2',
        fees: 1.00,
        status: 'EXECUTED'
      });

      await repository.create({
        symbol: 'GOOGL',
        action: 'BUY',
        quantity: 25,
        price: 2500.00,
        timestamp: now,
        reasoning: 'Momentum signal',
        signalId: 'signal-3',
        fees: 2.50,
        status: 'PENDING'
      });

      await repository.create({
        symbol: 'TSLA',
        action: 'BUY',
        quantity: 50,
        price: 800.00,
        timestamp: now,
        reasoning: 'Breakout signal',
        signalId: 'signal-4',
        fees: 1.50,
        status: 'FAILED'
      });
    });

    it('should get all trade history', async () => {
      const trades = await repository.getTradeHistory();
      expect(trades).toHaveLength(4);
    });

    it('should filter trades by symbol', async () => {
      const applTrades = await repository.getTradeHistory({ symbol: 'AAPL' });
      expect(applTrades).toHaveLength(2);
      expect(applTrades.every(t => t.symbol === 'AAPL')).toBe(true);
    });

    it('should filter trades by action', async () => {
      const buyTrades = await repository.getTradeHistory({ action: 'BUY' });
      expect(buyTrades).toHaveLength(3);
      expect(buyTrades.every(t => t.action === 'BUY')).toBe(true);
    });

    it('should filter trades by status', async () => {
      const executedTrades = await repository.getTradeHistory({ status: 'EXECUTED' });
      expect(executedTrades).toHaveLength(2);
      expect(executedTrades.every(t => t.status === 'EXECUTED')).toBe(true);
    });

    it('should filter trades by date range', async () => {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      
      const todayTrades = await repository.getTradeHistory({ 
        startDate: startOfToday 
      });
      expect(todayTrades).toHaveLength(3); // All trades from today
    });

    it('should limit and offset results', async () => {
      const firstTwo = await repository.getTradeHistory({ limit: 2 });
      expect(firstTwo).toHaveLength(2);
      
      const nextTwo = await repository.getTradeHistory({ limit: 2, offset: 2 });
      expect(nextTwo).toHaveLength(2);
      
      // Should be different trades
      expect(firstTwo.length).toBeGreaterThan(0);
      expect(nextTwo.length).toBeGreaterThan(0);
      if (firstTwo[0] && nextTwo[0]) {
        expect(firstTwo[0].id).not.toBe(nextTwo[0].id);
      }
    });

    it('should get trades by symbol', async () => {
      const applTrades = await repository.getBySymbol('AAPL');
      expect(applTrades).toHaveLength(2);
    });

    it('should get recent trades', async () => {
      const recent = await repository.getRecentTrades(3);
      expect(recent).toHaveLength(3);
    });

    it('should get executed trades for date range', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const executed = await repository.getExecutedTrades(yesterday, tomorrow);
      expect(executed).toHaveLength(1); // Only the AAPL SELL trade from today
      expect(executed.every(t => t.status === 'EXECUTED')).toBe(true);
    });

    it('should get pending trades', async () => {
      const pending = await repository.getPendingTrades();
      expect(pending).toHaveLength(1);
      if (pending[0]) {
        expect(pending[0].symbol).toBe('GOOGL');
      }
    });
  });

  describe('trade updates', () => {
    let tradeId: string;

    beforeEach(async () => {
      const trade = await repository.create({
        symbol: 'NVDA',
        action: 'BUY',
        quantity: 30,
        price: 400.00,
        timestamp: new Date(),
        reasoning: 'AI momentum',
        signalId: 'signal-5',
        fees: 1.20,
        status: 'PENDING'
      });
      tradeId = trade.id;
    });

    it('should update trade status', async () => {
      const updated = await repository.updateStatus(tradeId, 'EXECUTED');
      expect(updated.status).toBe('EXECUTED');
    });

    it('should update trade fields', async () => {
      const updated = await repository.update(tradeId, {
        price: 405.00,
        fees: 1.50
      });
      
      expect(updated.price).toBe(405.00);
      expect(updated.fees).toBe(1.50);
    });
  });

  describe('trade statistics', () => {
    beforeEach(async () => {
      const now = new Date();
      
      // Create various trades for statistics
      await repository.create({
        symbol: 'AAPL',
        action: 'BUY',
        quantity: 100,
        price: 150.00,
        timestamp: now,
        reasoning: 'Entry',
        signalId: 'signal-1',
        fees: 1.00,
        status: 'EXECUTED'
      });

      await repository.create({
        symbol: 'MSFT',
        action: 'SELL',
        quantity: 50,
        price: 300.00,
        timestamp: now,
        reasoning: 'Exit',
        signalId: 'signal-2',
        fees: 1.50,
        status: 'EXECUTED'
      });

      await repository.create({
        symbol: 'GOOGL',
        action: 'BUY',
        quantity: 25,
        price: 2500.00,
        timestamp: now,
        reasoning: 'Entry',
        signalId: 'signal-3',
        fees: 2.50,
        status: 'FAILED'
      });
    });

    it('should get trade statistics', async () => {
      const stats = await repository.getTradeStats();
      
      expect(stats.totalTrades).toBe(3);
      expect(stats.executedTrades).toBe(2);
      expect(stats.failedTrades).toBe(1);
      expect(stats.buyTrades).toBe(2);
      expect(stats.sellTrades).toBe(1);
      expect(stats.totalFees).toBe(5.00);
    });

    it('should get daily volume', async () => {
      const today = new Date();
      const volume = await repository.getDailyVolume(today);
      
      // AAPL: 100 * 150 + MSFT: 50 * 300 = 15000 + 15000 = 30000
      expect(volume).toBe(30000);
    });

    it('should get most traded symbols', async () => {
      // Add more AAPL trades
      await repository.create({
        symbol: 'AAPL',
        action: 'SELL',
        quantity: 50,
        price: 155.00,
        timestamp: new Date(),
        reasoning: 'Partial exit',
        signalId: 'signal-4',
        fees: 0.75,
        status: 'EXECUTED'
      });

      const mostTraded = await repository.getMostTradedSymbols(5);
      
      expect(mostTraded).toHaveLength(2); // AAPL and MSFT
      if (mostTraded[0]) {
        expect(mostTraded[0].symbol).toBe('AAPL');
        expect(mostTraded[0].count).toBe(2);
      }
    });
  });
});