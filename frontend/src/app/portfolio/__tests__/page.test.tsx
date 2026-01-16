import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PortfolioPage from '../page';

// Mock the API client module
jest.mock('@/lib/api-client', () => ({
  apiClient: {
    getPositions: jest.fn(),
    getPortfolioMetrics: jest.fn(),
  },
}));

// Import after mocking
import { apiClient } from '@/lib/api-client';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

describe('PortfolioPage', () => {
  const mockPositions = [
    {
      id: '1',
      symbol: 'AAPL',
      quantity: 100,
      entryPrice: 150.00,
      currentPrice: 155.00,
      entryDate: new Date('2024-01-15'),
      stopLoss: 145.00,
      profitTargets: [160.00, 165.00],
      unrealizedPnL: 500.00,
      realizedPnL: 0,
      exitCriteria: [],
      lastUpdated: new Date(),
      sector: 'Technology',
    },
    {
      id: '2',
      symbol: 'MSFT',
      quantity: 50,
      entryPrice: 300.00,
      currentPrice: 295.00,
      entryDate: new Date('2024-01-20'),
      stopLoss: 285.00,
      profitTargets: [310.00, 320.00],
      unrealizedPnL: -250.00,
      realizedPnL: 0,
      exitCriteria: [],
      lastUpdated: new Date(),
      sector: 'Technology',
    },
  ];

  const mockMetrics = {
    totalValue: 100000,
    totalPnL: 5000,
    dailyPnL: 250,
    weeklyPnL: 1000,
    monthlyPnL: 3000,
    positionCount: 2,
    cashPercentage: 50,
    largestPosition: { symbol: 'AAPL', percentage: 25 },
    sectorExposure: { Technology: 75, Healthcare: 25 },
    lastUpdated: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.getPositions as jest.Mock).mockResolvedValue(mockPositions);
    (apiClient.getPortfolioMetrics as jest.Mock).mockResolvedValue(mockMetrics);
  });

  it('renders loading state initially', () => {
    render(<PortfolioPage />);
    // Check for loading skeleton
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders portfolio data after loading', async () => {
    render(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('Portfolio')).toBeInTheDocument();
    });

    // Check portfolio summary
    expect(screen.getByText('$100,000.00')).toBeInTheDocument();
    expect(screen.getByText('$5,000.00')).toBeInTheDocument();
    expect(screen.getByText('$250.00')).toBeInTheDocument();

    // Check positions
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getAllByText('Technology').length).toBeGreaterThan(0);
  });

  it('displays position details correctly', async () => {
    render(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    // Check AAPL position details
    expect(screen.getByText('100')).toBeInTheDocument(); // quantity
    expect(screen.getByText('$150.00')).toBeInTheDocument(); // entry price
    expect(screen.getByText('$155.00')).toBeInTheDocument(); // current price
    expect(screen.getByText('$500.00')).toBeInTheDocument(); // P&L
  });

  it('shows sector exposure when available', async () => {
    render(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('Sector Exposure')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Technology').length).toBeGreaterThan(0);
    expect(screen.getByText('Healthcare')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  it('displays empty state when no positions', async () => {
    (apiClient.getPositions as jest.Mock).mockResolvedValue([]);
    (apiClient.getPortfolioMetrics as jest.Mock).mockResolvedValue({
      ...mockMetrics,
      positionCount: 0,
    });

    render(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('No open positions')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    (apiClient.getPositions as jest.Mock).mockRejectedValue(
      new Error('API Error')
    );

    render(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load portfolio')).toBeInTheDocument();
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
  });

  it('displays P&L with correct colors', async () => {
    render(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    // Positive P&L should be green
    const positivePnL = screen.getByText('$500.00');
    expect(positivePnL).toHaveClass('text-green-600');

    // Negative P&L should be red
    const negativePnL = screen.getByText('-$250.00');
    expect(negativePnL).toHaveClass('text-red-600');
  });

  it('has navigation link back to dashboard', async () => {
    render(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('Portfolio')).toBeInTheDocument();
    });

    const backLink = screen.getByText('← Back to Dashboard');
    expect(backLink).toHaveAttribute('href', '/');
  });
});
