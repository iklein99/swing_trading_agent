/**
 * Unit tests for LoggingService
 */

import { LoggingService, createLoggingService } from '../logging-service';
import { LogViewer, createLogViewer } from '../log-viewer';
import { DatabaseConnection } from '../../database/connection';
import { LoggingRepository } from '../../database/repositories/logging-repository';
import {
  ExecutionLog,
  LLMInteraction,
  TradingCycleLog,
  LogQuery
} from '../../../../shared/src/types/logging';
import { v4 as uuidv4 } from 'uuid';

// Mock console methods to avoid noise in tests
const originalConsole = { ...console };
beforeAll(() => {
  console.debug = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

describe('LoggingService', () => {
  let db: DatabaseConnection;
  let loggingService: LoggingService;
  let repository: LoggingRepository;

  beforeEach(async () => {
    // Create in-memory database for testing
    db = new DatabaseConnection(':memory:');
    await db.initialize();
    
    loggingService = createLoggingService(db, 'TRADING_ENGINE');
    repository = new LoggingRepository(db);
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Basic Logging', () => {
    test('should log debug messages', () => {
      const metadata = { key: 'value' };
      loggingService.debug('Test debug message', metadata);
      
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG] [TRADING_ENGINE] Test debug message'),
        metadata
      );
    });

    test('should log info messages', () => {
      const metadata = { userId: '123' };
      loggingService.info('Test info message', metadata);
      
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] [TRADING_ENGINE] Test info message'),
        metadata
      );
    });

    test('should log warning messages', () => {
      loggingService.warn('Test warning message');
      
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] [TRADING_ENGINE] Test warning message'),
        undefined
      );
    });

    test('should log error messages with error object', () => {
      const error = new Error('Test error');
      const metadata = { context: 'test' };
      
      loggingService.error('Test error message', error, metadata);
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] [TRADING_ENGINE] Test error message'),
        expect.objectContaining({
          context: 'test',
          errorName: 'Error',
          errorMessage: 'Test error',
          stackTrace: expect.any(String)
        })
      );
    });

    test('should log fatal messages', () => {
      const error = new Error('Fatal error');
      
      loggingService.fatal('Fatal error occurred', error);
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[FATAL] [TRADING_ENGINE] Fatal error occurred'),
        expect.objectContaining({
          errorName: 'Error',
          errorMessage: 'Fatal error'
        })
      );
    });
  });

  describe('Execution Cycle Context', () => {
    test('should set and clear execution cycle ID', () => {
      const cycleId = 'test-cycle-123';
      
      loggingService.setExecutionCycleId(cycleId);
      // Verify the cycle ID is set (internal state)
      
      loggingService.clearExecutionCycleId();
      // Verify the cycle ID is cleared (internal state)
    });

    test('should create scoped logger with execution cycle context', () => {
      const cycleId = 'scoped-cycle-456';
      const scopedLogger = loggingService.createScopedLogger(cycleId);
      
      expect(scopedLogger).toBeDefined();
      
      // Test scoped logging
      scopedLogger.info('Scoped log message');
      
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] [TRADING_ENGINE] Scoped log message'),
        expect.objectContaining({
          executionCycleId: cycleId
        })
      );
      
      scopedLogger.dispose();
    });
  });

  describe('Database Logging', () => {
    test('should save execution log to database', async () => {
      const executionLog: ExecutionLog = {
        id: uuidv4(),
        timestamp: new Date(),
        component: 'SIGNAL_GENERATOR',
        action: 'generate_buy_signal',
        details: { symbol: 'AAPL', confidence: 0.85 },
        level: 'INFO',
        executionCycleId: 'cycle-123',
        duration: 150,
        success: true
      };

      await loggingService.logExecution(executionLog);

      // Verify log was saved to database
      const query: LogQuery = {
        executionCycleId: 'cycle-123',
        limit: 1
      };
      
      const logs = await loggingService.query(query);
      expect(logs).toHaveLength(1);
      expect(logs[0]!.component).toBe('SIGNAL_GENERATOR');
      expect(logs[0]!.message).toBe('generate_buy_signal');
    });

    test('should save LLM interaction to database', async () => {
      const interaction: LLMInteraction = {
        id: uuidv4(),
        timestamp: new Date(),
        prompt: 'Analyze AAPL stock for trading opportunity',
        response: 'AAPL shows bullish signals with strong volume',
        model: 'claude-3-sonnet',
        processingTime: 2500,
        tokenUsage: {
          promptTokens: 150,
          completionTokens: 75,
          totalTokens: 225,
          cost: 0.01
        },
        associatedSignalId: 'signal-123',
        success: true,
        retryCount: 0
      };

      await loggingService.logLLMInteraction(interaction);

      // Verify interaction was saved
      const interactions = await loggingService.getLLMInteractions();
      expect(interactions).toHaveLength(1);
      expect(interactions[0]!.model).toBe('claude-3-sonnet');
      expect(interactions[0]!.prompt).toBe('Analyze AAPL stock for trading opportunity');
    });

    test('should save trading cycle log to database', async () => {
      const cycleLog: TradingCycleLog = {
        id: uuidv4(),
        cycleId: 'cycle-789',
        startTime: new Date(),
        endTime: new Date(),
        duration: 5000,
        phase: 'COMPLETED',
        buySignalsGenerated: 3,
        sellSignalsGenerated: 1,
        exitCriteriaTriggered: 2,
        tradesExecuted: 4,
        errors: [],
        success: true
      };

      await loggingService.logTradingCycle(cycleLog);

      // Verify cycle log was saved
      const cycleLogs = await loggingService.getTradingCycleLogs(1);
      expect(cycleLogs).toHaveLength(1);
      expect(cycleLogs[0]!.cycleId).toBe('cycle-789');
      expect(cycleLogs[0]!.phase).toBe('COMPLETED');
    });
  });

  describe('Log Querying and Filtering', () => {
    beforeEach(async () => {
      // Insert test data
      const testLogs: ExecutionLog[] = [
        {
          id: uuidv4(),
          timestamp: new Date('2024-01-01T10:00:00Z'),
          component: 'TRADING_ENGINE',
          action: 'start_cycle',
          details: {},
          level: 'INFO',
          executionCycleId: 'cycle-1',
          success: true
        },
        {
          id: uuidv4(),
          timestamp: new Date('2024-01-01T10:01:00Z'),
          component: 'SIGNAL_GENERATOR',
          action: 'generate_signal',
          details: { symbol: 'AAPL' },
          level: 'INFO',
          executionCycleId: 'cycle-1',
          success: true
        },
        {
          id: uuidv4(),
          timestamp: new Date('2024-01-01T10:02:00Z'),
          component: 'RISK_MANAGER',
          action: 'validate_trade',
          details: { symbol: 'AAPL', rejected: true },
          level: 'WARN',
          executionCycleId: 'cycle-1',
          success: false,
          error: 'Position limit exceeded'
        }
      ];

      for (const log of testLogs) {
        await repository.saveExecutionLog(log);
      }
    });

    test('should query logs by date range', async () => {
      const query: LogQuery = {
        startDate: new Date('2024-01-01T09:00:00Z'),
        endDate: new Date('2024-01-01T11:00:00Z')
      };

      const logs = await loggingService.query(query);
      expect(logs.length).toBeGreaterThanOrEqual(3);
    });

    test('should query logs by level', async () => {
      const query: LogQuery = {
        level: 'WARN'
      };

      const logs = await loggingService.query(query);
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0]!.level).toBe('WARN');
    });

    test('should query logs by component', async () => {
      const query: LogQuery = {
        component: 'SIGNAL_GENERATOR'
      };

      const logs = await loggingService.query(query);
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0]!.component).toBe('SIGNAL_GENERATOR');
    });

    test('should query logs by execution cycle ID', async () => {
      const query: LogQuery = {
        executionCycleId: 'cycle-1'
      };

      const logs = await loggingService.query(query);
      expect(logs.length).toBeGreaterThanOrEqual(3);
      logs.forEach(log => {
        expect(log.metadata?.['executionCycleId']).toBe('cycle-1');
      });
    });

    test('should search logs by text', async () => {
      const query: LogQuery = {
        search: 'AAPL'
      };

      const logs = await loggingService.query(query);
      expect(logs.length).toBeGreaterThanOrEqual(2);
    });

    test('should limit and paginate results', async () => {
      const query: LogQuery = {
        limit: 2,
        offset: 1
      };

      const logs = await loggingService.query(query);
      expect(logs.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Log Summary and Statistics', () => {
    beforeEach(async () => {
      // Insert test data with various levels
      const testLogs: ExecutionLog[] = [
        {
          id: uuidv4(),
          timestamp: new Date(),
          component: 'TRADING_ENGINE',
          action: 'info_message',
          details: {},
          level: 'INFO',
          executionCycleId: 'test',
          success: true
        },
        {
          id: uuidv4(),
          timestamp: new Date(),
          component: 'SIGNAL_GENERATOR',
          action: 'warning_message',
          details: {},
          level: 'WARN',
          executionCycleId: 'test',
          success: true
        },
        {
          id: uuidv4(),
          timestamp: new Date(),
          component: 'RISK_MANAGER',
          action: 'error_message',
          details: {},
          level: 'ERROR',
          executionCycleId: 'test',
          success: false,
          error: 'Test error'
        }
      ];

      for (const log of testLogs) {
        await repository.saveExecutionLog(log);
      }
    });

    test('should generate log summary with statistics', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const endDate = new Date();

      const summary = await loggingService.getSummary(startDate, endDate);

      expect(summary.totalLogs).toBeGreaterThanOrEqual(3);
      expect(summary.errorCount).toBeGreaterThanOrEqual(1);
      expect(summary.warningCount).toBeGreaterThanOrEqual(1);
      expect(summary.infoCount).toBeGreaterThanOrEqual(1);
      expect(summary.componentBreakdown).toBeDefined();
      expect(summary.topErrors).toBeDefined();
      expect(summary.timeRange.start).toEqual(startDate);
      expect(summary.timeRange.end).toEqual(endDate);
    });
  });

  describe('Log Cleanup', () => {
    test('should clean up old logs', async () => {
      // Insert old log
      const oldLog: ExecutionLog = {
        id: uuidv4(),
        timestamp: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days ago
        component: 'TRADING_ENGINE',
        action: 'old_message',
        details: {},
        level: 'INFO',
        executionCycleId: 'old',
        success: true
      };

      await repository.saveExecutionLog(oldLog);

      // Clean up logs older than 30 days
      const deletedCount = await loggingService.cleanupOldLogs(30);

      expect(deletedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Close database to simulate error
      await db.close();

      // These should not throw errors
      expect(() => loggingService.info('Test message')).not.toThrow();
      
      const logs = await loggingService.query({});
      expect(logs).toEqual([]);

      const summary = await loggingService.getSummary(new Date(), new Date());
      expect(summary.totalLogs).toBe(0);
    });
  });
});

