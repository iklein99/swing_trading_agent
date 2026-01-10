# Swing Trading Guidelines

## Overview
This document provides systematic guidelines for swing trading stocks, including selection criteria, entry/exit strategies, and risk management rules. Designed for autonomous or semi-autonomous trading systems.

---

## 1. Stock Selection Criteria

### 1.1 Liquidity Requirements
- **Minimum Average Daily Volume**: 1,000,000 shares
- **Minimum Market Cap**: $500M (mid-cap and above)
- **Bid-Ask Spread**: < 0.5% of stock price
- **Rationale**: Ensures ability to enter/exit positions without significant slippage

### 1.2 Volatility Metrics
- **Average True Range (ATR)**: 2-8% of stock price (14-day period)
- **Historical Volatility**: 20-60% annualized
- **Beta**: 0.8 - 2.0 (relative to market)
- **Rationale**: Sufficient movement for profit potential without excessive risk

### 1.3 Price Range
- **Stock Price**: $10 - $500 per share
- **Avoid**: Penny stocks (<$5) and extremely high-priced stocks
- **Rationale**: Reduces manipulation risk and allows for better position sizing

### 1.4 Technical Setup Requirements
- **Clear Trend**: Stock should be in a defined uptrend or downtrend (20-day and 50-day MA analysis)
- **Support/Resistance Levels**: Identifiable key levels with historical validation
- **Volume Confirmation**: Recent volume increase during price moves
- **Not Extended**: Price should not be >3 ATR away from key moving averages

### 1.5 Fundamental Filters (Optional but Recommended)
- **Avoid**: Companies with upcoming earnings within 3-5 days
- **News Check**: No major pending news events (FDA approvals, trials, major announcements)
- **Sector Strength**: Relative sector performance positive or neutral
- **Financial Health**: Avoid companies with bankruptcy risk or severe financial distress

---

## 2. Entry Criteria

### 2.1 Technical Entry Signals

#### Long (Buy) Entries
1. **Breakout Entry**
   - Price breaks above resistance with volume >150% of average
   - Confirmation: Close above resistance for 2 consecutive periods
   - Entry: On breakout candle or pullback to breakout level

2. **Pullback Entry**
   - Stock in uptrend (price above 20-day and 50-day MA)
   - Price pulls back to support level or moving average
   - Entry: When price shows reversal signal (bullish engulfing, hammer, etc.)

3. **Moving Average Bounce**
   - Price approaches 20-day or 50-day EMA in an uptrend
   - RSI (14) oversold (<40) or reaching support zone
   - Entry: When price begins to move away from MA with volume

4. **Momentum Entry**
   - MACD crosses above signal line
   - RSI crosses above 50 (from below)
   - Price above VWAP
   - Entry: At market or limit order slightly above current price

#### Short (Sell) Entries
1. **Breakdown Entry**
   - Price breaks below support with volume >150% of average
   - Confirmation: Close below support for 2 consecutive periods
   - Entry: On breakdown candle or rally back to breakdown level

2. **Rejection Entry**
   - Stock in downtrend (price below 20-day and 50-day MA)
   - Price rallies to resistance level or moving average
   - Entry: When price shows reversal signal (bearish engulfing, shooting star, etc.)

3. **Moving Average Rejection**
   - Price approaches 20-day or 50-day EMA in a downtrend
   - RSI (14) overbought (>60) or reaching resistance zone
   - Entry: When price begins to move away from MA with volume

### 2.2 Entry Timing
- **Time of Day**: Avoid first 15 minutes (9:30-9:45 AM ET) and last 15 minutes of trading
- **Optimal Window**: 10:00 AM - 3:30 PM ET
- **Market Conditions**: Ensure market (SPY/QQQ) is not in extreme volatility or gap scenario

### 2.3 Position Sizing
- **Risk Per Trade**: 1-2% of total portfolio value
- **Position Size Calculation**: (Account Risk Amount) / (Entry Price - Stop Loss Price)
- **Maximum Position**: No single position should exceed 10% of portfolio
- **Correlation Check**: Limit exposure to highly correlated stocks (max 3 positions in same sector)

---

## 3. Exit Criteria - Take Profit Targets

### 3.1 Target Setting Methods

#### Method 1: ATR-Based Targets
- **Target 1**: Entry + (1.5 × ATR) - Take 33% profit
- **Target 2**: Entry + (2.5 × ATR) - Take 33% profit
- **Target 3**: Entry + (4.0 × ATR) - Take remaining position or trail stop
- **Rationale**: Adapts to stock volatility; higher volatility = wider targets

