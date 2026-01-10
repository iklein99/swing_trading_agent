/**
 * Base repository class with common CRUD operations
 */

import { DatabaseConnection } from '../connection';
import { v4 as uuidv4 } from 'uuid';

export abstract class BaseRepository<T extends { id: string }> {
  protected db: DatabaseConnection;
  protected tableName: string;

  constructor(db: DatabaseConnection, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  /**
   * Create a new record
   */
  async create(data: Omit<T, 'id'>): Promise<T> {
    const id = uuidv4();
    const record = { ...data, id } as T;
    
    const columns = Object.keys(record);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(col => this.serializeValue((record as any)[col]));

    const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    await this.db.run(sql, values);
    
    const created = await this.findById(id);
    if (!created) {
      throw new Error(`Failed to create record in ${this.tableName}`);
    }
    
    return created;
  }

  /**
   * Find record by ID
   */
  async findById(id: string): Promise<T | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const row = await this.db.get(sql, [id]);
    
    return row ? this.deserializeRow(row) : null;
  }

  /**
   * Find multiple records with optional conditions
   */
  async findMany(conditions?: Record<string, unknown>, limit?: number, offset?: number): Promise<T[]> {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (conditions && Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map(key => `${key} = ?`)
        .join(' AND ');
      sql += ` WHERE ${whereClause}`;
      params.push(...Object.values(conditions).map(val => this.serializeValue(val)));
    }

    // Only add ORDER BY if the table has a timestamp-like column
    if (this.tableName === 'portfolios') {
      sql += ` ORDER BY created_at DESC`;
    } else if (this.tableName === 'trades') {
      sql += ` ORDER BY timestamp DESC`;
    } else {
      sql += ` ORDER BY id DESC`;
    }

    if (limit) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }

    if (offset) {
      sql += ` OFFSET ?`;
      params.push(offset);
    }

    const rows = await this.db.all(sql, params);
    return rows.map(row => this.deserializeRow(row));
  }

  /**
   * Update record by ID
   */
  async update(id: string, updates: Partial<Omit<T, 'id'>>): Promise<T> {
    // Convert camelCase to snake_case for database columns
    const dbUpdates: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(updates)) {
      // Convert camelCase to snake_case
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      dbUpdates[dbKey] = this.serializeValue(value);
    }
    
    // Always update last_updated timestamp if the table has this column
    if (this.tableName === 'portfolios' || this.tableName === 'positions') {
      dbUpdates['last_updated'] = new Date().toISOString();
    }

    const columns = Object.keys(dbUpdates);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = columns.map(col => dbUpdates[col]);

    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    
    await this.db.run(sql, [...values, id]);
    
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Record with id ${id} not found in ${this.tableName}`);
    }
    
    return updated;
  }

  /**
   * Delete record by ID
   */
  async delete(id: string): Promise<boolean> {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    const result = await this.db.run(sql, [id]);
    
    return (result.changes || 0) > 0;
  }

  /**
   * Count records with optional conditions
   */
  async count(conditions?: Record<string, unknown>): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (conditions && Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map(key => `${key} = ?`)
        .join(' AND ');
      sql += ` WHERE ${whereClause}`;
      params.push(...Object.values(conditions).map(val => this.serializeValue(val)));
    }

    const result = await this.db.get<{ count: number }>(sql, params);
    return result?.count || 0;
  }

  /**
   * Check if record exists
   */
  async exists(id: string): Promise<boolean> {
    const sql = `SELECT 1 FROM ${this.tableName} WHERE id = ? LIMIT 1`;
    const result = await this.db.get(sql, [id]);
    return !!result;
  }

  /**
   * Execute custom SQL query
   */
  protected async query<R = unknown>(sql: string, params: unknown[] = []): Promise<R[]> {
    return this.db.all<R>(sql, params);
  }

  /**
   * Execute custom SQL query returning single result
   */
  protected async queryOne<R = unknown>(sql: string, params: unknown[] = []): Promise<R | null> {
    const result = await this.db.get<R>(sql, params);
    return result || null;
  }

  /**
   * Serialize value for database storage
   */
  protected serializeValue(value: unknown): unknown {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return value;
  }

  /**
   * Deserialize database row to typed object
   */
  protected deserializeRow(row: any): T {
    const result = { ...row };
    
    // Convert date strings back to Date objects
    for (const [key, value] of Object.entries(result)) {
      if (typeof value === 'string') {
        // Check if it's an ISO date string
        if (this.isISODateString(value)) {
          result[key] = new Date(value);
        }
        // Try to parse JSON strings
        else if (this.isJSONString(value)) {
          try {
            result[key] = JSON.parse(value);
          } catch {
            // Keep as string if parsing fails
          }
        }
      }
    }
    
    return result as T;
  }

  /**
   * Check if string is ISO date format
   */
  private isISODateString(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(value);
  }

  /**
   * Check if string is JSON format
   */
  private isJSONString(value: string): boolean {
    return (value.startsWith('{') && value.endsWith('}')) || 
           (value.startsWith('[') && value.endsWith(']'));
  }

  /**
   * Begin transaction
   */
  async beginTransaction(): Promise<void> {
    await this.db.run('BEGIN TRANSACTION');
  }

  /**
   * Commit transaction
   */
  async commitTransaction(): Promise<void> {
    await this.db.run('COMMIT');
  }

  /**
   * Rollback transaction
   */
  async rollbackTransaction(): Promise<void> {
    await this.db.run('ROLLBACK');
  }
}