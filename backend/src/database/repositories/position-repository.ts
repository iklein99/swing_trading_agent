/**
 * Position repository for database operations
 */

import { BaseRepository } from './base-repository';
import { Position } from '../../../../shared/src/types/portfolio';
import { DatabaseConnection } from '../connection';

export class PositionRepository extends BaseRepository<Position> {
  constructor(db: DatabaseConnection) {
    super(db, 'positions');
  }

  /**
   * Get all positions for a portfolio
   */
  async getByPortfolio(portfolioId: string): Promise<Position[]> {
    return this.findMany({ portfolio_id: portfolioId });
  }

  /**
   * Get position by symbol for a portfolio
   */
  async getBySymbol(portfolioId: string, symbol: string): Promise<Position | null> {
    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE portfolio_id = ? AND symbol = ? 
      LIMIT 1
    `;
    
    const row = await this.queryOne(sql, [portfolioId, symbol]);
    return row ? this.deserializeRow(row) : null;
  }

  /**
   * Get all open positions (quantity > 0)
   */
  async getOpenPositions(portfolioId: string): Promise<Position[]> {
    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE portfolio_id = ? AND quantity > 0
      ORDER BY entry_date DESC
    `;
    
    const rows = await this.query(sql, [portfolioId]);
    return rows.map(row => this.deserializeRow(row));
  }

  /**
   * Update position price and PnL
   */
  async updatePrice(id: string, currentPrice: number, unrealizedPnL: number): Promise<Position> {
    const sql = `UPDATE ${this.tableName} SET current_price = ?, unrealized_pnl = ?, last_updated = ? WHERE id = ?`;
    await this.db.run(sql, [currentPrice, unrealizedPnL, new Date().toISOString(), id]);
    
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Position with id ${id} not found`);
    }
    return updated;
  }

  /**
   * Close position (set quantity to 0 and update realized PnL)
   */
  async closePosition(id: string, realizedPnL: number): Promise<Position> {
    const sql = `UPDATE ${this.tableName} SET quantity = 0, realized_pnl = ?, last_updated = ? WHERE id = ?`;
    await this.db.run(sql, [realizedPnL, new Date().toISOString(), id]);
    
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Position with id ${id} not found`);
    }
    return updated;
  }

  /**
   * Override update to handle field mapping
   */
  override async update(id: string, updates: Partial<Omit<Position, 'id'>>): Promise<Position> {
    const dbUpdates: Record<string, unknown> = {};
    
    // Map specific fields
    if (updates.stopLoss !== undefined) dbUpdates['stop_loss'] = updates.stopLoss;
    if (updates.profitTargets !== undefined) dbUpdates['profit_targets'] = JSON.stringify(updates.profitTargets);
    if (updates.currentPrice !== undefined) dbUpdates['current_price'] = updates.currentPrice;
    if (updates.unrealizedPnL !== undefined) dbUpdates['unrealized_pnl'] = updates.unrealizedPnL;
    if (updates.realizedPnL !== undefined) dbUpdates['realized_pnl'] = updates.realizedPnL;
    if (updates.sector !== undefined) dbUpdates['sector'] = updates.sector;
    
    dbUpdates['last_updated'] = new Date().toISOString();

    const columns = Object.keys(dbUpdates);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = columns.map(col => dbUpdates[col]);

    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    await this.db.run(sql, [...values, id]);
    
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Position with id ${id} not found`);
    }
    return updated;
  }

  /**
   * Get positions by sector
   */
  async getBySector(portfolioId: string, sector: string): Promise<Position[]> {
    return this.findMany({ portfolio_id: portfolioId, sector });
  }

  /**
   * Get sector exposure for portfolio
   */
  async getSectorExposure(portfolioId: string): Promise<Record<string, number>> {
    const sql = `
      SELECT sector, SUM(quantity * current_price) as exposure
      FROM ${this.tableName}
      WHERE portfolio_id = ? AND quantity > 0 AND sector IS NOT NULL
      GROUP BY sector
    `;
    
    const rows = await this.query<{ sector: string; exposure: number }>(sql, [portfolioId]);
    
    const exposure: Record<string, number> = {};
    for (const row of rows) {
      exposure[row.sector] = row.exposure;
    }
    
    return exposure;
  }

  /**
   * Get largest position by value
   */
  async getLargestPosition(portfolioId: string): Promise<{ symbol: string; value: number } | null> {
    const sql = `
      SELECT symbol, (quantity * current_price) as value
      FROM ${this.tableName}
      WHERE portfolio_id = ? AND quantity > 0
      ORDER BY value DESC
      LIMIT 1
    `;
    
    const row = await this.queryOne<{ symbol: string; value: number }>(sql, [portfolioId]);
    return row || null;
  }

  /**
   * Create position with database-specific field mapping
   */
  override async create(data: Omit<Position, 'id'>): Promise<Position> {
    // Map the Position interface to database columns
    const dbData = {
      portfolio_id: 'default', // Default portfolio for now
      symbol: data.symbol,
      quantity: data.quantity,
      entry_price: data.entryPrice,
      current_price: data.currentPrice,
      entry_date: data.entryDate.toISOString(),
      stop_loss: data.stopLoss,
      profit_targets: JSON.stringify(data.profitTargets),
      unrealized_pnl: data.unrealizedPnL,
      realized_pnl: data.realizedPnL,
      sector: data.sector,
      last_updated: data.lastUpdated.toISOString()
    };

    const id = require('uuid').v4();
    const columns = Object.keys(dbData);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(col => (dbData as any)[col]);

    const sql = `INSERT INTO ${this.tableName} (id, ${columns.join(', ')}) VALUES (?, ${placeholders})`;
    
    await this.db.run(sql, [id, ...values]);
    
    const created = await this.findById(id);
    if (!created) {
      throw new Error(`Failed to create position in ${this.tableName}`);
    }
    
    return created;
  }

  /**
   * Override deserializeRow to handle database column mapping
   */
  protected override deserializeRow(row: any): Position {
    // Map database columns back to Position interface
    return {
      id: row.id,
      symbol: row.symbol,
      quantity: row.quantity,
      entryPrice: row.entry_price,
      currentPrice: row.current_price,
      entryDate: new Date(row.entry_date),
      stopLoss: row.stop_loss,
      profitTargets: JSON.parse(row.profit_targets || '[]'),
      unrealizedPnL: row.unrealized_pnl,
      realizedPnL: row.realized_pnl,
      exitCriteria: [], // Will be loaded separately
      sector: row.sector,
      lastUpdated: new Date(row.last_updated)
    } as Position;
  }
}