#### Method 2: Support/Resistance Targets
- **Target 1**: Next significant resistance level (for longs) or support (for shorts)
- **Target 2**: Secondary resistance/support level
- **Target 3**: Major resistance/support or round number levels
- **Rationale**: Uses natural price barriers where reversals are likely

#### Method 3: Percentage Targets
- **Target 1**: Entry + 3-5% - Take 50% profit
- **Target 2**: Entry + 7-10% - Take remaining or trail stop
- **Rationale**: Simple, consistent approach regardless of stock characteristics

#### Method 4: Risk/Reward Ratio
- **Minimum R:R**: 2:1 (profit target is 2× the risk)
- **Preferred R:R**: 3:1 or higher
- **Calculation**: If risk is $1 (stop loss), minimum target is $2 profit
- **Rationale**: Ensures mathematical edge over time

### 3.2 Partial Profit Taking Strategy
- **Scale Out Approach**: Recommended for reducing risk while maintaining upside
  - Exit 33% at Target 1
  - Exit 33% at Target 2
  - Trail stop on remaining 33%
- **Alternative**: Exit 50% at first target, trail stop on remainder

### 3.3 Trailing Stop Strategy
- **Activation**: After Target 1 or Target 2 is hit
- **Trailing Amount**: 1.5-2.0 × ATR below current high (for longs)
- **Adjustment**: Update trail daily or when price makes new favorable high/low
- **Lock in Profits**: Move stop to break-even after 1.5:1 R:R is achieved

---

## 4. Exit Criteria - Stop Losses

### 4.1 Initial Stop Loss Placement

#### For Long Positions
- **Below Support**: 1-2% below identified support level
- **ATR-Based**: Entry - (1.0-1.5 × ATR)
- **Percentage**: 5-8% below entry (adjust based on volatility)
- **Swing Low**: Below recent swing low with buffer

#### For Short Positions
- **Above Resistance**: 1-2% above identified resistance level
- **ATR-Based**: Entry + (1.0-1.5 × ATR)
- **Percentage**: 5-8% above entry (adjust based on volatility)
- **Swing High**: Above recent swing high with buffer

### 4.2 Stop Loss Rules
- **Always Use Stops**: Never enter a position without a predefined stop loss
- **No Moving Stops Further**: Stops can only move in your favor, never against
- **Wide Enough**: Stop should be beyond normal price noise (use ATR as guide)
- **Not Too Wide**: If required stop exceeds 2% account risk, reduce position size

### 4.3 Break-Even Stop
- **When**: After price moves favorably by 1.5× initial risk
- **Action**: Move stop loss to entry price (zero loss point)
- **Purpose**: Eliminate risk of loss while maintaining upside potential

### 4.4 Time-Based Stop
- **Holding Period**: Maximum 5-15 trading days (swing trade duration)
- **Action**: If position hasn't reached targets within timeframe, evaluate:
  - If no progress: Exit at market
  - If positive movement: Trail stop or hold
- **Purpose**: Prevents capital from being tied up in dead positions

---

## 5. When to Sell (Exit Signals)

### 5.1 Profit-Taking Exits
1. **Target Reached**: Any of your predetermined profit targets hit
2. **Momentum Exhaustion**: Signs of trend weakening
   - Decreasing volume on price moves
   - Bearish candlestick patterns after significant run
   - Divergence between price and momentum indicators
3. **Time Target**: Hold period exceeded without reaching objectives

### 5.2 Loss-Prevention Exits
1. **Stop Loss Hit**: Automatic exit, no exceptions
2. **Technical Breakdown**: 
   - Break of major support/resistance
   - Loss of moving average support (20-day or 50-day)
   - Failed breakout/breakdown
3. **Pattern Failure**: Entry pattern invalidates
4. **Market Deterioration**: Broad market enters correction mode (SPY/QQQ down >3% in session)

### 5.3 News/Event Exits
1. **Unexpected News**: Major negative news for longs (positive for shorts)
2. **Earnings Approaching**: Exit 1-2 days before if position still open
3. **Volatility Spike**: Extreme volatility that exceeds normal range

### 5.4 Portfolio Management Exits
1. **Correlation Risk**: Multiple correlated positions moving against you
2. **Portfolio Drawdown**: Total portfolio down 5-8% from peak - reduce exposure
3. **Rebalancing**: Trim oversized winners that exceed position size limits

