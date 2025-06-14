# MCP-Style Service Integration Plan

## Overview

This document outlines how to integrate pre-defined services with the existing MCP (Model Context Protocol) server infrastructure. The goal is to make human services work exactly like MCP tools, with semantic matching, bidding, and execution following the same patterns.

## 🚀 **Key Insight: Services = Tools with Humans**

```typescript
// CURRENT: MCP Tool
interface MCPTool {
  name: string
  description: string
  server: string
  parameters: JsonSchema
  execute: (params) => Promise<result>
}

// NEW: Human Service (same interface!)
interface HumanService {
  name: string           // "react-website-development"
  description: string    // "Build responsive React websites"
  server: string         // "provider-john-doe" 
  parameters: JsonSchema // { budget: number, timeline: string, features: string[] }
  execute: (params) => Promise<result> // Creates project, returns delivery timeline
}
```

**The beautiful insight**: Customer requests for services can use the **exact same bidding infrastructure** as MCP tool selection, just with human providers instead of AI tools.

## Current MCP Infrastructure Analysis

### Existing MCP Components (to reuse)

#### 1. **MCPServerManager.tsx** (Dashboard Servers tab)
- Server connection management
- Tool discovery and listing
- Health monitoring and status

#### 2. **BidHistory.tsx** (Dashboard Bids tab)  
- Tool bidding sessions and analytics
- Choice rates and performance tracking
- Bid comparison and selection logic

#### 3. **ConsoleAgent.tsx** (Dashboard Console tab)
- Task description → tool bidding → execution
- Real-time tool suggestions and selection
- Cost tracking and result display

#### 4. **Backend MCP Infrastructure**
```typescript
// Existing files to extend
backend/mcp/mcpClient.ts       // MCP client connections
backend/mcp/mcpServer.ts       // MCP server implementation  
backend/toolBidManager.ts      // Tool bidding logic
backend/mcp/mcpTypes.ts        // MCP type definitions
```

## Service Integration Strategy

### 1. **Extend MCP Types for Human Services**

#### Enhanced MCP Types (mcpTypes.ts)
```typescript
// EXISTING
interface MCPServer {
  id: string
  name: string
  type: 'mcp' | 'temporal'
  connectionString: string
  tools: MCPTool[]
}

// ENHANCED
interface MCPServer {
  id: string
  name: string
  type: 'mcp' | 'temporal' | 'human_provider'  // NEW TYPE
  connectionString: string
  tools: MCPTool[]
  services?: HumanService[]                     // NEW FIELD
  providerId?: string                           // NEW FIELD
}

interface HumanService extends MCPTool {
  // Inherits: name, description, parameters from MCPTool
  providerId: string
  pricing: {
    type: 'fixed' | 'hourly' | 'custom'
    basePrice: number
    currency: string
  }
  timeline: {
    estimatedHours: number
    deliveryDays: number
  }
  category: string[]
  requirements: string[]
  deliverables: string[]
  embedding: number[]        // For semantic search
  isActive: boolean
  rating?: number
  completedProjects?: number
}
```

### 2. **Provider-as-Server Pattern**

#### Each Service Provider = MCP Server
```typescript
// When user becomes service provider, auto-create "server"
const createProviderServer = (providerId: string) => ({
  id: `provider-${providerId}`,
  name: `${providerProfile.displayName} Services`,
  type: 'human_provider',
  connectionString: `internal://provider/${providerId}`,
  tools: [], // Empty - providers offer services, not tools
  services: [], // Populated by provider's service listings
  providerId: providerId
})
```

### 3. **Semantic Matching Integration**

#### Leverage Existing Qdrant Infrastructure
The project already has vector search configured. Extend for service matching:

```typescript
// Existing: backend/embedding.ts 
// Extend to generate embeddings for services
const generateServiceEmbedding = async (service: HumanService) => {
  const text = `${service.name} ${service.description} ${service.category.join(' ')} ${service.requirements.join(' ')}`
  return await generateEmbedding(text) // Reuse existing function
}

