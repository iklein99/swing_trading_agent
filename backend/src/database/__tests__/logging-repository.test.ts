/**
 * Logging repository tests
 */

import { DatabaseConnection } from '../connection';
import { LoggingRepository } from '../repositories/logging-repository';
import { 
  ExecutionLog, 
  LLMInteraction, 
  TradingCycleLog
} from '../../../../shared/src/types/logging';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

describe('LoggingRepository', () => {
  let db: DatabaseConnection;
  let repository: LoggingRepository;
  const testDbPath = path.join(__dirname, 'logging-test.db');

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
    repository = new LoggingRepository(db);
  });

  afterEach(async () => {
    if (db.isConnected()) {
      await db.close();
    }
    
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('execution logs', () => {
    it('should save execution log', async () => {
      const log: ExecutionLog = {
        id: uuidv4(),
        timestamp: new Date(),
        component: 'TRADING_ENGINE',
        action: 'EXECUTE_CYCLE',
        details: { cycleNumber: 1, signalsGenerated: 3 },
        level: 'INFO',
        executionCycleId: 'cycle-123',
        duration: 1500,
        success: true
      };

      await repository.saveExecutionLog(log);

      const logs = await repository.getExecutionLogs({});
      expect(logs).toHaveLength(1);
      if (logs[0]) {
        expect(logs[0].component).toBe('TRADING_ENGINE');
        expect(logs[0].details['cycleNumber']).toBe(1);
      }
    });

    it('should save execution log with error', async () => {
      const log: ExecutionLog = {
        id: uuidv4(),
        timestamp: new Date(),
        component: 'SIGNAL_GENERATOR',
        action: 'GENERATE_SIGNALS',
        details: { symbol: 'AAPL' },
        level: 'ERROR',
        executionCycleId: 'cycle-456',
        duration: 500,
        success: false,
        error: 'Market data unavailable'
      };

      await repository.saveExecutionLog(log);

      const logs = await repository.getExecutionLogs({ level: 'ERROR' });
      expect(logs).toHaveLength(1);
      if (logs[0]) {
        expect(logs[0].error).toBe('Market data unavailable');
        expect(logs[0].success).toBe(false);
      }
    });

    it('should query execution logs with filters', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Create test logs
      await repository.saveExecutionLog({
        id: uuidv4(),
        timestamp: yesterday,
        component: 'TRADING_ENGINE',
        action: 'START',
        details: {},
        level: 'INFO',
        executionCycleId: 'cycle-1',
        success: true
      });

      await repository.saveExecutionLog({
        id: uuidv4(),
        timestamp: now,
        component: 'SIGNAL_GENERATOR',
        action: 'ANALYZE',
        details: { symbol: 'AAPL' },
        level: 'WARN',
        executionCycleId: 'cycle-2',
        success: true
      });

      await repository.saveExecutionLog({
        id: uuidv4(),
        timestamp: now,
        component: 'TRADING_ENGINE',
        action: 'EXECUTE',
        details: {},
        level: 'ERROR',
        executionCycleId: 'cycle-2',
        success: false,
        error: 'Connection failed'
      });

      // Test component filter
      const engineLogs = await repository.getExecutionLogs({ component: 'TRADING_ENGINE' });
      expect(engineLogs).toHaveLength(2);

      // Test level filter
      const errorLogs = await repository.getExecutionLogs({ level: 'ERROR' });
      expect(errorLogs).toHaveLength(1);

      // Test date filter
      const todayLogs = await repository.getExecutionLogs({ 
        startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()) 
      });
      expect(todayLogs).toHaveLength(2);

      // Test search
      const searchLogs = await repository.getExecutionLogs({ search: 'AAPL' });
      expect(searchLogs).toHaveLength(1);

      // Test limit
      const limitedLogs = await repository.getExecutionLogs({ limit: 2 });
      expect(limitedLogs).toHaveLength(2);
    });
  });

  describe('LLM interactions', () => {
    it('should save LLM interaction', async () => {
      const interaction: LLMInteraction = {
        id: uuidv4(),
        timestamp: new Date(),
        prompt: 'Analyze AAPL for trading opportunities',
        response: 'AAPL shows strong momentum with RSI at 65...',
        model: 'claude-3-sonnet',
        processingTime: 2500,
        tokenUsage: {
          promptTokens: 150,
          completionTokens: 300,
          totalTokens: 450,
          cost: 0.02
        },
        associatedSignalId: 'signal-123',
        success: true,
        retryCount: 0
      };

      await repository.saveLLMInteraction(interaction);

      const interactions = await repository.getLLMInteractions();
      expect(interactions).toHaveLength(1);
      if (interactions[0]) {
        expect(interactions[0].model).toBe('claude-3-sonnet');
        expect(interactions[0].tokenUsage.totalTokens).toBe(450);
      }
    });

    it('should save failed LLM interaction', async () => {
      const interaction: LLMInteraction = {
        id: uuidv4(),
        timestamp: new Date(),
        prompt: 'Generate trading signal for TSLA',
        response: '',
        model: 'claude-3-sonnet',
        processingTime: 1000,
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 0,
          totalTokens: 100
        },
        success: false,
        error: 'Rate limit exceeded',
        retryCount: 2
      };

      await repository.saveLLMInteraction(interaction);

      const interactions = await repository.getLLMInteractions();
      expect(interactions).toHaveLength(1);
      if (interactions[0]) {
        expect(interactions[0].success).toBe(false);
        expect(interactions[0].error).toBe('Rate limit exceeded');
        expect(interactions[0].retryCount).toBe(2);
      }
    });

    it('should get LLM interactions with date filter', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await repository.saveLLMInteraction({
        id: uuidv4(),
        timestamp: yesterday,
        prompt: 'Old prompt',
        response: 'Old response',
        model: 'claude-3-sonnet',
        processingTime: 1000,
        tokenUsage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
        success: true,
        retryCount: 0
      });

      await repository.saveLLMInteraction({
        id: uuidv4(),
        timestamp: now,
        prompt: 'New prompt',
        response: 'New response',
        model: 'claude-3-sonnet',
        processingTime: 1500,
        tokenUsage: { promptTokens: 75, completionTokens: 125, totalTokens: 200 },
        success: true,
        retryCount: 0
      });

      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayInteractions = await repository.getLLMInteractions(todayStart);
      
      expect(todayInteractions).toHaveLength(1);
      if (todayInteractions[0]) {
        expect(todayInteractions[0].prompt).toBe('New prompt');
      }
    });
  });

  describe('trading cycle logs', () => {
    it('should save trading cycle log', async () => {
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

      await repository.saveTradingCycleLog(cycleLog);

      const logs = await repository.getTradingCycleLogs();
      expect(logs).toHaveLength(1);
      if (logs[0]) {
        expect(logs[0].cycleId).toBe('cycle-789');
        expect(logs[0].tradesExecuted).toBe(4);
      }
    });

    it('should save failed trading cycle log', async () => {
      const cycleLog: TradingCycleLog = {
        id: uuidv4(),
        cycleId: 'cycle-failed',
        startTime: new Date(),
        phase: 'FAILED',
        buySignalsGenerated: 0,
        sellSignalsGenerated: 0,
        exitCriteriaTriggered: 0,
        tradesExecuted: 0,
        errors: ['Market data service unavailable', 'LLM service timeout'],
        success: false
      };

      await repository.saveTradingCycleLog(cycleLog);

      const logs = await repository.getTradingCycleLogs();
      expect(logs).toHaveLength(1);
      if (logs[0]) {
        expect(logs[0].success).toBe(false);
        expect(logs[0].errors).toHaveLength(2);
      }
    });
  });

  describe('log statistics and cleanup', () => {
    beforeEach(async () => {
      const now = new Date();
      
      // Create various logs for statistics
      await repository.saveExecutionLog({
        id: uuidv4(),
        timestamp: now,
        component: 'TRADING_ENGINE',
        action: 'START',
        details: {},
        level: 'INFO',
        executionCycleId: 'cycle-1',
        success: true
      });

      await repository.saveExecutionLog({
        id: uuidv4(),
        timestamp: now,
        component: 'SIGNAL_GENERATOR',
        action: 'ANALYZE',
        details: {},
        level: 'WARN',
        executionCycleId: 'cycle-1',
        success: true
      });

      await repository.saveExecutionLog({
        id: uuidv4(),
        timestamp: now,
        component: 'PORTFOLIO_MANAGER',
        action: 'UPDATE',
        details: {},
        level: 'ERROR',
        executionCycleId: 'cycle-1',
        success: false,
        error: 'Database connection lost'
      });
    });

    it('should get log statistics', async () => {
      const stats = await repository.getLogStats();
      
      expect(stats.totalLogs).toBe(3);
      expect(stats.errorCount).toBe(1);
      expect(stats.warningCount).toBe(1);
      expect(stats.infoCount).toBe(1);
      expect(stats.debugCount).toBe(0);
    });

    it('should cleanup old logs', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40); // 40 days ago

      // Add old log
      await repository.saveExecutionLog({
        id: uuidv4(),
        timestamp: oldDate,
        component: 'TRADING_ENGINE',
        action: 'OLD_ACTION',
        details: {},
        level: 'INFO',
        executionCycleId: 'old-cycle',
        success: true
      });

      const deletedCount = await repository.cleanupLogs(30); // Keep last 30 days
      expect(deletedCount).toBe(1);

      const remainingLogs = await repository.getExecutionLogs({});
      expect(remainingLogs).toHaveLength(3); // Original 3 logs should remain
    });
  });
});