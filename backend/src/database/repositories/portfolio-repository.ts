/**
 * Portfolio repository for database operations
 */

import { BaseRepository } from './base-repository';
import { Portfolio, PortfolioSnapshot } from '../../../../shared/src/types/portfolio';
import { DatabaseConnection } from '../connection';

export class PortfolioRepository extends BaseRepository<Portfolio> {
  constructor(db: DatabaseConnection) {
    super(db, 'portfolios');
  }

  /**
   * Create portfolio with database-specific field mapping
   */
  override async create(data: Omit<Portfolio, 'id'>): Promise<Portfolio> {
    // Map the Portfolio interface to database columns
    const dbData = {
      total_value: data.totalValue,
      cash_balance: data.cashBalance,
      daily_pnl: data.dailyPnL,
      total_pnl: data.totalPnL,
      last_updated: data.lastUpdated.toISOString(),
      created_at: data.createdAt.toISOString()
    };

    const id = require('uuid').v4();
    const columns = Object.keys(dbData);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(col => (dbData as any)[col]);

    const sql = `INSERT INTO ${this.tableName} (id, ${columns.join(', ')}) VALUES (?, ${placeholders})`;
    
    await this.db.run(sql, [id, ...values]);
    
    const created = await this.findById(id);
    if (!created) {
      throw new Error(`Failed to create portfolio in ${this.tableName}`);
    }
    
    return created;
  }

  /**
   * Override deserializeRow to handle database column mapping
   */
  protected override deserializeRow(row: any): Portfolio {
    return {
      id: row.id,
      totalValue: row.total_value,
      cashBalance: row.cash_balance,
      positions: [], // Will be loaded separately
      dailyPnL: row.daily_pnl,
      totalPnL: row.total_pnl,
      lastUpdated: new Date(row.last_updated),
      createdAt: new Date(row.created_at)
    } as Portfolio;
  }

  /**
   * Get the default portfolio (creates if doesn't exist)
   */
  async getDefault(): Promise<Portfolio> {
    let portfolio = await this.findById('default');
    
    if (!portfolio) {
      // Create with specific ID
      const sql = `INSERT INTO ${this.tableName} (id, total_value, cash_balance, daily_pnl, total_pnl, last_updated, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      const now = new Date().toISOString();
      await this.db.run(sql, ['default', 100000, 100000, 0, 0, now, now]);
      
      portfolio = await this.findById('default');
      if (!portfolio) {
        throw new Error('Failed to create default portfolio');
      }
    }
    
    return portfolio;
  }

  /**
   * Update portfolio metrics
   */
  async updateMetrics(
    id: string, 
    totalValue: number, 
    cashBalance: number, 
    dailyPnL: number, 
    totalPnL: number
  ): Promise<Portfolio> {
    const sql = `UPDATE ${this.tableName} SET total_value = ?, cash_balance = ?, daily_pnl = ?, total_pnl = ?, last_updated = ? WHERE id = ?`;
    await this.db.run(sql, [totalValue, cashBalance, dailyPnL, totalPnL, new Date().toISOString(), id]);
    
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Portfolio with id ${id} not found`);
    }
    return updated;
  }

  /**
   * Save portfolio snapshot for historical tracking
   */
  async saveSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
    const sql = `
      INSERT INTO portfolio_snapshots (
        id, portfolio_id, timestamp, total_value, cash_balance, 
        position_count, daily_pnl, total_pnl, positions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.run(sql, [
      snapshot.id,
      snapshot.portfolioId,
      snapshot.timestamp.toISOString(),
      snapshot.totalValue,
      snapshot.cashBalance,
      snapshot.positionCount,
      snapshot.dailyPnL,
      snapshot.totalPnL,
      JSON.stringify(snapshot.positions)
    ]);
  }

  /**
   * Get portfolio snapshots for a date range
   */
  async getSnapshots(
    portfolioId: string, 
    startDate?: Date, 
    endDate?: Date, 
    limit?: number
  ): Promise<PortfolioSnapshot[]> {
    let sql = `
      SELECT * FROM portfolio_snapshots 
      WHERE portfolio_id = ?
    `;
    const params: unknown[] = [portfolioId];

    if (startDate) {
      sql += ` AND timestamp >= ?`;
      params.push(startDate.toISOString());
    }

    if (endDate) {
      sql += ` AND timestamp <= ?`;
      params.push(endDate.toISOString());
    }

    sql += ` ORDER BY timestamp DESC`;

    if (limit) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }

    const rows = await this.query(sql, params);
    return rows.map(row => this.deserializeSnapshotRow(row));
  }

  /**
   * Get latest portfolio snapshot
   */
  async getLatestSnapshot(portfolioId: string): Promise<PortfolioSnapshot | null> {
    const sql = `
      SELECT * FROM portfolio_snapshots 
      WHERE portfolio_id = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;
    
    const row = await this.queryOne(sql, [portfolioId]);
    return row ? this.deserializeSnapshotRow(row) : null;
  }

  /**
   * Deserialize portfolio snapshot from database row
   */
  private deserializeSnapshotRow(row: any): PortfolioSnapshot {
    return {
      id: row.id,
      portfolioId: row.portfolio_id,
      timestamp: new Date(row.timestamp),
      totalValue: row.total_value,
      cashBalance: row.cash_balance,
      positionCount: row.position_count,
      dailyPnL: row.daily_pnl,
      totalPnL: row.total_pnl,
      positions: JSON.parse(row.positions || '[]')
    };
  }

  /**
   * Clean up old snapshots (keep only last N days)
   */
  async cleanupSnapshots(portfolioId: string, retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const sql = `
      DELETE FROM portfolio_snapshots 
      WHERE portfolio_id = ? AND timestamp < ?
    `;
    
    const result = await this.db.run(sql, [portfolioId, cutoffDate.toISOString()]);
    return result.changes || 0;
  }

  /**
   * Get portfolio performance over time
   */
  async getPerformanceHistory(
    portfolioId: string, 
    days: number = 30
  ): Promise<Array<{ date: Date; totalValue: number; dailyPnL: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const sql = `
      SELECT timestamp as date, total_value, daily_pnl
      FROM portfolio_snapshots 
      WHERE portfolio_id = ? AND timestamp >= ?
      ORDER BY timestamp ASC
    `;

    const rows = await this.query<{ date: string; total_value: number; daily_pnl: number }>(
      sql, 
      [portfolioId, startDate.toISOString()]
    );

    return rows.map(row => ({
      date: new Date(row.date),
      totalValue: row.total_value,
      dailyPnL: row.daily_pnl
    }));
  }
}