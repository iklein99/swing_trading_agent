/**
 * Comprehensive logging service for the trading system
 * Provides structured logging with different levels, database storage, and search capabilities
 */

import { v4 as uuidv4 } from 'uuid';
import {
  LoggerInterface,
  SystemLog,
  ExecutionLog,
  LLMInteraction,
  TradingCycleLog,
  AuditLog,
  LogQuery,
  LogSummary,
  LogLevel,
  ComponentType
} from '../../../shared/src/types/logging';
import { LoggingRepository } from '../database/repositories/logging-repository';
import { DatabaseConnection } from '../database/connection';

export class LoggingService implements LoggerInterface {
  private repository: LoggingRepository;
  private component: ComponentType;
  private sessionId: string;
  private currentExecutionCycleId: string | undefined;

  constructor(db: DatabaseConnection, component: ComponentType) {
    this.repository = new LoggingRepository(db);
    this.component = component;
    this.sessionId = uuidv4();
  }

  /**
   * Set the current execution cycle ID for context
   */
  setExecutionCycleId(cycleId: string): void {
    this.currentExecutionCycleId = cycleId;
  }

  /**
   * Clear the current execution cycle ID
   */
  clearExecutionCycleId(): void {
    this.currentExecutionCycleId = undefined;
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    this.logMessage('DEBUG', message, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.logMessage('INFO', message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.logMessage('WARN', message, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    const errorMetadata = {
      ...metadata,
      ...(error && {
        errorName: error.name,
        errorMessage: error.message,
        stackTrace: error.stack
      })
    };
    this.logMessage('ERROR', message, errorMetadata);
  }

  /**
   * Log fatal error message
   */
  fatal(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    const errorMetadata = {
      ...metadata,
      ...(error && {
        errorName: error.name,
        errorMessage: error.message,
        stackTrace: error.stack
      })
    };
    this.logMessage('FATAL', message, errorMetadata);
  }

  /**
   * Log trading cycle information
   */
  async logTradingCycle(cycleLog: TradingCycleLog): Promise<void> {
    try {
      await this.repository.saveTradingCycleLog(cycleLog);
      this.info('Trading cycle logged', { cycleId: cycleLog.cycleId, phase: cycleLog.phase });
    } catch (error) {
      console.error('Failed to log trading cycle:', error);
      // Don't throw to avoid breaking the trading cycle
    }
  }

  /**
   * Log LLM interaction
   */
  async logLLMInteraction(interaction: LLMInteraction): Promise<void> {
    try {
      await this.repository.saveLLMInteraction(interaction);
      this.info('LLM interaction logged', { 
        interactionId: interaction.id,
        model: interaction.model,
        processingTime: interaction.processingTime,
        success: interaction.success
      });
    } catch (error) {
      console.error('Failed to log LLM interaction:', error);
      // Don't throw to avoid breaking the LLM service
    }
  }

  /**
   * Log execution details
   */
  async logExecution(log: ExecutionLog): Promise<void> {
    try {
      await this.repository.saveExecutionLog(log);
    } catch (error) {
      console.error('Failed to log execution:', error);
      // Don't throw to avoid breaking the execution flow
    }
  }

  /**
   * Log audit trail
   */
  async logAudit(audit: AuditLog): Promise<void> {
    try {
      // For now, store audit logs as execution logs with special action
      const executionLog: ExecutionLog = {
        id: audit.id,
        timestamp: audit.timestamp,
        component: 'API_SERVER',
        action: `AUDIT_${audit.action}`,
        details: {
          resource: audit.resource,
          resourceId: audit.resourceId,
          oldValue: audit.oldValue,
          newValue: audit.newValue,
          ipAddress: audit.ipAddress,
          userAgent: audit.userAgent,
          reason: audit.reason
        },
        level: audit.success ? 'INFO' : 'WARN',
        executionCycleId: this.currentExecutionCycleId || 'audit',
        success: audit.success
      };

      await this.logExecution(executionLog);
    } catch (error) {
      console.error('Failed to log audit:', error);
    }
  }

  /**
   * Query logs with filtering and pagination
   */
  async query(query: LogQuery): Promise<SystemLog[]> {
    try {
      const executionLogs = await this.repository.getExecutionLogs(query);
      
      // Convert ExecutionLog to SystemLog format
      return executionLogs.map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        level: log.level,
        component: log.component,
        message: log.action,
        metadata: {
          ...log.details,
          executionCycleId: log.executionCycleId,
          duration: log.duration,
          success: log.success,
          ...(log.error && { error: log.error })
        },
        ...(log.error && { stackTrace: log.error }),
        sessionId: this.sessionId
      }));
    } catch (error) {
      console.error('Failed to query logs:', error);
      return [];
    }
  }

