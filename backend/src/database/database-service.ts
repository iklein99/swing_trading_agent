/**
 * Main database service implementing the DatabaseInterface
 */

import { DatabaseInterface, TradeHistoryFilter } from '../../../shared/src/types/interfaces';
import { Trade } from '../../../shared/src/types/trading';
import { Position, PortfolioSnapshot } from '../../../shared/src/types/portfolio';
import { ExecutionLog, LLMInteraction, LogQuery } from '../../../shared/src/types/logging';

import { DatabaseConnection, getDatabase } from './connection';
import { PortfolioRepository } from './repositories/portfolio-repository';
import { PositionRepository } from './repositories/position-repository';
import { TradeRepository } from './repositories/trade-repository';
import { LoggingRepository } from './repositories/logging-repository';

export class DatabaseService implements DatabaseInterface {
  private db: DatabaseConnection;
  private portfolioRepo: PortfolioRepository;
  private positionRepo: PositionRepository;
  private tradeRepo: TradeRepository;
  private loggingRepo: LoggingRepository;

  constructor(db?: DatabaseConnection) {
    this.db = db || getDatabase();
    this.portfolioRepo = new PortfolioRepository(this.db);
    this.positionRepo = new PositionRepository(this.db);
    this.tradeRepo = new TradeRepository(this.db);
    this.loggingRepo = new LoggingRepository(this.db);
  }

  // Generic CRUD operations
  async create<T>(table: string, data: Omit<T, 'id'>): Promise<T> {
    const repo = this.getRepository(table);
    return repo.create(data) as Promise<T>;
  }

  async findById<T>(table: string, id: string): Promise<T | null> {
    const repo = this.getRepository(table);
    return repo.findById(id);
  }

  async findMany<T>(table: string, query?: Record<string, unknown>): Promise<T[]> {
    const repo = this.getRepository(table);
    return repo.findMany(query);
  }

  async update<T>(table: string, id: string, updates: Partial<T>): Promise<T> {
    const repo = this.getRepository(table);
    return repo.update(id, updates);
  }

  async delete(table: string, id: string): Promise<boolean> {
    const repo = this.getRepository(table);
    return repo.delete(id);
  }

  // Trading-specific operations
  async saveTrade(trade: Trade): Promise<Trade> {
    return this.tradeRepo.create(trade);
  }

  async savePosition(position: Position): Promise<Position> {
    return this.positionRepo.create(position);
  }

  async savePortfolioSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
    return this.portfolioRepo.saveSnapshot(snapshot);
  }

  async getTradeHistory(filters?: TradeHistoryFilter): Promise<Trade[]> {
    return this.tradeRepo.getTradeHistory(filters);
  }

  async getPositionHistory(symbol?: string): Promise<Position[]> {
    if (symbol) {
      return this.positionRepo.findMany({ symbol });
    }
    return this.positionRepo.findMany();
  }

  // Logging operations
  async saveLog(log: ExecutionLog): Promise<void> {
    return this.loggingRepo.saveExecutionLog(log);
  }

  async saveLLMInteraction(interaction: LLMInteraction): Promise<void> {
    return this.loggingRepo.saveLLMInteraction(interaction);
  }

  async getLogs(query: LogQuery): Promise<ExecutionLog[]> {
    return this.loggingRepo.getExecutionLogs(query);
  }

  // Maintenance operations
  async cleanup(retentionDays: number): Promise<void> {
    await this.loggingRepo.cleanupLogs(retentionDays);
    await this.portfolioRepo.cleanupSnapshots('default', retentionDays);
  }

  async backup(): Promise<string> {
    return this.db.backup();
  }

  async migrate(): Promise<void> {
    return this.db.migrate();
  }

  // Repository access methods
  getPortfolioRepository(): PortfolioRepository {
    return this.portfolioRepo;
  }

  getPositionRepository(): PositionRepository {
    return this.positionRepo;
  }

  getTradeRepository(): TradeRepository {
    return this.tradeRepo;
  }

  getLoggingRepository(): LoggingRepository {
    return this.loggingRepo;
  }

  // Database connection methods
  async beginTransaction(): Promise<void> {
    await this.db.run('BEGIN TRANSACTION');
  }

  async commitTransaction(): Promise<void> {
    await this.db.run('COMMIT');
  }

  async rollbackTransaction(): Promise<void> {
    await this.db.run('ROLLBACK');
  }

  async close(): Promise<void> {
    return this.db.close();
  }

  isConnected(): boolean {
    return this.db.isConnected();
  }

  /**
   * Get repository instance for table
   */
  private getRepository(table: string): any {
    switch (table) {
      case 'portfolios':
        return this.portfolioRepo;
      case 'positions':
        return this.positionRepo;
      case 'trades':
        return this.tradeRepo;
      default:
        throw new Error(`No repository found for table: ${table}`);
    }
  }

  /**
   * Execute raw SQL query (for advanced operations)
   */
  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.all<T>(sql, params);
  }

  /**
   * Execute raw SQL query returning single result
   */
  async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    const result = await this.db.get<T>(sql, params);
    return result || null;
  }

  /**
   * Get database statistics
   */
  async getStats() {
    return this.db.getStats();
  }
}

// Singleton instance
let dbServiceInstance: DatabaseService | null = null;

/**
 * Get singleton database service instance
 */
export function getDatabaseService(): DatabaseService {
  if (!dbServiceInstance) {
    dbServiceInstance = new DatabaseService();
  }
  return dbServiceInstance;
}

/**
 * Initialize database service (should be called once at startup)
 */
export async function initializeDatabaseService(dbPath?: string): Promise<DatabaseService> {
  if (dbServiceInstance) {
    await dbServiceInstance.close();
  }
  
  const db = await require('./connection').initializeDatabase(dbPath);
  dbServiceInstance = new DatabaseService(db);
  return dbServiceInstance;
}