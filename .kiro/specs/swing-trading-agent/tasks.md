# Implementation Plan

- [x] 1. Set up basic project structure
  - Create monorepo structure with backend, frontend (Next.js), and shared directories
  - Set up TypeScript configuration for all packages
  - Configure Jest testing framework with fast-check for property-based testing
  - Create basic package.json files and build scripts
  - _Requirements: 8.1, 8.5_

- [x] 2. Create core type definitions and interfaces
  - Define all TypeScript interfaces in shared/types directory
  - Create core data models (Trade, Position, Portfolio, TradingSignal)
  - Add logging and LLM interaction interfaces
  - Set up basic configuration types and validation schemas
  - _Requirements: 8.1_

- [x] 2.1 Write property test for configuration validation
  - **Property 10: Configuration validation**
  - **Validates: Requirements 8.5**

- [x] 3. Implement and test database layer
  - Set up SQLite database with basic schema
  - Create database models and migration scripts
  - Implement repository pattern for data access
  - Add basic CRUD operations for trades, positions, and logs
  - Test database operations with unit tests
  - _Requirements: 7.1, 7.2, 7.5_

- [x] 3.1 Test database layer functionality
  - Write unit tests for all repository operations
  - Test data persistence and retrieval
  - Verify database schema and constraints
  - Ensure all tests pass before proceeding

- [x] 4. Implement and test logging service
  - Create structured logging service with different log levels
  - Implement log storage to database with proper indexing
  - Add log filtering and search capabilities
  - Create basic log viewer functionality
  - Test logging service thoroughly
  - _Requirements: 4.6, 10.1, 10.2, 10.5_

- [ ]* 4.1 Write property test for logging completeness
  - **Property 5: Comprehensive logging invariant (basic logging)**
  - **Validates: Requirements 4.6**

- [x] 4.2 Test logging service functionality
  - Write unit tests for log creation, storage, and retrieval
  - Test log filtering and search functionality
  - Verify log data integrity and performance
  - Ensure all tests pass before proceeding

- [x] 5. Implement and test market data service (basic version)
  - Create MarketDataService interface and basic implementation
  - Start with mock data provider for development and testing
  - Implement basic quote and historical data structures
  - Add error handling for data unavailability
  - Test market data service with mock data
  - _Requirements: 5.1, 5.4_

- [ ]* 5.1 Write property test for market data dependency
  - **Property 8: Signal generation data dependency**
  - **Validates: Requirements 5.4**

- [x] 5.2 Test market data service functionality
  - Write unit tests for data fetching and error handling
  - Test mock data provider functionality
  - Verify data structure validation
  - Ensure all tests pass before proceeding

- [x] 6. Implement and test basic LLM service
  - Create LLMService interface with mock implementation
  - Add comprehensive logging of all LLM interactions
  - Implement basic prompt/response handling
  - Create error handling and fallback mechanisms
  - Test LLM service with mock responses
  - _Requirements: 5.5, 10.1, 10.2_

- [ ]* 6.1 Write property test for LLM interaction logging
  - **Property 5: Comprehensive logging invariant (LLM interactions)**
  - **Validates: Requirements 10.1, 10.2**

- [x] 6.2 Test LLM service functionality
  - Write unit tests for LLM interaction logging
  - Test error handling and fallback mechanisms
  - Verify prompt/response data integrity
  - Ensure all tests pass before proceeding

- [x] 6.5. Implement and test trading guidelines manager
  - Create GuidelinesManager class for loading and managing trading guidelines
  - Implement markdown file parsing for `artifacts/swing_trading_guidelines.md`
  - Add guidelines validation with comprehensive error reporting
  - Create file watching for hot-reload without system restart
  - Add fallback mechanisms for missing or invalid guidelines
  - Test guidelines manager with various file scenarios
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ]* 6.5.1 Write property test for guidelines loading and validation
  - **Property 11: Guidelines loading and validation**
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.5, 2.6**