// Existing: backend/data/search.ts
// Extend semantic search for services
const findMatchingServices = async (requestDescription: string, limit = 5) => {
  const queryEmbedding = await generateEmbedding(requestDescription)
  return await semanticSearch('services', queryEmbedding, limit) // Reuse existing search
}
```

### 4. **Bidding Integration with Tool Bidding**

#### Enhanced Tool Bid Manager (toolBidManager.ts)
```typescript
// EXISTING: Tool bidding for AI agent tasks
interface ToolBidSession {
  sessionId: string
  taskDescription: string
  toolBids: ToolBid[]
  chosenBid?: ToolBid
}

// ENHANCED: Combined tool + service bidding
interface BidSession {
  sessionId: string
  taskDescription: string
  requestType: 'tool_selection' | 'service_request'
  toolBids: ToolBid[]           // AI tools (existing)
  serviceBids: ServiceBid[]     // Human services (new)
  chosenBid?: ToolBid | ServiceBid
}

interface ServiceBid {
  bidId: string
  serviceId: string
  providerId: string
  serviceName: string
  relevanceScore: number
  pricing: {
    totalCost: number
    breakdown: string[]
  }
  timeline: {
    estimatedCompletion: Date
  }
  bidReason: string
  isAutoGenerated: boolean      // From pre-defined service
}
```

### 5. **Console Agent Integration**

#### Enhanced ConsoleAgent for Service Requests
```typescript
// Customer submits: "I need a React website for my business"
// System generates both tool bids AND service bids:

const handleServiceRequest = async (description: string) => {
  // 1. Generate tool bids (existing logic)
  const toolBids = await generateToolBids(description)
  
  // 2. Generate service bids (new logic, same interface)
  const serviceBids = await generateServiceBids(description)
  
  // 3. Combine and rank (same comparison logic)
  const allBids = [...toolBids, ...serviceBids].sort(by_relevance)
  
  // 4. Present unified selection interface
  return {
    message: "I found several options for your request:",
    availableOptions: allBids.length,
    recommendedBid: allBids[0],
    allBids: allBids
  }
}

const generateServiceBids = async (description: string) => {
  // Find matching services using semantic search
  const matchingServices = await findMatchingServices(description, 5)
  
  // Generate bids from each matching service
  return matchingServices.map(service => ({
    bidId: generateId(),
    serviceId: service.id,
    providerId: service.providerId,
    serviceName: service.name,
    relevanceScore: service.matchScore,
    pricing: calculateServicePricing(service, description),
    timeline: estimateTimeline(service, description),
    bidReason: `Service "${service.name}" matches your requirements`,
    isAutoGenerated: true
  }))
}
```

## Implementation Plan

**Total Implementation: ~4-5 days** (heavy reuse of existing MCP infrastructure)

### Phase 1: Core Service Infrastructure (1-2 days - Mostly DB extensions)

#### 1.1. Database Schema
```sql
-- REUSE: Extend existing MCPTools table for human services
ALTER TABLE MCPTools ADD COLUMN service_type ENUM('ai_tool', 'human_service') DEFAULT 'ai_tool';
ALTER TABLE MCPTools ADD COLUMN provider_id VARCHAR(255);
ALTER TABLE MCPTools ADD COLUMN pricing JSON;
ALTER TABLE MCPTools ADD COLUMN timeline JSON;
ALTER TABLE MCPTools ADD COLUMN embedding VECTOR(3072); -- Reuse existing Qdrant setup

-- REUSE: Extend existing tool bidding tables (already covered in other docs)
ALTER TABLE BidSessions ADD COLUMN request_type ENUM('tool_selection', 'service_request') DEFAULT 'tool_selection';
ALTER TABLE ToolBids ADD COLUMN bid_type ENUM('ai_tool', 'human_service') DEFAULT 'ai_tool';
```

#### 1.2. Backend Extensions
```typescript
// Extend existing files
backend/mcp/mcpTypes.ts        // Add HumanService interface
backend/toolBidManager.ts      // Add service bidding logic
backend/data/search.ts         // Add service semantic search
```

### Phase 2: Provider Service Management (1 day - Reuse MCP patterns)

#### 2.1. Dashboard Services Tab
```typescript
// Add to existing Dashboard.tsx tabs
<TabsTrigger value="services">
  <Briefcase className="h-4 w-4 mr-2" />
  Services
