/**
 * Tests for API Client
 */

import { ApiClient } from '../api-client';
import axios from 'axios';

// Mock axios module
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ApiClient', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Create mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn((onSuccess, onError) => {
            // Store the interceptor functions for testing if needed
            return 0;
          }),
        },
      },
    };

    // Mock axios.create to return our mock instance
    mockedAxios.create = jest.fn(() => mockAxiosInstance);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Health & Status', () => {
    it('should fetch health check', async () => {
      const client = new ApiClient('http://localhost:3001');
      const mockResponse = { data: { status: 'ok', timestamp: new Date() } };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await client.healthCheck();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
      expect(result).toEqual(mockResponse.data);
    });

    it('should fetch system status', async () => {
      const client = new ApiClient('http://localhost:3001');
      const mockStatus = {
        isRunning: true,
        currentPhase: 'IDLE',
        uptime: 3600,
        cyclesCompleted: 10,
        errors: [],
        performance: {
          averageCycleTime: 1500,
          successRate: 100,
        },
      };
      mockAxiosInstance.get.mockResolvedValue({ data: mockStatus });

      const result = await client.getSystemStatus();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/status');
      expect(result).toEqual(mockStatus);
    });

    it('should fetch system health', async () => {
      const client = new ApiClient('http://localhost:3001');
      const mockHealth = {
        overall: 'HEALTHY',
        components: {},
        lastCheck: new Date(),
      };
      mockAxiosInstance.get.mockResolvedValue({ data: mockHealth });

      const result = await client.getSystemHealth();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/health');
      expect(result).toEqual(mockHealth);
    });
  });

  describe('Portfolio', () => {
    it('should fetch portfolio', async () => {
      const client = new ApiClient('http://localhost:3001');
      const mockPortfolio = {
        id: 'test',
        totalValue: 100000,
        cashBalance: 50000,
        positions: [],
        dailyPnL: 500,
        totalPnL: 5000,
        lastUpdated: new Date(),
        createdAt: new Date(),
      };
      mockAxiosInstance.get.mockResolvedValue({ data: mockPortfolio });

      const result = await client.getPortfolio();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/portfolio');
      expect(result).toEqual(mockPortfolio);
    });

    it('should fetch positions', async () => {
      const client = new ApiClient('http://localhost:3001');
      const mockPositions = [
        {
          id: 'pos-1',
          symbol: 'AAPL',
          quantity: 100,
          entryPrice: 150,
          currentPrice: 155,
          entryDate: new Date(),
          stopLoss: 145,
          profitTargets: [160],
          unrealizedPnL: 500,
          realizedPnL: 0,
          exitCriteria: [],
          lastUpdated: new Date(),
        },
      ];
      mockAxiosInstance.get.mockResolvedValue({ data: mockPositions });

      const result = await client.getPositions();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/portfolio/positions');
      expect(result).toEqual(mockPositions);
    });

    it('should fetch portfolio metrics', async () => {
      const client = new ApiClient('http://localhost:3001');
      const mockMetrics = {
        totalValue: 100000,
        totalPnL: 5000,
        dailyPnL: 500,
        weeklyPnL: 2000,
        monthlyPnL: 5000,
        positionCount: 3,
        cashPercentage: 50,
        largestPosition: { symbol: 'AAPL', percentage: 15 },
        sectorExposure: {},
        lastUpdated: new Date(),
      };
      mockAxiosInstance.get.mockResolvedValue({ data: mockMetrics });

      const result = await client.getPortfolioMetrics();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/portfolio/metrics');
      expect(result).toEqual(mockMetrics);
    });
  });

  describe('Guidelines', () => {
    it('should fetch guidelines status', async () => {
      const client = new ApiClient('http://localhost:3001');
      const mockStatus = {
        loaded: true,
        valid: true,
        version: '1.0.0',
      };
      mockAxiosInstance.get.mockResolvedValue({ data: mockStatus });

      const result = await client.getGuidelinesStatus();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/guidelines/status');
      expect(result).toEqual(mockStatus);
    });

    it('should reload guidelines', async () => {
      const client = new ApiClient('http://localhost:3001');
      const mockResponse = { success: true, message: 'Guidelines reloaded' };
      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await client.reloadGuidelines();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/guidelines/reload');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Trading Engine Control', () => {
    it('should start engine', async () => {
      const client = new ApiClient('http://localhost:3001');
      const mockResponse = { success: true, message: 'Engine started' };
      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await client.startEngine();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/engine/start');
      expect(result).toEqual(mockResponse);
    });

    it('should stop engine', async () => {
      const client = new ApiClient('http://localhost:3001');
      const mockResponse = { success: true, message: 'Engine stopped' };
      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await client.stopEngine();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/engine/stop');
      expect(result).toEqual(mockResponse);
    });

    it('should execute trading cycle', async () => {
      const client = new ApiClient('http://localhost:3001');
      const mockResponse = {
        success: true,
        result: {
          buySignalsProcessed: 2,
          sellSignalsProcessed: 1,
          exitCriteriaChecked: 3,
          tradesExecuted: [],
          errors: [],
          executionTime: 1500,
        },
      };
      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse});

      const result = await client.executeTradingCycle();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/engine/cycle');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Logs', () => {
    it('should fetch logs with parameters', async () => {
      const client = new ApiClient('http://localhost:3001');
      const mockLogs = { logs: [], total: 0 };
      mockAxiosInstance.get.mockResolvedValue({ data: mockLogs });

      const params = { level: 'ERROR', limit: 50 };
      const result = await client.getLogs(params);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/logs', { params });
      expect(result).toEqual(mockLogs);
    });

    it('should fetch log summary', async () => {
      const client = new ApiClient('http://localhost:3001');
      const mockSummary = {
        totalLogs: 100,
        errorCount: 5,
        warningCount: 10,
      };
      mockAxiosInstance.get.mockResolvedValue({ data: mockSummary });

      const result = await client.getLogSummary();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/logs/summary', { params: undefined });
      expect(result).toEqual(mockSummary);
    });
  });
});
