/**
 * Position repository tests
 */

import { DatabaseConnection } from '../connection';
import { PositionRepository } from '../repositories/position-repository';
import { Position } from '../../../../shared/src/types/portfolio';
import fs from 'fs';
import path from 'path';

describe('PositionRepository', () => {
  let db: DatabaseConnection;
  let repository: PositionRepository;
  const testDbPath = path.join(__dirname, 'position-test.db');

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
    repository = new PositionRepository(db);
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

  describe('create and retrieve positions', () => {
    it('should create a new position', async () => {
      const positionData: Omit<Position, 'id'> = {
        symbol: 'AAPL',
        quantity: 100,
        entryPrice: 150.00,
        currentPrice: 155.00,
        entryDate: new Date(),
        stopLoss: 140.00,
        profitTargets: [160.00, 170.00],
        unrealizedPnL: 500.00,
        realizedPnL: 0,
        exitCriteria: [],
        sector: 'Technology',
        lastUpdated: new Date()
      };

      const position = await repository.create(positionData);

      expect(position.id).toBeDefined();
      expect(position.symbol).toBe('AAPL');
      expect(position.quantity).toBe(100);
      expect(position.entryPrice).toBe(150.00);
      expect(position.profitTargets).toEqual([160.00, 170.00]);
    });

    it('should find position by ID', async () => {
      const positionData: Omit<Position, 'id'> = {
        symbol: 'MSFT',
        quantity: 50,
        entryPrice: 300.00,
        currentPrice: 310.00,
        entryDate: new Date(),
        stopLoss: 280.00,
        profitTargets: [320.00],
        unrealizedPnL: 500.00,
        realizedPnL: 0,
        exitCriteria: [],
        lastUpdated: new Date()
      };

      const created = await repository.create(positionData);
      const found = await repository.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.symbol).toBe('MSFT');
      expect(found!.quantity).toBe(50);
    });
  });

  describe('portfolio operations', () => {
    beforeEach(async () => {
      // Create test positions
      await repository.create({
        symbol: 'AAPL',
        quantity: 100,
        entryPrice: 150.00,
        currentPrice: 155.00,
        entryDate: new Date(),
        stopLoss: 140.00,
        profitTargets: [160.00],
        unrealizedPnL: 500.00,
        realizedPnL: 0,
        exitCriteria: [],
        sector: 'Technology',
        lastUpdated: new Date()
      });

      await repository.create({
        symbol: 'GOOGL',
        quantity: 25,
        entryPrice: 2500.00,
        currentPrice: 2600.00,
        entryDate: new Date(),
        stopLoss: 2300.00,
        profitTargets: [2700.00],
        unrealizedPnL: 2500.00,
        realizedPnL: 0,
        exitCriteria: [],
        sector: 'Technology',
        lastUpdated: new Date()
      });

      await repository.create({
        symbol: 'JPM',
        quantity: 0, // Closed position
        entryPrice: 140.00,
        currentPrice: 145.00,
        entryDate: new Date(),
        stopLoss: 130.00,
        profitTargets: [150.00],
        unrealizedPnL: 0,
        realizedPnL: 500.00,
        exitCriteria: [],
        sector: 'Financial',
        lastUpdated: new Date()
      });
    });

    it('should get positions by portfolio', async () => {
      const positions = await repository.getByPortfolio('default');
      expect(positions).toHaveLength(3);
    });

    it('should get position by symbol', async () => {
      const position = await repository.getBySymbol('default', 'AAPL');
      expect(position).toBeDefined();
      expect(position!.symbol).toBe('AAPL');
    });

    it('should get only open positions', async () => {
      const openPositions = await repository.getOpenPositions('default');
      expect(openPositions).toHaveLength(2); // AAPL and GOOGL
      expect(openPositions.every(p => p.quantity > 0)).toBe(true);
    });

    it('should get positions by sector', async () => {
      const techPositions = await repository.getBySector('default', 'Technology');
      expect(techPositions).toHaveLength(2); // AAPL and GOOGL
    });

    it('should get sector exposure', async () => {
      const exposure = await repository.getSectorExposure('default');
      
      expect(exposure['Technology']).toBeDefined();
      expect(exposure['Technology']).toBe(15500 + 65000); // AAPL: 100*155 + GOOGL: 25*2600
      expect(exposure['Financial']).toBeUndefined(); // JPM is closed (quantity = 0)
    });

    it('should get largest position', async () => {
      const largest = await repository.getLargestPosition('default');
      
      expect(largest).toBeDefined();
      expect(largest!.symbol).toBe('GOOGL');
      expect(largest!.value).toBe(65000); // 25 * 2600
    });
  });

  describe('position updates', () => {
    let positionId: string;

    beforeEach(async () => {
      const position = await repository.create({
        symbol: 'TSLA',
        quantity: 50,
        entryPrice: 800.00,
        currentPrice: 820.00,
        entryDate: new Date(),
        stopLoss: 750.00,
        profitTargets: [850.00],
        unrealizedPnL: 1000.00,
        realizedPnL: 0,
        exitCriteria: [],
        sector: 'Automotive',
        lastUpdated: new Date()
      });
      positionId = position.id;
    });

    it('should update position price and PnL', async () => {
      const updated = await repository.updatePrice(positionId, 840.00, 2000.00);
      
      expect(updated.currentPrice).toBe(840.00);
      expect(updated.unrealizedPnL).toBe(2000.00);
      expect(updated.lastUpdated).toBeInstanceOf(Date);
    });

    it('should close position', async () => {
      const closed = await repository.closePosition(positionId, 1500.00);
      
      expect(closed.quantity).toBe(0);
      expect(closed.realizedPnL).toBe(1500.00);
    });

    it('should update position fields', async () => {
      const updated = await repository.update(positionId, {
        stopLoss: 780.00,
        profitTargets: [860.00, 880.00]
      });
      
      expect(updated.stopLoss).toBe(780.00);
      expect(updated.profitTargets).toEqual([860.00, 880.00]);
    });
  });
});