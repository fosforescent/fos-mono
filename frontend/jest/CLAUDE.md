# CLAUDE.md

## Directory Summary

Jest test framework configuration and setup for unit and integration testing of React components and shared utilities in the Fosforescent application.

### Dependencies
- **@testing-library/jest-dom**: Custom Jest matchers for DOM assertions
- **Jest Framework**: JavaScript testing framework
- **React Testing Library**: React component testing utilities
- **TypeScript**: Type checking for test files

### Data Inputs

#### Test Configuration
- **Jest Config**: Test framework configuration and settings
- **Setup Scripts**: Global test environment initialization
- **Mock Definitions**: Mock implementations for external dependencies
- **Test Environment**: JSDOM or Node environment configuration

#### Test Files
- **Component Tests**: React component unit tests
- **Utility Tests**: Shared function and utility testing
- **Integration Tests**: Cross-component interaction testing
- **Mock Data**: Test fixtures and sample data

### Data Outputs

#### Test Results
- **Test Reports**: Pass/fail status and coverage information
- **Coverage Reports**: Code coverage analysis and metrics
- **Error Messages**: Detailed failure information and stack traces
- **Performance Metrics**: Test execution timing and performance

#### Assertion Capabilities
- **DOM Assertions**: Testing DOM element properties and content
- **React Assertions**: Component state and prop testing
- **Async Testing**: Promise and async function testing
- **Mock Verification**: Mock function call verification

### Events Handled
- **Test Execution**: Running individual and batch tests
- **Setup/Teardown**: Test environment initialization and cleanup
- **Mock Operations**: Mock function creation and verification
- **Assertion Evaluation**: Test assertion checking and reporting

### Data Transformations
- **Test Code → Test Results**: Test execution producing pass/fail outcomes
- **Component State → Assertions**: React component state verified through assertions
- **Mock Calls → Verification**: Mock function usage validated in tests
- **Coverage Data → Reports**: Code coverage converted to readable reports

### Testing Capabilities

#### DOM Testing
- **Element Queries**: Finding elements by text, role, label, etc.
- **Content Assertions**: Verifying element text content and attributes
- **Interaction Testing**: Simulating user clicks, inputs, and events
- **Accessibility Testing**: ARIA attributes and accessibility compliance

#### React Component Testing
- **Component Rendering**: Testing component output and structure
- **Prop Testing**: Verifying component behavior with different props
- **State Testing**: Testing component state changes and updates
- **Event Handling**: Testing user interaction and event callbacks

#### Async Testing
- **Promise Testing**: Testing async functions and Promise resolution
- **Timeout Handling**: Testing time-based operations and delays
- **API Mocking**: Mocking external API calls and responses
- **Loading States**: Testing async loading and error states

#### Mock Capabilities
- **Function Mocking**: Creating and verifying mock function calls
- **Module Mocking**: Mocking entire modules and dependencies
- **Implementation Mocking**: Custom mock implementations
- **Call Verification**: Verifying mock function arguments and call counts

### Test Environment Setup
- **Global Matchers**: jest-dom matchers available in all tests
- **DOM Environment**: JSDOM setup for browser API simulation
- **React Testing**: React Testing Library configuration
- **TypeScript Support**: Type checking and compilation for tests

### Development Features
- **Hot Reloading**: Test re-execution on file changes
- **Debug Support**: Debugging capabilities for test development
- **Coverage Tracking**: Real-time code coverage monitoring
- **Error Reporting**: Detailed error messages and stack traces

### Quality Assurance
- **Regression Testing**: Preventing feature regressions
- **Coverage Requirements**: Minimum code coverage enforcement
- **CI Integration**: Automated testing in continuous integration
- **Performance Testing**: Test execution performance monitoring

## TODOs