- [x] 6.5.2 Test guidelines manager functionality
  - Write unit tests for guidelines file parsing and validation
  - Test file watching and hot-reload functionality
  - Test error handling for missing, corrupt, or invalid guidelines files
  - Verify fallback mechanisms work correctly
  - Ensure all tests pass before proceeding

- [x] 6.6. Update shared types for guidelines integration
  - Add comprehensive TypeScript interfaces for trading guidelines
  - Create types for liquidity requirements, volatility metrics, entry signals
  - Add interfaces for exit criteria, risk management rules, and profit targets
  - Update existing interfaces to reference guidelines where appropriate
  - _Requirements: 2.5, 2.6_

- [x] 6.7. Simplify GuidelinesManager to use structured configuration
  - Convert markdown-based guidelines to structured YAML/JSON format
  - Simplify parsing logic by removing markdown parsing complexity
  - Improve maintainability and reduce parsing errors
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 6.7.1 Create structured guidelines configuration file
  - Read the existing `artifacts/swing_trading_guidelines.md` file
  - Extract ONLY configurable parameters (thresholds, limits, percentages, ranges)
  - Examples of what to extract: minimum volume (1M shares), ATR range (2-8%), max position (10%)
  - Examples of what NOT to extract: logic like "use 20-day and 50-day MA to determine trend"
  - Create a new `artifacts/swing_trading_guidelines.yaml` (or .json) file
  - Structure the configuration to match the TradingGuidelines TypeScript interface
  - Include all sections: stock selection, entry signals, exit criteria, risk management
  - Add comments in YAML explaining what each parameter controls (not how it's used)
  - Keep the configuration focused on "what" (values) not "how" (logic)
  - Validate the structure matches the TypeScript types exactly
  - _Requirements: 2.1, 2.5_

- [x] 6.7.2 Update GuidelinesManager to load YAML/JSON
  - Remove markdown parsing logic from GuidelinesManager
  - Add YAML/JSON parsing using appropriate library (js-yaml or native JSON)
  - Update loadGuidelines() method to read structured configuration file
  - Simplify parseGuidelinesFromMarkdown() to parseGuidelinesFromYaml()
  - Remove all regex-based extraction methods (extractLiquidityRequirements, etc.)
  - Replace with simple YAML/JSON deserialization into TypeScript types
  - Keep validation logic intact (validate ranges, required fields, etc.)
  - Update file path configuration to point to new file
  - Note: Trading logic (how to use these parameters) stays in other services
  - _Requirements: 2.1, 2.2_

- [x] 6.7.3 Update GuidelinesManager tests
  - Update test fixtures to use YAML/JSON format instead of markdown
  - Remove tests for markdown parsing logic
  - Add tests for YAML/JSON parsing
  - Test validation with structured format
  - Test file watching with new file format
  - Ensure all existing test scenarios still pass
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 6.7.4 Update documentation and configuration
  - Update README or documentation to reference new guidelines file format
  - Document the separation: configuration file has parameters, code has logic
  - Add example showing what belongs in config vs. what belongs in code
  - Add example guidelines YAML/JSON file if needed
  - Update any configuration files that reference the guidelines path
  - Keep the original markdown file for reference (rename to .md.backup or .md.reference)
  - Add migration notes explaining the new structure
  - _Requirements: 2.4_

- [x] 6.7.5 Verify integration with RiskManager and other services
  - Test that RiskManager still receives correct guidelines
  - Verify all guidelines-dependent services work correctly
  - Run integration tests to ensure no regressions
  - Test hot-reload functionality with new file format
  - Ensure all tests pass before proceeding
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 7. Implement and test portfolio manager (core functionality)
  - Create PortfolioManager class with basic position tracking
  - Implement portfolio state persistence and loading
  - Add basic performance metrics calculation
  - Create simple trade execution with mock broker
  - Test portfolio operations thoroughly
  - _Requirements: 1.4, 7.1, 7.3, 7.5_

- [ ]* 7.1 Write property test for portfolio state consistency
  - **Property 6: Portfolio state consistency**
  - **Validates: Requirements 1.4, 7.1**

- [x] 7.2 Test portfolio manager functionality
  - Write unit tests for position tracking and updates
  - Test portfolio persistence and loading
  - Verify performance metrics calculations
  - Ensure all tests pass before proceeding

- [x] 8. Implement and test risk manager with guidelines integration
  - Create RiskManager class with position sizing logic based on loaded guidelines
  - Implement position limits and risk calculations using guidelines rules
  - Add risk validation for trades using guidelines-defined limits
  - Create position size calculation based on guidelines risk parameters
  - Integrate with GuidelinesManager for dynamic rule updates
  - Test risk management rules thoroughly with various guidelines scenarios
  - _Requirements: 1.3, 9.1, 9.2, 9.3, 9.4_

- [ ]* 8.1 Write property test for position limit enforcement
  - **Property 1: Portfolio position limit enforcement**
  - **Validates: Requirements 1.3**

- [ ]* 8.2 Write property test for risk management consistency
  - **Property 2: Risk management consistency**
  - **Validates: Requirements 9.1**

- [ ]* 8.3 Write property test for risk limit protection
  - **Property 7: Risk limit protection**
  - **Validates: Requirements 9.2, 9.4**

- [ ]* 8.4 Write property test for sector concentration limits
  - **Property 9: Sector concentration limits**
  - **Validates: Requirements 9.3**

- [x] 8.5 Test risk manager functionality
  - Write unit tests for position sizing and limits using guidelines
  - Test trade validation and rejection scenarios with various guidelines
  - Test guidelines integration and dynamic rule updates
  - Verify risk calculations are correct with different guidelines configurations
  - Ensure all tests pass before proceeding

- [x] 9. Implement and test signal generator with guidelines integration
  - Create SignalGenerator class with guidelines-based signal generation
  - Implement stock screening using guidelines selection criteria
  - Add entry signal validation based on guidelines technical requirements
  - Create signal confidence scoring using guidelines rules
  - Integrate with GuidelinesManager for dynamic criteria updates
  - Test signal generation with various guidelines configurations
  - _Requirements: 5.2, 5.3, 5.5_

- [x] 9.1 Test signal generator functionality
  - Write unit tests for guidelines-based signal generation logic
  - Test stock screening using guidelines criteria
  - Test signal validation against guidelines requirements
  - Verify signal data structure and confidence scoring with guidelines
  - Ensure all tests pass before proceeding

- [x] 10. Implement and test exit criteria monitor with guidelines integration
  - Create ExitCriteriaMonitor class using guidelines-defined exit rules
  - Implement stop loss and profit target establishment based on guidelines methods
  - Add continuous monitoring with guidelines-specified priority rules
  - Create exit signal generation using guidelines criteria
  - Integrate with GuidelinesManager for dynamic exit rule updates
  - Test exit criteria monitoring with various guidelines configurations
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ]* 10.1 Write property test for exit criteria processing
  - **Property 4: Exit criteria processing completeness**
  - **Validates: Requirements 3.2, 3.3**

