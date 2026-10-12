# Customer Portal Integration Plan

## 🚀 Minimum Viable Integration (MVP)

The absolute minimum changes needed to enable basic customer-provider functionality:

### 1. **Database Schema** (1 day)
```sql
-- Add single field to existing users table
ALTER TABLE UserModel ADD COLUMN is_service_provider BOOLEAN DEFAULT TRUE;

-- REUSE: Extend existing BidSessions table
ALTER TABLE BidSessions ADD COLUMN request_type ENUM('tool_selection', 'service_request') DEFAULT 'tool_selection';
ALTER TABLE BidSessions ADD COLUMN voice_notes JSON;

-- REUSE: Extend existing ToolBids table  
ALTER TABLE ToolBids ADD COLUMN bid_type ENUM('ai_tool', 'human_service') DEFAULT 'ai_tool';
ALTER TABLE ToolBids ADD COLUMN service_details JSON; -- For human service pricing/timeline
```

### 2. **Routing Logic** (1 day)
```typescript
// Update DashboardRouter.tsx (5 lines of code)
const isServiceProvider = data.info?.profile?.isServiceProvider ?? true
if (isServiceProvider) return <Dashboard />
return <CustomerPortal />
```

### 3. **Basic Customer Portal** (2 days)
- Simple form: title, description, budget
- **Voice recording capability** for request details
- List of submitted requests with voice note playback
- List of received bids per request

### 4. **Provider Queue Enhancement** (1 day)
- Add customer requests to existing `/inbox` QueueView
- Simple request cards with "Submit Bid" button

### 5. **Semantic Service Matching** (1 day)
- **REUSE**: Extend existing MCPTools table for provider service listings
- **REUSE**: Existing Qdrant vector search (already configured)
- **REUSE**: Auto-generate bids from matching services using existing tool bidding logic
- **REUSE**: Existing MCP server bidding infrastructure (treat human services as tools)

### 6. **Voice Input System** (2-3 days - Only truly new component)
- Audio recording component with MediaRecorder API
- File upload endpoint and cloud storage integration
- OpenAI Whisper API integration for transcription
- Voice note playback and transcription display components

**Total MVP: ~5-6 days of development** (leverages existing infrastructure)

## Current Portal Architecture

### Main Application Flow
```
App.tsx (main entry point)
├── AuthLanding (if not logged in)
├── PendingApproval (if logged in but not approved)
└── <Outlet> (if logged in and approved)
    └── DashboardRouter (index route "/")
        ├── AdminDashboard (if admin/superadmin role)
        └── Dashboard (if user role)
```

### Route Structure (main.tsx)
```
/                    → DashboardRouter → Dashboard/AdminDashboard
/inbox              → QueueView (todo queue)
/market             → BrowseView (marketplace)
/agora              → QueueView (public discussions)
/folders            → TreeView (hierarchical view)
/search             → QueryView (search interface)
/info               → BrowseView (information view)
/settings           → SettingsPage
```

### User Role Determination
- **Admin/SuperAdmin**: `data.info.role === 'admin' | 'superadmin'` → AdminDashboard
- **Regular User**: Default → Dashboard
- **Service Provider**: Determined by user profile/registration status
- **Customer**: Users who are NOT service providers

## Integration Strategy

### 1. User Classification System

#### New User Types
```typescript
interface UserProfile {
  role: 'admin' | 'superadmin' | 'user'
  accountType: 'service_provider' | 'customer' | 'hybrid'
  isServiceProvider: boolean
  permissions: string[]
}
```

#### Role Detection Logic
```typescript
const getUserPortalType = (user: UserProfile) => {
  if (user.role === 'admin' || user.role === 'superadmin') {
    return 'admin'
  }
  if (user.isServiceProvider || user.accountType === 'service_provider') {
    return 'service_provider'
  }
  return 'customer' // Default for non-service-provider users
}
```

### 2. Enhanced DashboardRouter

#### Updated DashboardRouter.tsx
```typescript
export const DashboardRouter: React.FC = () => {
  const { data } = useProps()
  
  const userRole = data.info?.role || 'user'
  const isServiceProvider = data.info?.profile?.isServiceProvider || false
  const accountType = data.info?.profile?.accountType || 'customer'
  
  // Admin users see admin dashboard
  if (userRole === 'admin' || userRole === 'superadmin') {
    return <AdminDashboard />
  }
  
  // Service providers see full dashboard
  if (isServiceProvider || accountType === 'service_provider') {
    return <Dashboard userRole={userRole} />
  }
  
  // Customer-only users see customer portal
  return <CustomerPortal />
}
```

