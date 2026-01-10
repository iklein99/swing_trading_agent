/**
 * Database layer exports
 */

// Core database components
export { DatabaseConnection, getDatabase, initializeDatabase } from './connection';
export { DatabaseService, getDatabaseService, initializeDatabaseService } from './database-service';

// Repositories
export { BaseRepository } from './repositories/base-repository';
export { PortfolioRepository } from './repositories/portfolio-repository';
export { PositionRepository } from './repositories/position-repository';
export { TradeRepository, TradeHistoryFilter, TradeStats } from './repositories/trade-repository';
export { LoggingRepository, LogStats } from './repositories/logging-repository';

// Types
export type { DatabaseStats } from './connection';