/**
 * Trade repository for database operations
 */

import { BaseRepository } from './base-repository';
import { Trade, TradeAction, TradeStatus } from '../../../../shared/src/types/trading';
import { DatabaseConnection } from '../connection';

export interface TradeHistoryFilter {
  symbol?: string;
  action?: TradeAction;
  startDate?: Date;
  endDate?: Date;
  status?: TradeStatus;
  limit?: number;
  offset?: number;
}

export class TradeRepository extends BaseRepository<Trade> {
  constructor(db: DatabaseConnection) {
    super(db, 'trades');
  }

  /**
   * Create trade with database-specific field mapping
   */
  override async create(data: Omit<Trade, 'id'>): Promise<Trade> {
    // Map the Trade interface to database columns
    const dbData = {
      symbol: data.symbol,
      action: data.action,
      quantity: data.quantity,
      price: data.price,
      timestamp: data.timestamp.toISOString(),
      reasoning: data.reasoning,
      signal_id: data.signalId,
      fees: data.fees,
      status: data.status
    };

    const id = require('uuid').v4();
    const columns = Object.keys(dbData);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(col => (dbData as any)[col]);

    const sql = `INSERT INTO ${this.tableName} (id, ${columns.join(', ')}) VALUES (?, ${placeholders})`;
    
    await this.db.run(sql, [id, ...values]);
    
    const created = await this.findById(id);
    if (!created) {
      throw new Error(`Failed to create trade in ${this.tableName}`);
    }
    
    return created;
  }

  /**
   * Override deserializeRow to handle database column mapping
   */
  protected override deserializeRow(row: any): Trade {
    return {
      id: row.id,
      symbol: row.symbol,
      action: row.action,
      quantity: row.quantity,
      price: row.price,
      timestamp: new Date(row.timestamp),
      reasoning: row.reasoning,
      signalId: row.signal_id,
      fees: row.fees,
      status: row.status
    } as Trade;
  }

  /**
   * Get trade history with filters
   */
  async getTradeHistory(filters: TradeHistoryFilter = {}): Promise<Trade[]> {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (filters.symbol) {
      conditions.push('symbol = ?');
      params.push(filters.symbol);
    }

    if (filters.action) {
      conditions.push('action = ?');
      params.push(filters.action);
    }

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.startDate) {
      conditions.push('timestamp >= ?');
      params.push(filters.startDate.toISOString());
    }

    if (filters.endDate) {
      conditions.push('timestamp <= ?');
      params.push(filters.endDate.toISOString());
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY timestamp DESC`;

    if (filters.limit) {
      sql += ` LIMIT ?`;
      params.push(filters.limit);
    }

    if (filters.offset) {
      sql += ` OFFSET ?`;
      params.push(filters.offset);
    }

    const rows = await this.query(sql, params);
    return rows.map(row => this.deserializeRow(row));
  }

  /**
   * Get trades by symbol
   */
  async getBySymbol(symbol: string, limit?: number): Promise<Trade[]> {
    const filter: TradeHistoryFilter = { symbol };
    if (limit !== undefined) {
      filter.limit = limit;
    }
    return this.getTradeHistory(filter);
  }

  /**
   * Get recent trades
   */
  async getRecentTrades(limit: number = 50): Promise<Trade[]> {
    return this.getTradeHistory({ limit });
  }

  /**
   * Get executed trades for a date range
   */
  async getExecutedTrades(startDate: Date, endDate: Date): Promise<Trade[]> {
    return this.getTradeHistory({ 
      status: 'EXECUTED', 
      startDate, 
      endDate 
    });
  }

  /**
   * Get pending trades
   */
  async getPendingTrades(): Promise<Trade[]> {
    return this.getTradeHistory({ status: 'PENDING' });
  }

  /**
   * Update trade status
   */
  async updateStatus(id: string, status: TradeStatus): Promise<Trade> {
    return this.update(id, { status });
  }

  /**
   * Get trade statistics
   */
  async getTradeStats(startDate?: Date, endDate?: Date): Promise<TradeStats> {
    let sql = `
      SELECT 
        COUNT(*) as total_trades,
        COUNT(CASE WHEN status = 'EXECUTED' THEN 1 END) as executed_trades,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_trades,
        COUNT(CASE WHEN action = 'BUY' THEN 1 END) as buy_trades,
        COUNT(CASE WHEN action = 'SELL' THEN 1 END) as sell_trades,
        SUM(fees) as total_fees,
        AVG(price) as average_price,
        MIN(timestamp) as first_trade,
        MAX(timestamp) as last_trade
      FROM ${this.tableName}
    `;
    
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (startDate) {
      conditions.push('timestamp >= ?');
      params.push(startDate.toISOString());
    }

    if (endDate) {
      conditions.push('timestamp <= ?');
      params.push(endDate.toISOString());
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const row = await this.queryOne<any>(sql, params);
    
    return {
      totalTrades: row?.total_trades || 0,
      executedTrades: row?.executed_trades || 0,
      failedTrades: row?.failed_trades || 0,
      buyTrades: row?.buy_trades || 0,
      sellTrades: row?.sell_trades || 0,
      totalFees: row?.total_fees || 0,
      averagePrice: row?.average_price || 0,
      firstTrade: row?.first_trade ? new Date(row.first_trade) : null,
      lastTrade: row?.last_trade ? new Date(row.last_trade) : null
    };
  }

  /**
   * Get daily trade volume
   */
  async getDailyVolume(date: Date): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const sql = `
      SELECT SUM(quantity * price) as volume
      FROM ${this.tableName}
      WHERE status = 'EXECUTED' 
        AND timestamp >= ? 
        AND timestamp <= ?
    `;

    const row = await this.queryOne<{ volume: number }>(sql, [
      startOfDay.toISOString(),
      endOfDay.toISOString()
    ]);

    return row?.volume || 0;
  }

  /**
   * Get trades by signal ID
   */
  async getBySignalId(signalId: string): Promise<Trade[]> {
    return this.findMany({ signal_id: signalId });
  }

  /**
   * Get most traded symbols
   */
  async getMostTradedSymbols(limit: number = 10): Promise<Array<{ symbol: string; count: number }>> {
    const sql = `
      SELECT symbol, COUNT(*) as count
      FROM ${this.tableName}
      WHERE status = 'EXECUTED'
      GROUP BY symbol
      ORDER BY count DESC
      LIMIT ?
    `;

    const rows = await this.query<{ symbol: string; count: number }>(sql, [limit]);
    return rows;
  }
}

export interface TradeStats {
  totalTrades: number;
  executedTrades: number;
  failedTrades: number;
  buyTrades: number;
  sellTrades: number;
  totalFees: number;
  averagePrice: number;
  firstTrade: Date | null;
  lastTrade: Date | null;
}