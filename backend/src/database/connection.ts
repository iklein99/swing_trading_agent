/**
 * Database connection and initialization utilities
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

export class DatabaseConnection {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'trading.db');
  }

  /**
   * Initialize database connection and run migrations
   */
  async initialize(): Promise<void> {
    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Create database connection
    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        throw new Error(`Failed to connect to database: ${err.message}`);
      }
    });

    // Enable foreign key constraints
    await this.run('PRAGMA foreign_keys = ON');
    
    // Run migrations
    await this.migrate();
  }

  /**
   * Run database migrations
   */
  async migrate(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into individual statements and execute
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (const statement of statements) {
      await this.run(statement);
    }
  }

  /**
   * Execute a SQL statement
   */
  async run(sql: string, params: unknown[] = []): Promise<sqlite3.RunResult> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  /**
   * Execute a SQL query and return a single row
   */
  async get<T = unknown>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.db!.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as T);
        }
      });
    });
  }

  /**
   * Execute a SQL query and return all rows
   */
  async all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  /**
   * Execute multiple SQL statements in a transaction
   */
  async transaction(statements: Array<{ sql: string; params?: unknown[] }>): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.run('BEGIN TRANSACTION');
    
    try {
      for (const { sql, params = [] } of statements) {
        await this.run(sql, params);
      }
      await this.run('COMMIT');
    } catch (error) {
      await this.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.db = null;
          resolve();
        }
      });
    });
  }

  /**
   * Get database instance (for advanced operations)
   */
  getDatabase(): sqlite3.Database {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Check if database is connected
   */
  isConnected(): boolean {
    return this.db !== null;
  }

  /**
   * Create a backup of the database
   */
  async backup(backupPath?: string): Promise<string> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultBackupPath = path.join(
      path.dirname(this.dbPath), 
      `trading_backup_${timestamp}.db`
    );
    
    const targetPath = backupPath || defaultBackupPath;
    
    // Simple file copy for SQLite backup
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(this.dbPath);
      const writeStream = fs.createWriteStream(targetPath);
      
      readStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', () => resolve(targetPath));
      
      readStream.pipe(writeStream);
    });
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<DatabaseStats> {
    const tables = await this.all<{ name: string }>(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);

    const stats: DatabaseStats = {
      tables: {},
      totalSize: 0,
      lastModified: new Date()
    };

    for (const table of tables) {
      const count = await this.get<{ count: number }>(`SELECT COUNT(*) as count FROM ${table.name}`);
      stats.tables[table.name] = count?.count || 0;
    }

    // Get file size
    try {
      const fileStats = fs.statSync(this.dbPath);
      stats.totalSize = fileStats.size;
      stats.lastModified = fileStats.mtime;
    } catch (error) {
      // File might not exist yet
    }

    return stats;
  }
}

export interface DatabaseStats {
  tables: Record<string, number>;
  totalSize: number;
  lastModified: Date;
}

// Singleton instance
let dbInstance: DatabaseConnection | null = null;

/**
 * Get singleton database instance
 */
export function getDatabase(): DatabaseConnection {
  if (!dbInstance) {
    dbInstance = new DatabaseConnection();
  }
  return dbInstance;
}

/**
 * Initialize database (should be called once at startup)
 */
export async function initializeDatabase(dbPath?: string): Promise<DatabaseConnection> {
  if (dbInstance) {
    await dbInstance.close();
  }
  
  dbInstance = new DatabaseConnection(dbPath);
  await dbInstance.initialize();
  return dbInstance;
}