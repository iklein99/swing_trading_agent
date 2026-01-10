/**
 * Basic test to verify the backend package setup
 */

describe('Backend Package Setup', () => {
  it('should pass basic test', () => {
    expect(true).toBe(true);
  });

  it('should have access to shared types', async () => {
    const { PLACEHOLDER_CONSTANT } = await import('@shared/constants');
    expect(PLACEHOLDER_CONSTANT).toBe('TODO');
  });
});