describe('LogViewer', () => {
  let db: DatabaseConnection;
  let loggingService: LoggingService;
  let logViewer: LogViewer;

  beforeEach(async () => {
    db = new DatabaseConnection(':memory:');
    await db.initialize();
    
    loggingService = createLoggingService(db, 'TRADING_ENGINE');
    logViewer = createLogViewer(loggingService);
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Log Display', () => {
    beforeEach(async () => {
      // Insert test log
      const testLog: ExecutionLog = {
        id: uuidv4(),
        timestamp: new Date(),
        component: 'SIGNAL_GENERATOR',
        action: 'Test log message',
        details: { symbol: 'AAPL', confidence: 0.85 },
        level: 'INFO',
        executionCycleId: 'test-cycle',
        success: true
      };

      await loggingService.logExecution(testLog);
    });

    test('should display logs with formatting', async () => {
      const logLines = await logViewer.displayLogs({}, 10);
      
      expect(logLines.length).toBeGreaterThan(0);
      expect(logLines[0]).toContain('[INFO]');
      expect(logLines[0]).toContain('[SIGNAL]');
      expect(logLines[0]).toContain('Test log message');
    });

    test('should filter logs by level', async () => {
      const logLines = await logViewer.displayLogs({ level: ['INFO'] }, 10);
      
      expect(logLines.length).toBeGreaterThan(0);
      logLines.forEach(line => {
        expect(line).toContain('[INFO]');
      });
    });

    test('should filter logs by component', async () => {
      const logLines = await logViewer.displayLogs({ components: ['SIGNAL_GENERATOR'] }, 10);
      
      expect(logLines.length).toBeGreaterThan(0);
      logLines.forEach(line => {
        expect(line).toContain('[SIGNAL]');
      });
    });

    test('should search logs by text', async () => {
      const logLines = await logViewer.searchLogs('AAPL', 10);
      
      expect(logLines.length).toBeGreaterThan(0);
    });
  });

  describe('Export Functionality', () => {
    test('should export logs in text format', async () => {
      const exportText = await logViewer.exportLogs({}, 'text');
      
      expect(exportText).toContain('# Log Export');
      expect(exportText).toContain('# Total logs:');
    });

    test('should export logs in JSON format', async () => {
      const exportJson = await logViewer.exportLogs({}, 'json');
      
      expect(() => JSON.parse(exportJson)).not.toThrow();
      const parsed = JSON.parse(exportJson);
      expect(Array.isArray(parsed)).toBe(true);
    });
  });
});