### 3. Customer Portal Component Structure

#### CustomerPortal.tsx
```typescript
interface CustomerPortalProps {
  data: AppStateLoaded
  setData: (data: AppStateLoaded) => void
  options: FosReactGlobal
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  data, setData, options
}) => {
  return (
    <div className="customer-portal">
      <CustomerHeader />
      <CustomerChatInterface />
      <CustomerBidManager />
      <CustomerRequestHistory />
    </div>
  )
}
```

#### Component Breakdown
- **CustomerHeader**: Simple header with user info and upgrade to service provider option
- **CustomerChatInterface**: Chat input with voice support and RFB generation
- **CustomerBidManager**: Bid selection and comparison interface
- **CustomerRequestHistory**: Previous requests and their status

### 4. Route Integration

#### Option A: Replace Default Dashboard Route
```typescript
// In main.tsx router configuration
{
  index: true,
  element: <DashboardRouter />, // This now intelligently routes
  loader: async () => ({ route: [] })
}
```

#### Option B: Add Dedicated Customer Route
```typescript
// Add new route for customer portal
{
  path: "customer",
  element: <CustomerPortal />,
  loader: async () => ({ route: [] })
},
// Redirect customers to customer route in App.tsx
```

#### Option C: Hybrid Approach (Recommended)
- Use **Option A** for the default route
- Add **Option B** as fallback and direct access
- Allow service providers to access customer portal via `/customer` route

### 5. Anonymous User Integration

#### Session Management
```typescript
interface AnonymousSession {
  sessionToken: string
  expiresAt: Date
  requests: RequestForBids[]
  voiceNotes: VoiceNote[]
  preferences: CustomerPreferences
}
```

#### Anonymous User Flow
1. **Landing Page**: Show limited customer portal without login requirement
2. **Session Creation**: Generate session token on first interaction
3. **URL Persistence**: Store session in URL params for sharing
4. **Upgrade Path**: Easy conversion to registered account

#### Modified App.tsx Logic
```typescript
// Enhanced authentication logic
const isAnonymousCustomer = !appState.loggedIn && hasCustomerSession()
const showCustomerPortal = isAnonymousCustomer || (appState.loggedIn && !isServiceProvider)

{!appState.loggedIn && !isAnonymousCustomer ? (
  <AuthLanding />
) : appState.loggedIn && appState.info?.approved === false ? (
  <PendingApproval />
) : showCustomerPortal ? (
  <CustomerPortal 
    isAnonymous={isAnonymousCustomer}
    data={appState}
    setData={setAppState}
    options={fosReactGlobal}
  />
) : (
  <Outlet context={...} />
)}
```

### 6. Integration with Existing Systems

#### Queue System Integration
```typescript
// Enhanced queue types for bid requests
interface QueueItem {
  type: 'todo' | 'comment' | 'bid_request' | 'bid_response'
  requestForBids?: RequestForBids
  bid?: Bid
  // ... existing fields
}
```

#### Service Provider Queue Updates
- Modify `QueueView` to show bid requests from customers
- Add filtering for bid requests vs regular todos
- Integration with semantic search for relevant bid matching

#### HamburgerMenu Updates
```typescript
// Add customer portal navigation
const customerMenuItems = [
  { path: "/customer", label: "Customer Portal", icon: MessageSquare },
  { path: "/inbox", label: "My Requests", icon: Target },
  { path: "/settings", label: "Settings", icon: LayoutDashboard },
]

const serviceProviderMenuItems = [
  // ... existing menu items
  { path: "/customer", label: "Customer View", icon: MessageSquare },
]
```

### 7. Upgrade/Downgrade Flow

#### Service Provider Registration
```typescript
interface ServiceProviderUpgrade {
  businessInfo: BusinessInformation
  serviceCategories: string[]
  pricing: PricingStructure
  portfolio: PortfolioItem[]
  verification: VerificationDocuments
}
```

#### Account Type Switching
- **Customer → Service Provider**: Registration wizard in settings
- **Service Provider → Customer Only**: Option to disable service provider features
- **Hybrid Accounts**: Allow users to act as both customer and provider

### 8. Database Schema Changes

#### User Profile Updates
```sql
ALTER TABLE UserModel ADD COLUMN account_type ENUM('customer', 'service_provider', 'hybrid') DEFAULT 'customer';
ALTER TABLE UserModel ADD COLUMN is_service_provider BOOLEAN DEFAULT FALSE;
ALTER TABLE UserModel ADD COLUMN service_provider_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE UserModel ADD COLUMN customer_preferences JSON;
```

