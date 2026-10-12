# Customer Portal Feature Design

## 🚀 Minimum Viable Features (MVP)

To get from the current state to a basic working customer portal, we need these **4 core features**:

### 1. **User Type Detection** (1-2 days)
- Add `isServiceProvider: boolean` field to user profile
- Modify `DashboardRouter.tsx` to route customers to `CustomerPortal` instead of `Dashboard`
- Default all existing users to `isServiceProvider: true` (no disruption)

### 2. **Basic Customer Portal** (2-3 days)
- Create `CustomerPortal.tsx` using `ConsoleAgent` component
- **Text + voice request submission** via ConsoleAgent interface (same functionality, customer-styled UI)
- Show submitted requests in console message history with voice note playback
- Automated RFB creation via AI agent processing (customer speaks or types needs, AI generates structured request)

### 3. **Request Distribution** (1-2 days)
- Add `customer_request` type to existing `QueueLayout.tsx`
- Customer requests appear in service provider `/inbox` queue
- Basic request cards showing title, description, budget

### 4. **Simple Bidding** (2-3 days)
- Add manual bid submission form (text proposal + price)
- Show received bids in customer portal as simple cards
- Basic bid selection (click to accept)

### 5. **Semantic Service Matching** (2-3 days)
- Integrate with existing Qdrant vector search infrastructure
- When RFB is submitted, automatically search for matching pre-defined services
- Include top N matching services as automatic bids alongside manual provider bids
- Reuse existing MCP server bidding interface and logic

### 6. **Voice Input Implementation** (2-3 days)
- Browser-based audio recording using MediaRecorder API
- Audio file upload and storage system
- Speech-to-text transcription using OpenAI Whisper API
- Basic audio playback and transcription display
- Integration with existing request submission flow

**Total MVP: ~1 week of development** (leverages existing tool bidding infrastructure)

## Overview

The Customer Portal provides a streamlined interface for users who are not registered as service providers. It focuses on request submission, bid management, and communication through a queue-based interface similar to the existing QueueView.

## User Experience Flow

### 1. Portal Access
- **Registered Users**: Users without service provider status see only the Customer Portal
- **Anonymous Users**: Can access the portal and save sessions via URL for later retrieval
- **Interface**: Queue-like view optimized for customer interactions

### 2. Request Submission via ConsoleAgent Interface

#### Unified Input (Text + Voice)
- **ConsoleAgent Interface**: Same core functionality as dashboard console but with customer-focused UI
- **Voice Input**: Voice note recording capability integrated into console
  - Record voice messages directly in the console chat
  - Display voice file with duration indicator (e.g., "🎤 2:34")
  - Collapsible transcription element below voice file
  - Auto-transcription using speech-to-text API
- **Text Input**: Standard console interface for typing service requests

#### Request Processing (AI-Driven)
- Customer speaks or types prompt describing needed service
- ConsoleAgent AI processes voice/text and generates "Request for Bids" (RFB) automatically
- Customer receives approval request for the RFB in console conversation
- Customer can review and approve/modify the bid request through chat interface

### 3. Bid Management Interface

#### Bid Selection UI
- **Card-based Display**: Each bid shown as a card with:
  - Service provider information
  - Proposed timeline
  - Cost breakdown
  - Service provider rating/reviews
  - Bid description and approach
- **Comparison Tools**: Side-by-side bid comparison
- **Selection Interface**: Radio buttons or similar for bid selection
- **Communication**: Direct messaging with service providers

#### Bid Request Approval
- Preview of generated RFB before publishing
- Edit/modify request details
- Set budget ranges and preferences
- Approve for distribution to service provider queues

## Technical Implementation

### Frontend Components

#### CustomerPortal.tsx
```
- Main portal interface using ConsoleAgent component
- Replaces Dashboard for non-service-provider users
- ConsoleAgent with customer UI variant (different styling, same functionality)
- Chat-first interface for service requests
```

#### VoiceInput.tsx
```
- Voice recording controls
- Audio playback interface
- Transcription display (collapsible)
- File upload for voice notes
```

#### BidSelection.tsx
```
- Bid card grid/list layout
- Bid comparison interface
- Selection and approval controls
- Service provider communication
```

#### RequestForBids.tsx
```
- RFB creation and editing
- Preview and approval interface
- Distribution controls
- Status tracking
```

### Backend Integration

