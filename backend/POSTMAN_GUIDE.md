# Postman Collection Guide

## Importing the Collection

### Method 1: Import from File
1. Open Postman
2. Click **Import** button (top left)
3. Click **Upload Files**
4. Select `Swing_Trading_Agent_API.postman_collection.json`
5. Click **Import**

### Method 2: Drag and Drop
1. Open Postman
2. Drag the `Swing_Trading_Agent_API.postman_collection.json` file into the Postman window
3. The collection will be imported automatically

## Collection Structure

The collection is organized into 6 main folders:

### 1. Health & Status
- **Health Check** - Basic server health
- **Get System Status** - Trading engine status
- **Get System Health** - Detailed component health

### 2. Portfolio
- **Get Portfolio** - Complete portfolio data
- **Get Current Positions** - Open positions
- **Get Portfolio Metrics** - Performance metrics
- **Get Performance Stats** - Detailed statistics

### 3. Trade History
- **Get All Trades** - Trade history with filters
- **Get Trade by ID** - Individual trade details
- **Filter Trades by Symbol** - Symbol-specific trades
- **Filter Trades by Action** - BUY/SELL filtered trades

### 4. Logs
- **Get Logs** - Query logs with filters
- **Get Error Logs** - Error-level logs only
- **Get Logs by Component** - Component-specific logs
- **Get Log Summary** - Aggregated statistics
- **Get LLM Interactions** - LLM conversation logs
- **Get Trading Cycle Logs** - Cycle execution logs

### 5. Guidelines Management
- **Get Current Guidelines** - View loaded guidelines
- **Get Guidelines Status** - Loading/validation status
- **Reload Guidelines** - Hot-reload from file
- **Validate Current Guidelines** - Validate loaded guidelines
- **Validate Custom Guidelines** - Validate provided guidelines

### 6. Trading Engine Control
- **Start Engine** - Initialize and start
- **Stop Engine** - Halt trading
- **Pause Engine** - Temporarily pause
- **Resume Engine** - Resume from pause
- **Execute Trading Cycle** - Manual cycle trigger

## Using the Collection

### Variables

The collection uses a `baseUrl` variable set to `http://localhost:3001`. 

To change the base URL:
1. Click on the collection name
2. Go to **Variables** tab
3. Update the `baseUrl` value
4. Click **Save**

### Testing Workflow

Here's a recommended testing workflow:

#### 1. Verify Server is Running
```
GET /health
```
Should return: `{ "status": "ok", "timestamp": "..." }`

#### 2. Check System Status
```
GET /api/status
```
View engine status, uptime, and performance metrics.

#### 3. View Portfolio
```
GET /api/portfolio
```
See current portfolio state with positions and balances.

#### 4. Check Guidelines
```
GET /api/guidelines/status
```
Verify guidelines are loaded and valid.

#### 5. View Current Guidelines
```
GET /api/guidelines
```
See all trading rules and parameters.

#### 6. Test Guidelines Reload
```
POST /api/guidelines/reload
```
Test hot-reload functionality (modify the YAML file first).

#### 7. Start Trading Engine
```
POST /api/engine/start
```
Initialize the trading engine.

#### 8. Execute a Trading Cycle
```
POST /api/engine/cycle
```
Manually trigger a trading cycle.

#### 9. View Logs
```
GET /api/logs?limit=20
```
Check recent system activity.

#### 10. Stop Engine
```
POST /api/engine/stop
```
Safely stop the trading engine.

## Query Parameters

Many endpoints support query parameters for filtering:

### Logs Endpoint
```
GET /api/logs?level=ERROR&component=TRADING_ENGINE&limit=50
```

Available parameters:
- `level`: DEBUG, INFO, WARN, ERROR, FATAL
- `component`: TRADING_ENGINE, SIGNAL_GENERATOR, etc.
- `startDate`: ISO date string
- `endDate`: ISO date string
- `limit`: Number of results (default: 100)
- `offset`: Pagination offset (default: 0)

### Trades Endpoint
```
GET /api/trades?symbol=AAPL&action=BUY&limit=20
```

Available parameters:
- `symbol`: Stock symbol (e.g., AAPL, MSFT)
- `action`: BUY or SELL
- `limit`: Number of results (default: 100)

## Tips & Tricks

### 1. Save Responses
Right-click on a request → **Save Response** → **Save as Example**
This helps document expected responses.

### 2. Use Environments
Create different environments for:
- **Local Development**: `http://localhost:3001`
- **Staging**: `https://staging.example.com`
- **Production**: `https://api.example.com`

### 3. Add Tests
Click on the **Tests** tab in any request to add assertions:

```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has portfolio data", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('totalValue');
});
```

### 4. Use Pre-request Scripts
For requests that need authentication or dynamic data:

```javascript
// Set timestamp
pm.variables.set("timestamp", new Date().toISOString());
```

### 5. Chain Requests
Use the **Collection Runner** to execute multiple requests in sequence:
1. Click on collection → **Run**
2. Select requests to run
3. Set iterations and delay
4. Click **Run**

## Common Use Cases

### Testing Guidelines Changes
1. Modify `artifacts/swing_trading_guidelines.yaml`
2. Run: `POST /api/guidelines/reload`
3. Run: `GET /api/guidelines/status` to verify
4. Run: `GET /api/guidelines` to see changes

### Monitoring Trading Activity
1. Run: `POST /api/engine/start`
2. Run: `POST /api/engine/cycle`
3. Run: `GET /api/logs/cycles` to see cycle results
4. Run: `GET /api/portfolio/metrics` to see impact

### Debugging Errors
1. Run: `GET /api/logs?level=ERROR&limit=50`
2. Run: `GET /api/logs/summary` for overview
3. Run: `GET /api/health` to check component status

### Performance Analysis
1. Run: `GET /api/portfolio/performance`
2. Run: `GET /api/trades?limit=100`
3. Run: `GET /api/logs/summary`

## Troubleshooting

### Connection Refused
- Verify server is running: `npm run dev:server`
- Check port 3001 is not in use
- Verify `baseUrl` variable is correct

### 404 Not Found
- Check endpoint path is correct
- Verify server version matches collection
- Check for typos in URL

### 500 Internal Server Error
- Check server logs in terminal
- Run: `GET /api/logs?level=ERROR`
- Verify guidelines are loaded: `GET /api/guidelines/status`

### Guidelines Not Loading
- Check file path in `.env`
- Verify YAML syntax is valid
- Run: `POST /api/guidelines/reload`
- Check: `GET /api/guidelines/status`

## Next Steps

1. **Customize the collection** - Add your own requests
2. **Create test suites** - Add automated tests
3. **Set up monitors** - Schedule automated runs
4. **Share with team** - Export and share the collection
5. **Document responses** - Save example responses

## Additional Resources

- [Postman Documentation](https://learning.postman.com/docs/)
- [API Testing Guide](./API_TESTING.md)
- [Server Documentation](./README.md)