- [x] 10.2 Test exit criteria monitor functionality
  - Write unit tests for guidelines-based exit criteria establishment and monitoring
  - Test stop loss and profit target logic using guidelines methods
  - Test guidelines integration and dynamic rule updates
  - Verify exit signal generation with different guidelines configurations
  - Ensure all tests pass before proceeding

- [x] 11. Implement and test trading engine with guidelines integration
  - Create TradingEngine class with guidelines-aware orchestration
  - Implement execution order: buy → sell → exit → update using guidelines
  - Add trading cycle with comprehensive logging and guidelines tracking
  - Integrate with GuidelinesManager for dynamic rule updates
  - Create simple scheduling for testing with guidelines validation
  - Test trading engine with all components and various guidelines configurations
  - _Requirements: 1.1, 1.2, 4.1, 4.2, 4.3, 4.4, 4.6_

- [ ]* 11.1 Write property test for execution order invariant
  - **Property 3: Execution order invariant**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 11.2 Test trading engine functionality
  - Write integration tests for complete trading cycles with guidelines
  - Test component orchestration and execution order with guidelines integration
  - Test guidelines hot-reload during trading cycles
  - Verify comprehensive logging of all operations and guidelines usage
  - Ensure all tests pass before proceeding

- [x] 12. Checkpoint - Core backend functionality complete
  - Run all unit and property tests to ensure system stability
  - Verify all core components work together correctly
  - Test basic trading workflows end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement REST API with guidelines management
  - Create Express.js API server with essential endpoints
  - Add endpoints for system status and basic portfolio data
  - Implement simple trade history retrieval
  - Create basic log viewing endpoints
  - Add guidelines management endpoints (view, reload, validate)
  - Test API endpoints with unit tests including guidelines endpoints
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 13.1 Test REST API functionality
  - Write unit tests for all API endpoints including guidelines management
  - Test request/response data validation
  - Test guidelines reload and validation endpoints
  - Verify error handling and status codes
  - Ensure all tests pass before proceeding

