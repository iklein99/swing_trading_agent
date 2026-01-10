/**
 * Demonstration of the logging service functionality
 * This file shows how to use the logging service in practice
 */

import { DatabaseConnection } from '../database/connection';
import { createLoggingService, createLogViewer } from '../services';
import { v4 as uuidv4 } from 'uuid';

async function demonstrateLoggingService() {
  console.log('🚀 Starting Logging Service Demonstration\n');

  // Initialize database and logging service
  const db = new DatabaseConnection(':memory:');
  await db.initialize();
  
  const logger = createLoggingService(db, 'TRADING_ENGINE');
  const logViewer = createLogViewer(logger);

  // 1. Basic logging
  console.log('📝 1. Basic Logging Examples:');
  logger.info('Trading system started', { version: '1.0.0', environment: 'demo' });
  logger.debug('Loading configuration', { configFile: 'trading.json' });
  logger.warn('Market data delayed', { delay: '5 seconds', provider: 'demo' });
  logger.error('Failed to connect to broker', new Error('Connection timeout'), { broker: 'demo-broker' });

  // 2. Scoped logging with execution cycle
  console.log('\n🔄 2. Scoped Logging with Execution Cycle:');
  const cycleId = `cycle-${Date.now()}`;
  const scopedLogger = logger.createScopedLogger(cycleId);
  
  scopedLogger.info('Starting trading cycle', { cycleId });
  scopedLogger.debug('Analyzing market data', { symbols: ['AAPL', 'GOOGL', 'TSLA'] });
  scopedLogger.info('Generated buy signal', { symbol: 'AAPL', confidence: 0.85 });
  scopedLogger.warn('Risk limit approaching', { currentRisk: '8%', limit: '10%' });
  scopedLogger.info('Trading cycle completed', { duration: '2.5s', tradesExecuted: 2 });
  
  scopedLogger.dispose();

  // 3. LLM interaction logging
  console.log('\n🤖 3. LLM Interaction Logging:');
  await logger.logLLMInteraction({
    id: uuidv4(),
    timestamp: new Date(),
    prompt: 'Analyze AAPL stock for swing trading opportunity based on recent price action and volume',
    response: 'AAPL shows bullish momentum with strong volume confirmation. Entry at $175 with stop loss at $170 and target at $185.',
    model: 'claude-3-sonnet',
    processingTime: 2500,
    tokenUsage: {
      promptTokens: 150,
      completionTokens: 75,
      totalTokens: 225,
      cost: 0.015
    },
    associatedSignalId: 'signal-aapl-001',
    success: true,
    retryCount: 0
  });

  // 4. Trading cycle logging
  console.log('\n📊 4. Trading Cycle Logging:');
  await logger.logTradingCycle({
    id: uuidv4(),
    cycleId,
    startTime: new Date(Date.now() - 5000),
    endTime: new Date(),
    duration: 5000,
    phase: 'COMPLETED',
    buySignalsGenerated: 3,
    sellSignalsGenerated: 1,
    exitCriteriaTriggered: 2,
    tradesExecuted: 2,
    errors: [],
    success: true
  });

  // 5. Log querying and filtering
  console.log('\n🔍 5. Log Querying and Filtering:');
  
  // Query recent logs
  const recentLogs = await logger.query({
    limit: 5,
    sortBy: 'timestamp',
    sortOrder: 'desc'
  });
  console.log(`Found ${recentLogs.length} recent logs`);

  // Query error logs only
  const errorLogs = await logger.query({
    level: 'ERROR',
    limit: 10
  });
  console.log(`Found ${errorLogs.length} error logs`);

  // 6. Log viewing and formatting
  console.log('\n📋 6. Formatted Log Display:');
  const formattedLogs = await logViewer.displayLogs({}, 5);
  console.log('Recent logs (formatted):');
  formattedLogs.forEach(log => console.log(log));

  // 7. Log summary and statistics
  console.log('\n📈 7. Log Summary and Statistics:');
  const summary = await logger.getSummary(
    new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
    new Date()
  );
  
  console.log(`Total logs: ${summary.totalLogs}`);
  console.log(`Errors: ${summary.errorCount}`);
  console.log(`Warnings: ${summary.warningCount}`);
  console.log(`Info: ${summary.infoCount}`);
  console.log('Component breakdown:', summary.componentBreakdown);

  // 8. LLM interactions display
  console.log('\n🤖 8. LLM Interactions Display:');
  const llmInteractions = await logViewer.displayLLMInteractions();
  console.log('LLM Interactions:');
  llmInteractions.forEach(interaction => console.log(interaction));

  // 9. Export functionality
  console.log('\n💾 9. Export Functionality:');
  const exportedLogs = await logViewer.exportLogs({}, 'text');
  console.log('Exported log preview (first 500 chars):');
  console.log(exportedLogs.substring(0, 500) + '...');

  // Cleanup
  await db.close();
  console.log('\n✅ Logging Service Demonstration Complete!');
}

// Run the demonstration if this file is executed directly
if (require.main === module) {
  demonstrateLoggingService().catch(console.error);
}

export { demonstrateLoggingService };