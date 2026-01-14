# Swing Trading Agent

An autonomous trading system that executes swing trades using large language model reasoning and systematic trading guidelines.

## Overview

The Swing Trading Agent is a TypeScript-based system that combines LLM-powered market analysis with systematic trading rules to execute swing trades automatically. The system operates with a simulated trading account, tracks performance metrics, and provides a comprehensive web interface for monitoring trades and system status.

## Features

- **Autonomous Trading**: LLM-powered signal generation with systematic execution
- **Risk Management**: Automated position sizing, stop losses, and portfolio limits
- **Web Interface**: Next.js dashboard for monitoring trades and performance
- **Comprehensive Logging**: Full audit trail of all decisions and LLM interactions
- **Modular Architecture**: Easily configurable LLM providers and data sources

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Interface │    │  Trading Agent  │    │ Market Data API │
│   (Next.js/TS)  │◄──►│   (Node.js/TS)  │◄──►│  (Massive.com)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Local Database  │    │   LLM Service   │
                       │   (SQLite)      │    │ (AWS Bedrock)   │
                       └─────────────────┘    └─────────────────┘
```

## Project Structure

- `backend/` - Node.js/TypeScript trading engine and API
- `frontend/` - Next.js web interface
- `shared/` - Common types and utilities
- `artifacts/` - Trading guidelines and configuration files
- `.kiro/specs/` - Feature specifications and implementation plan

## Trading Guidelines

The system uses a structured YAML configuration file (`artifacts/swing_trading_guidelines.yaml`) to define trading parameters and rules. This configuration file contains:

- **Stock Selection Criteria**: Liquidity requirements, volatility metrics, price ranges
- **Entry Signals**: Technical indicators and confirmation requirements
- **Exit Criteria**: Stop loss methods, profit targets, trailing stops
- **Risk Management**: Position limits, daily loss limits, sector concentration rules

### Configuration vs. Logic

The guidelines file contains **configurable parameters** (the "what"):
- Thresholds: `minimumAverageDailyVolume: 1000000`
- Limits: `maxPositionSizePercent: 10`
- Ranges: `atrPercentRange: { min: 2, max: 8 }`
- Percentages: `dailyLossLimit: 3`

The **trading logic** (the "how") remains in the code:
- How to calculate moving averages to determine trends
- How to combine multiple indicators for signal generation
- How to prioritize exit criteria when multiple conditions are met

### Hot-Reload Support

The GuidelinesManager service watches the configuration file for changes and automatically reloads updated parameters without requiring a system restart. This allows for dynamic adjustment of trading rules during operation.

## Getting Started

This project is currently in development. See the implementation plan in `.kiro/specs/swing-trading-agent/tasks.md` for development progress.

## Development

The project follows an incremental development approach with component-by-component testing. Each component is built and tested independently before integration.

## License

MIT License - see LICENSE file for details.