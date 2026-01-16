/**
 * Basic test to verify the frontend package setup
 */

import { render, screen, waitFor } from '@testing-library/react';
import Home from '../app/page';
import { apiClient } from '@/lib/api-client';

// Mock the API client
jest.mock('@/lib/api-client', () => ({
  apiClient: {
    getSystemStatus: jest.fn(),
    getSystemHealth: jest.fn(),
    getPortfolioMetrics: jest.fn(),
  },
}));

describe('Frontend Package Setup', () => {
  beforeEach(() => {
    // Mock successful API responses
    (apiClient.getSystemStatus as jest.Mock).mockResolvedValue({
      isRunning: true,
      currentPhase: 'IDLE',
      uptime: 3600,
      cyclesCompleted: 10,
      errors: [],
      performance: {
        averageCycleTime: 1500,
        successRate: 100,
      },
    });

    (apiClient.getSystemHealth as jest.Mock).mockResolvedValue({
      overall: 'HEALTHY',
      components: {
        tradingEngine: { status: 'HEALTHY', message: 'OK', lastCheck: new Date() },
      },
      lastCheck: new Date(),
    });

    (apiClient.getPortfolioMetrics as jest.Mock).mockResolvedValue({
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
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the dashboard', async () => {
    render(<Home />);
    
    await waitFor(() => {
      const heading = screen.getByText(/Swing Trading Agent Dashboard/i);
      expect(heading).toBeInTheDocument();
    });
  });

  it('should display portfolio value', async () => {
    render(<Home />);
    
    await waitFor(() => {
      expect(screen.getByText(/Portfolio Value/i)).toBeInTheDocument();
      expect(screen.getByText(/\$100,000\.00/)).toBeInTheDocument();
    });
  });

  it('should display engine status', async () => {
    render(<Home />);
    
    await waitFor(() => {
      expect(screen.getByText(/Engine Status/i)).toBeInTheDocument();
      expect(screen.getByText(/Running/i)).toBeInTheDocument();
    });
  });

  it('should pass basic test', () => {
    expect(true).toBe(true);
  });
});