### 5.5 End-of-Day Rules
- **Overnight Risk**: Decide each day whether to hold overnight
  - Hold if: Position profitable and market stable
  - Consider exiting if: High uncertainty, major news pending, or at stop loss level
- **Gap Risk**: Be aware of overnight gap risk, especially with volatile stocks

---

## 6. Risk Management Rules

### 6.1 Overall Portfolio Rules
- **Maximum Daily Loss**: 3% of portfolio - stop trading for the day if hit
- **Maximum Weekly Loss**: 6% of portfolio - reduce position sizes if hit
- **Maximum Open Positions**: 5-8 positions (for diversification)
- **Maximum Risk Per Sector**: 30% of portfolio

### 6.2 Trade Management Rules
- **Review Each Trade**: Log entry reason, exit plan, and actual results
- **No Revenge Trading**: Don't immediately re-enter after a stop loss
- **No Averaging Down**: Don't add to losing positions
- **Scale In Carefully**: If adding to winners, only after confirmation and with reduced size

### 6.3 Market Environment Adaptation
- **Trending Market**: Favor breakout/breakdown strategies, wider targets
- **Range-Bound Market**: Favor pullback strategies, tighter targets
- **High Volatility**: Reduce position sizes, widen stops, quicker profit-taking
- **Low Volatility**: Can use tighter stops, but expect smaller moves

---

## 7. Key Performance Metrics to Track

### 7.1 Win Rate Metrics
- **Target Win Rate**: 45-60% (with proper R:R, this is profitable)
- **Average Win**: Should be >2× average loss
- **Profit Factor**: Total gains / Total losses (target >1.5)

### 7.2 Risk Metrics
- **Maximum Drawdown**: Track peak-to-trough decline (keep <20%)
- **Recovery Time**: How quickly portfolio recovers from drawdowns
- **Risk-Adjusted Return**: Compare returns to volatility/risk taken

### 7.3 Execution Metrics
- **Slippage**: Difference between expected and actual fill prices
- **Trade Execution Time**: How quickly signals are acted upon
- **Partial Fill Rate**: Frequency of incomplete order fills

---

## 8. Red Flags - When NOT to Trade

### 8.1 Market Conditions
- Major economic data releases (FOMC, jobs report, CPI)
- Market opening gaps >2% on indices
- Market holiday weeks with low volume
- Extreme VIX readings (>30)

### 8.2 Stock-Specific
- Stocks in blackout/quiet periods before earnings
- Low volume days (<50% of average)
- News pending (mergers, acquisitions, FDA decisions)
- Recent major gap without consolidation

### 8.3 Personal/System
- System or data feed issues
- Inability to monitor positions
- After hitting maximum daily/weekly loss limits
- During periods of poor performance (3+ consecutive losses)

---

## 9. Checklist Template

### Pre-Entry Checklist
- [ ] Stock meets liquidity requirements (volume, market cap)
- [ ] Technical setup is clear (trend, support/resistance identified)
- [ ] Entry signal has confirmed
- [ ] Stop loss level determined
- [ ] Position size calculated (1-2% account risk)
- [ ] Profit targets set (minimum 2:1 R:R)
- [ ] No major news/earnings within 3-5 days
- [ ] Market conditions are favorable
- [ ] Portfolio has room for position (not overexposed)

### Post-Entry Checklist
- [ ] Stop loss order placed
- [ ] Profit target alerts/orders set
- [ ] Trade logged with entry reason
- [ ] Initial risk documented
- [ ] Review time scheduled

### Exit Checklist
- [ ] Exit reason documented
- [ ] Actual vs. expected performance analyzed
- [ ] Stop loss was appropriate (if stopped out)
- [ ] Targets were realistic (if target hit)
- [ ] Lessons learned noted

---

## 10. Final Notes

### Discipline
- Follow the plan without exception
- Don't let emotions override your rules
- Accept that losses are part of trading
- Don't chase trades - wait for your setup

### Continuous Improvement
- Review all trades weekly
- Identify patterns in wins and losses
- Adjust parameters based on data, not feelings
- Keep detailed records for analysis

### Automation Considerations
- Ensure all rules are quantifiable for coding
- Build in fail-safes for system failures
- Test thoroughly with paper trading first
- Monitor automated system daily for anomalies
- Have manual override capability

---

**Disclaimer**: This guide is for educational purposes. Past performance doesn't guarantee future results. Always do your own research and consider consulting with a financial advisor. Trading involves substantial risk of loss.