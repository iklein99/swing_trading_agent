/**
 * Basic test to verify the frontend package setup
 */

import { render, screen } from '@testing-library/react';
import Home from '../app/page';

describe('Frontend Package Setup', () => {
  it('should render the home page', () => {
    render(<Home />);
    
    const heading = screen.getByRole('heading', { name: /swing trading agent/i });
    expect(heading).toBeInTheDocument();
  });

  it('should pass basic test', () => {
    expect(true).toBe(true);
  });
});