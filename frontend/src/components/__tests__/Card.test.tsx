/**
 * Tests for Card Component
 */

import { render, screen } from '@testing-library/react';
import Card from '../Card';

describe('Card', () => {
  it('should render children', () => {
    render(
      <Card>
        <div>Test Content</div>
      </Card>
    );
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should render title when provided', () => {
    render(
      <Card title="Test Title">
        <div>Content</div>
      </Card>
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('should not render title section when title is not provided', () => {
    const { container } = render(
      <Card>
        <div>Content</div>
      </Card>
    );
    const titleSection = container.querySelector('.border-b');
    expect(titleSection).not.toBeInTheDocument();
  });

  it('should render action element when provided', () => {
    render(
      <Card title="Test" action={<button>Action</button>}>
        <div>Content</div>
      </Card>
    );
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <Card className="custom-class">
        <div>Content</div>
      </Card>
    );
    const card = container.firstChild;
    expect(card).toHaveClass('custom-class');
  });

  it('should have default styling classes', () => {
    const { container } = render(
      <Card>
        <div>Content</div>
      </Card>
    );
    const card = container.firstChild;
    expect(card).toHaveClass('bg-white', 'rounded-lg', 'shadow-sm');
  });
});