</TabsTrigger>

// New component: ServiceManagement.tsx
interface ServiceManagementProps {
  services: HumanService[]
  onServiceCreate: (service: HumanService) => void
  onServiceUpdate: (id: string, service: HumanService) => void
  onServiceDelete: (id: string) => void
}
```

#### 2.2. Service Creation Interface
```typescript
// Form fields matching MCP tool pattern
interface ServiceCreationForm {
  name: string              // "react-website-development"
  description: string       // Rich text description
  category: string[]        // ["web-development", "react", "frontend"]
  pricing: PricingStructure
  timeline: TimelineEstimate
  requirements: string[]    // ["project requirements", "design mockups"]
  deliverables: string[]    // ["source code", "deployment", "documentation"]
}
```

### Phase 3: Request Processing Integration (1 day - Reuse existing console)

#### 3.1. Enhanced ConsoleAgent
- Modify existing console to handle service requests
- Integrate service bidding with tool bidding
- Unified bid comparison interface

#### 3.2. Customer Portal Integration
- When customer submits RFB, trigger service matching
- Display service bids alongside manual provider bids
- Same selection interface for both types

### Phase 4: Queue Integration (0.5 days - Minor queue extensions)

#### 4.1. Enhanced QueueLayout
```typescript
// Add service matches to existing queue items
interface QueueItem {
  type: 'todo' | 'comment' | 'expression' | 'customer_request' | 'service_match'
  serviceMatch?: {
    requestId: string
    service: HumanService
    matchScore: number
    autoGenerated: boolean
  }
}
```

## Shared Infrastructure Benefits

### 1. **Reuse Existing Components**
- **MCPServerManager** → Manage provider "servers" and their services
- **BidHistory** → Track both tool and service bid performance  
- **ConsoleAgent** → Unified interface for tools and services
- **Semantic Search** → Same Qdrant infrastructure for services

### 2. **Consistent User Experience**
- Same bidding interface whether AI tool or human service
- Same analytics and performance tracking
- Same real-time updates and notifications
- Same cost tracking and billing integration

### 3. **Minimal Code Duplication**
- Service bidding extends tool bidding (90% code reuse)
- Service search extends existing semantic search
- Service management reuses MCP server patterns
- Provider profiles reuse existing user management

## Advanced Features (Future Phases)

### 1. **Hybrid Tool-Service Workflows**
```typescript
// Customer request: "Build a website and set up analytics"
// System response: 
// - Service bid: Website development (human provider)
// - Tool bid: Analytics setup (automated MCP tool)
// - Combined workflow with dependencies
```

### 2. **Service Composition**
```typescript
// Multiple services for complex projects
interface ServiceWorkflow {
  services: HumanService[]
  dependencies: ServiceDependency[]
  totalCost: number
  totalTimeline: number
}
```

### 3. **Provider Collaboration**
```typescript
// Services that require multiple providers
interface CollaborativeService {
  primaryProvider: string
  requiredPartners: string[]
  skillRequirements: string[]
}
```

## Success Metrics

### 1. **Service Adoption**
- Number of services created by providers
- Service bid win rates vs manual bids
- Customer satisfaction with auto-matched services

### 2. **System Efficiency**
- Response time for service matching
- Accuracy of semantic matching (customer acceptance rate)
- Reduction in manual bid submission time

### 3. **Platform Growth**
- Percentage of requests resolved via pre-defined services
- Provider service portfolio growth over time
- Cross-platform revenue (tools + services)

This integration leverages the existing MCP infrastructure to create a seamless experience where human services work exactly like AI tools, with the same bidding, selection, and execution patterns that users are already familiar with.