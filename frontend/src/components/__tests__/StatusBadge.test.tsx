/**
 * Tests for StatusBadge Component
 */

import { render, screen } from '@testing-library/react';
import StatusBadge from '../StatusBadge';

describe('StatusBadge', () => {
  it('should render with HEALTHY status', () => {
    render(<StatusBadge status="HEALTHY" />);
    expect(screen.getByText('HEALTHY')).toBeInTheDocument();
  });

  it('should render with custom label', () => {
    render(<StatusBadge status="RUNNING" label="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('RUNNING')).not.toBeInTheDocument();
  });

  it('should apply correct color for HEALTHY status', () => {
    const { container } = render(<StatusBadge status="HEALTHY" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-green-100', 'text-green-800');
  });

  it('should apply correct color for WARNING status', () => {
    const { container } = render(<StatusBadge status="WARNING" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  it('should apply correct color for CRITICAL status', () => {
    const { container } = render(<StatusBadge status="CRITICAL" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('should apply correct color for OFFLINE status', () => {
    const { container } = render(<StatusBadge status="OFFLINE" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
  });

  it('should render status indicator dot', () => {
    const { container } = render(<StatusBadge status="HEALTHY" />);
    const dot = container.querySelector('.w-2.h-2');
    expect(dot).toBeInTheDocument();
  });
});
