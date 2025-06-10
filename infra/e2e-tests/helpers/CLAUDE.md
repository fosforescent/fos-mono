# CLAUDE.md

## Directory Summary

Playwright-based end-to-end test helper functions providing authentication, navigation, and common test operations for the Fosforescent application.

### Dependencies
- **@playwright/test**: Playwright testing framework and Page API
- **Browser APIs**: DOM interaction and network monitoring
- **Application Routes**: Knowledge of app navigation and authentication flows

### Data Inputs

#### Test Configuration
- **Page Objects**: Playwright page instances for browser interaction
- **Test Credentials**: Generated test user credentials
- **Navigation Targets**: Application routes and view destinations
- **Timeout Settings**: Wait durations for async operations

#### User Interactions
- **Form Data**: Registration and login form inputs
- **Click Events**: Button and link interactions
- **Navigation Events**: Page routing and view switching
- **Authentication State**: Login status and session management

### Data Outputs

#### Authentication State
- **Login Sessions**: Authenticated user sessions for testing
- **Test Users**: Dynamically created test accounts
- **Session Persistence**: Maintained authentication across test steps
- **Authentication Verification**: Confirmation of login success

#### Navigation Results
- **View Navigation**: Successful navigation to target views
- **Route Verification**: Confirmation of correct page loading
- **State Transitions**: Application state changes from navigation
- **Load Completion**: Network and rendering completion confirmation

### Events Handled
- **User Registration**: Creating new test accounts
- **User Login**: Authenticating existing test users
- **View Navigation**: Moving between application views
- **Form Submission**: Handling registration and login forms
- **Network Operations**: Monitoring auth-related network requests

### Data Transformations
- **Test Data → User Accounts**: Generated credentials converted to test users
- **Page Interactions → Authentication State**: Browser actions resulting in login sessions
- **Navigation Commands → View Changes**: Helper calls converted to application navigation
- **Network Responses → Test Verification**: API responses used for test validation

### Helper Functions

#### Authentication Helpers
- **loginWithTestUser()**: Comprehensive login with fallback registration
- **registerTestUser()**: New user account creation with validation
- **Authentication Detection**: Checking current login status
- **Auto-Login Handling**: Managing automatic login after registration

#### Navigation Helpers
- **navigateToQueueView()**: Navigate to queue-based workflow view
- **View Switching**: Moving between different application views
- **Route Verification**: Confirming successful navigation
- **Load State Management**: Waiting for complete page loads

#### Test Utilities
- **Dynamic User Generation**: Creating unique test credentials
- **Network Monitoring**: Tracking authentication API calls
- **Error Handling**: Robust handling of test failures
- **Debug Logging**: Comprehensive test execution logging

### Authentication Flow
1. **Check Existing Auth**: Detect if already authenticated
2. **Registration**: Create new test user with valid credentials
3. **Login Attempt**: Authenticate with generated credentials
4. **Verification**: Confirm successful authentication
5. **Session Persistence**: Maintain auth state for subsequent tests

### Test Reliability Features
- **Retry Logic**: Automatic retry for flaky operations
- **Dynamic Credentials**: Unique users prevent test conflicts
- **Network Monitoring**: API response tracking for debugging
- **Graceful Fallbacks**: Alternative authentication methods
- **Comprehensive Logging**: Detailed test execution information

### Error Handling
- **Authentication Failures**: Graceful handling of login/registration errors
- **Network Timeouts**: Robust timeout management
- **Element Detection**: Fallback selectors for UI elements
- **State Validation**: Confirmation of expected application state

### Development Support
- **Debug Output**: Console logging for test development
- **Network Inspection**: Request/response monitoring
- **Page State Analysis**: Content analysis for debugging
- **Test Isolation**: Independent test user creation

## TODOs