#### Request Processing via ConsoleAgent (Reuses Existing Infrastructure)
- **REUSE**: ConsoleAgent AI parses customer voice/text prompts (same as existing tool requests)
- **REUSE**: Generate BidSession from natural language using existing console AI capabilities
- **REUSE**: Store as BidSession with customer session/account linkage (existing model)
- **REUSE**: Anonymous session persistence via URL tokens (existing functionality)
- **REUSE**: Existing console infrastructure for processing and conversation management
- **NEW ONLY**: Add `requestType: 'service_request'` and `voiceNotes` fields to existing BidSession

#### Voice Processing
- Audio file upload and storage
- Speech-to-text transcription (OpenAI Whisper API)
- Audio file serving and streaming
- Transcription quality and confidence scoring

#### Bid Distribution System (Reuses Existing Tool Bidding)
- **REUSE**: Queue integration for service providers (existing QueueLayout)
- **REUSE**: Semantic search matching using existing Qdrant infrastructure
- **REUSE**: Auto-bid generation from pre-defined services using existing vector similarity
- **REUSE**: Hybrid bidding logic (existing tool bidding + human service bids)
- **REUSE**: MCP-style interface and existing tool bidding infrastructure
- **REUSE**: Notification system for new bid requests (existing)
- **REUSE**: Bid submission and tracking workflow (existing BidHistory)

### Service Provider Integration

#### Queue Display for Providers
- **Bid Requests**: Show RFBs in service provider queues
- **Filtering**: By service type, location, budget range
- **Matching**: Semantic search to surface relevant requests
- **Response Options**: Manual bid submission or AI-assisted bidding

#### Bid Submission Interface
- **Manual Bidding**: Custom bid creation interface
- **AI-Assisted**: Use semantic search to suggest similar past bids
- **Template System**: Reusable bid templates for common services
- **Pricing Tools**: Cost calculation and profit margin tools

## Data Models

### Customer Request (Reuses BidSession)
```typescript
// REUSE: Existing BidSession model with extensions
interface BidSession {
  id: number
  sessionId: string
  taskDescription: string    // Customer's service request
  context: any              // Can include budget, timeline, requirements
  createdAt: Date
  bids: ToolBid[]          // Mix of AI tool bids AND human service bids
  chosenBid?: ToolBid
  // NEW: Add voice support
  voiceNotes?: VoiceNote[]
  requestType: 'tool_selection' | 'service_request' // NEW field
}
```

### Voice Note
```typescript
interface VoiceNote {
  id: string
  audioFileUrl: string
  duration: number // seconds
  transcription?: {
    text: string
    confidence: number
    language: string
  }
  createdAt: Date
}
```

### Service Bid (Extends ToolBid)
```typescript
// REUSE: Existing ToolBid model with extensions
interface ToolBid {
  bidId: string
  serverId: number          // AI server ID OR human provider ID
  serverName: string        // "WebSearch MCP" OR "John Doe Services"
  toolName: string          // "search_web" OR "react-website-development"
  toolDescription?: string  // Service description
  tokenCost: number        // Token cost OR dollar cost (normalized)
  relevanceScore?: number
  bidReason?: string
  isChosen: boolean
  chosenAt?: Date
  createdAt: Date
  // NEW: Distinguish bid types
  bidType: 'ai_tool' | 'human_service'
  // NEW: Service-specific fields (only for human_service)
  serviceDetails?: {
    timeline: { startDate: Date, endDate: Date }
    pricing: { totalCost: number, breakdown: string[] }
    attachments?: string[]
  }
}
```

### Pre-defined Service (Reuses MCP Tool Pattern)
```typescript
// REUSE: MCP Tool model extended for human services
interface MCPTool {
  name: string              // "react-website-development"
  description: string       // Service description
  server: string           // Provider name/ID
  parameters: JsonSchema   // Service requirements schema
  // NEW: Service-specific extensions
  serviceType?: 'human_service'
  pricing?: {
    type: 'fixed' | 'hourly' | 'custom'
    basePrice: number
    currency: string
  }
  timeline?: {
    estimatedHours: number
    deliveryDays: number
  }
  embedding?: number[]     // Vector for semantic search (reuse existing Qdrant)
  isActive?: boolean
  providerId?: string
}
```

## Anonymous User Session Management

### URL-based Sessions
- Generate unique session tokens for anonymous users
- Store session data temporarily (7-30 days)
- Allow session recovery via URL sharing
- Optional account creation to permanentize sessions

