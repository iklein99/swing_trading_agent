/**
 * Logging repository for database operations
 */

import { 
  ExecutionLog, 
  LLMInteraction, 
  LogQuery, 
  LogLevel, 
  ComponentType,
  TradingCycleLog 
} from '../../../../shared/src/types/logging';
import { DatabaseConnection } from '../connection';

export class LoggingRepository {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * Save execution log
   */
  async saveExecutionLog(log: ExecutionLog): Promise<void> {
    const sql = `
      INSERT INTO execution_logs (
        id, timestamp, component, action, details, level, 
        execution_cycle_id, duration, success, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.run(sql, [
      log.id,
      log.timestamp.toISOString(),
      log.component,
      log.action,
      JSON.stringify(log.details),
      log.level,
      log.executionCycleId,
      log.duration || null,
      log.success ? 1 : 0,
      log.error || null
    ]);
  }

  /**
   * Save LLM interaction
   */
  async saveLLMInteraction(interaction: LLMInteraction): Promise<void> {
    const sql = `
      INSERT INTO llm_interactions (
        id, timestamp, prompt, response, model, processing_time,
        prompt_tokens, completion_tokens, total_tokens, cost,
        associated_signal_id, associated_trade_id, success, error, retry_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.run(sql, [
      interaction.id,
      interaction.timestamp.toISOString(),
      interaction.prompt,
      interaction.response,
      interaction.model,
      interaction.processingTime,
      interaction.tokenUsage.promptTokens,
      interaction.tokenUsage.completionTokens,
      interaction.tokenUsage.totalTokens,
      interaction.tokenUsage.cost || null,
      interaction.associatedSignalId || null,
      interaction.associatedTradeId || null,
      interaction.success ? 1 : 0,
      interaction.error || null,
      interaction.retryCount
    ]);
  }

  /**
   * Save trading cycle log
   */
  async saveTradingCycleLog(cycleLog: TradingCycleLog): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO trading_cycle_logs (
        id, cycle_id, start_time, end_time, duration, phase,
        buy_signals_generated, sell_signals_generated, exit_criteria_triggered,
        trades_executed, errors, success
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.run(sql, [
      cycleLog.id,
      cycleLog.cycleId,
      cycleLog.startTime.toISOString(),
      cycleLog.endTime?.toISOString() || null,
      cycleLog.duration || null,
      cycleLog.phase,
      cycleLog.buySignalsGenerated,
      cycleLog.sellSignalsGenerated,
      cycleLog.exitCriteriaTriggered,
      cycleLog.tradesExecuted,
      JSON.stringify(cycleLog.errors),
      cycleLog.success ? 1 : 0
    ]);
  }

  /**
   * Query execution logs
   */
  async getExecutionLogs(query: LogQuery): Promise<ExecutionLog[]> {
    let sql = `SELECT * FROM execution_logs`;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (query.startDate) {
      conditions.push('timestamp >= ?');
      params.push(query.startDate.toISOString());
    }

    if (query.endDate) {
      conditions.push('timestamp <= ?');
      params.push(query.endDate.toISOString());
    }

    if (query.level) {
      conditions.push('level = ?');
      params.push(query.level);
    }

    if (query.component) {
      conditions.push('component = ?');
      params.push(query.component);
    }

    if (query.executionCycleId) {
      conditions.push('execution_cycle_id = ?');
      params.push(query.executionCycleId);
    }

    if (query.search) {
      conditions.push('(action LIKE ? OR details LIKE ? OR error LIKE ?)');
      const searchTerm = `%${query.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const sortBy = query.sortBy || 'timestamp';
    const sortOrder = query.sortOrder || 'desc';
    sql += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

    if (query.limit) {
      sql += ` LIMIT ?`;
      params.push(query.limit);
    }

    if (query.offset) {
      sql += ` OFFSET ?`;
      params.push(query.offset);
    }

    const rows = await this.db.all(sql, params);
    return rows.map(row => this.deserializeExecutionLog(row));
  }

  /**
   * Get LLM interactions
   */
  async getLLMInteractions(
    startDate?: Date, 
    endDate?: Date, 
    limit?: number
  ): Promise<LLMInteraction[]> {
    let sql = `SELECT * FROM llm_interactions`;
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

    sql += ` ORDER BY timestamp DESC`;

    if (limit) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }

    const rows = await this.db.all(sql, params);
    return rows.map(row => this.deserializeLLMInteraction(row));
  }

  /**
   * Get trading cycle logs
   */
  async getTradingCycleLogs(limit?: number): Promise<TradingCycleLog[]> {
    let sql = `SELECT * FROM trading_cycle_logs ORDER BY start_time DESC`;
    const params: unknown[] = [];

    if (limit) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }

    const rows = await this.db.all(sql, params);
    return rows.map(row => this.deserializeTradingCycleLog(row));
  }

  /**
   * Get log statistics
   */
  async getLogStats(startDate?: Date, endDate?: Date): Promise<LogStats> {
    let sql = `
      SELECT 
        COUNT(*) as total_logs,
        COUNT(CASE WHEN level = 'ERROR' THEN 1 END) as error_count,
        COUNT(CASE WHEN level = 'WARN' THEN 1 END) as warning_count,
        COUNT(CASE WHEN level = 'INFO' THEN 1 END) as info_count,
        COUNT(CASE WHEN level = 'DEBUG' THEN 1 END) as debug_count,
        MIN(timestamp) as first_log,
        MAX(timestamp) as last_log
      FROM execution_logs
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

    const row = await this.db.get<any>(sql, params);

    return {
      totalLogs: row?.total_logs || 0,
      errorCount: row?.error_count || 0,
      warningCount: row?.warning_count || 0,
      infoCount: row?.info_count || 0,
      debugCount: row?.debug_count || 0,
      firstLog: row?.first_log ? new Date(row.first_log) : null,
      lastLog: row?.last_log ? new Date(row.last_log) : null
    };
  }

  /**
   * Clean up old logs
   */
  async cleanupLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const tables = [
      { name: 'execution_logs', timestampCol: 'timestamp' },
      { name: 'llm_interactions', timestampCol: 'timestamp' },
      { name: 'trading_cycle_logs', timestampCol: 'start_time' }
    ];
    let totalDeleted = 0;

    for (const table of tables) {
      const sql = `DELETE FROM ${table.name} WHERE ${table.timestampCol} < ?`;
      const result = await this.db.run(sql, [cutoffDate.toISOString()]);
      totalDeleted += result.changes || 0;
    }

    return totalDeleted;
  }

  /**
   * Deserialize execution log from database row
   */
  private deserializeExecutionLog(row: any): ExecutionLog {
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      component: row.component as ComponentType,
      action: row.action,
      details: JSON.parse(row.details || '{}'),
      level: row.level as LogLevel,
      executionCycleId: row.execution_cycle_id,
      duration: row.duration,
      success: Boolean(row.success),
      error: row.error
    };
  }

