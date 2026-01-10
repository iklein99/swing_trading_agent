/**
 * Basic test to verify the shared package setup
 */

import { PLACEHOLDER_CONSTANT } from '../constants';

describe('Shared Package Setup', () => {
  it('should export placeholder constant', () => {
    expect(PLACEHOLDER_CONSTANT).toBe('TODO');
  });

  it('should pass basic test', () => {
    expect(true).toBe(true);
  });
});