/**
 * Server startup script for testing the API
 * Initializes all services and starts the Express API server
 */

import dotenv from 'dotenv';
import path from 'path';
import { createApiServer } from './api/server';
import { createLoggingService } from './services/logging-service';
import { createGuidelinesManager } from './services/guidelines-manager';
import { createTradingEngine } from './services/trading-engine';
import { createPortfolioManager } from './services/portfolio-manager';
import { createRiskManager } from './services/risk-manager';
import { createSignalGenerator } from './services/signal-generator';
import { createExitCriteriaMonitor } from './services/exit-criteria-monitor';
import { createMarketDataService } from './services/market-data-service';
import { DatabaseService } from './database/database-service';
import { DatabaseConnection } from './database/connection';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/trading.db');
const GUIDELINES_PATH = process.env.GUIDELINES_PATH || path.join(__dirname, '../../artifacts/swing_trading_guidelines.yaml');

async function startServer() {
  try {
    console.log('🚀 Starting Swing Trading Agent API Server...\n');

    // Initialize database
    console.log('📦 Initializing database...');
    const dbConnection = new DatabaseConnection(DB_PATH);
    await dbConnection.initialize();
    const db = new DatabaseService(dbConnection);
    console.log('✅ Database initialized\n');

    // Initialize logging service
    console.log('📝 Initializing logging service...');
    const logger = createLoggingService(dbConnection, 'API_SERVER');
    console.log('✅ Logging service initialized\n');

    // Initialize guidelines manager
    console.log('📋 Initializing guidelines manager...');
    const guidelinesManager = createGuidelinesManager(logger, {
      guidelinesFilePath: GUIDELINES_PATH,
      watchForChanges: true,
      backupOnLoad: false,
      validateOnLoad: true
    });
    
    try {
      await guidelinesManager.loadGuidelines();
      console.log('✅ Guidelines loaded successfully\n');
    } catch (error) {
      console.warn('⚠️  Warning: Could not load guidelines. API will still start but guidelines endpoints may return errors.');
      console.warn(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }

    // Initialize market data service
    console.log('📊 Initializing market data service...');
    const marketDataService = createMarketDataService(logger);
    console.log('✅ Market data service initialized\n');

    // Initialize LLM service
    console.log('🤖 Initializing LLM service...');
    const { createLLMService } = await import('./services/llm-service');
    const llmService = createLLMService(logger, { provider: 'mock' });
    console.log('✅ LLM service initialized\n');

    // Initialize portfolio manager
    console.log('💼 Initializing portfolio manager...');
    const portfolioManager = createPortfolioManager(db, logger, {
      portfolioId: 'default',
      initialCash: 100000,
      mockBrokerEnabled: true
    });
    await portfolioManager.initialize();
    console.log('✅ Portfolio manager initialized\n');

    // Initialize risk manager
    console.log('🛡️  Initializing risk manager...');
    const riskManager = createRiskManager(logger, guidelinesManager);
    console.log('✅ Risk manager initialized\n');

    // Initialize signal generator
    console.log('📡 Initializing signal generator...');
    const signalGenerator = createSignalGenerator({
      guidelinesManager,
      marketDataService,
      llmService,
      loggingService: logger
    });
    console.log('✅ Signal generator initialized\n');

    // Initialize exit criteria monitor
    console.log('🚪 Initializing exit criteria monitor...');
    const exitCriteriaMonitor = createExitCriteriaMonitor({
      guidelinesManager,
      marketDataService,
      loggingService: logger
    });
    console.log('✅ Exit criteria monitor initialized\n');

    // Initialize trading engine
    console.log('⚙️  Initializing trading engine...');
    const tradingEngine = createTradingEngine(
      logger,
      guidelinesManager,
      signalGenerator,
      portfolioManager,
      riskManager,
      exitCriteriaMonitor,
      marketDataService
    );
    console.log('✅ Trading engine initialized\n');

    // Create and start API server
    console.log('🌐 Starting API server...');
    const apiServer = createApiServer(
      {
        port: PORT,
        corsOrigins: ['http://localhost:3000', 'http://localhost:3001'],
        enableHelmet: true
      },
      logger,
      tradingEngine,
      portfolioManager,
      guidelinesManager
    );

    await apiServer.start();
    
    console.log('\n✨ Server started successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔗 API Server: http://localhost:${PORT}`);
    console.log(`📖 Health Check: http://localhost:${PORT}/health`);
    console.log(`📊 API Status: http://localhost:${PORT}/api/status`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Available Endpoints:');
    console.log('  System:');
    console.log('    GET  /health');
    console.log('    GET  /api/status');
    console.log('    GET  /api/health');
    console.log('  Portfolio:');
    console.log('    GET  /api/portfolio');
    console.log('    GET  /api/portfolio/positions');
    console.log('    GET  /api/portfolio/metrics');
    console.log('    GET  /api/portfolio/performance');
    console.log('  Trades:');
    console.log('    GET  /api/trades');
    console.log('    GET  /api/trades/:id');
    console.log('  Logs:');
    console.log('    GET  /api/logs');
    console.log('    GET  /api/logs/summary');
    console.log('    GET  /api/logs/llm');
    console.log('    GET  /api/logs/cycles');
    console.log('  Guidelines:');
    console.log('    GET  /api/guidelines');
    console.log('    POST /api/guidelines/reload');
    console.log('    POST /api/guidelines/validate');
    console.log('    GET  /api/guidelines/status');
    console.log('  Engine Control:');
    console.log('    POST /api/engine/start');
    console.log('    POST /api/engine/stop');
    console.log('    POST /api/engine/pause');
    console.log('    POST /api/engine/resume');
    console.log('    POST /api/engine/cycle');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 Tip: Use Postman or curl to test the endpoints');
    console.log('📝 Press Ctrl+C to stop the server\n');

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Shutting down server...');
  process.exit(0);
});

// Start the server
startServer();
