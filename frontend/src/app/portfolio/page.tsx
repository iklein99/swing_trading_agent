'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient, Position, PortfolioMetrics } from '@/lib/api-client';
import Card from '@/components/Card';

export default function PortfolioPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    // Refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [positionsData, metricsData] = await Promise.all([
        apiClient.getPositions(),
        apiClient.getPortfolioMetrics(),
      ]);
      
      setPositions(positionsData);
      setMetrics(metricsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const calculatePnLPercent = (position: Position) => {
    const pnlPercent = ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100;
    return pnlPercent;
  };

  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <Card title="Error">
            <div className="text-center py-8">
              <div className="text-red-600 text-lg font-semibold mb-2">
                Unable to load portfolio
              </div>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Portfolio</h1>
            <p className="text-gray-600">
              Current positions and performance metrics
            </p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Total Value</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(metrics?.totalValue || 0)}
              </div>
              <div className="text-xs text-gray-500">
                Cash: {formatCurrency((metrics?.totalValue || 0) * ((metrics?.cashPercentage || 0) / 100))}
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Total P&L</div>
              <div className={`text-2xl font-bold ${(metrics?.totalPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(metrics?.totalPnL || 0)}
              </div>
              <div className={`text-xs ${(metrics?.totalPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(((metrics?.totalPnL || 0) / 100000) * 100)}
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Daily P&L</div>
              <div className={`text-2xl font-bold ${(metrics?.dailyPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(metrics?.dailyPnL || 0)}
              </div>
              <div className="text-xs text-gray-500">
                Weekly: {formatCurrency(metrics?.weeklyPnL || 0)}
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Open Positions</div>
              <div className="text-2xl font-bold text-gray-900">
                {metrics?.positionCount || 0}
              </div>
              <div className="text-xs text-gray-500">
                Cash: {metrics?.cashPercentage.toFixed(1)}%
              </div>
            </div>
          </Card>
        </div>

        {/* Positions Table */}
        <Card title="Current Positions">
          {positions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-lg mb-2">No open positions</div>
              <p className="text-gray-500 text-sm">
                Positions will appear here when trades are executed
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Symbol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entry Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      P&L
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stop Loss
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entry Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {positions.map((position) => {
                    const pnlPercent = calculatePnLPercent(position);
                    const isProfitable = position.unrealizedPnL >= 0;
                    
                    return (
                      <tr key={position.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {position.symbol}
                              </div>
                              {position.sector && (
                                <div className="text-xs text-gray-500">
                                  {position.sector}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {position.quantity.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(position.entryPrice)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(position.currentPrice)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(position.unrealizedPnL)}
                          </div>
                          <div className={`text-xs ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercent(pnlPercent)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(position.stopLoss)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(position.entryDate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Sector Exposure */}
        {metrics?.sectorExposure && Object.keys(metrics.sectorExposure).length > 0 && (
          <div className="mt-6">
            <Card title="Sector Exposure">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(metrics.sectorExposure).map(([sector, percentage]) => (
                  <div key={sector} className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {sector}
                    </div>
                    <div className="text-2xl font-bold text-primary-600">
                      {percentage.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          Last updated: {new Date().toLocaleTimeString()} • Auto-refreshing every 10 seconds
        </div>
      </div>
    </main>
  );
}
