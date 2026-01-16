# API Testing Guide

This guide will help you test the Swing Trading Agent REST API using Postman or other API testing tools.

## Quick Start

### 1. Start the API Server

```bash
cd backend
npm run dev:server
```

The server will start on `http://localhost:3001` by default.

### 2. Test with Postman

Import the following endpoints into Postman or use them directly:

## Available Endpoints

### Health Check
```
GET http://localhost:3001/health
```
Returns basic health status.

### System Status

#### Get Engine Status
```
GET http://localhost:3001/api/status
```
Returns the current status of the trading engine.

#### Get System Health
```
GET http://localhost:3001/api/health
```
Returns detailed health information for all system components.

### Portfolio Endpoints

#### Get Portfolio
```
GET http://localhost:3001/api/portfolio
```
Returns complete portfolio information including positions and balances.

#### Get Current Positions
```
GET http://localhost:3001/api/portfolio/positions
```
Returns all current open positions.

#### Get Portfolio Metrics
```
GET http://localhost:3001/api/portfolio/metrics
```
Returns portfolio metrics including P&L, position count, and sector exposure.

#### Get Performance Stats
```
GET http://localhost:3001/api/portfolio/performance
```
Returns detailed performance statistics including win rate, profit factor, etc.

### Trade History

#### Get Trade History
```
GET http://localhost:3001/api/trades?limit=50&symbol=AAPL&action=BUY
```
Query parameters:
- `limit` (optional): Number of trades to return (default: 100)
- `symbol` (optional): Filter by stock symbol
- `action` (optional): Filter by action (BUY or SELL)

#### Get Trade by ID
```
GET http://localhost:3001/api/trades/:id
```
Replace `:id` with the actual trade ID.

### Log Viewing

#### Query Logs
```
GET http://localhost:3001/api/logs?level=ERROR&component=TRADING_ENGINE&limit=100
```
Query parameters:
- `level` (optional): Filter by log level (DEBUG, INFO, WARN, ERROR, FATAL)
- `component` (optional): Filter by component
- `startDate` (optional): Start date (ISO format)
- `endDate` (optional): End date (ISO format)
- `limit` (optional): Number of logs to return (default: 100)
- `offset` (optional): Pagination offset (default: 0)

#### Get Log Summary
```
GET http://localhost:3001/api/logs/summary?startDate=2024-01-01&endDate=2024-01-31
```
Returns aggregated log statistics for the specified date range.

#### Get LLM Interactions
```
GET http://localhost:3001/api/logs/llm?limit=50
```
Returns LLM interaction logs with prompts and responses.

#### Get Trading Cycle Logs
```
GET http://localhost:3001/api/logs/cycles?limit=50
```
Returns logs for trading cycle executions.

### Guidelines Management

#### Get Current Guidelines
```
GET http://localhost:3001/api/guidelines
```
Returns the currently loaded trading guidelines.

#### Reload Guidelines
```
POST http://localhost:3001/api/guidelines/reload
```
Reloads guidelines from the configuration file without restarting the server.

#### Validate Guidelines
```
POST http://localhost:3001/api/guidelines/validate
Content-Type: application/json

{
  "guidelines": {
    // Optional: provide guidelines to validate
    // If omitted, validates currently loaded guidelines
  }
}
```
Validates guidelines structure and returns validation results.

#### Get Guidelines Status
```
GET http://localhost:3001/api/guidelines/status
```
Returns the loading status and validation state of guidelines.

### Trading Engine Control

#### Start Engine
```
POST http://localhost:3001/api/engine/start
```
Starts the trading engine.

#### Stop Engine
```
POST http://localhost:3001/api/engine/stop
```
Stops the trading engine.

#### Pause Engine
```
POST http://localhost:3001/api/engine/pause
```
Pauses the trading engine (can be resumed).

#### Resume Engine
```
POST http://localhost:3001/api/engine/resume
```
Resumes a paused trading engine.

#### Execute Trading Cycle
```
POST http://localhost:3001/api/engine/cycle
```
Manually triggers a single trading cycle execution.

## Example Postman Collection

You can create a Postman collection with these endpoints. Here's a sample workflow:

1. **Check Health**: `GET /health`
2. **Get System Status**: `GET /api/status`
3. **Get Portfolio**: `GET /api/portfolio`
4. **Get Guidelines Status**: `GET /api/guidelines/status`
5. **Start Engine**: `POST /api/engine/start`
6. **Execute Cycle**: `POST /api/engine/cycle`
7. **Check Logs**: `GET /api/logs`
8. **Stop Engine**: `POST /api/engine/stop`

## Testing Tips

### Using curl

```bash
# Health check
curl http://localhost:3001/health

# Get portfolio
curl http://localhost:3001/api/portfolio

# Reload guidelines
curl -X POST http://localhost:3001/api/guidelines/reload

# Get logs with filters
curl "http://localhost:3001/api/logs?level=ERROR&limit=10"
```

### Using Postman

1. Create a new collection called "Swing Trading Agent API"
2. Add a variable `baseUrl` with value `http://localhost:3001`
3. Use `{{baseUrl}}` in your requests
4. Save common headers (Content-Type: application/json)
5. Use environments for different configurations (dev, staging, prod)

## Troubleshooting

### Server won't start
- Check if port 3001 is already in use
- Verify database path exists
- Check guidelines file path in .env

### Guidelines not loading
- Verify the guidelines YAML file exists at the configured path
- Check the file format is valid YAML
- Review server logs for validation errors

### Database errors
- Ensure the data directory exists
- Check file permissions
- Verify SQLite is properly installed

## Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=3001
DB_PATH=./data/trading.db
GUIDELINES_PATH=./artifacts/swing_trading_guidelines.yaml
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
LOG_LEVEL=info
```

## Next Steps

- Test all endpoints to ensure they work correctly
- Monitor logs for any errors
- Test guidelines reload functionality
- Verify portfolio operations
- Test trading engine control endpoints
