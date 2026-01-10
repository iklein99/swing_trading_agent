/**
 * Portfolio repository tests
 */

import { DatabaseConnection } from '../connection';
import { PortfolioRepository } from '../repositories/portfolio-repository';
import { PortfolioSnapshot } from '../../../../shared/src/types/portfolio';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

describe('PortfolioRepository', () => {
  let db: DatabaseConnection;
  let repository: PortfolioRepository;
  const testDbPath = path.join(__dirname, 'portfolio-test.db');

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
    repository = new PortfolioRepository(db);
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

  describe('getDefault', () => {
    it('should return default portfolio', async () => {
      const portfolio = await repository.getDefault();
      
      expect(portfolio.id).toBe('default');
      expect(portfolio.totalValue).toBe(100000);
      expect(portfolio.cashBalance).toBe(100000);
      expect(portfolio.positions).toEqual([]);
    });

    it('should create default portfolio if it does not exist', async () => {
      // Delete the default portfolio first
      await db.run('DELETE FROM portfolios WHERE id = ?', ['default']);
      
      const portfolio = await repository.getDefault();
      
      expect(portfolio.id).toBe('default');
      expect(portfolio.totalValue).toBe(100000);
      expect(portfolio.cashBalance).toBe(100000);
    });
  });

  describe('updateMetrics', () => {
    it('should update portfolio metrics', async () => {
      const portfolio = await repository.getDefault();
      
      const updated = await repository.updateMetrics(
        portfolio.id,
        110000,
        90000,
        5000,
        10000
      );
      
      expect(updated.totalValue).toBe(110000);
      expect(updated.cashBalance).toBe(90000);
      expect(updated.dailyPnL).toBe(5000);
      expect(updated.totalPnL).toBe(10000);
      expect(updated.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('snapshots', () => {
    let portfolioId: string;

    beforeEach(async () => {
      const portfolio = await repository.getDefault();
      portfolioId = portfolio.id;
    });

    it('should save portfolio snapshot', async () => {
      const snapshot: PortfolioSnapshot = {
        id: uuidv4(),
        portfolioId,
        timestamp: new Date(),
        totalValue: 105000,
        cashBalance: 95000,
        positionCount: 2,
        dailyPnL: 2500,
        totalPnL: 5000,
        positions: [
          {
            symbol: 'AAPL',
            quantity: 100,
            price: 150,
            value: 15000,
            unrealizedPnL: 1000,
            percentage: 14.3
          }
        ]
      };
      
      await repository.saveSnapshot(snapshot);
      
      const saved = await repository.getLatestSnapshot(portfolioId);
      expect(saved).toBeDefined();
      expect(saved!.totalValue).toBe(105000);
      expect(saved!.positions).toHaveLength(1);
    });

    it('should get snapshots for date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Save snapshots
      await repository.saveSnapshot({
        id: uuidv4(),
        portfolioId,
        timestamp: yesterday,
        totalValue: 100000,
        cashBalance: 100000,
        positionCount: 0,
        dailyPnL: 0,
        totalPnL: 0,
        positions: []
      });
      
      await repository.saveSnapshot({
        id: uuidv4(),
        portfolioId,
        timestamp: now,
        totalValue: 105000,
        cashBalance: 95000,
        positionCount: 1,
        dailyPnL: 2500,
        totalPnL: 5000,
        positions: []
      });
      
      const snapshots = await repository.getSnapshots(portfolioId, yesterday, now);
      expect(snapshots).toHaveLength(2);
      if (snapshots[0] && snapshots[1]) {
        expect(snapshots[0].totalValue).toBe(105000); // Most recent first
        expect(snapshots[1].totalValue).toBe(100000);
      }
    });

    it('should cleanup old snapshots', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40); // 40 days ago
      
      // Save old snapshot
      await repository.saveSnapshot({
        id: uuidv4(),
        portfolioId,
        timestamp: oldDate,
        totalValue: 100000,
        cashBalance: 100000,
        positionCount: 0,
        dailyPnL: 0,
        totalPnL: 0,
        positions: []
      });
      
      // Save recent snapshot
      await repository.saveSnapshot({
        id: uuidv4(),
        portfolioId,
        timestamp: new Date(),
        totalValue: 105000,
        cashBalance: 95000,
        positionCount: 1,
        dailyPnL: 2500,
        totalPnL: 5000,
        positions: []
      });
      
      const deletedCount = await repository.cleanupSnapshots(portfolioId, 30);
      expect(deletedCount).toBe(1);
      
      const remaining = await repository.getSnapshots(portfolioId);
      expect(remaining).toHaveLength(1);
      if (remaining[0]) {
        expect(remaining[0].totalValue).toBe(105000);
      }
    });

    it('should get performance history', async () => {
      const dates = [];
      for (let i = 0; i < 5; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date);
        
        await repository.saveSnapshot({
          id: uuidv4(),
          portfolioId,
          timestamp: date,
          totalValue: 100000 + (i * 1000),
          cashBalance: 90000,
          positionCount: 1,
          dailyPnL: i * 500,
          totalPnL: i * 1000,
          positions: []
        });
      }
      
      const history = await repository.getPerformanceHistory(portfolioId, 10);
      expect(history).toHaveLength(5);
      if (history[0] && history[4]) {
        expect(history[0].totalValue).toBe(104000); // Oldest first (ascending order)
        expect(history[4].totalValue).toBe(100000); // Most recent last
      }
    });
  });
});