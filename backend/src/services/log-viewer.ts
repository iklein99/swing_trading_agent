/**
 * Log viewer service for displaying and filtering logs
 * Provides formatted output and search capabilities
 */

import {
  LogQuery,
  LogLevel,
  ComponentType,
  SystemLog,
  LLMInteraction,
  TradingCycleLog
} from '../../../shared/src/types/logging';
import { LoggingService } from './logging-service';

export interface LogViewerOptions {
  colorize?: boolean;
  includeMetadata?: boolean;
  maxWidth?: number;
  dateFormat?: 'iso' | 'short' | 'relative';
}

export interface LogFilter {
  level?: LogLevel[];
  components?: ComponentType[];
  search?: string;
  startDate?: Date;
  endDate?: Date;
  executionCycleId?: string;
}

export class LogViewer {
  private loggingService: LoggingService;
  private options: LogViewerOptions;

  constructor(loggingService: LoggingService, options: LogViewerOptions = {}) {
    this.loggingService = loggingService;
    this.options = {
      colorize: true,
      includeMetadata: true,
      maxWidth: 120,
      dateFormat: 'short',
      ...options
    };
  }

  /**
   * Display logs with filtering and formatting
   */
  async displayLogs(filter: LogFilter = {}, limit: number = 100): Promise<string[]> {
    const query: LogQuery = {
      limit,
      sortBy: 'timestamp',
      sortOrder: 'desc'
    };

    if (filter.startDate) query.startDate = filter.startDate;
    if (filter.endDate) query.endDate = filter.endDate;
    if (filter.level && filter.level.length > 0) {
      const firstLevel = filter.level[0];
      if (firstLevel) query.level = firstLevel;
    }
    if (filter.components && filter.components.length > 0) {
      const firstComponent = filter.components[0];
      if (firstComponent) query.component = firstComponent;
    }
    if (filter.executionCycleId) query.executionCycleId = filter.executionCycleId;
    if (filter.search) query.search = filter.search;

    const logs = await this.loggingService.query(query);
    
    // Apply additional filtering for multiple levels/components
    const filteredLogs = logs.filter(log => {
      if (filter.level && filter.level.length > 0 && !filter.level.includes(log.level)) {
        return false;
      }
      if (filter.components && filter.components.length > 0 && !filter.components.includes(log.component)) {
        return false;
      }
      return true;
    });

    return filteredLogs.map(log => this.formatLogEntry(log));
  }

  /**
   * Display LLM interactions
   */
  async displayLLMInteractions(startDate?: Date, endDate?: Date, limit: number = 50): Promise<string[]> {
    const interactions = await this.loggingService.getLLMInteractions(startDate, endDate, limit);
    return interactions.map(interaction => this.formatLLMInteraction(interaction));
  }

  /**
   * Display trading cycle logs
   */
  async displayTradingCycles(limit: number = 20): Promise<string[]> {
    const cycles = await this.loggingService.getTradingCycleLogs(limit);
    return cycles.map(cycle => this.formatTradingCycle(cycle));
  }

  /**
   * Search logs by text
   */
  async searchLogs(searchTerm: string, limit: number = 100): Promise<string[]> {
    const query: LogQuery = {
      search: searchTerm,
      limit,
      sortBy: 'timestamp',
      sortOrder: 'desc'
    };

    const logs = await this.loggingService.query(query);
    return logs.map(log => this.formatLogEntry(log));
  }

  /**
   * Get logs for a specific execution cycle
   */
  async getExecutionCycleLogs(cycleId: string): Promise<string[]> {
    const query: LogQuery = {
      executionCycleId: cycleId,
      sortBy: 'timestamp',
      sortOrder: 'asc'
    };

    const logs = await this.loggingService.query(query);
    return logs.map(log => this.formatLogEntry(log));
  }

  /**
   * Get error logs only
   */
  async getErrorLogs(limit: number = 50): Promise<string[]> {
    const query: LogQuery = {
      level: 'ERROR',
      limit,
      sortBy: 'timestamp',
      sortOrder: 'desc'
    };

    const logs = await this.loggingService.query(query);
    return logs.map(log => this.formatLogEntry(log));
  }

  /**
   * Format a single log entry
   */
  private formatLogEntry(log: SystemLog): string {
    const timestamp = this.formatTimestamp(log.timestamp);
    const level = this.formatLevel(log.level);
    const component = this.formatComponent(log.component);
    
    let message = log.message;
    if (this.options.maxWidth && message.length > this.options.maxWidth - 50) {
      message = message.substring(0, this.options.maxWidth - 53) + '...';
    }

    let formatted = `${timestamp} ${level} ${component} ${message}`;

    if (this.options.includeMetadata && log.metadata && Object.keys(log.metadata).length > 0) {
      const metadata = this.formatMetadata(log.metadata);
      formatted += `\n  ${metadata}`;
    }

    if (log.stackTrace) {
      const stackTrace = this.formatStackTrace(log.stackTrace);
      formatted += `\n  ${stackTrace}`;
    }

    return formatted;
  }

