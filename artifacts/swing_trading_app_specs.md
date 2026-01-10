# Swing Trading App

## Overview

The Swing Trading App is a autonomous agent that will trade on behalf of a swing trader.
The agent will use a reasoning large language model to generate trading signals and execute trades on behalf of the swing trader.  The first version of the agent will trade
using a fictitious trading account.  The agent will keep track of performance and use a mock API to execute trades.  


## Flow
- The agent will run in the background.  It will stay idle until it is time to take action. It will during the trading day starting before the markets open and ending after the markets close.
- The agent will look for buy and sell signals based on the trading guidelines provided in the swing trading guidelines document.  If funds are available, the agent will execute trades based on the signals.
- No single equity position should exceed 10% of the portfolio.
- For each purchase, the agent will set exit criteria based on the trading guidelines provided in the swing trading guidelines document.
- On each execution, the agent will update the portfolio and check for any exit criteria that have been met.  If an exit criteria has been met, the agent will execute the exit.
- The order of operations will be as follows:
    - Check for buy signals
    - Check for sell signals
    - Check for exit criteria   
    - Update portfolio

## Technical Details
- The agent will be written in Typescript
- The user interface will be a ReactJS (Typescript) application
- The agent will use a reasoning large language model to generate trading signals and execute trades on behalf of the swing trader.  The first version of the agent will trade
using a fictitious trading account.  The agent will keep track of performance and use a mock API to execute trades. 
- The architecture should be modular and enable easy change of LLM to use. 
- The initial LLM will be Claude Opus 4.5 via AWS Bedrock.  I plan to experiment with open source models using Olama as well.
- The agent will use the API from massive.com to access market data.
- The agent will use a mock API to execute trades. This will be the case until the agent is ready to be used with a real trading account.
- The agent will keep track of the portfolio and the performance of the portfolio in a local database.
- The application will also have a web user interface that will allow access to:
    - System status and execution schedules
    - Trades made that run with entry and exit prices and signals used to decide on trades
    - Portfolio positions at the end of the run
    - List of exit criteria for each held position
    - Portfolio Value
    - Portfolio Returns
    - Number of Trades
    - Number of Wins
    - Number of Losses
    - Win/Loss Ratio
    - Total Profit/Loss
    
 
