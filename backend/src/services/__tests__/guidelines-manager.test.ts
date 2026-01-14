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
    
    testGuidelinesPath = 'test-guidelines.yaml';
    
    const config: GuidelinesManagerConfig = {
      guidelinesFilePath: testGuidelinesPath,
      watchForChanges: false, // Disable for most tests
      backupOnLoad: false,
      validateOnLoad: true
    };
    
    guidelinesManager = new GuidelinesManager(loggingService, config);
    
    // Mock YAML guidelines content
    mockGuidelinesContent = `
version: "1.0.0"
lastUpdated: "2025-01-14"

stockSelection:
  liquidityRequirements:
    minimumAverageDailyVolume: 1000000
    minimumMarketCap: 500000000
    maxBidAskSpreadPercent: 0.5
  
  volatilityMetrics:
    atrRange:
      min: 2.0
      max: 8.0
    historicalVolatilityRange:
      min: 20.0
      max: 60.0
    betaRange:
      min: 0.8
      max: 2.0
  
  priceRange:
    minPrice: 10.0
    maxPrice: 500.0
  
  technicalSetupRequirements:
    requireClearTrend: true
    requireSupportResistance: true
    requireVolumeConfirmation: true
    maxATRExtension: 3.0
  
  fundamentalFilters:
    avoidEarningsWithinDays: 5
    checkMajorNews: true
    requirePositiveSectorStrength: true
    avoidFinancialDistress: true

entrySignals:
  longEntries:
    - name: "Breakout Entry"
      type: "BREAKOUT"
      conditions:
        - "Price breaks above resistance"
        - "Volume >150% of average"
      volumeRequirement: 1.5
      confirmationRequired: true
      riskRewardRatio: 2.0
    
    - name: "Pullback Entry"
      type: "PULLBACK"
      conditions:
        - "Stock in uptrend"
      volumeRequirement: 1.0
      confirmationRequired: true
      riskRewardRatio: 2.0
    
    - name: "Moving Average Bounce"
      type: "MOVING_AVERAGE_BOUNCE"
      conditions:
        - "Price approaches MA"
      volumeRequirement: 1.0
      confirmationRequired: false
      riskRewardRatio: 2.0
    
    - name: "Momentum Entry"
      type: "MOMENTUM"
      conditions:
        - "MACD crosses above signal"
      volumeRequirement: 1.0
      confirmationRequired: false
      riskRewardRatio: 2.0
  
  shortEntries:
    - name: "Breakdown Entry"
      type: "BREAKOUT"
      conditions:
        - "Price breaks below support"
      volumeRequirement: 1.5
      confirmationRequired: true
      riskRewardRatio: 2.0
  
  timingRules:
    avoidFirstMinutes: 15
    avoidLastMinutes: 15
    optimalWindowStart: "10:00 AM"
    optimalWindowEnd: "3:30 PM"
  
  positionSizing:
    riskPerTradePercent: 2.0
    maxPositionPercent: 10.0
    maxCorrelatedPositions: 3
    maxSectorPositions: 3

exitCriteria:
  profitTargets:
    - name: "ATR-Based Targets"
      method: "ATR_BASED"
      targets:
        - level: 1
          calculation: "Entry + (1.5 × ATR)"
          exitPercentage: 33
        - level: 2
          calculation: "Entry + (2.5 × ATR)"
          exitPercentage: 33
        - level: 3
          calculation: "Entry + (4.0 × ATR)"
          exitPercentage: 34
      partialExitStrategy:
        scaleOutApproach: true
        target1ExitPercent: 33
        target2ExitPercent: 33
        trailRemainder: true
    
    - name: "Risk/Reward Ratio"
      method: "RISK_REWARD"
      targets:
        - level: 1
          calculation: "2:1 R:R minimum"
          exitPercentage: 50
      partialExitStrategy:
        scaleOutApproach: true
        target1ExitPercent: 50
        target2ExitPercent: 50
        trailRemainder: true
  
  stopLosses:
    methods:
      - name: "Below Support"
        type: "BELOW_SUPPORT"
        calculation: "1-2% below support level"
        bufferPercent: 2.0
      - name: "ATR-Based"
        type: "ATR_BASED"
        calculation: "Entry - (1.0-1.5 × ATR)"
        bufferPercent: 0.0
      - name: "Percentage"
        type: "PERCENTAGE"
        calculation: "5-8% below entry"
        bufferPercent: 8.0
    maxRiskPercent: 2.0
    breakEvenRule:
      activateAtRiskRewardRatio: 1.5
      moveToBreakEven: true
    timeBasedStop:
      maxHoldingDays: 15
      evaluateAtTimeLimit: true
  
  trailingStops:
    activationTrigger: "After Target 1 or Target 2 hit"
    trailingAmount: "1.5-2.0 × ATR below current high"
    adjustmentFrequency: "DAILY"
    lockInProfitsAt: 1.5
  
  timeBasedExits:
    maxHoldingPeriod: 15
    evaluationCriteria:
      - "No progress toward targets"

riskManagement:
  portfolioRules:
    maxDailyLossPercent: 3.0
    maxWeeklyLossPercent: 6.0
    maxDrawdownPercent: 8.0
    maxOpenPositions: 8
    maxSectorExposurePercent: 30.0
    maxPositionSizePercent: 10.0
    riskPerTradePercent: 2.0
  
  tradeManagement:
    noRevengeTrading: true
    noAveragingDown: true
    scaleInCarefully: true
    reviewEachTrade: true
  
  marketEnvironment:
    trendingMarketStrategy: "Favor breakout strategies"
    rangeBoundMarketStrategy: "Favor pullback strategies"
    highVolatilityAdjustments: "Reduce position sizes"
    lowVolatilityAdjustments: "Tighter stops"
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
        guidelinesFilePath: 'custom-guidelines.yaml',
        watchForChanges: true,
        backupOnLoad: true,
        validateOnLoad: false
      };

      const manager = new GuidelinesManager(loggingService, config);
      expect(manager).toBeDefined();
    });

    test('should create service using factory function', () => {
      const manager = createGuidelinesManager(loggingService, { 
        guidelinesFilePath: 'factory-test.yaml' 
      });
      expect(manager).toBeDefined();
    });
  });

  describe('Guidelines Loading', () => {
    test('should load guidelines from YAML file successfully', async () => {
      const guidelines = await guidelinesManager.loadGuidelines();
      
      expect(guidelines).toBeDefined();
      expect(guidelines.stockSelection).toBeDefined();
      expect(guidelines.entrySignals).toBeDefined();
      expect(guidelines.exitCriteria).toBeDefined();
      expect(guidelines.riskManagement).toBeDefined();
      expect(guidelines.version).toBe('1.0.0');
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

    test('should handle invalid YAML format', async () => {
      mockFs.readFile.mockResolvedValue('invalid: yaml: content: [unclosed');
      
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
        filePath: 'test.yaml'
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
      const modifiedContent = mockGuidelinesContent.replace('minimumAverageDailyVolume: 1000000', 'minimumAverageDailyVolume: 2000000');
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
        guidelinesFilePath: 'test.yaml',
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
version: "1.0.0"
stockSelection:
  liquidityRequirements:
    minimumAverageDailyVolume: -1000
entrySignals: {}
exitCriteria: {}
riskManagement:
  portfolioRules:
    maxDailyLossPercent: 150
`;
      mockFs.readFile.mockResolvedValue(invalidContent);
      
      // Try to reload - should return last valid guidelines
      const reloadedGuidelines = await guidelinesManager.reloadGuidelines();
      
      // Should return the same valid guidelines
      expect(reloadedGuidelines.version).toBe(validGuidelines.version);
      expect(reloadedGuidelines.stockSelection.liquidityRequirements.minimumAverageDailyVolume)
        .toBe(validGuidelines.stockSelection.liquidityRequirements.minimumAverageDailyVolume);
    });

    test('should handle YAML parsing errors gracefully', async () => {
      // Mock content with invalid YAML syntax
      mockFs.readFile.mockResolvedValue('invalid: yaml: [unclosed bracket');
      
      await expect(guidelinesManager.loadGuidelines()).rejects.toThrow(GuidelinesManagerError);
      await expect(guidelinesManager.loadGuidelines()).rejects.toThrow('Failed to parse guidelines from YAML');
    });

    test('should handle validation errors during load', async () => {
      const config: GuidelinesManagerConfig = {
        guidelinesFilePath: testGuidelinesPath,
        watchForChanges: false,
        backupOnLoad: false,
        validateOnLoad: true
      };
      
      const manager = new GuidelinesManager(loggingService, config);
      
      // Mock content that will fail validation
      const invalidGuidelines = `
version: "1.0.0"
stockSelection:
  liquidityRequirements:
    minimumAverageDailyVolume: -1000
entrySignals: {}
exitCriteria: {}
riskManagement:
  portfolioRules:
    maxDailyLossPercent: 150
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
      guidelinesFilePath: 'custom-guidelines.yaml',
      watchForChanges: false,
      validateOnLoad: false
    };
    
    const manager = createGuidelinesManager(loggingService, customConfig);
    expect(manager).toBeInstanceOf(GuidelinesManager);
    manager.dispose();
  });

  test('should merge custom config with defaults', () => {
    const partialConfig = {
      guidelinesFilePath: 'partial-config.yaml'
    };
    
    const manager = createGuidelinesManager(loggingService, partialConfig);
    expect(manager).toBeInstanceOf(GuidelinesManager);
    manager.dispose();
  });
});
