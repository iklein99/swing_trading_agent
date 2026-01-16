'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient, EngineStatus, SystemHealth, PortfolioMetrics } from '@/lib/api-client';
import Card from '@/components/Card';
import StatusBadge from '@/components/StatusBadge';

export default function Home() {
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    // Refresh every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [status, health, metrics] = await Promise.all([
        apiClient.getSystemStatus(),
        apiClient.getSystemHealth(),
        apiClient.getPortfolioMetrics(),
      ]);
      
      setEngineStatus(status);
      setSystemHealth(health);
      setPortfolioMetrics(metrics);
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

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-gray-200 rounded"></div>
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
          <Card title="Connection Error">
            <div className="text-center py-8">
              <div className="text-red-600 text-lg font-semibold mb-2">
                Unable to connect to backend
              </div>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Retry Connection
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Swing Trading Agent Dashboard
          </h1>
          <p className="text-gray-600">
            Monitor your autonomous trading system in real-time
          </p>
        </div>

        {/* Quick Navigation */}
        <div className="mb-8 flex gap-4">
          <Link
            href="/portfolio"
            className="px-6 py-3 bg-white border border-gray-200 rounded-lg hover:border-primary-500 hover:shadow-md transition-all"
          >
            <div className="text-sm font-medium text-gray-900">Portfolio</div>
            <div className="text-xs text-gray-500">View positions</div>
          </Link>
          <Link
            href="/trades"
            className="px-6 py-3 bg-white border border-gray-200 rounded-lg hover:border-primary-500 hover:shadow-md transition-all"
          >
            <div className="text-sm font-medium text-gray-900">Trades</div>
            <div className="text-xs text-gray-500">Trade history</div>
          </Link>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Engine Status */}
          <Card>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Engine Status</div>
              <StatusBadge
                status={engineStatus?.isRunning ? 'RUNNING' : 'STOPPED'}
                label={engineStatus?.isRunning ? 'Running' : 'Stopped'}
              />
              <div className="text-xs text-gray-500 mt-2">
                Phase: {engineStatus?.currentPhase || 'N/A'}
              </div>
            </div>
          </Card>

          {/* System Health */}
          <Card>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">System Health</div>
              <StatusBadge status={systemHealth?.overall || 'OFFLINE'} />
              <div className="text-xs text-gray-500 mt-2">
                {Object.keys(systemHealth?.components || {}).length} components
              </div>
            </div>
          </Card>

          {/* Portfolio Value */}
          <Card>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Portfolio Value</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(portfolioMetrics?.totalValue || 0)}
              </div>
              <div className={`text-sm ${(portfolioMetrics?.dailyPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(portfolioMetrics?.dailyPnL || 0)} today
              </div>
            </div>
          </Card>

          {/* Total P&L */}
          <Card>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Total P&L</div>
              <div className={`text-2xl font-bold ${(portfolioMetrics?.totalPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(portfolioMetrics?.totalPnL || 0)}
              </div>
              <div className="text-sm text-gray-500">
                {formatPercent(((portfolioMetrics?.totalPnL || 0) / 100000) * 100)}
              </div>
            </div>
          </Card>
        </div>

        {/* Detailed Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Engine Details */}
          <Card title="Trading Engine">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Uptime</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatUptime(engineStatus?.uptime || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Cycles Completed</span>
                <span className="text-sm font-medium text-gray-900">
                  {engineStatus?.cyclesCompleted || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Success Rate</span>
                <span className="text-sm font-medium text-gray-900">
                  {engineStatus?.performance.successRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Avg Cycle Time</span>
                <span className="text-sm font-medium text-gray-900">
                  {engineStatus?.performance.averageCycleTime.toFixed(0)}ms
                </span>
              </div>
              {engineStatus?.errors && engineStatus.errors.length > 0 && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="text-sm font-medium text-red-600 mb-2">
                    Recent Errors ({engineStatus.errors.length})
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    {engineStatus.errors.slice(0, 3).map((error, i) => (
                      <div key={i} className="truncate">{error}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Portfolio Details */}
          <Card title="Portfolio Overview">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Cash Balance</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(portfolioMetrics?.totalValue ? portfolioMetrics.totalValue * (portfolioMetrics.cashPercentage / 100) : 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Open Positions</span>
                <span className="text-sm font-medium text-gray-900">
                  {portfolioMetrics?.positionCount || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Cash Percentage</span>
                <span className="text-sm font-medium text-gray-900">
                  {portfolioMetrics?.cashPercentage.toFixed(1)}%
                </span>
              </div>
              {portfolioMetrics?.largestPosition && portfolioMetrics.largestPosition.symbol && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Largest Position</span>
                  <span className="text-sm font-medium text-gray-900">
                    {portfolioMetrics.largestPosition.symbol} ({portfolioMetrics.largestPosition.percentage.toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* System Components */}
        {systemHealth && (
          <div className="mt-6">
            <Card title="System Components">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(systemHealth.components).map(([name, component]) => (
                  <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-gray-900 capitalize">
                        {name.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{component.message}</div>
                    </div>
                    <StatusBadge status={component.status} label="" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          Last updated: {new Date().toLocaleTimeString()} • Auto-refreshing every 5 seconds
        </div>
      </div>
    </main>
  );
}