  /**
   * Get log summary with statistics
   */
  async getSummary(startDate: Date, endDate: Date): Promise<LogSummary> {
    try {
      const stats = await this.repository.getLogStats(startDate, endDate);
      
      // Get component breakdown
      const componentQuery: LogQuery = {
        startDate,
        endDate,
        limit: 10000 // Large limit to get all logs for analysis
      };
      
      const logs = await this.repository.getExecutionLogs(componentQuery);
      
      // Calculate component breakdown
      const componentBreakdown: Record<ComponentType, number> = {
        TRADING_ENGINE: 0,
        SIGNAL_GENERATOR: 0,
        PORTFOLIO_MANAGER: 0,
        RISK_MANAGER: 0,
        MARKET_DATA_SERVICE: 0,
        LLM_SERVICE: 0,
        EXIT_CRITERIA_MONITOR: 0,
        DATABASE: 0,
        API_SERVER: 0,
        SCHEDULER: 0
      };

      logs.forEach(log => {
        if (componentBreakdown.hasOwnProperty(log.component)) {
          componentBreakdown[log.component]++;
        }
      });

      // Get top errors
      const errorLogs = logs.filter(log => log.level === 'ERROR' && log.error);
      const errorCounts = new Map<string, { count: number; lastOccurrence: Date }>();
      
      errorLogs.forEach(log => {
        const errorKey = log.error || 'Unknown error';
        const existing = errorCounts.get(errorKey);
        if (existing) {
          existing.count++;
          if (log.timestamp > existing.lastOccurrence) {
            existing.lastOccurrence = log.timestamp;
          }
        } else {
          errorCounts.set(errorKey, {
            count: 1,
            lastOccurrence: log.timestamp
          });
        }
      });

      const topErrors = Array.from(errorCounts.entries())
        .map(([message, data]) => ({
          message,
          count: data.count,
          lastOccurrence: data.lastOccurrence
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalLogs: stats.totalLogs,
        errorCount: stats.errorCount,
        warningCount: stats.warningCount,
        infoCount: stats.infoCount,
        debugCount: stats.debugCount,
        componentBreakdown,
        timeRange: {
          start: startDate,
          end: endDate
        },
        topErrors
      };
    } catch (error) {
      console.error('Failed to get log summary:', error);
      
      // Return empty summary on error
      return {
        totalLogs: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        debugCount: 0,
        componentBreakdown: {
          TRADING_ENGINE: 0,
          SIGNAL_GENERATOR: 0,
          PORTFOLIO_MANAGER: 0,
          RISK_MANAGER: 0,
          MARKET_DATA_SERVICE: 0,
          LLM_SERVICE: 0,
          EXIT_CRITERIA_MONITOR: 0,
          DATABASE: 0,
          API_SERVER: 0,
          SCHEDULER: 0
        },
        timeRange: { start: startDate, end: endDate },
        topErrors: []
      };
    }
  }

  /**
   * Create a scoped logger for a specific execution cycle
   */
  createScopedLogger(executionCycleId: string): ScopedLogger {
    return new ScopedLogger(this, executionCycleId);
  }

  /**
   * Get LLM interactions for a date range
   */
  async getLLMInteractions(startDate?: Date, endDate?: Date, limit?: number): Promise<LLMInteraction[]> {
    try {
      return await this.repository.getLLMInteractions(startDate, endDate, limit);
    } catch (error) {
      console.error('Failed to get LLM interactions:', error);
      return [];
    }
  }

  /**
   * Get trading cycle logs
   */
  async getTradingCycleLogs(limit?: number): Promise<TradingCycleLog[]> {
    try {
      return await this.repository.getTradingCycleLogs(limit);
    } catch (error) {
      console.error('Failed to get trading cycle logs:', error);
      return [];
    }
  }

  /**
   * Clean up old logs
   */
  async cleanupOldLogs(retentionDays: number = 30): Promise<number> {
    try {
      const deletedCount = await this.repository.cleanupLogs(retentionDays);
      this.info('Log cleanup completed', { deletedCount, retentionDays });
      return deletedCount;
    } catch (error) {
      this.error('Log cleanup failed', error as Error);
      return 0;
    }
  }

  /**
   * Internal method to log messages
   */
  private logMessage(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    // Console logging for immediate feedback
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] [${this.component}] ${message}`;
    
    switch (level) {
      case 'DEBUG':
        console.debug(logEntry, metadata);
        break;
      case 'INFO':
        console.info(logEntry, metadata);
        break;
      case 'WARN':
        console.warn(logEntry, metadata);
        break;
      case 'ERROR':
      case 'FATAL':
        console.error(logEntry, metadata);
        break;
    }

    // Async database logging (fire and forget to avoid blocking)
    this.logToDatabase(level, message, metadata).catch(error => {
      console.error('Failed to log to database:', error);
    });
  }

  /**
   * Log to database asynchronously
   */
  private async logToDatabase(level: LogLevel, message: string, metadata?: Record<string, unknown>): Promise<void> {
    const executionLog: ExecutionLog = {
      id: uuidv4(),
      timestamp: new Date(),
      component: this.component,
      action: message,
      details: metadata || {},
      level,
      executionCycleId: this.currentExecutionCycleId || 'system',
      success: level !== 'ERROR' && level !== 'FATAL',
      ...(level === 'ERROR' || level === 'FATAL' ? { error: message } : {})
    };

    await this.repository.saveExecutionLog(executionLog);
  }
}

/**
 * Scoped logger that automatically includes execution cycle context
 */
export class ScopedLogger {
  private logger: LoggingService;
  private executionCycleId: string;

  constructor(logger: LoggingService, executionCycleId: string) {
    this.logger = logger;
    this.executionCycleId = executionCycleId;
    this.logger.setExecutionCycleId(executionCycleId);
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.logger.debug(message, { ...metadata, executionCycleId: this.executionCycleId });
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.logger.info(message, { ...metadata, executionCycleId: this.executionCycleId });
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.logger.warn(message, { ...metadata, executionCycleId: this.executionCycleId });
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.logger.error(message, error, { ...metadata, executionCycleId: this.executionCycleId });
  }

  fatal(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.logger.fatal(message, error, { ...metadata, executionCycleId: this.executionCycleId });
  }

  async logExecution(action: string, details: Record<string, unknown>, success: boolean = true, duration?: number): Promise<void> {
    const executionLog: ExecutionLog = {
      id: uuidv4(),
      timestamp: new Date(),
      component: this.logger['component'],
      action,
      details,
      level: success ? 'INFO' : 'ERROR',
      executionCycleId: this.executionCycleId,
      success,
      ...(duration !== undefined && { duration })
    };

    await this.logger.logExecution(executionLog);
  }

  /**
   * Dispose of the scoped logger and clear execution cycle context
   */
  dispose(): void {
    this.logger.clearExecutionCycleId();
  }
}

/**
 * Factory function to create logging service instances
 */
export function createLoggingService(db: DatabaseConnection, component: ComponentType): LoggingService {
  return new LoggingService(db, component);
}