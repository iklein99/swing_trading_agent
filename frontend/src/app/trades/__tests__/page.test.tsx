import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TradesPage from '../page';

// Mock the API client module
jest.mock('@/lib/api-client', () => ({
  apiClient: {
    getTradeHistory: jest.fn(),
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

describe('TradesPage', () => {
  const mockTrades = [
    {
      id: '1',
      symbol: 'AAPL',
      action: 'BUY' as const,
      quantity: 100,
      price: 150.00,
      timestamp: new Date('2024-01-15T10:30:00'),
      reasoning: 'Strong technical setup',
      signalId: 'signal-1',
      fees: 1.50,
      status: 'EXECUTED' as const,
    },
    {
      id: '2',
      symbol: 'MSFT',
      action: 'SELL' as const,
      quantity: 50,
      price: 300.00,
      timestamp: new Date('2024-01-20T14:45:00'),
      reasoning: 'Profit target reached',
      signalId: 'signal-2',
      fees: 2.00,
      status: 'EXECUTED' as const,
    },
    {
      id: '3',
      symbol: 'GOOGL',
      action: 'BUY' as const,
      quantity: 25,
      price: 140.00,
      timestamp: new Date('2024-01-22T09:15:00'),
      reasoning: 'Entry signal triggered',
      signalId: 'signal-3',
      fees: 0.75,
      status: 'PENDING' as const,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.getTradeHistory as jest.Mock).mockResolvedValue({
      trades: mockTrades,
      total: mockTrades.length,
      limit: 50,
      filters: {},
    });
  });

  it('renders loading state initially', () => {
    render(<TradesPage />);
    // Check for loading skeleton
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders trade history after loading', async () => {
    render(<TradesPage />);

    await waitFor(() => {
      expect(screen.getByText('Trade History')).toBeInTheDocument();
    });

    // Check trades are displayed
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('GOOGL')).toBeInTheDocument();
  });

  it('displays trade details correctly', async () => {
    render(<TradesPage />);

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    // Check AAPL trade details - use getAllByText for values that appear multiple times
    expect(screen.getAllByText('100').length).toBeGreaterThan(0); // quantity
    expect(screen.getAllByText('$150.00').length).toBeGreaterThan(0); // price
    expect(screen.getAllByText('$15,000.00').length).toBeGreaterThan(0); // total
    expect(screen.getByText('$1.50')).toBeInTheDocument(); // fees
  });

  it('displays action badges with correct colors', async () => {
    render(<TradesPage />);

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    const buyBadges = screen.getAllByText('BUY');
    const sellBadge = screen.getByText('SELL');

    buyBadges.forEach(badge => {
      expect(badge).toHaveClass('bg-green-100', 'text-green-800');
    });
    expect(sellBadge).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('displays status badges correctly', async () => {
    render(<TradesPage />);

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    const executedBadges = screen.getAllByText('EXECUTED');
    const pendingBadge = screen.getByText('PENDING');

    executedBadges.forEach(badge => {
      expect(badge).toHaveClass('bg-green-100', 'text-green-800');
    });
    expect(pendingBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  it('filters trades by symbol', async () => {
    const mockFilteredTrades = [mockTrades[0]];
    (apiClient.getTradeHistory as jest.Mock).mockResolvedValue({
      trades: mockFilteredTrades,
      total: 1,
      limit: 50,
      filters: { symbol: 'AAPL' },
    });

    render(<TradesPage />);

    await waitFor(() => {
      expect(screen.getByText('Trade History')).toBeInTheDocument();
    });

    const symbolInput = screen.getByPlaceholderText('e.g., AAPL');
    fireEvent.change(symbolInput, { target: { value: 'AAPL' } });

    await waitFor(() => {
      expect(apiClient.getTradeHistory).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'AAPL' })
      );
    });
  });

  it('filters trades by action', async () => {
    render(<TradesPage />);

    await waitFor(() => {
      expect(screen.getByText('Trade History')).toBeInTheDocument();
    });

    // Find all selects and get the second one (Action select)
    const selects = document.querySelectorAll('select');
    const actionSelect = selects[0]; // First select is Action
    fireEvent.change(actionSelect, { target: { value: 'BUY' } });

    await waitFor(() => {
      expect(apiClient.getTradeHistory).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BUY' })
      );
    });
  });

  it('clears filters when clear button is clicked', async () => {
    render(<TradesPage />);

    await waitFor(() => {
      expect(screen.getByText('Trade History')).toBeInTheDocument();
    });

    // Set filters
    const symbolInput = screen.getByPlaceholderText('e.g., AAPL');
    fireEvent.change(symbolInput, { target: { value: 'AAPL' } });

    // Clear filters
    const clearButton = screen.getByText('Clear Filters');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(symbolInput).toHaveValue('');
    });
  });

  it('displays empty state when no trades', async () => {
    (apiClient.getTradeHistory as jest.Mock).mockResolvedValue({
      trades: [],
      total: 0,
      limit: 50,
      filters: {},
    });

    render(<TradesPage />);

    await waitFor(() => {
      expect(screen.getByText('No trades found')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    (apiClient.getTradeHistory as jest.Mock).mockRejectedValue(
      new Error('API Error')
    );

    render(<TradesPage />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load trades')).toBeInTheDocument();
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
  });

  it('has navigation link back to dashboard', async () => {
    render(<TradesPage />);

    await waitFor(() => {
      expect(screen.getByText('Trade History')).toBeInTheDocument();
    });

    const backLink = screen.getByText('← Back to Dashboard');
    expect(backLink).toHaveAttribute('href', '/');
  });

  it('displays trade count in title', async () => {
    render(<TradesPage />);

    await waitFor(() => {
      expect(screen.getByText('Trades (3)')).toBeInTheDocument();
    });
  });
});
