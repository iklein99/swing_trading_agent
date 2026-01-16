/**
 * API Client for Swing Trading Agent Backend
 * Provides typed methods for all backend API endpoints
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

// Types from backend
export interface EngineStatus {
  isRunning: boolean;
  currentPhase: string;
  uptime: number;
  cyclesCompleted: number;
  errors: string[];
  performance: {
    averageCycleTime: number;
    successRate: number;
    lastError?: string;
    lastErrorTime?: Date;
  };
  lastCycleTime?: Date;
  nextCycleTime?: Date;
}

export interface SystemHealth {
  overall: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE';
  components: {
    [key: string]: ComponentHealth;
  };
  lastCheck: Date;
}

export interface ComponentHealth {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE';
  message: string;
  lastCheck: Date;
  errorRate?: number;
}

export interface Portfolio {
  id: string;
  totalValue: number;
  cashBalance: number;
  positions: Position[];
  dailyPnL: number;
  totalPnL: number;
  lastUpdated: Date;
  createdAt: Date;
}

export interface Position {
  id: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  entryDate: Date;
  stopLoss: number;
  profitTargets: number[];
  unrealizedPnL: number;
  realizedPnL: number;
  exitCriteria: any[];
  lastUpdated: Date;
  sector?: string;
}

export interface PortfolioMetrics {
  totalValue: number;
  totalPnL: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  positionCount: number;
  cashPercentage: number;
  largestPosition: { symbol: string; percentage: number };
  sectorExposure: Record<string, number>;
  lastUpdated: Date;
}

export interface PerformanceStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  currentDrawdown: number;
  sharpeRatio: number;
  sortino: number;
  calmarRatio: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  averageHoldingPeriod: number;
  totalFees: number;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  lastUpdated: Date;
}

export interface GuidelinesStatus {
  loaded: boolean;
  valid: boolean;
  version?: string;
  lastUpdated?: Date;
  validation?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    missingRequiredSections: string[];
  };
}

export interface ApiError {
  error: string;
  message?: string;
}

/**
 * API Client class
 */
export class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL: string = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001') {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        if (error.response) {
          // Server responded with error
          throw new Error(error.response.data.message || error.response.data.error || 'API Error');
        } else if (error.request) {
          // Request made but no response
          throw new Error('No response from server. Is the backend running?');
        } else {
          // Error setting up request
          throw new Error(error.message || 'Request failed');
        }
      }
    );
  }

  // Health & Status
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    const response = await this.client.get('/health');
    return response.data;
  }

  async getSystemStatus(): Promise<EngineStatus> {
    const response = await this.client.get('/api/status');
    return response.data;
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const response = await this.client.get('/api/health');
    return response.data;
  }

  // Portfolio
  async getPortfolio(): Promise<Portfolio> {
    const response = await this.client.get('/api/portfolio');
    return response.data;
  }

  async getPositions(): Promise<Position[]> {
    const response = await this.client.get('/api/portfolio/positions');
    return response.data;
  }

  async getPortfolioMetrics(): Promise<PortfolioMetrics> {
    const response = await this.client.get('/api/portfolio/metrics');
    return response.data;
  }

  async getPerformanceStats(): Promise<PerformanceStats> {
    const response = await this.client.get('/api/portfolio/performance');
    return response.data;
  }

  // Guidelines
  async getGuidelinesStatus(): Promise<GuidelinesStatus> {
    const response = await this.client.get('/api/guidelines/status');
    return response.data;
  }

  async getGuidelines(): Promise<any> {
    const response = await this.client.get('/api/guidelines');
    return response.data;
  }

  async reloadGuidelines(): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/api/guidelines/reload');
    return response.data;
  }

  // Trading Engine Control
  async startEngine(): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/api/engine/start');
    return response.data;
  }

  async stopEngine(): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/api/engine/stop');
    return response.data;
  }

  async pauseEngine(): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/api/engine/pause');
    return response.data;
  }

  async resumeEngine(): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/api/engine/resume');
    return response.data;
  }

  async executeTradingCycle(): Promise<{ success: boolean; result: any }> {
    const response = await this.client.post('/api/engine/cycle');
    return response.data;
  }

  // Logs
  async getLogs(params?: {
    level?: string;
    component?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: any[]; total: number }> {
    const response = await this.client.get('/api/logs', { params });
    return response.data;
  }

  async getLogSummary(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const response = await this.client.get('/api/logs/summary', { params });
    return response.data;
  }
}

// Export singleton instance
let apiClient: ApiClient;

// Only create singleton if not in test environment
if (process.env.NODE_ENV !== 'test') {
  apiClient = new ApiClient();
}

// Export for use in application
export { apiClient };

// Export default
export default ApiClient;