### Session Data
- RFB drafts and history
- Voice notes and transcriptions
- Bid interactions and selections
- Communication threads

## Voice Input Implementation

### Recording Interface
- **Browser APIs**: MediaRecorder API for audio capture
- **Format**: WebM/MP4 audio for browser compatibility
- **Controls**: Record, pause, stop, playback
- **Visual Feedback**: Waveform visualization during recording

### Audio Processing
- **Client-side**: Basic audio validation and compression
- **Server-side**: Audio file storage and transcription
- **Streaming**: Progressive upload for long recordings
- **Fallback**: File upload option for older browsers

### Transcription Features
- **Real-time**: Live transcription during recording (optional)
- **Batch**: Process after upload completion
- **Editing**: Allow manual transcription corrections
- **Languages**: Multi-language support based on user preference

## Integration Points

### Existing Systems
- **Queue System**: Leverage existing queue infrastructure
- **Authentication**: Integrate with current auth system
- **Semantic Search**: Use existing search for bid matching
- **Payment System**: Integrate with Stripe for transaction processing

### New Dependencies
- **Speech-to-Text**: OpenAI Whisper API or similar
- **Audio Storage**: Cloud storage for voice files
- **Real-time Communication**: WebSocket for live bid updates
- **Push Notifications**: Alert system for bid responses

## User Stories

### Customer Stories
1. **As a customer**, I want to describe my service needs in natural language so I can easily request bids
2. **As a customer**, I want to send voice messages so I can provide detailed requirements hands-free
3. **As a customer**, I want to compare bids side-by-side so I can make informed decisions
4. **As a customer**, I want to access my requests without registering so I can try the service easily
5. **As a customer**, I want to share my request session via URL so I can collaborate with others

### Service Provider Stories
1. **As a service provider**, I want to see relevant bid requests in my queue so I can find suitable work
2. **As a service provider**, I want AI assistance with bid creation so I can respond faster
3. **As a service provider**, I want to hear voice notes from customers so I can better understand requirements
4. **As a service provider**, I want to filter requests by criteria so I can focus on my specialty

## Success Metrics

### Customer Engagement
- Session conversion rate (anonymous → registered)
- Request completion rate (submission → bid selection)
- Voice input adoption rate
- Customer satisfaction scores

### Service Provider Efficiency
- Bid response time improvement
- Bid win rate with AI assistance
- Queue engagement metrics
- Provider satisfaction with request quality

### Platform Growth
- Number of RFBs generated
- Bid completion rates
- Revenue per transaction
- User retention (both customer and provider sides)

## Implementation Phases

### Phase 1: Core Portal (MVP)
- Basic customer portal interface
- Text-based request submission
- Simple bid display and selection
- Anonymous session support

### Phase 2: Voice Integration
- Voice input recording
- Audio transcription
- Voice note playback
- Enhanced chat interface

### Phase 3: Advanced Bidding
- AI-assisted bid generation for providers
- Semantic search bid matching
- Real-time bid updates
- Enhanced comparison tools

### Phase 4: Enhanced Experience
- Advanced voice features (real-time transcription)
- Multi-language support
- Mobile app considerations
- Advanced analytics and recommendations

## Technical Considerations

### Security
- Audio file access controls
- Anonymous session token security
- Bid information privacy
- Voice data retention policies

### Performance
- Audio file compression and streaming
- Real-time transcription latency
- Queue update efficiency
- Mobile responsiveness

### Scalability
- Audio storage scaling
- Transcription service limits
- Real-time connection management
- Database optimization for bid queries

## Future Enhancements

### AI Features
- Smart bid recommendation for customers
- Automated negotiation assistance
- Predictive pricing models
- Quality assessment algorithms

### Collaboration Features
- Multi-customer request collaboration
- Team-based bid evaluation
- Shared workspaces for complex projects
- Integration with project management tools

### Mobile Experience
- Native mobile app
- Push notifications
- Offline voice recording
- Mobile-optimized bid comparison

## Questions for Stakeholder Review

1. Should anonymous users have access to all portal features or a limited subset?
2. What audio file size and duration limits should we implement?
3. How long should we retain anonymous session data?
4. Should we implement real-time transcription or batch processing only?
5. What level of AI assistance should we provide to service providers for bid generation?
6. How should we handle disputes between customers and service providers?
7. What payment and escrow features should be integrated into the bid acceptance flow?