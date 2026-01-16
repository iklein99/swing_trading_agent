/**
 * REST API Server for Swing Trading Agent
 * Provides endpoints for system status, portfolio data, trade history, logs, and guidelines management
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { TradingEngine } from '../services/trading-engine';
import { PortfolioManager } from '../services/portfolio-manager';
import { GuidelinesManager } from '../services/guidelines-manager';
import { LoggingService } from '../services/logging-service';
import { LogQuery } from '../../../shared/src/types/logging';

export interface ApiServerConfig {
  port: number;
  corsOrigins?: string[];
  enableHelmet?: boolean;
}

export class ApiServer {
  private app: Express;
  private config: ApiServerConfig;
  private logger: LoggingService;
  private tradingEngine: TradingEngine;
  private portfolioManager: PortfolioManager;
  private guidelinesManager: GuidelinesManager;

  constructor(
    config: ApiServerConfig,
    logger: LoggingService,
    tradingEngine: TradingEngine,
    portfolioManager: PortfolioManager,
    guidelinesManager: GuidelinesManager
  ) {
    this.app = express();
    this.config = config;
    this.logger = logger;
    this.tradingEngine = tradingEngine;
    this.portfolioManager = portfolioManager;
    this.guidelinesManager = guidelinesManager;

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    if (this.config.enableHelmet !== false) {
      this.app.use(helmet());
    }

    // CORS
    this.app.use(cors({
      origin: this.config.corsOrigins || ['http://localhost:3000'],
      credentials: true
    }));

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      this.logger.debug('API request received', {
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip
      });
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date() });
    });

    // System status endpoints
    this.app.get('/api/status', this.getSystemStatus.bind(this));
    this.app.get('/api/health', this.getSystemHealth.bind(this));

    // Portfolio endpoints
    this.app.get('/api/portfolio', this.getPortfolio.bind(this));
    this.app.get('/api/portfolio/positions', this.getPositions.bind(this));
    this.app.get('/api/portfolio/metrics', this.getPortfolioMetrics.bind(this));
    this.app.get('/api/portfolio/performance', this.getPerformanceStats.bind(this));

    // Trade history endpoints
    this.app.get('/api/trades', this.getTradeHistory.bind(this));
    this.app.get('/api/trades/:id', this.getTradeById.bind(this));

    // Log viewing endpoints
    this.app.get('/api/logs', this.getLogs.bind(this));
    this.app.get('/api/logs/summary', this.getLogSummary.bind(this));
    this.app.get('/api/logs/llm', this.getLLMInteractions.bind(this));
    this.app.get('/api/logs/cycles', this.getTradingCycleLogs.bind(this));

    // Guidelines management endpoints
    this.app.get('/api/guidelines', this.getGuidelines.bind(this));
    this.app.post('/api/guidelines/reload', this.reloadGuidelines.bind(this));
    this.app.post('/api/guidelines/validate', this.validateGuidelines.bind(this));
    this.app.get('/api/guidelines/status', this.getGuidelinesStatus.bind(this));

    // Trading engine control endpoints
    this.app.post('/api/engine/start', this.startEngine.bind(this));
    this.app.post('/api/engine/stop', this.stopEngine.bind(this));
    this.app.post('/api/engine/pause', this.pauseEngine.bind(this));
    this.app.post('/api/engine/resume', this.resumeEngine.bind(this));
    this.app.post('/api/engine/cycle', this.executeTradingCycle.bind(this));
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      this.logger.error('API error', err);
      res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
      });
    });
  }

  /**
   * Start the API server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.config.port, () => {
        this.logger.info('API server started', { port: this.config.port });
        resolve();
      });
    });
  }

  /**
   * Get Express app instance (for testing)
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * API endpoint handlers
   */

  private async getSystemStatus(_req: Request, res: Response): Promise<void> {
    try {
      const status = this.tradingEngine.getStatus();
      res.json(status);
    } catch (error) {
      this.logger.error('Failed to get system status', error as Error);
      res.status(500).json({ error: 'Failed to get system status' });
    }
  }

  private async getSystemHealth(_req: Request, res: Response): Promise<void> {
    try {
      const health = await this.tradingEngine.getHealth();
      res.json(health);
    } catch (error) {
      this.logger.error('Failed to get system health', error as Error);
      res.status(500).json({ error: 'Failed to get system health' });
    }
  }

  private async getPortfolio(_req: Request, res: Response): Promise<void> {
    try {
      const portfolio = this.portfolioManager.getPortfolio();
      res.json(portfolio);
    } catch (error) {
      this.logger.error('Failed to get portfolio', error as Error);
      res.status(500).json({ error: 'Failed to get portfolio' });
    }
  }

  private async getPositions(_req: Request, res: Response): Promise<void> {
    try {
      const positions = this.portfolioManager.getCurrentPositions();
      res.json(positions);
    } catch (error) {
      this.logger.error('Failed to get positions', error as Error);
      res.status(500).json({ error: 'Failed to get positions' });
    }
  }

  private async getPortfolioMetrics(_req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.portfolioManager.updatePortfolioMetrics();
      res.json(metrics);
    } catch (error) {
      this.logger.error('Failed to get portfolio metrics', error as Error);
      res.status(500).json({ error: 'Failed to get portfolio metrics' });
    }
  }

  private async getPerformanceStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.portfolioManager.getPerformanceStats();
      res.json(stats);
    } catch (error) {
      this.logger.error('Failed to get performance stats', error as Error);
      res.status(500).json({ error: 'Failed to get performance stats' });
    }
  }

  private async getTradeHistory(req: Request, res: Response): Promise<void> {
    try {
      // Parse query parameters
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string) : 100;
      const symbol = req.query['symbol'] as string | undefined;
      const action = req.query['action'] as 'BUY' | 'SELL' | undefined;
      
      // For now, return empty array - will be implemented with trade repository
      const trades: any[] = [];
      
      res.json({
        trades,
        total: trades.length,
        limit,
        filters: { symbol, action }
      });
    } catch (error) {
      this.logger.error('Failed to get trade history', error as Error);
      res.status(500).json({ error: 'Failed to get trade history' });
    }
  }

  private async getTradeById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // For now, return 404 - will be implemented with trade repository
      res.status(404).json({ error: 'Trade not found', id });
    } catch (error) {
      this.logger.error('Failed to get trade', error as Error);
      res.status(500).json({ error: 'Failed to get trade' });
    }
  }

  private async getLogs(req: Request, res: Response): Promise<void> {
    try {
      // Parse query parameters
      const startDate = req.query['startDate'] ? new Date(req.query['startDate'] as string) : undefined;
      const endDate = req.query['endDate'] ? new Date(req.query['endDate'] as string) : undefined;
      
      const query: LogQuery = {
        level: req.query['level'] as any,
        component: req.query['component'] as any,
        limit: req.query['limit'] ? parseInt(req.query['limit'] as string) : 100,
        offset: req.query['offset'] ? parseInt(req.query['offset'] as string) : 0
      };

      // Only add date fields if they exist
      if (startDate) {
        query.startDate = startDate;
      }
      if (endDate) {
        query.endDate = endDate;
      }

      const logs = await this.logger.query(query);
      
      res.json({
        logs,
        total: logs.length,
        query
      });
    } catch (error) {
      this.logger.error('Failed to get logs', error as Error);
      res.status(500).json({ error: 'Failed to get logs' });
    }
  }

  private async getLogSummary(req: Request, res: Response): Promise<void> {
    try {
      const startDate = req.query['startDate'] 
        ? new Date(req.query['startDate'] as string)
        : new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
      
      const endDate = req.query['endDate']
        ? new Date(req.query['endDate'] as string)
        : new Date();

      const summary = await this.logger.getSummary(startDate, endDate);
      res.json(summary);
    } catch (error) {
      this.logger.error('Failed to get log summary', error as Error);
      res.status(500).json({ error: 'Failed to get log summary' });
    }
  }

  private async getLLMInteractions(req: Request, res: Response): Promise<void> {
    try {
      const startDate = req.query['startDate'] ? new Date(req.query['startDate'] as string) : undefined;
      const endDate = req.query['endDate'] ? new Date(req.query['endDate'] as string) : undefined;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string) : 50;

      const interactions = await this.logger.getLLMInteractions(startDate, endDate, limit);
      res.json({ interactions, total: interactions.length });
    } catch (error) {
      this.logger.error('Failed to get LLM interactions', error as Error);
      res.status(500).json({ error: 'Failed to get LLM interactions' });
    }
  }

  private async getTradingCycleLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string) : 50;
      const cycles = await this.logger.getTradingCycleLogs(limit);
      res.json({ cycles, total: cycles.length });
    } catch (error) {
      this.logger.error('Failed to get trading cycle logs', error as Error);
      res.status(500).json({ error: 'Failed to get trading cycle logs' });
    }
  }

  private async getGuidelines(_req: Request, res: Response): Promise<void> {
    try {
      const guidelines = this.guidelinesManager.getCurrentGuidelines();
      
      if (!guidelines) {
        res.status(404).json({ error: 'Guidelines not loaded' });
        return;
      }

      res.json(guidelines);
    } catch (error) {
      this.logger.error('Failed to get guidelines', error as Error);
      res.status(500).json({ error: 'Failed to get guidelines' });
    }
  }

  private async reloadGuidelines(_req: Request, res: Response): Promise<void> {
    try {
      const guidelines = await this.guidelinesManager.reloadGuidelines();
      
      this.logger.info('Guidelines reloaded via API', {
        version: guidelines.version,
        lastUpdated: guidelines.lastUpdated
      });

      res.json({
        success: true,
        message: 'Guidelines reloaded successfully',
        guidelines
      });
    } catch (error) {
      this.logger.error('Failed to reload guidelines', error as Error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to reload guidelines',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async validateGuidelines(req: Request, res: Response): Promise<void> {
    try {
      const guidelines = req.body.guidelines || this.guidelinesManager.getCurrentGuidelines();
      
      if (!guidelines) {
        res.status(400).json({ error: 'No guidelines provided or loaded' });
        return;
      }

      const validation = this.guidelinesManager.validateGuidelines(guidelines);
      
      res.json({
        validation,
        guidelines: validation.isValid ? guidelines : undefined
      });
    } catch (error) {
      this.logger.error('Failed to validate guidelines', error as Error);
      res.status(500).json({ error: 'Failed to validate guidelines' });
    }
  }

  private async getGuidelinesStatus(_req: Request, res: Response): Promise<void> {
    try {
      const guidelines = this.guidelinesManager.getCurrentGuidelines();
      
      if (!guidelines) {
        res.json({
          loaded: false,
          message: 'Guidelines not loaded'
        });
        return;
      }

      const validation = this.guidelinesManager.validateGuidelines(guidelines);

      res.json({
        loaded: true,
        valid: validation.isValid,
        version: guidelines.version,
        lastUpdated: guidelines.lastUpdated,
        validation
      });
    } catch (error) {
      this.logger.error('Failed to get guidelines status', error as Error);
      res.status(500).json({ error: 'Failed to get guidelines status' });
    }
  }

  private async startEngine(_req: Request, res: Response): Promise<void> {
    try {
      await this.tradingEngine.start();
      res.json({ success: true, message: 'Trading engine started' });
    } catch (error) {
      this.logger.error('Failed to start engine', error as Error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to start engine',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async stopEngine(_req: Request, res: Response): Promise<void> {
    try {
      await this.tradingEngine.stop();
      res.json({ success: true, message: 'Trading engine stopped' });
    } catch (error) {
      this.logger.error('Failed to stop engine', error as Error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to stop engine',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async pauseEngine(_req: Request, res: Response): Promise<void> {
    try {
      await this.tradingEngine.pause();
      res.json({ success: true, message: 'Trading engine paused' });
    } catch (error) {
      this.logger.error('Failed to pause engine', error as Error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to pause engine',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async resumeEngine(_req: Request, res: Response): Promise<void> {
    try {
      await this.tradingEngine.resume();
      res.json({ success: true, message: 'Trading engine resumed' });
    } catch (error) {
      this.logger.error('Failed to resume engine', error as Error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to resume engine',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async executeTradingCycle(_req: Request, res: Response): Promise<void> {
    try {
      const result = await this.tradingEngine.executeTradingCycle();
      res.json({ success: true, result });
    } catch (error) {
      this.logger.error('Failed to execute trading cycle', error as Error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to execute trading cycle',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

/**
 * Factory function to create API server
 */
export function createApiServer(
  config: ApiServerConfig,
  logger: LoggingService,
  tradingEngine: TradingEngine,
  portfolioManager: PortfolioManager,
  guidelinesManager: GuidelinesManager
): ApiServer {
  return new ApiServer(config, logger, tradingEngine, portfolioManager, guidelinesManager);
}