  /**
   * Format LLM interaction
   */
  private formatLLMInteraction(interaction: LLMInteraction): string {
    const timestamp = this.formatTimestamp(interaction.timestamp);
    const status = interaction.success ? '✓' : '✗';
    const model = interaction.model;
    const processingTime = `${interaction.processingTime}ms`;
    const tokens = `${interaction.tokenUsage.totalTokens} tokens`;

    let formatted = `${timestamp} LLM ${status} ${model} ${processingTime} ${tokens}`;

    if (interaction.associatedSignalId) {
      formatted += ` [Signal: ${interaction.associatedSignalId}]`;
    }

    if (interaction.associatedTradeId) {
      formatted += ` [Trade: ${interaction.associatedTradeId}]`;
    }

    // Add prompt preview (first 100 chars)
    const promptPreview = interaction.prompt.length > 100 
      ? interaction.prompt.substring(0, 100) + '...'
      : interaction.prompt;
    formatted += `\n  Prompt: ${promptPreview}`;

    // Add response preview (first 200 chars)
    const responsePreview = interaction.response.length > 200
      ? interaction.response.substring(0, 200) + '...'
      : interaction.response;
    formatted += `\n  Response: ${responsePreview}`;

    if (interaction.error) {
      formatted += `\n  Error: ${interaction.error}`;
    }

    return formatted;
  }

  /**
   * Format trading cycle log
   */
  private formatTradingCycle(cycle: TradingCycleLog): string {
    const timestamp = this.formatTimestamp(cycle.startTime);
    const status = cycle.success ? '✓' : '✗';
    const duration = cycle.duration ? `${cycle.duration}ms` : 'ongoing';
    const phase = cycle.phase;

    let formatted = `${timestamp} CYCLE ${status} ${cycle.cycleId} [${phase}] ${duration}`;

    const stats = [
      `Buy: ${cycle.buySignalsGenerated}`,
      `Sell: ${cycle.sellSignalsGenerated}`,
      `Exit: ${cycle.exitCriteriaTriggered}`,
      `Trades: ${cycle.tradesExecuted}`
    ];
    formatted += `\n  Stats: ${stats.join(', ')}`;

    if (cycle.errors.length > 0) {
      formatted += `\n  Errors: ${cycle.errors.join(', ')}`;
    }

    return formatted;
  }

  /**
   * Format timestamp based on options
   */
  private formatTimestamp(date: Date): string {
    switch (this.options.dateFormat) {
      case 'iso':
        return date.toISOString();
      case 'relative':
        return this.getRelativeTime(date);
      case 'short':
      default:
        return date.toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
    }
  }

  /**
   * Format log level with colors
   */
  private formatLevel(level: LogLevel): string {
    if (!this.options.colorize) {
      return `[${level}]`.padEnd(7);
    }

    const colors = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m',  // Green
      WARN: '\x1b[33m',  // Yellow
      ERROR: '\x1b[31m', // Red
      FATAL: '\x1b[35m'  // Magenta
    };

    const reset = '\x1b[0m';
    const color = colors[level] || '';
    return `${color}[${level}]${reset}`.padEnd(13); // Account for color codes
  }

  /**
   * Format component name
   */
  private formatComponent(component: ComponentType): string {
    const shortNames = {
      TRADING_ENGINE: 'ENGINE',
      SIGNAL_GENERATOR: 'SIGNAL',
      PORTFOLIO_MANAGER: 'PORTFOLIO',
      RISK_MANAGER: 'RISK',
      MARKET_DATA_SERVICE: 'MARKET',
      LLM_SERVICE: 'LLM',
      EXIT_CRITERIA_MONITOR: 'EXIT',
      GUIDELINES_MANAGER: 'GUIDE',
      DATABASE: 'DB',
      API_SERVER: 'API',
      SCHEDULER: 'SCHED'
    };

    const shortName = shortNames[component] || component;
    return `[${shortName}]`.padEnd(12);
  }

  /**
   * Format metadata object
   */
  private formatMetadata(metadata: Record<string, unknown>): string {
    const entries = Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        if (typeof value === 'object') {
          return `${key}: ${JSON.stringify(value)}`;
        }
        return `${key}: ${value}`;
      });

    return entries.join(', ');
  }

  /**
   * Format stack trace
   */
  private formatStackTrace(stackTrace: string): string {
    const lines = stackTrace.split('\n').slice(0, 3); // Show first 3 lines
    return `Stack: ${lines.join(' | ')}`;
  }

  /**
   * Get relative time string
   */
  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  /**
   * Export logs to text format
   */
  async exportLogs(filter: LogFilter = {}, format: 'text' | 'json' = 'text'): Promise<string> {
    const query: LogQuery = {
      limit: 10000, // Large limit for export
      sortBy: 'timestamp',
      sortOrder: 'asc'
    };

    if (filter.startDate) query.startDate = filter.startDate;
    if (filter.endDate) query.endDate = filter.endDate;
    if (filter.level && filter.level.length > 0) {
      const firstLevel = filter.level[0];
      if (firstLevel) query.level = firstLevel;
    }
    if (filter.components && filter.components.length > 0) {
      const firstComponent = filter.components[0];
      if (firstComponent) query.component = firstComponent;
    }
    if (filter.executionCycleId) query.executionCycleId = filter.executionCycleId;
    if (filter.search) query.search = filter.search;

    const logs = await this.loggingService.query(query);

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // Text format
    const header = `# Log Export - ${new Date().toISOString()}\n` +
                  `# Filter: ${JSON.stringify(filter)}\n` +
                  `# Total logs: ${logs.length}\n\n`;

    const logLines = logs.map(log => this.formatLogEntry(log));
    return header + logLines.join('\n');
  }
}

/**
 * Factory function to create log viewer
 */
export function createLogViewer(loggingService: LoggingService, options?: LogViewerOptions): LogViewer {
  return new LogViewer(loggingService, options);
}