describe('Integration Tests', () => {
  let db: DatabaseConnection;
  let loggingService: LoggingService;

  beforeEach(async () => {
    db = new DatabaseConnection(':memory:');
    await db.initialize();
    
    loggingService = createLoggingService(db, 'TRADING_ENGINE');
  });

  afterEach(async () => {
    await db.close();
  });

  test('should handle complete logging workflow', async () => {
    const cycleId = 'integration-test-cycle';
    
    // Start execution cycle
    loggingService.setExecutionCycleId(cycleId);
    
    // Log various messages
    loggingService.info('Starting trading cycle', { cycleId });
    loggingService.debug('Processing market data', { symbols: ['AAPL', 'GOOGL'] });
    loggingService.warn('Low confidence signal', { symbol: 'TSLA', confidence: 0.3 });
    
    // Log LLM interaction
    const llmInteraction: LLMInteraction = {
      id: uuidv4(),
      timestamp: new Date(),
      prompt: 'Analyze market conditions',
      response: 'Market shows mixed signals',
      model: 'claude-3-sonnet',
      processingTime: 1500,
      tokenUsage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150
      },
      success: true,
      retryCount: 0
    };
    
    await loggingService.logLLMInteraction(llmInteraction);
    
    // Log trading cycle completion
    const cycleLog: TradingCycleLog = {
      id: uuidv4(),
      cycleId,
      startTime: new Date(Date.now() - 5000),
      endTime: new Date(),
      duration: 5000,
      phase: 'COMPLETED',
      buySignalsGenerated: 2,
      sellSignalsGenerated: 1,
      exitCriteriaTriggered: 0,
      tradesExecuted: 1,
      errors: [],
      success: true
    };
    
    await loggingService.logTradingCycle(cycleLog);
    
    // Clear execution cycle
    loggingService.clearExecutionCycleId();
    
    // Verify all logs were created
    const logs = await loggingService.query({ executionCycleId: cycleId });
    expect(logs.length).toBeGreaterThan(0);
    
    const llmInteractions = await loggingService.getLLMInteractions();
    expect(llmInteractions.length).toBe(1);
    
    const cycleLogs = await loggingService.getTradingCycleLogs(1);
    expect(cycleLogs.length).toBe(1);
    expect(cycleLogs[0]!.cycleId).toBe(cycleId);
  });
});