#### New Tables
```sql
-- Anonymous sessions
CREATE TABLE AnonymousSessions (
  session_token VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  session_data JSON
);

-- Service provider profiles
CREATE TABLE ServiceProviderProfiles (
  user_id VARCHAR(255) PRIMARY KEY,
  business_name VARCHAR(255),
  service_categories JSON,
  pricing_structure JSON,
  verification_status ENUM('pending', 'verified', 'rejected'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 9. Implementation Phases

#### Phase 1: Core Integration (Week 1-2)
1. **Update DashboardRouter** with user type detection
2. **Create basic CustomerPortal component** with queue-like interface
3. **Modify App.tsx** to route customers to customer portal
4. **Update database schema** for user account types

#### Phase 2: Customer Features (Week 3-4)
1. **Extend ConsoleAgent for customer mode** with voice + text input
2. **Add RFB generation and approval workflow** within console conversation
3. **Create bid display and selection within console interface**
4. **Integrate customer requests with existing queue system**

#### Phase 3: Anonymous Users (Week 5-6)
1. **Add anonymous session management**
2. **Implement URL-based session persistence**
3. **Create upgrade flow** from anonymous to registered
4. **Test anonymous user experience**

#### Phase 4: Voice Integration (Week 7-8)
1. **Add voice input recording capability**
2. **Integrate speech-to-text transcription**
3. **Implement voice note playback**
4. **Add transcription display with collapsible UI**

#### Phase 5: Service Provider Integration (Week 9-10)
1. **Add bid request distribution to service provider queues**
2. **Implement manual bid submission interface**
3. **Integrate semantic search for bid matching**
4. **Add AI-assisted bidding features**

### 10. Configuration and Feature Flags

#### Environment Variables
```bash
# Customer portal features
ENABLE_CUSTOMER_PORTAL=true
ENABLE_ANONYMOUS_SESSIONS=true
ANONYMOUS_SESSION_DURATION_DAYS=30
ENABLE_VOICE_INPUT=true

# Service provider features
ENABLE_SERVICE_PROVIDER_REGISTRATION=true
REQUIRE_PROVIDER_VERIFICATION=false
ENABLE_AI_ASSISTED_BIDDING=true
```

#### Feature Flags in Frontend
```typescript
interface FeatureFlags {
  customerPortal: boolean
  anonymousUsers: boolean
  voiceInput: boolean
  serviceProviderUpgrade: boolean
  hybridAccounts: boolean
}
```

### 11. Testing Strategy

#### Unit Tests
- Customer portal component rendering
- User type detection logic
- Anonymous session management
- Voice input functionality

#### Integration Tests
- Customer → Service Provider upgrade flow
- Bid request creation and distribution
- Anonymous session persistence
- Voice note transcription

#### E2E Tests
- Complete customer journey (anonymous → registered → request → bid selection)
- Service provider bid response workflow
- Cross-user type interactions

### 12. Migration Plan

#### Existing Users
1. **Auto-classify existing users** as service providers based on activity
2. **Prompt users to choose account type** on next login
3. **Provide migration wizard** for role changes
4. **Preserve existing functionality** during transition

#### Data Migration
```sql
-- Classify existing active users as service providers
UPDATE UserModel 
SET account_type = 'service_provider', is_service_provider = TRUE
WHERE id IN (
  SELECT DISTINCT user_id FROM user_activity_metrics 
  WHERE provider_activities > 0
);
```

### 13. Backward Compatibility

#### Existing Routes
- All existing routes (`/inbox`, `/market`, etc.) continue to work
- Service providers see enhanced versions with bid requests
- Customers see simplified versions focused on their requests

#### API Compatibility
- Existing API endpoints remain unchanged
- New customer-specific endpoints added
- Gradual migration of shared endpoints to handle both user types

### 14. Success Metrics

#### Customer Engagement
- Customer portal adoption rate
- Request completion rate (submission → selection)
- Anonymous user conversion rate
- Customer satisfaction scores

#### Service Provider Impact
- Bid response time improvement
- New customer acquisition through portal
- Revenue increase from customer requests
- Provider satisfaction with request quality

#### Platform Growth
- Total requests generated through customer portal
- Customer retention rates
- Cross-selling to service provider accounts
- Overall platform transaction volume

This integration plan maintains the existing functionality while adding the customer portal as a new user experience path, ensuring smooth adoption and minimal disruption to current users.