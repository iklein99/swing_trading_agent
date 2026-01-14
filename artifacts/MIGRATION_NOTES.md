# Guidelines Migration Notes

## Overview

The trading guidelines have been migrated from a markdown format (`swing_trading_guidelines.md`) to a structured YAML format (`swing_trading_guidelines.yaml`). This change simplifies the system architecture and improves maintainability.

## What Changed

### Before (Markdown Format)
- Guidelines were stored in a markdown file with sections and subsections
- The GuidelinesManager used complex regex patterns to extract values
- Parsing was error-prone and difficult to maintain
- Mixed configuration values with explanatory text

### After (YAML Format)
- Guidelines are stored in a structured YAML configuration file
- The GuidelinesManager uses simple YAML deserialization
- Parsing is straightforward and reliable
- Clear separation between configuration and documentation

## File Locations

- **New Configuration**: `artifacts/swing_trading_guidelines.yaml`
- **Original Reference**: `artifacts/swing_trading_guidelines.md.reference` (kept for reference)
- **This Document**: `artifacts/MIGRATION_NOTES.md`

## Configuration Structure

The YAML file is organized into these main sections:

```yaml
stockSelection:
  liquidityRequirements:
    minimumAverageDailyVolume: 1000000
    minimumAverageDailyValue: 10000000
  volatilityMetrics:
    atrPercentRange: { min: 2, max: 8 }
  priceRange:
    minimumPrice: 10
    maximumPrice: 500

entrySignals:
  technicalIndicators:
    rsiRange: { min: 30, max: 70 }
    volumeConfirmationMultiplier: 1.5
  # ... more sections

exitCriteria:
  stopLoss:
    atrMultiplier: 2
    maxLossPercent: 7
  # ... more sections

riskManagement:
  positionLimits:
    maxPositionSizePercent: 10
    maxOpenPositions: 8
  # ... more sections
```

## What Belongs in Configuration vs. Code

### Configuration File (YAML) - The "What"
Contains **values and parameters** that can be adjusted:
- Thresholds: `minimumAverageDailyVolume: 1000000`
- Limits: `maxPositionSizePercent: 10`
- Ranges: `atrPercentRange: { min: 2, max: 8 }`
- Multipliers: `volumeConfirmationMultiplier: 1.5`
- Percentages: `dailyLossLimit: 3`

### Code - The "How"
Contains **logic and algorithms** for using the parameters:
- How to calculate a 20-day moving average
- How to determine if a stock is in an uptrend
- How to combine RSI and volume for signal confirmation
- How to prioritize multiple exit criteria
- How to calculate position sizes based on risk parameters

## Example: Trend Determination

**Configuration (YAML)**:
```yaml
entrySignals:
  technicalIndicators:
    trendConfirmation: true
```

**Code (TypeScript)**:
```typescript
// Logic for determining trend using 20-day and 50-day moving averages
function isInUptrend(prices: number[]): boolean {
  const ma20 = calculateMovingAverage(prices, 20);
  const ma50 = calculateMovingAverage(prices, 50);
  return ma20 > ma50 && prices[prices.length - 1] > ma20;
}
```

The configuration says "we need trend confirmation" (what), but the code defines "how to determine a trend."

## Benefits of This Approach

1. **Simpler Parsing**: YAML deserialization is straightforward and reliable
2. **Better Validation**: TypeScript types ensure configuration matches expected structure
3. **Easier Maintenance**: No complex regex patterns to maintain
4. **Clear Separation**: Configuration values are separate from trading logic
5. **Hot-Reload**: File watching works more reliably with structured format
6. **Type Safety**: Configuration maps directly to TypeScript interfaces

## Migration Impact

### Services Updated
- `GuidelinesManager`: Completely rewritten to use YAML parsing
- `RiskManager`: No changes needed (uses GuidelinesManager interface)
- Other services: No changes needed

### Tests Updated
- All GuidelinesManager tests updated to use YAML fixtures
- 38 tests passing with new format
- Test coverage maintained

### Breaking Changes
- Configuration file path changed from `.md` to `.yaml`
- Environment variable or config may need updating if custom path was used
- Default path: `artifacts/swing_trading_guidelines.yaml`

## How to Update Configuration

1. Edit `artifacts/swing_trading_guidelines.yaml`
2. Modify only the values (numbers, percentages, ranges)
3. Keep the structure intact (don't remove required fields)
4. Save the file
5. The GuidelinesManager will automatically reload (if file watching is enabled)

## Validation

The GuidelinesManager validates all configuration values:
- Required fields must be present
- Numeric values must be within valid ranges
- Percentages must be between 0-100
- Min/max ranges must have min < max

If validation fails, the system will:
1. Log detailed error messages
2. Keep using the last valid configuration
3. Continue operating safely

## Questions or Issues?

If you encounter any issues with the new format:
1. Check the validation error messages in logs
2. Compare your YAML structure with the reference file
3. Ensure all required fields are present
4. Verify numeric values are within valid ranges
