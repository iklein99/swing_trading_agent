# Postman Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Import the Collection
1. Open Postman
2. Click **Import** (top left)
3. Select `Swing_Trading_Agent_API.postman_collection.json`
4. Click **Import**

### Step 2: Verify Server is Running
The server should already be running at `http://localhost:3001`

If not, start it with:
```bash
cd backend
npm run dev:server
```

### Step 3: Test Your First Endpoint
In Postman, expand the collection and run:
- **Health & Status** → **Health Check**

You should see:
```json
{
  "status": "ok",
  "timestamp": "2026-01-16T20:05:27.329Z"
}
```

## 🎯 Quick Test Sequence

Try these requests in order:

1. **Health Check** ✅
   ```
   GET /health
   ```

2. **System Status** 📊
   ```
   GET /api/status
   ```

3. **Portfolio** 💼
   ```
   GET /api/portfolio
   ```

4. **Guidelines Status** 📋
   ```
   GET /api/guidelines/status
   ```

5. **Current Guidelines** 📖
   ```
   GET /api/guidelines
   ```

## 🔥 Popular Endpoints

### View Portfolio
```
GET /api/portfolio
```
See your current portfolio value, positions, and P&L.

### Reload Guidelines
```
POST /api/guidelines/reload
```
Hot-reload trading guidelines without restarting the server.

### Execute Trading Cycle
```
POST /api/engine/cycle
```
Manually trigger a trading cycle to test the system.

### View Recent Logs
```
GET /api/logs?limit=20
```
See the last 20 log entries.

### Check for Errors
```
GET /api/logs?level=ERROR&limit=10
```
View recent error logs.

## 📁 Collection Structure

```
Swing Trading Agent API
├── Health & Status (3 requests)
├── Portfolio (4 requests)
├── Trade History (4 requests)
├── Logs (6 requests)
├── Guidelines Management (5 requests)
└── Trading Engine Control (5 requests)
```

**Total: 27 pre-configured requests**

## 💡 Pro Tips

### Tip 1: Use the Collection Runner
Run multiple requests in sequence:
1. Click collection → **Run**
2. Select requests
3. Click **Run**

### Tip 2: Save Example Responses
Right-click request → **Save Response** → **Save as Example**

### Tip 3: Add Tests
Click **Tests** tab and add:
```javascript
pm.test("Status is 200", () => {
    pm.response.to.have.status(200);
});
```

### Tip 4: Use Variables
The collection uses `{{baseUrl}}` variable.
Change it in: Collection → Variables tab

## 🐛 Troubleshooting

### Can't Connect?
- ✅ Check server is running: `npm run dev:server`
- ✅ Verify URL: `http://localhost:3001`
- ✅ Check port 3001 is available

### 404 Error?
- ✅ Check endpoint path
- ✅ Verify server version

### 500 Error?
- ✅ Check server logs in terminal
- ✅ Run: `GET /api/logs?level=ERROR`

## 📚 More Information

- **Full Guide**: See `POSTMAN_GUIDE.md`
- **API Documentation**: See `API_TESTING.md`
- **Server Logs**: Check terminal where server is running

## ✨ What's Included

The collection includes requests for:
- ✅ System health and status monitoring
- ✅ Portfolio management and metrics
- ✅ Trade history and filtering
- ✅ Comprehensive logging and debugging
- ✅ Guidelines management and validation
- ✅ Trading engine control

## 🎉 You're Ready!

Start testing the API with Postman. The server is running and ready to receive requests!

**Server URL**: `http://localhost:3001`
**Collection**: `Swing_Trading_Agent_API.postman_collection.json`
**Requests**: 27 pre-configured endpoints

Happy testing! 🚀
