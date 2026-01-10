/**
 * Database connection tests
 */

import { DatabaseConnection } from '../connection';
import fs from 'fs';
import path from 'path';

describe('DatabaseConnection', () => {
  let db: DatabaseConnection;
  const testDbPath = path.join(__dirname, 'test.db');

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
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

  describe('initialization', () => {
    it('should initialize database and create tables', async () => {
      expect(db.isConnected()).toBe(true);
      
      // Check if tables were created
      const tables = await db.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);
      
      const tableNames = tables.map((t: any) => t.name);
      expect(tableNames).toContain('portfolios');
      expect(tableNames).toContain('positions');
      expect(tableNames).toContain('trades');
      expect(tableNames).toContain('execution_logs');
      expect(tableNames).toContain('llm_interactions');
    });

    it('should create default portfolio', async () => {
      const portfolio = await db.get(`SELECT * FROM portfolios WHERE id = 'default'`);
      expect(portfolio).toBeDefined();
      expect((portfolio as any).total_value).toBe(100000);
      expect((portfolio as any).cash_balance).toBe(100000);
    });
  });

  describe('basic operations', () => {
    it('should execute run operations', async () => {
      const result = await db.run(`
        INSERT INTO portfolios (id, total_value, cash_balance) 
        VALUES ('test', 50000, 50000)
      `);
      
      expect(result.changes).toBe(1);
    });

    it('should execute get operations', async () => {
      await db.run(`
        INSERT INTO portfolios (id, total_value, cash_balance) 
        VALUES ('test', 50000, 50000)
      `);
      
      const portfolio = await db.get(`SELECT * FROM portfolios WHERE id = 'test'`);
      expect(portfolio).toBeDefined();
      expect((portfolio as any).id).toBe('test');
    });

    it('should execute all operations', async () => {
      await db.run(`
        INSERT INTO portfolios (id, total_value, cash_balance) 
        VALUES ('test1', 50000, 50000)
      `);
      await db.run(`
        INSERT INTO portfolios (id, total_value, cash_balance) 
        VALUES ('test2', 60000, 60000)
      `);
      
      const portfolios = await db.all(`SELECT * FROM portfolios WHERE id LIKE 'test%'`);
      expect(portfolios).toHaveLength(2);
    });
  });

  describe('transactions', () => {
    it('should execute successful transactions', async () => {
      const statements = [
        { sql: `INSERT INTO portfolios (id, total_value, cash_balance) VALUES ('test1', 50000, 50000)` },
        { sql: `INSERT INTO portfolios (id, total_value, cash_balance) VALUES ('test2', 60000, 60000)` }
      ];
      
      await db.transaction(statements);
      
      const portfolios = await db.all(`SELECT * FROM portfolios WHERE id LIKE 'test%'`);
      expect(portfolios).toHaveLength(2);
    });

    it('should rollback failed transactions', async () => {
      const statements = [
        { sql: `INSERT INTO portfolios (id, total_value, cash_balance) VALUES ('test1', 50000, 50000)` },
        { sql: `INSERT INTO invalid_table (id) VALUES ('test')` } // This will fail
      ];
      
      await expect(db.transaction(statements)).rejects.toThrow();
      
      const portfolios = await db.all(`SELECT * FROM portfolios WHERE id = 'test1'`);
      expect(portfolios).toHaveLength(0);
    });
  });

  describe('backup', () => {
    it('should create database backup', async () => {
      // Add some data
      await db.run(`
        INSERT INTO portfolios (id, total_value, cash_balance) 
        VALUES ('test', 50000, 50000)
      `);
      
      const backupPath = await db.backup();
      expect(fs.existsSync(backupPath)).toBe(true);
      
      // Clean up backup
      fs.unlinkSync(backupPath);
    });
  });

  describe('statistics', () => {
    it('should return database statistics', async () => {
      const stats = await db.getStats();
      
      expect(stats.tables).toBeDefined();
      expect(stats.tables['portfolios']).toBe(1); // Default portfolio
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(typeof stats.lastModified.getTime).toBe('function');
    });
  });
});