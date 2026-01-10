/**
 * Database service integration tests
 */

import { DatabaseService } from '../database-service';
import { DatabaseConnection } from '../connection';
import { Trade } from '../../../../shared/src/types/trading';
import { Position, PortfolioSnapshot } from '../../../../shared/src/types/portfolio';
import { ExecutionLog, LLMInteraction } from '../../../../shared/src/types/logging';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

describe('DatabaseService', () => {
  let db: DatabaseConnection;
  let service: DatabaseService;
  const testDbPath = path.join(__dirname, 'service-test.db');

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
    service = new DatabaseService(db);
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

  describe('generic CRUD operations', () => {
    it('should create, find, update, and delete records', async () => {
      // Create
      const tradeData: Omit<Trade, 'id'> = {
        symbol: 'AAPL',
        action: 'BUY',
        quantity: 100,
        price: 150.00,
        timestamp: new Date(),
        reasoning: 'Test trade',
        signalId: 'signal-123',
        fees: 1.00,
        status: 'EXECUTED'
      };

      const created = await service.create<Trade>('trades', tradeData);
      expect(created.id).toBeDefined();
      expect(created.symbol).toBe('AAPL');

      // Find by ID
      const found = await service.findById<Trade>('trades', created.id);
      expect(found).toBeDefined();
      expect(found!.symbol).toBe('AAPL');

      // Update
      const updated = await service.update<Trade>('trades', created.id, { price: 155.00 });
      expect(updated.price).toBe(155.00);

      // Find many
      const trades = await service.findMany<Trade>('trades', { symbol: 'AAPL' });
      expect(trades).toHaveLength(1);

      // Delete
      const deleted = await service.delete('trades', created.id);
      expect(deleted).toBe(true);

      const notFound = await service.findById<Trade>('trades', created.id);
      expect(notFound).toBeNull();
    });
  });

  describe('trading-specific operations', () => {
    it('should save and retrieve trades', async () => {
      const trade: Trade = {
        id: uuidv4(),
        symbol: 'MSFT',
        action: 'BUY',
        quantity: 50,
        price: 300.00,
        timestamp: new Date(),
        reasoning: 'Strong momentum',
        signalId: 'signal-456',
        fees: 1.50,
        status: 'EXECUTED'
      };

      const saved = await service.saveTrade(trade);
      expect(saved.symbol).toBe(trade.symbol);
      expect(saved.quantity).toBe(trade.quantity);

      const history = await service.getTradeHistory({ symbol: 'MSFT' });
      expect(history).toHaveLength(1);
      if (history[0]) {
        expect(history[0].symbol).toBe('MSFT');
      }
    });

    it('should save and retrieve positions', async () => {
      const position: Position = {
        id: uuidv4(),
        symbol: 'GOOGL',
        quantity: 25,
        entryPrice: 2500.00,
        currentPrice: 2600.00,
        entryDate: new Date(),
        stopLoss: 2300.00,
        profitTargets: [2700.00, 2800.00],
        unrealizedPnL: 2500.00,
        realizedPnL: 0,
        exitCriteria: [],
        sector: 'Technology',
        lastUpdated: new Date()
      };

      const saved = await service.savePosition(position);
      expect(saved.symbol).toBe(position.symbol);
      expect(saved.quantity).toBe(position.quantity);

      const history = await service.getPositionHistory('GOOGL');
      expect(history).toHaveLength(1);
      if (history[0]) {
        expect(history[0].symbol).toBe('GOOGL');
      }
    });

    it('should save portfolio snapshots', async () => {
      const snapshot: PortfolioSnapshot = {
        id: uuidv4(),
        portfolioId: 'default',
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

      await service.savePortfolioSnapshot(snapshot);

      // Verify it was saved by checking the portfolio repository
      const portfolioRepo = service.getPortfolioRepository();
      const saved = await portfolioRepo.getLatestSnapshot('default');
      expect(saved).toBeDefined();
      expect(saved!.totalValue).toBe(105000);
    });
  });

  describe('logging operations', () => {
    it('should save and retrieve execution logs', async () => {
      const log: ExecutionLog = {
        id: uuidv4(),
        timestamp: new Date(),
        component: 'TRADING_ENGINE',
        action: 'EXECUTE_CYCLE',
        details: { cycleNumber: 1 },
        level: 'INFO',
        executionCycleId: 'cycle-123',
        duration: 1500,
        success: true
      };

      await service.saveLog(log);

      const logs = await service.getLogs({ component: 'TRADING_ENGINE' });
      expect(logs).toHaveLength(1);
      if (logs[0]) {
        expect(logs[0].action).toBe('EXECUTE_CYCLE');
      }
    });

    it('should save and retrieve LLM interactions', async () => {
      const interaction: LLMInteraction = {
        id: uuidv4(),
        timestamp: new Date(),
        prompt: 'Analyze TSLA for trading',
        response: 'TSLA shows bullish momentum...',
        model: 'claude-3-sonnet',
        processingTime: 2000,
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 200,
          totalTokens: 300,
          cost: 0.015
        },
        success: true,
        retryCount: 0
      };

      await service.saveLLMInteraction(interaction);

      const loggingRepo = service.getLoggingRepository();
      const interactions = await loggingRepo.getLLMInteractions();
      expect(interactions).toHaveLength(1);
      if (interactions[0]) {
        expect(interactions[0].model).toBe('claude-3-sonnet');
      }
    });
  });

  describe('transaction operations', () => {
    it('should handle successful transactions', async () => {
      await service.beginTransaction();

      try {
        await service.create<Trade>('trades', {
          symbol: 'NVDA',
          action: 'BUY',
          quantity: 30,
          price: 400.00,
          timestamp: new Date(),
          reasoning: 'AI momentum',
          signalId: 'signal-789',
          fees: 1.20,
          status: 'EXECUTED'
        });

        await service.create<Trade>('trades', {
          symbol: 'AMD',
          action: 'BUY',
          quantity: 40,
          price: 100.00,
          timestamp: new Date(),
          reasoning: 'Semiconductor play',
          signalId: 'signal-790',
          fees: 1.00,
          status: 'EXECUTED'
        });

        await service.commitTransaction();

        const trades = await service.findMany<Trade>('trades');
        expect(trades).toHaveLength(2);
      } catch (error) {
        await service.rollbackTransaction();
        throw error;
      }
    });

    it('should handle failed transactions', async () => {
      await service.beginTransaction();

      try {
        await service.create<Trade>('trades', {
          symbol: 'INTC',
          action: 'BUY',
          quantity: 50,
          price: 50.00,
          timestamp: new Date(),
          reasoning: 'Value play',
          signalId: 'signal-791',
          fees: 1.00,
          status: 'EXECUTED'
        });

        // This should fail due to invalid table
        await db.run('INSERT INTO invalid_table (id) VALUES (?)', ['test']);

        await service.commitTransaction();
      } catch (error) {
        await service.rollbackTransaction();
        
        // Verify rollback worked
        const trades = await service.findMany<Trade>('trades');
        expect(trades).toHaveLength(0);
      }
    });
  });

  describe('maintenance operations', () => {
    it('should create backup', async () => {
      // Add some data first
      await service.create<Trade>('trades', {
        symbol: 'BACKUP_TEST',
        action: 'BUY',
        quantity: 10,
        price: 100.00,
        timestamp: new Date(),
        reasoning: 'Backup test',
        signalId: 'signal-backup',
        fees: 0.50,
        status: 'EXECUTED'
      });

      const backupPath = await service.backup();
      expect(fs.existsSync(backupPath)).toBe(true);

      // Clean up backup
      fs.unlinkSync(backupPath);
    });

    it('should get database statistics', async () => {
      const stats = await service.getStats();
      
      expect(stats.tables).toBeDefined();
      expect(stats.tables['portfolios']).toBe(1); // Default portfolio
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('should check connection status', () => {
      expect(service.isConnected()).toBe(true);
    });
  });

  describe('repository access', () => {
    it('should provide access to specific repositories', () => {
      const portfolioRepo = service.getPortfolioRepository();
      const positionRepo = service.getPositionRepository();
      const tradeRepo = service.getTradeRepository();
      const loggingRepo = service.getLoggingRepository();

      expect(portfolioRepo).toBeDefined();
      expect(positionRepo).toBeDefined();
      expect(tradeRepo).toBeDefined();
      expect(loggingRepo).toBeDefined();
    });
  });
});