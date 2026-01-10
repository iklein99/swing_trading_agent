-- Swing Trading Agent Database Schema
-- SQLite database schema for the trading system

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Portfolios table
CREATE TABLE IF NOT EXISTS portfolios (
    id TEXT PRIMARY KEY,
    total_value REAL NOT NULL DEFAULT 0,
    cash_balance REAL NOT NULL DEFAULT 0,
    daily_pnl REAL NOT NULL DEFAULT 0,
    total_pnl REAL NOT NULL DEFAULT 0,
    last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    portfolio_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    entry_price REAL NOT NULL,
    current_price REAL NOT NULL,
    entry_date DATETIME NOT NULL,
    stop_loss REAL NOT NULL,
    profit_targets TEXT NOT NULL, -- JSON array of profit targets
    unrealized_pnl REAL NOT NULL DEFAULT 0,
    realized_pnl REAL NOT NULL DEFAULT 0,
    sector TEXT,
    last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
);

-- Exit criteria table
CREATE TABLE IF NOT EXISTS exit_criteria (
    id TEXT PRIMARY KEY,
    position_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('STOP_LOSS', 'PROFIT_TARGET', 'TIME_BASED', 'TECHNICAL')),
    value REAL NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
);

-- Trading signals table
CREATE TABLE IF NOT EXISTS trading_signals (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
    confidence REAL NOT NULL,
    reasoning TEXT NOT NULL,
    technical_indicators TEXT NOT NULL, -- JSON object
    recommended_size INTEGER NOT NULL,
    stop_loss REAL NOT NULL,
    profit_targets TEXT NOT NULL, -- JSON array
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reasoning TEXT NOT NULL,
    signal_id TEXT,
    fees REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'EXECUTED', 'FAILED'))
);

-- Portfolio snapshots table for historical tracking
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id TEXT PRIMARY KEY,
    portfolio_id TEXT NOT NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_value REAL NOT NULL,
    cash_balance REAL NOT NULL,
    position_count INTEGER NOT NULL,
    daily_pnl REAL NOT NULL,
    total_pnl REAL NOT NULL,
    positions TEXT NOT NULL, -- JSON array of position snapshots
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
);

-- Execution logs table
CREATE TABLE IF NOT EXISTS execution_logs (
    id TEXT PRIMARY KEY,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    component TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL, -- JSON object
    level TEXT NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')),
    execution_cycle_id TEXT NOT NULL,
    duration INTEGER, -- milliseconds
    success BOOLEAN NOT NULL DEFAULT 1,
    error TEXT
);

-- LLM interactions table
CREATE TABLE IF NOT EXISTS llm_interactions (
    id TEXT PRIMARY KEY,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    model TEXT NOT NULL,
    processing_time INTEGER NOT NULL, -- milliseconds
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    cost REAL,
    associated_signal_id TEXT,
    associated_trade_id TEXT,
    success BOOLEAN NOT NULL DEFAULT 1,
    error TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0
);

-- Trading cycle logs table
CREATE TABLE IF NOT EXISTS trading_cycle_logs (
    id TEXT PRIMARY KEY,
    cycle_id TEXT NOT NULL UNIQUE,
    start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    duration INTEGER, -- milliseconds
    phase TEXT NOT NULL DEFAULT 'STARTING' CHECK (phase IN ('STARTING', 'BUY_SIGNALS', 'SELL_SIGNALS', 'EXIT_CRITERIA', 'PORTFOLIO_UPDATE', 'COMPLETED', 'FAILED')),
    buy_signals_generated INTEGER NOT NULL DEFAULT 0,
    sell_signals_generated INTEGER NOT NULL DEFAULT 0,
    exit_criteria_triggered INTEGER NOT NULL DEFAULT 0,
    trades_executed INTEGER NOT NULL DEFAULT 0,
    errors TEXT, -- JSON array of error messages
    success BOOLEAN NOT NULL DEFAULT 1
);

-- Performance stats table (computed metrics)
CREATE TABLE IF NOT EXISTS performance_stats (
    id TEXT PRIMARY KEY,
    portfolio_id TEXT NOT NULL,
    total_trades INTEGER NOT NULL DEFAULT 0,
    winning_trades INTEGER NOT NULL DEFAULT 0,
    losing_trades INTEGER NOT NULL DEFAULT 0,
    win_rate REAL NOT NULL DEFAULT 0,
    average_win REAL NOT NULL DEFAULT 0,
    average_loss REAL NOT NULL DEFAULT 0,
    profit_factor REAL NOT NULL DEFAULT 0,
    max_drawdown REAL NOT NULL DEFAULT 0,
    current_drawdown REAL NOT NULL DEFAULT 0,
    sharpe_ratio REAL NOT NULL DEFAULT 0,
    sortino REAL NOT NULL DEFAULT 0,
    calmar_ratio REAL NOT NULL DEFAULT 0,
    max_consecutive_wins INTEGER NOT NULL DEFAULT 0,
    max_consecutive_losses INTEGER NOT NULL DEFAULT 0,
    average_holding_period REAL NOT NULL DEFAULT 0, -- hours
    total_fees REAL NOT NULL DEFAULT 0,
    net_profit REAL NOT NULL DEFAULT 0,
    gross_profit REAL NOT NULL DEFAULT 0,
    gross_loss REAL NOT NULL DEFAULT 0,
    last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_positions_portfolio_id ON positions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_execution_logs_timestamp ON execution_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_execution_logs_component ON execution_logs(component);
CREATE INDEX IF NOT EXISTS idx_execution_logs_cycle_id ON execution_logs(execution_cycle_id);
CREATE INDEX IF NOT EXISTS idx_llm_interactions_timestamp ON llm_interactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_timestamp ON portfolio_snapshots(timestamp);
CREATE INDEX IF NOT EXISTS idx_exit_criteria_position_id ON exit_criteria(position_id);
CREATE INDEX IF NOT EXISTS idx_exit_criteria_active ON exit_criteria(is_active);

-- Insert default portfolio if none exists
INSERT OR IGNORE INTO portfolios (id, total_value, cash_balance) 
VALUES ('default', 100000.0, 100000.0);