  /**
   * Deserialize LLM interaction from database row
   */
  private deserializeLLMInteraction(row: any): LLMInteraction {
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      prompt: row.prompt,
      response: row.response,
      model: row.model,
      processingTime: row.processing_time,
      tokenUsage: {
        promptTokens: row.prompt_tokens,
        completionTokens: row.completion_tokens,
        totalTokens: row.total_tokens,
        cost: row.cost
      },
      associatedSignalId: row.associated_signal_id,
      associatedTradeId: row.associated_trade_id,
      success: Boolean(row.success),
      error: row.error,
      retryCount: row.retry_count
    };
  }

  /**
   * Deserialize trading cycle log from database row
   */
  private deserializeTradingCycleLog(row: any): TradingCycleLog {
    const result: TradingCycleLog = {
      id: row.id,
      cycleId: row.cycle_id,
      startTime: new Date(row.start_time),
      duration: row.duration,
      phase: row.phase,
      buySignalsGenerated: row.buy_signals_generated,
      sellSignalsGenerated: row.sell_signals_generated,
      exitCriteriaTriggered: row.exit_criteria_triggered,
      tradesExecuted: row.trades_executed,
      errors: JSON.parse(row.errors || '[]'),
      success: Boolean(row.success)
    };
    
    if (row.end_time) {
      result.endTime = new Date(row.end_time);
    }
    
    return result;
  }
}

export interface LogStats {
  totalLogs: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  debugCount: number;
  firstLog: Date | null;
  lastLog: Date | null;
}