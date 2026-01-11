/**
 * Unit tests for GuidelinesManager
 * Tests guidelines file parsing, validation, file watching, and error handling
 */

import { promises as fs } from 'fs';
import path from 'path';
import { 
  GuidelinesManager, 
  GuidelinesManagerError, 
  createGuidelinesManager
} from '../guidelines-manager';
import {
  TradingGuidelines,
  GuidelinesManagerConfig
} from '@shared/types';
import { LoggingService, createLoggingService } from '../logging-service';
import { DatabaseConnection } from '../../database/connection';

// Mock console methods to avoid noise in tests
const originalConsole = { ...console };
beforeAll(() => {
  console.debug = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

// Mock file system operations
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
}));

// Mock chokidar
jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn()
  }))
}));

// Mock database connection
jest.mock('../../database/connection', () => ({
  DatabaseConnection: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    db: {
      prepare: jest.fn(() => ({
        run: jest.fn(),
        get: jest.fn(),
        all: jest.fn()
      }))
    }
  }))
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('GuidelinesManager', () => {
  let db: DatabaseConnection;
  let loggingService: LoggingService;
  let guidelinesManager: GuidelinesManager;
  let testGuidelinesPath: string;
  let mockGuidelinesContent: string;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mocked database for testing
    db = new DatabaseConnection(':memory:');
    await db.initialize();
    
    loggingService = createLoggingService(db, 'GUIDELINES_MANAGER');
    
    testGuidelinesPath = 'test-guidelines.md';
    
    const config: GuidelinesManagerConfig = {
      guidelinesFilePath: testGuidelinesPath,
      watchForChanges: false, // Disable for most tests
      backupOnLoad: false,
      validateOnLoad: true
    };
    
    guidelinesManager = new GuidelinesManager(loggingService, config);
    // Mock guidelines content
    mockGuidelinesContent = `
# Swing Trading Guidelines

## 1. Stock Selection Criteria

### 1.1 Liquidity Requirements
- **Minimum Average Daily Volume**: 1,000,000 shares
- **Minimum Market Cap**: $500M (mid-cap and above)
- **Bid-Ask Spread**: < 0.5% of stock price

### 1.2 Volatility Metrics
- **Average True Range (ATR)**: 2-8% of stock price (14-day period)
- **Historical Volatility**: 20-60% annualized
- **Beta**: 0.8 - 2.0 (relative to market)

### 1.3 Price Range
- **Stock Price**: $10 - $500 per share

### 1.4 Technical Setup Requirements
- **Clear Trend**: Stock should be in a defined uptrend or downtrend
- **Support/Resistance Levels**: Identifiable key levels
- **Volume Confirmation**: Recent volume increase during price moves
- **Not Extended**: Price should not be >3 ATR away from key moving averages

### 1.5 Fundamental Filters (Optional but Recommended)
- **Avoid**: Companies with upcoming earnings within 3-5 days
- **News Check**: No major pending news events
- **Sector Strength**: Relative sector performance positive or neutral
- **Financial Health**: Avoid companies with bankruptcy risk

## 2. Entry Criteria

### 2.1 Technical Entry Signals

#### Long (Buy) Entries
1. **Breakout Entry**
   - Price breaks above resistance with volume >150% of average
   - Confirmation: Close above resistance for 2 consecutive periods

2. **Pullback Entry**
   - Stock in uptrend (price above 20-day and 50-day MA)
   - Price pulls back to support level or moving average

3. **Moving Average Bounce**
   - Price approaches 20-day or 50-day EMA in an uptrend
   - RSI (14) oversold (<40) or reaching support zone

4. **Momentum Entry**
   - MACD crosses above signal line
   - RSI crosses above 50 (from below)
   - Price above VWAP

#### Short (Sell) Entries
1. **Breakdown Entry**
   - Price breaks below support with volume >150% of average
   - Confirmation: Close below support for 2 consecutive periods

### 2.2 Entry Timing
- **Time of Day**: Avoid first 15 minutes (9:30-9:45 AM ET) and last 15 minutes of trading
- **Optimal Window**: 10:00 AM - 3:30 PM ET

### 2.3 Position Sizing
- **Risk Per Trade**: 1-2% of total portfolio value
- **Maximum Position**: No single position should exceed 10% of portfolio

## 3. Exit Criteria - Take Profit Targets

### 3.1 Target Setting Methods

#### Method 1: ATR-Based Targets
- **Target 1**: Entry + (1.5 × ATR) - Take 33% profit
- **Target 2**: Entry + (2.5 × ATR) - Take 33% profit
- **Target 3**: Entry + (4.0 × ATR) - Take remaining position

#### Method 4: Risk/Reward Ratio
- **Minimum R:R**: 2:1 (profit target is 2× the risk)
- **Preferred R:R**: 3:1 or higher

### 3.2 Partial Profit Taking Strategy
- **Scale Out Approach**: Recommended for reducing risk
  - Exit 33% at Target 1
  - Exit 33% at Target 2
  - Trail stop on remaining 33%

### 3.3 Trailing Stop Strategy
- **Activation**: After Target 1 or Target 2 is hit
- **Trailing Amount**: 1.5-2.0 × ATR below current high (for longs)
- **Lock in Profits**: Move stop to break-even after 1.5:1 R:R is achieved

## 4. Exit Criteria - Stop Losses

### 4.1 Initial Stop Loss Placement

#### For Long Positions
- **Below Support**: 1-2% below identified support level
- **ATR-Based**: Entry - (1.0-1.5 × ATR)
- **Percentage**: 5-8% below entry (adjust based on volatility)

### 4.2 Stop Loss Rules
- **Always Use Stops**: Never enter a position without a predefined stop loss
- **Wide Enough**: Stop should be beyond normal price noise
- **Not Too Wide**: If required stop exceeds 2% account risk, reduce position size

### 4.3 Break-Even Stop
- **When**: After price moves favorably by 1.5× initial risk
- **Action**: Move stop loss to entry price (zero loss point)

### 4.4 Time-Based Stop
- **Holding Period**: Maximum 5-15 trading days (swing trade duration)

## 6. Risk Management Rules

### 6.1 Overall Portfolio Rules
- **Maximum Daily Loss**: 3% of portfolio - stop trading for the day if hit
- **Maximum Weekly Loss**: 6% of portfolio - reduce position sizes if hit
- **Maximum Open Positions**: 5-8 positions (for diversification)
- **Maximum Risk Per Sector**: 30% of portfolio

### 6.2 Trade Management Rules
- **Review Each Trade**: Log entry reason, exit plan, and actual results
- **No Revenge Trading**: Don't immediately re-enter after a stop loss
- **No Averaging Down**: Don't add to losing positions
- **Scale In Carefully**: If adding to winners, only after confirmation

### 6.3 Market Environment Adaptation
- **Trending Market**: Favor breakout/breakdown strategies, wider targets
- **Range-Bound Market**: Favor pullback strategies, tighter targets
- **High Volatility**: Reduce position sizes, widen stops, quicker profit-taking
- **Low Volatility**: Can use tighter stops, but expect smaller moves
`;

    // Setup mock file system responses
    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(mockGuidelinesContent);
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    guidelinesManager.dispose();
    await db.close();
  });
  describe('Service Initialization', () => {
    test('should initialize with correct configuration', () => {
      const config: GuidelinesManagerConfig = {
        guidelinesFilePath: 'custom-guidelines.md',
        watchForChanges: true,
        backupOnLoad: true,
        validateOnLoad: false
      };

      const manager = new GuidelinesManager(loggingService, config);
      expect(manager).toBeDefined();
    });

    test('should create service using factory function', () => {
      const manager = createGuidelinesManager(loggingService, { 
        guidelinesFilePath: 'factory-test.md' 
      });
      expect(manager).toBeDefined();
    });
  });

  describe('Guidelines Loading', () => {
    test('should load guidelines from file successfully', async () => {
      const guidelines = await guidelinesManager.loadGuidelines();
      
      expect(guidelines).toBeDefined();
      expect(guidelines.stockSelection).toBeDefined();
      expect(guidelines.entrySignals).toBeDefined();
      expect(guidelines.exitCriteria).toBeDefined();
      expect(guidelines.riskManagement).toBeDefined();
      expect(guidelines.version).toBeDefined();
      expect(guidelines.lastUpdated).toBeInstanceOf(Date);
      expect(guidelines.filePath).toBe(path.resolve(testGuidelinesPath));
    });

    test('should parse liquidity requirements correctly', async () => {
      const guidelines = await guidelinesManager.loadGuidelines();
      
      expect(guidelines.stockSelection.liquidityRequirements).toEqual({
        minimumAverageDailyVolume: 1000000,
        minimumMarketCap: 500000000,
        maxBidAskSpreadPercent: 0.5
      });
    });

    test('should parse volatility metrics correctly', async () => {
      const guidelines = await guidelinesManager.loadGuidelines();
      
      expect(guidelines.stockSelection.volatilityMetrics).toEqual({
        atrRange: { min: 2, max: 8 },
        historicalVolatilityRange: { min: 20, max: 60 },
        betaRange: { min: 0.8, max: 2.0 }
      });
    });

    test('should parse price range correctly', async () => {
      const guidelines = await guidelinesManager.loadGuidelines();
      
      expect(guidelines.stockSelection.priceRange).toEqual({
        minPrice: 10,
        maxPrice: 500
      });
    });

    test('should parse entry signals correctly', async () => {
      const guidelines = await guidelinesManager.loadGuidelines();
      
      expect(guidelines.entrySignals.longEntries).toHaveLength(4);
      expect(guidelines.entrySignals.longEntries[0]).toMatchObject({
        name: 'Breakout Entry',
        type: 'BREAKOUT',
        volumeRequirement: 1.5,
        confirmationRequired: true,
        riskRewardRatio: 2.0
      });
    });

    test('should parse risk management rules correctly', async () => {
      const guidelines = await guidelinesManager.loadGuidelines();
      
      expect(guidelines.riskManagement.portfolioRules).toMatchObject({
        maxDailyLossPercent: 3,
        maxWeeklyLossPercent: 6,
        maxSectorExposurePercent: 30,
        riskPerTradePercent: 2
      });
    });

    test('should handle file not found error', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));
      
      await expect(guidelinesManager.loadGuidelines())
        .rejects.toThrow(GuidelinesManagerError);
      
      await expect(guidelinesManager.loadGuidelines())
        .rejects.toThrow('Guidelines file not found');
    });

    test('should handle file read error', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));
      
      await expect(guidelinesManager.loadGuidelines())
        .rejects.toThrow(GuidelinesManagerError);
    });

    test('should store current guidelines after successful load', async () => {
      const guidelines = await guidelinesManager.loadGuidelines();
      
      const current = guidelinesManager.getCurrentGuidelines();
      expect(current).toEqual(guidelines);
    });
  });

  describe('Guidelines Validation', () => {
    test('should validate correct guidelines successfully', async () => {
      const guidelines = await guidelinesManager.loadGuidelines();
      const validation = guidelinesManager.validateGuidelines(guidelines);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.missingRequiredSections).toHaveLength(0);
    });

    test('should detect missing required sections', () => {
      const incompleteGuidelines = {
        stockSelection: {},
        // Missing entrySignals, exitCriteria, riskManagement
        lastUpdated: new Date(),
        version: '1.0.0',
        filePath: 'test.md'
      } as TradingGuidelines;
      
      const validation = guidelinesManager.validateGuidelines(incompleteGuidelines);
      
      expect(validation.isValid).toBe(false);
      expect(validation.missingRequiredSections).toContain('entrySignals');
      expect(validation.missingRequiredSections).toContain('exitCriteria');
      expect(validation.missingRequiredSections).toContain('riskManagement');
    });

    test('should validate liquidity requirements', async () => {
      const guidelines = await guidelinesManager.loadGuidelines();
      
      // Test invalid values
      guidelines.stockSelection.liquidityRequirements.minimumAverageDailyVolume = -1000;
      guidelines.stockSelection.liquidityRequirements.maxBidAskSpreadPercent = 150;
      
      const validation = guidelinesManager.validateGuidelines(guidelines);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Minimum average daily volume must be positive');
      expect(validation.errors).toContain('Max bid-ask spread percent must be between 0 and 100');
    });

    test('should validate volatility metrics ranges', async () => {
      const guidelines = await guidelinesManager.loadGuidelines();
      
      // Test invalid ranges
      guidelines.stockSelection.volatilityMetrics.atrRange = { min: 10, max: 5 };
      guidelines.stockSelection.volatilityMetrics.betaRange = { min: 2.0, max: 1.0 };
      
      const validation = guidelinesManager.validateGuidelines(guidelines);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('ATR range minimum must be less than maximum');
      expect(validation.errors).toContain('Beta range minimum must be less than maximum');
    });

    test('should validate price range', async () => {
      const guidelines = await guidelinesManager.loadGuidelines();
      
      // Test invalid price range
      guidelines.stockSelection.priceRange = { minPrice: 100, maxPrice: 50 };
      
      const validation = guidelinesManager.validateGuidelines(guidelines);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Price range minimum must be less than maximum');
    });

    test('should validate risk management rules', async () => {
      const guidelines = await guidelinesManager.loadGuidelines();
      
      // Test invalid risk percentages
      guidelines.riskManagement.portfolioRules.maxDailyLossPercent = 150;
      guidelines.riskManagement.portfolioRules.riskPerTradePercent = -5;
      guidelines.riskManagement.portfolioRules.maxOpenPositions = 0;
      
      const validation = guidelinesManager.validateGuidelines(guidelines);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Max daily loss percent must be between 0 and 100');
      expect(validation.errors).toContain('Risk per trade percent must be between 0 and 100');
      expect(validation.errors).toContain('Max open positions must be positive');
    });

    test('should validate entry signals', async () => {
      const guidelines = await guidelinesManager.loadGuidelines();
      
      // Test invalid entry signals
      if (guidelines.entrySignals.longEntries[0]) {
        guidelines.entrySignals.longEntries[0].name = '';
        guidelines.entrySignals.longEntries[0].riskRewardRatio = -1;
        guidelines.entrySignals.longEntries[0].volumeRequirement = 0;
      }
      
      const validation = guidelinesManager.validateGuidelines(guidelines);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('must have a name'))).toBe(true);
      expect(validation.errors.some(e => e.includes('positive risk/reward ratio'))).toBe(true);
      expect(validation.errors.some(e => e.includes('positive volume requirement'))).toBe(true);
    });

    test('should generate warnings for missing optional sections', async () => {
      const guidelines = await guidelinesManager.loadGuidelines();
      
      // Remove optional sections
      guidelines.entrySignals.shortEntries = [];
      guidelines.exitCriteria.trailingStops = undefined as any;
      
      const validation = guidelinesManager.validateGuidelines(guidelines);
      
      expect(validation.warnings).toContain('No short entry signals defined');
      expect(validation.warnings).toContain('No trailing stop rules defined');
    });
  });
  describe('Guidelines Reloading', () => {
    test('should reload guidelines successfully', async () => {
      // Load initial guidelines
      await guidelinesManager.loadGuidelines();
      
      // Modify mock content
      const modifiedContent = mockGuidelinesContent.replace('1,000,000 shares', '2,000,000 shares');
      mockFs.readFile.mockResolvedValue(modifiedContent);
      
      // Reload guidelines
      const reloadedGuidelines = await guidelinesManager.reloadGuidelines();
      
      expect(reloadedGuidelines).toBeDefined();
      expect(reloadedGuidelines.stockSelection.liquidityRequirements.minimumAverageDailyVolume).toBe(2000000);
    });

    test('should notify callbacks on guidelines change', async () => {
      const callback = jest.fn();
      
      // Load initial guidelines and register callback
      await guidelinesManager.loadGuidelines();
      guidelinesManager.watchGuidelinesFile(callback);
      
      // Reload guidelines
      await guidelinesManager.reloadGuidelines();
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        stockSelection: expect.any(Object),
        entrySignals: expect.any(Object)
      }));
    });

    test('should handle callback errors gracefully', async () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      
      await guidelinesManager.loadGuidelines();
      guidelinesManager.watchGuidelinesFile(errorCallback);
      
      // Should not throw even if callback throws
      await expect(guidelinesManager.reloadGuidelines()).resolves.toBeDefined();
      expect(errorCallback).toHaveBeenCalled();
    });
  });

  describe('Guidelines Access Methods', () => {
    beforeEach(async () => {
      await guidelinesManager.loadGuidelines();
    });

    test('should get stock selection criteria', () => {
      const criteria = guidelinesManager.getStockSelectionCriteria();
      
      expect(criteria).toBeDefined();
      expect(criteria?.liquidityRequirements).toBeDefined();
      expect(criteria?.volatilityMetrics).toBeDefined();
      expect(criteria?.priceRange).toBeDefined();
    });

    test('should get entry signal rules', () => {
      const rules = guidelinesManager.getEntrySignalRules();
      
      expect(rules).toBeDefined();
      expect(rules?.longEntries).toBeDefined();
      expect(rules?.shortEntries).toBeDefined();
      expect(rules?.timingRules).toBeDefined();
    });

    test('should get exit criteria rules', () => {
      const rules = guidelinesManager.getExitCriteriaRules();
      
      expect(rules).toBeDefined();
      expect(rules?.profitTargets).toBeDefined();
      expect(rules?.stopLosses).toBeDefined();
    });

    test('should get risk management rules', () => {
      const rules = guidelinesManager.getRiskManagementRules();
      
      expect(rules).toBeDefined();
      expect(rules?.portfolioRules).toBeDefined();
      expect(rules?.tradeManagement).toBeDefined();
    });

    test('should return null when no guidelines loaded', () => {
      const freshManager = new GuidelinesManager(loggingService, {
        guidelinesFilePath: 'test.md',
        watchForChanges: false,
        backupOnLoad: false,
        validateOnLoad: false
      });
      
      expect(freshManager.getCurrentGuidelines()).toBeNull();
      expect(freshManager.getStockSelectionCriteria()).toBeNull();
      expect(freshManager.getEntrySignalRules()).toBeNull();
      expect(freshManager.getExitCriteriaRules()).toBeNull();
      expect(freshManager.getRiskManagementRules()).toBeNull();
      
      freshManager.dispose();
    });
  });

  describe('Error Handling and Fallback Mechanisms', () => {
    test('should use last valid guidelines when validation fails', async () => {
      // Load valid guidelines first
      const validGuidelines = await guidelinesManager.loadGuidelines();
      
      // Mock invalid content that will fail validation
      const invalidContent = `
# Invalid Guidelines
## Stock Selection
- Minimum Average Daily Volume: -1000 shares
- Maximum Daily Loss: 150% of portfolio
`;
      mockFs.readFile.mockResolvedValue(invalidContent);
      
      // Try to reload - should return last valid guidelines
      const reloadedGuidelines = await guidelinesManager.reloadGuidelines();
      
      // Should return the same valid guidelines (by reference or deep equality)
      expect(reloadedGuidelines.version).toBe(validGuidelines.version);
      expect(reloadedGuidelines.stockSelection.liquidityRequirements.minimumAverageDailyVolume)
        .toBe(validGuidelines.stockSelection.liquidityRequirements.minimumAverageDailyVolume);
    });

    test('should handle parsing errors gracefully', async () => {
      // Mock content that will cause parsing issues
      mockFs.readFile.mockResolvedValue('# Invalid Guidelines\nNo proper structure');
      
      const guidelines = await guidelinesManager.loadGuidelines();
      
      // Should still return a guidelines object with defaults
      expect(guidelines).toBeDefined();
      expect(guidelines.stockSelection).toBeDefined();
    });

    test('should handle validation errors during load', async () => {
      const config: GuidelinesManagerConfig = {
        guidelinesFilePath: testGuidelinesPath,
        watchForChanges: false,
        backupOnLoad: false,
        validateOnLoad: true
      };
      
      const manager = new GuidelinesManager(loggingService, config);
      
      // Mock content that will fail validation - create invalid guidelines with negative values
      const invalidGuidelines = `
# Invalid Guidelines
## Stock Selection
- Minimum Average Daily Volume: -1000 shares
- Maximum Daily Loss: 150% of portfolio
`;
      mockFs.readFile.mockResolvedValue(invalidGuidelines);
      
      await expect(manager.loadGuidelines()).rejects.toThrow(GuidelinesManagerError);
      await expect(manager.loadGuidelines()).rejects.toThrow('Guidelines validation failed');
      
      manager.dispose();
    });

    test('should handle backup creation errors gracefully', async () => {
      const config: GuidelinesManagerConfig = {
        guidelinesFilePath: testGuidelinesPath,
        watchForChanges: false,
        backupOnLoad: true,
        validateOnLoad: false
      };
      
      const manager = new GuidelinesManager(loggingService, config);
      
      // Mock backup write failure
      mockFs.writeFile.mockRejectedValue(new Error('Backup write failed'));
      
      // Should still load guidelines successfully
      const guidelines = await manager.loadGuidelines();
      expect(guidelines).toBeDefined();
      
      manager.dispose();
    });
  });

  describe('File Watching', () => {
    test('should setup file watcher when configured', async () => {
      const { watch } = require('chokidar');
      const mockWatcher = {
        on: jest.fn(),
        close: jest.fn()
      };
      
      (watch as jest.Mock).mockReturnValue(mockWatcher);
      
      const config: GuidelinesManagerConfig = {
        guidelinesFilePath: testGuidelinesPath,
        watchForChanges: true,
        backupOnLoad: false,
        validateOnLoad: false
      };
      
      const manager = new GuidelinesManager(loggingService, config);
      
      // Load guidelines to trigger watcher setup
      await manager.loadGuidelines();
      
      expect(watch).toHaveBeenCalledWith(testGuidelinesPath, expect.any(Object));
      expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));
      
      manager.dispose();
    });

    test('should stop watching when disposed', async () => {
      const { watch } = require('chokidar');
      const mockWatcher = {
        on: jest.fn(),
        close: jest.fn()
      };
      
      (watch as jest.Mock).mockReturnValue(mockWatcher);
      
      const config: GuidelinesManagerConfig = {
        guidelinesFilePath: testGuidelinesPath,
        watchForChanges: true,
        backupOnLoad: false,
        validateOnLoad: false
      };
      
      const manager = new GuidelinesManager(loggingService, config);
      
      // Load guidelines to set up watcher
      await manager.loadGuidelines();
      
      manager.stopWatching();
      expect(mockWatcher.close).toHaveBeenCalled();
      
      manager.dispose();
    });
  });

  describe('Resource Cleanup', () => {
    test('should dispose resources properly', async () => {
      await guidelinesManager.loadGuidelines();
      
      // Add some callbacks
      guidelinesManager.watchGuidelinesFile(() => {});
      guidelinesManager.watchGuidelinesFile(() => {});
      
      // Dispose should clean up everything
      guidelinesManager.dispose();
      
      expect(guidelinesManager.getCurrentGuidelines()).toBeNull();
    });
  });
});

describe('GuidelinesManager Factory Function', () => {
  let db: DatabaseConnection;
  let loggingService: LoggingService;

  beforeEach(async () => {
    db = new DatabaseConnection(':memory:');
    await db.initialize();
    loggingService = createLoggingService(db, 'GUIDELINES_MANAGER');
  });

  afterEach(async () => {
    await db.close();
  });

  test('should create manager with default configuration', () => {
    const manager = createGuidelinesManager(loggingService);
    expect(manager).toBeInstanceOf(GuidelinesManager);
    manager.dispose();
  });

  test('should create manager with custom configuration', () => {
    const customConfig = {
      guidelinesFilePath: 'custom-guidelines.md',
      watchForChanges: false,
      validateOnLoad: false
    };
    
    const manager = createGuidelinesManager(loggingService, customConfig);
    expect(manager).toBeInstanceOf(GuidelinesManager);
    manager.dispose();
  });

  test('should merge custom config with defaults', () => {
    const partialConfig = {
      guidelinesFilePath: 'partial-config.md'
    };
    
    const manager = createGuidelinesManager(loggingService, partialConfig);
    expect(manager).toBeInstanceOf(GuidelinesManager);
    manager.dispose();
  });
});