- [x] 14. Set up Next.js frontend with basic components
  - Create Next.js TypeScript application
  - Set up basic routing and layout components
  - Create API client service for backend communication
  - Implement basic dashboard with system status
  - Test frontend compilation and basic functionality
  - _Requirements: 6.1_

- [x] 14.1 Test frontend basic functionality
  - Test Next.js application builds and runs correctly
  - Verify API client communication with backend
  - Test basic component rendering
  - Ensure frontend works before adding complexity

- [x] 15. Implement portfolio and trade views
  - Create portfolio status component with current positions
  - Add trade history view with basic filtering
  - Implement performance metrics display
  - Create responsive design for mobile and desktop
  - Test all frontend components
  - _Requirements: 6.2, 6.3, 6.4_

- [ ] 16. Implement log viewing interface
  - Create log viewer component with filtering capabilities
  - Add LLM interaction display with prompts and responses
  - Implement search functionality for troubleshooting
  - Create pagination for large log datasets
  - Test log viewing functionality
  - _Requirements: 10.3, 10.4_

- [ ] 16.5. Implement guidelines management interface
  - Create guidelines viewer component showing current loaded guidelines
  - Add guidelines validation status display with error reporting
  - Implement guidelines reload functionality through UI
  - Create guidelines editing interface (optional advanced feature)
  - Add guidelines history and change tracking
  - Test guidelines management UI functionality
  - _Requirements: 2.4, 6.5_

- [ ] 17. Add advanced risk management features with guidelines integration
  - Verify all guidelines-based risk management features are working
  - Test dynamic guidelines updates with active risk management
  - Add any missing advanced risk management features from guidelines
  - Create position queuing when limits are reached
  - Test advanced risk management rules with various guidelines configurations
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 18. Integrate real market data (Massive.com API)
  - Replace mock market data service with real API integration
  - Add API key management and rate limiting
  - Implement real-time data fetching and caching
  - Test with live market data (carefully with small positions)
  - _Requirements: 5.1_

- [ ] 19. Integrate AWS Bedrock LLM service
  - Replace mock LLM service with AWS Bedrock integration
  - Implement Claude model integration with proper prompting
  - Add AWS credentials management and error handling
  - Test LLM integration with real trading scenarios
  - _Requirements: 5.5, 10.1, 10.2_

- [ ] 20. Final integration and system testing
  - Test complete end-to-end workflows with real services and guidelines
  - Verify all risk management rules work under load with guidelines
  - Test error handling and recovery scenarios including guidelines failures
  - Test guidelines hot-reload during live trading scenarios
  - Validate system performance and stability with guidelines integration
  - _Requirements: All requirements integration_

- [ ]* 20.1 Write comprehensive integration tests
  - Test complete trading cycles with real data and guidelines
  - Verify system behavior during various failure scenarios including guidelines failures
  - Test concurrent operations and system stability with guidelines updates

- [ ] 21. Final checkpoint - Production readiness
  - Run complete test suite including all property-based tests
  - Verify system meets all requirements and performance criteria
  - Test deployment and configuration procedures including guidelines setup
  - Verify guidelines management works in production environment
  - Ensure all tests pass, ask the user if questions arise.