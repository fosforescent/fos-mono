# Proposed Architecture Refactoring

This document outlines a domain-driven reorganization of the Fosforescent codebase to improve modularity, composability, and maintainability.

## Current Architecture Issues

### Cross-cutting Concerns Scattered
- Authentication logic spread across `backend/auth/`, `backend/verifyJwt.ts`, and frontend components
- Graph operations split between `shared/dag-implementation/` and `backend/data/`
- No centralized event system despite extensive event documentation in `events.md`
- WebSocket logic mixed with business logic in `backend/websocketService.ts`

### Mixed Responsibilities
- Backend files mix domain logic with infrastructure concerns
- Frontend components handle both UI presentation and business logic
- No clear domain boundaries or interfaces
- Difficult to test individual components in isolation

### Tight Coupling
- Direct database access scattered throughout backend
- Hard-coded dependencies between unrelated features
- Shared state management without clear ownership
- Infrastructure details leaked into business logic

## Proposed Domain-Driven Structure

```
src/
├── domains/
│   ├── user-management/
│   │   ├── core/                           # Pure business logic
│   │   │   ├── entities/
│   │   │   │   ├── User.ts                # User aggregate root
│   │   │   │   ├── Session.ts             # Session entity
│   │   │   │   ├── Credentials.ts         # Value object
│   │   │   │   └── EmailVerification.ts   # Email verification entity
│   │   │   ├── repositories/
│   │   │   │   ├── UserRepository.ts      # Interface for user persistence
│   │   │   │   └── SessionRepository.ts   # Interface for session storage
│   │   │   ├── services/
│   │   │   │   ├── AuthService.ts         # Authentication business logic
│   │   │   │   ├── PasswordService.ts     # Password hashing/validation
│   │   │   │   ├── EmailService.ts        # Email verification logic
│   │   │   │   └── SubscriptionService.ts # Stripe subscription logic
│   │   │   └── errors/
│   │   │       ├── AuthenticationError.ts
│   │   │       └── ValidationError.ts
│   │   ├── infrastructure/                 # Implementation details
│   │   │   ├── persistence/
│   │   │   │   ├── PrismaUserRepository.ts    # Prisma implementation
│   │   │   │   └── RedisSessionRepository.ts  # Redis session storage
│   │   │   ├── email/
│   │   │   │   ├── SendGridEmailProvider.ts   # Email service implementation
│   │   │   │   └── EmailTemplates.ts          # Email templates
│   │   │   ├── auth/
│   │   │   │   ├── JwtTokenProvider.ts        # JWT implementation
│   │   │   │   ├── BcryptPasswordHasher.ts    # Password hashing
│   │   │   │   └── StripePaymentProvider.ts   # Stripe integration
│   │   │   └── config/
│   │   │       └── UserConfig.ts              # Domain-specific config
│   │   ├── api/                            # HTTP endpoints
│   │   │   ├── routes/
│   │   │   │   ├── authRoutes.ts              # Auth endpoints
│   │   │   │   ├── userRoutes.ts              # User management
│   │   │   │   └── subscriptionRoutes.ts      # Subscription endpoints
│   │   │   ├── middleware/
│   │   │   │   ├── authMiddleware.ts          # JWT validation
│   │   │   │   └── rateLimitMiddleware.ts     # Rate limiting
│   │   │   └── serializers/
│   │   │       ├── UserSerializer.ts         # API response formatting
│   │   │       └── ErrorSerializer.ts        # Error response formatting
│   │   ├── events/                         # Domain events
│   │   │   ├── UserRegistered.ts              # user.register event
│   │   │   ├── UserLoggedIn.ts                # user.login event
│   │   │   ├── EmailVerified.ts               # user.email_verification event
│   │   │   └── handlers/
│   │   │       ├── SendWelcomeEmailHandler.ts # Event handlers
│   │   │       └── UpdateUserStatsHandler.ts
│   │   └── tests/
│   │       ├── unit/                          # Unit tests for core logic
│   │       ├── integration/                   # Integration tests
│   │       └── fixtures/                      # Test data
│   │
│   ├── graph/
│   │   ├── core/
│   │   │   ├── entities/
│   │   │   │   ├── FosNode.ts                 # Graph node aggregate
│   │   │   │   ├── FosStore.ts                # Graph store aggregate
│   │   │   │   ├── CID.ts                     # Content identifier value object
│   │   │   │   ├── NodeContent.ts             # Node content value object
│   │   │   │   └── GraphRelationship.ts       # Relationship entity
│   │   │   ├── repositories/
│   │   │   │   ├── GraphRepository.ts         # Graph persistence interface
│   │   │   │   └── NodeRepository.ts          # Node storage interface
│   │   │   ├── services/
│   │   │   │   ├── GraphService.ts            # Graph manipulation logic
│   │   │   │   ├── HashService.ts             # Content addressing
│   │   │   │   ├── ValidationService.ts       # Node validation
│   │   │   │   └── MigrationService.ts        # Graph migrations
│   │   │   └── errors/
│   │   │       ├── NodeNotFoundError.ts
│   │   │       ├── InvalidHashError.ts
│   │   │       └── CircularDependencyError.ts
│   │   ├── infrastructure/
│   │   │   ├── persistence/
│   │   │   │   ├── PostgreSQLGraphRepository.ts   # PostgreSQL implementation
│   │   │   │   └── InMemoryGraphRepository.ts     # In-memory for tests
│   │   │   ├── distributed/
│   │   │   │   ├── DHTGraphStore.ts               # Distributed hash table
│   │   │   │   └── P2PNetworking.ts               # Peer-to-peer networking
│   │   │   └── serialization/
│   │   │       ├── NodeSerializer.ts              # Node serialization
│   │   │       └── GraphSerializer.ts             # Graph serialization
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── graphRoutes.ts                 # Graph CRUD endpoints
│   │   │   │   └── nodeRoutes.ts                  # Node operations
│   │   │   └── serializers/
│   │   │       └── GraphSerializer.ts             # API response formatting
│   │   ├── events/
│   │   │   ├── NodeCreated.ts                     # graph.node_created event
│   │   │   ├── NodeUpdated.ts                     # graph.node_updated event
│   │   │   ├── NodeDeleted.ts                     # graph.node_deleted event
│   │   │   ├── RelationshipCreated.ts             # graph.relationship_created event
│   │   │   └── handlers/
│   │   │       ├── UpdateSearchIndexHandler.ts   # Update search on changes
│   │   │       └── BroadcastChangeHandler.ts      # Notify collaborators
│   │   └── tests/
│   │
│   ├── workflow/
│   │   ├── core/
│   │   │   ├── entities/
│   │   │   │   ├── Workflow.ts                    # Workflow aggregate
│   │   │   │   ├── Expression.ts                  # Expression entity
│   │   │   │   ├── ExecutionContext.ts            # Execution context
│   │   │   │   ├── WorkflowStep.ts                # Individual step
│   │   │   │   └── ExecutionResult.ts             # Execution result
│   │   │   ├── repositories/
│   │   │   │   ├── WorkflowRepository.ts          # Workflow persistence
│   │   │   │   └── ExecutionRepository.ts         # Execution history
│   │   │   ├── services/
│   │   │   │   ├── ExecutionService.ts            # Workflow execution
│   │   │   │   ├── ExpressionEvaluator.ts         # Expression evaluation
│   │   │   │   ├── DependencyResolver.ts          # Dependency resolution
│   │   │   │   └── SchedulingService.ts           # Execution scheduling
│   │   │   └── errors/
│   │   │       ├── ExecutionError.ts
│   │   │       ├── DependencyError.ts
│   │   │       └── TimeoutError.ts
│   │   ├── infrastructure/
│   │   │   ├── execution/
│   │   │   │   ├── AsyncExecutionEngine.ts        # Async execution
│   │   │   │   ├── WorkerPool.ts                  # Worker management
│   │   │   │   └── ResourceManager.ts             # Resource allocation
│   │   │   └── interpreters/
│   │   │       ├── JavaScriptInterpreter.ts       # JS expression evaluation
│   │   │       └── PythonInterpreter.ts           # Python evaluation
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── workflowRoutes.ts              # Workflow endpoints
│   │   │       └── executionRoutes.ts             # Execution endpoints
│   │   ├── events/
│   │   │   ├── WorkflowExecutionStarted.ts        # workflow.execution_started
│   │   │   ├── WorkflowExecutionCompleted.ts      # workflow.execution_completed
│   │   │   ├── WorkflowExecutionFailed.ts         # workflow.execution_failed
│   │   │   ├── StepCompleted.ts                   # workflow.step_completed
│   │   │   └── handlers/
│   │   │       ├── NotifyUserHandler.ts           # Notify on completion
│   │   │       └── UpdateProgressHandler.ts       # Update progress
│   │   └── tests/
│   │
│   ├── collaboration/
│   │   ├── core/
│   │   │   ├── entities/
│   │   │   │   ├── CollaborationSession.ts        # Collaboration session
│   │   │   │   ├── Conflict.ts                    # Merge conflict
│   │   │   │   ├── Resolution.ts                  # Conflict resolution
│   │   │   │   └── Participant.ts                 # Session participant
│   │   │   ├── repositories/
│   │   │   │   ├── SessionRepository.ts           # Session persistence
│   │   │   │   └── ConflictRepository.ts          # Conflict storage
│   │   │   ├── services/
│   │   │   │   ├── CollaborationService.ts        # Collaboration logic
│   │   │   │   ├── ConflictResolver.ts            # Conflict resolution
│   │   │   │   ├── SynchronizationService.ts      # State synchronization
│   │   │   │   └── PresenceService.ts             # User presence
│   │   │   └── errors/
│   │   │       ├── ConflictError.ts
│   │   │       └── SynchronizationError.ts
│   │   ├── infrastructure/
│   │   │   ├── websocket/
│   │   │   │   ├── WebSocketServer.ts             # WebSocket server
│   │   │   │   ├── ConnectionManager.ts           # Connection management
│   │   │   │   └── MessageBroker.ts               # Message routing
│   │   │   └── realtime/
│   │   │       ├── CRDTImplementation.ts          # CRDT for conflict resolution
│   │   │       └── OperationalTransform.ts        # Operational transformation
│   │   ├── api/
│   │   │   └── websocket/
│   │   │       ├── CollaborationHandler.ts        # WebSocket message handlers
│   │   │       └── PresenceHandler.ts             # Presence updates
│   │   ├── events/
│   │   │   ├── UserJoined.ts                      # collaboration.user_joined
│   │   │   ├── UserLeft.ts                        # collaboration.user_left
│   │   │   ├── ConflictDetected.ts                # collaboration.conflict_detected
│   │   │   ├── ConflictResolved.ts                # collaboration.conflict_resolved
│   │   │   └── handlers/
│   │   │       ├── NotifyParticipantsHandler.ts   # Notify other users
│   │   │       └── LogActivityHandler.ts          # Log collaboration events
│   │   └── tests/
│   │
│   ├── search/
│   │   ├── core/
│   │   │   ├── entities/
│   │   │   │   ├── SearchQuery.ts                 # Search query value object
│   │   │   │   ├── SearchResult.ts                # Search result entity
│   │   │   │   ├── Embedding.ts                   # Vector embedding
│   │   │   │   └── SearchIndex.ts                 # Search index
│   │   │   ├── repositories/
│   │   │   │   ├── SearchRepository.ts            # Search persistence
│   │   │   │   └── EmbeddingRepository.ts         # Vector storage
│   │   │   ├── services/
│   │   │   │   ├── SearchService.ts               # Search orchestration
│   │   │   │   ├── EmbeddingService.ts            # Vector generation
│   │   │   │   ├── IndexingService.ts             # Search indexing
│   │   │   │   └── RankingService.ts              # Result ranking
│   │   │   └── errors/
│   │   │       ├── SearchError.ts
│   │   │       └── IndexingError.ts
│   │   ├── infrastructure/
│   │   │   ├── vector/
│   │   │   │   ├── PgVectorRepository.ts          # PostgreSQL pgvector
│   │   │   │   └── ChromaRepository.ts            # Alternative vector DB
│   │   │   ├── embedding/
│   │   │   │   ├── OpenAIEmbeddingProvider.ts     # OpenAI embeddings
│   │   │   │   └── LocalEmbeddingProvider.ts      # Local embeddings
│   │   │   └── indexing/
│   │   │       ├── ElasticsearchIndexer.ts        # Full-text search
│   │   │       └── MemoryIndexer.ts               # In-memory indexing
│   │   ├── api/
│   │   │   └── routes/
│   │   │       └── searchRoutes.ts                # Search endpoints
│   │   ├── events/
│   │   │   ├── SearchPerformed.ts                 # search.performed event
│   │   │   ├── IndexUpdated.ts                    # search.index_updated event
│   │   │   └── handlers/
│   │   │       └── UpdateSearchStatsHandler.ts    # Update search analytics
│   │   └── tests/
│   │
│   └── integrations/
│       ├── stripe/
│       │   ├── core/
│       │   │   ├── entities/
│       │   │   │   ├── Payment.ts                 # Payment entity
│       │   │   │   ├── Subscription.ts            # Subscription entity
│       │   │   │   └── Customer.ts                # Customer entity
│       │   │   ├── services/
│       │   │   │   ├── PaymentService.ts          # Payment processing
│       │   │   │   └── SubscriptionService.ts     # Subscription management
│       │   │   └── errors/
│       │   │       └── PaymentError.ts
│       │   ├── infrastructure/
│       │   │   ├── StripeClient.ts                # Stripe API client
│       │   │   └── WebhookHandler.ts              # Stripe webhooks
│       │   ├── api/
│       │   │   └── routes/
│       │   │       ├── paymentRoutes.ts           # Payment endpoints
│       │   │       └── webhookRoutes.ts           # Webhook endpoints
│       │   ├── events/
│       │   │   ├── PaymentSucceeded.ts            # stripe.payment_succeeded
│       │   │   ├── PaymentFailed.ts               # stripe.payment_failed
│       │   │   └── handlers/
│       │   │       └── UpdateSubscriptionHandler.ts
│       │   └── tests/
│       ├── email/
│       │   ├── core/
│       │   │   ├── entities/
│       │   │   │   ├── Email.ts                   # Email entity
│       │   │   │   └── EmailTemplate.ts           # Email template
│       │   │   ├── services/
│       │   │   │   └── EmailService.ts            # Email sending logic
│       │   │   └── errors/
│       │   │       └── EmailError.ts
│       │   ├── infrastructure/
│       │   │   ├── SendGridProvider.ts            # SendGrid implementation
│       │   │   └── SMTPProvider.ts                # SMTP implementation
│       │   ├── events/
│       │   │   ├── EmailSent.ts                   # email.sent event
│       │   │   ├── EmailFailed.ts                 # email.failed event
│       │   │   └── handlers/
│       │   │       └── LogEmailEventHandler.ts
│       │   └── tests/
│       └── external-apis/
│           ├── openai/
│           ├── github/
│           └── notion/
│
├── shared/
│   ├── events/                                # Event system infrastructure
│   │   ├── EventBus.ts                        # Central event bus
│   │   ├── EventStore.ts                      # Event persistence
│   │   ├── EventHandler.ts                    # Base event handler
│   │   ├── DomainEvent.ts                     # Base domain event
│   │   └── types.ts                           # Event type definitions
│   ├── types/                                 # Cross-domain types
│   │   ├── common.ts                          # Common value objects
│   │   ├── errors.ts                          # Base error types
│   │   └── pagination.ts                     # Pagination types
│   ├── utils/                                 # Pure utility functions
│   │   ├── validation.ts                      # Validation utilities
│   │   ├── crypto.ts                          # Cryptographic utilities
│   │   └── formatting.ts                     # Formatting utilities
│   └── contracts/                             # Domain interfaces
│       ├── Repository.ts                      # Base repository interface
│       ├── Service.ts                         # Base service interface
│       └── EventHandler.ts                    # Event handler interface
│
├── infrastructure/                            # Cross-cutting infrastructure
│   ├── database/
│   │   ├── DatabaseConnection.ts              # Database setup
│   │   ├── migrations/                        # Database migrations
│   │   └── seeds/                             # Database seeds
│   ├── monitoring/
│   │   ├── Logger.ts                          # Structured logging
│   │   ├── Metrics.ts                         # Application metrics
│   │   ├── Tracing.ts                         # Distributed tracing
│   │   └── HealthCheck.ts                     # Health monitoring
│   ├── caching/
│   │   ├── CacheManager.ts                    # Cache abstraction
│   │   ├── RedisCache.ts                      # Redis implementation
│   │   └── MemoryCache.ts                     # In-memory cache
│   ├── config/
│   │   ├── Configuration.ts                   # Configuration management
│   │   ├── Environment.ts                     # Environment variables
│   │   └── validation.ts                      # Config validation
│   └── messaging/
│       ├── MessageQueue.ts                    # Message queue abstraction
│       ├── RedisQueue.ts                      # Redis queue implementation
│       └── InMemoryQueue.ts                   # In-memory queue
│
├── api/                                       # API composition layer
│   ├── routes/
│   │   ├── index.ts                           # Route composition
│   │   └── documentation.ts                   # API documentation
│   ├── middleware/
│   │   ├── corsMiddleware.ts                  # CORS handling
│   │   ├── compressionMiddleware.ts           # Response compression
│   │   ├── securityMiddleware.ts              # Security headers
│   │   └── loggingMiddleware.ts               # Request logging
│   ├── composition/
│   │   ├── DependencyContainer.ts             # Dependency injection
│   │   └── ServiceRegistry.ts                 # Service registration
│   └── server.ts                              # Server setup and startup
│
└── ui/                                        # Frontend reorganized by domain
    ├── domains/
    │   ├── user-management/
    │   │   ├── components/
    │   │   │   ├── LoginForm.tsx              # Authentication UI
    │   │   │   ├── RegisterForm.tsx           # Registration UI
    │   │   │   ├── UserProfile.tsx            # User profile UI
    │   │   │   └── SubscriptionSettings.tsx   # Subscription UI
    │   │   ├── hooks/
    │   │   │   ├── useAuth.ts                 # Authentication hook
    │   │   │   ├── useUser.ts                 # User data hook
    │   │   │   └── useSubscription.ts         # Subscription hook
    │   │   ├── stores/
    │   │   │   ├── authStore.ts               # Authentication state
    │   │   │   └── userStore.ts               # User data state
    │   │   └── types/
    │   │       └── userTypes.ts               # UI-specific user types
    │   ├── graph/
    │   │   ├── components/
    │   │   │   ├── GraphCanvas.tsx            # Graph visualization
    │   │   │   ├── NodeEditor.tsx             # Node editing UI
    │   │   │   ├── GraphBrowser.tsx           # Graph navigation
    │   │   │   └── RelationshipEditor.tsx     # Relationship editing
    │   │   ├── hooks/
    │   │   │   ├── useGraph.ts                # Graph data hook
    │   │   │   ├── useNodes.ts                # Node operations hook
    │   │   │   └── useRelationships.ts        # Relationship hook
    │   │   ├── stores/
    │   │   │   ├── graphStore.ts              # Graph state management
    │   │   │   └── selectionStore.ts          # Selection state
    │   │   └── utils/
    │   │       ├── graphLayout.ts             # Graph layout algorithms
    │   │       └── nodeRendering.ts           # Node rendering utilities
    │   ├── workflow/
    │   │   ├── components/
    │   │   │   ├── WorkflowBuilder.tsx        # Workflow creation UI
    │   │   │   ├── ExecutionMonitor.tsx       # Execution monitoring
    │   │   │   ├── ExpressionEditor.tsx       # Expression editing
    │   │   │   └── WorkflowHistory.tsx        # Execution history
    │   │   ├── hooks/
    │   │   │   ├── useWorkflow.ts             # Workflow hook
    │   │   │   ├── useExecution.ts            # Execution hook
    │   │   │   └── useExpressions.ts          # Expression hook
    │   │   └── stores/
    │   │       ├── workflowStore.ts           # Workflow state
    │   │       └── executionStore.ts          # Execution state
    │   └── collaboration/
    │       ├── components/
    │       │   ├── UserList.tsx               # Collaborator list
    │       │   ├── ConflictResolver.tsx       # Conflict resolution UI
    │       │   ├── PresenceIndicator.tsx      # User presence
    │       │   └── ChatPanel.tsx              # Collaboration chat
    │       ├── hooks/
    │       │   ├── useCollaboration.ts        # Collaboration hook
    │       │   ├── usePresence.ts             # Presence hook
    │       │   └── useConflicts.ts            # Conflict hook
    │       └── stores/
    │           ├── collaborationStore.ts      # Collaboration state
    │           └── presenceStore.ts           # Presence state
    ├── shared/
    │   ├── components/                        # Reusable UI components
    │   │   ├── Button.tsx                     # Button component
    │   │   ├── Modal.tsx                      # Modal component
    │   │   ├── Form.tsx                       # Form components
    │   │   └── Layout.tsx                     # Layout components
    │   ├── hooks/                             # Cross-domain hooks
    │   │   ├── useApi.ts                      # API client hook
    │   │   ├── useWebSocket.ts                # WebSocket hook
    │   │   └── useLocalStorage.ts             # Local storage hook
    │   ├── stores/                            # Shared state management
    │   │   ├── appStore.ts                    # Application state
    │   │   ├── notificationStore.ts           # Notifications
    │   │   └── settingsStore.ts               # User settings
    │   ├── utils/                             # UI utilities
    │   │   ├── formatting.ts                  # Data formatting
    │   │   ├── validation.ts                  # Form validation
    │   │   └── constants.ts                   # UI constants
    │   └── types/                             # Shared UI types
    │       ├── apiTypes.ts                    # API response types
    │       └── uiTypes.ts                     # UI component types
    └── app/                                   # App shell and routing
        ├── App.tsx                            # Root component
        ├── Router.tsx                         # Application routing
        ├── Layout.tsx                         # Main layout
        └── providers/                         # Context providers
            ├── AuthProvider.tsx               # Authentication context
            ├── ThemeProvider.tsx              # Theme context
            └── ErrorProvider.tsx              # Error boundary
```

## Key Architectural Principles

### 1. Domain-Driven Design
- **Bounded Contexts**: Each domain encapsulates related business logic
- **Ubiquitous Language**: Consistent terminology within each domain
- **Aggregate Roots**: Clear entity ownership and consistency boundaries
- **Value Objects**: Immutable data structures for simple concepts

### 2. Hexagonal Architecture (Ports & Adapters)
- **Core Logic**: Business rules independent of external concerns
- **Ports**: Interfaces for external dependencies
- **Adapters**: Implementation of external integrations
- **Dependency Inversion**: Core depends on abstractions, not implementations

### 3. Event-Driven Architecture
- **Domain Events**: Capture business-significant occurrences
- **Event Bus**: Decoupled communication between domains
- **Event Sourcing**: Optional for audit trails and debugging
- **CQRS**: Separate read/write models where beneficial

### 4. Composition over Inheritance
- **Dependency Injection**: Configurable service composition
- **Interface Segregation**: Small, focused interfaces
- **Strategy Pattern**: Pluggable implementations
- **Factory Pattern**: Object creation abstraction

## Migration Strategy

### Phase 1: Event System Foundation
1. Implement central event bus and domain event base classes
2. Add event handlers for existing functionality
3. Create event store for persistence and debugging

### Phase 2: User Management Domain
1. Extract user-related logic from scattered locations
2. Implement clean interfaces for authentication and authorization
3. Add comprehensive test coverage for business logic

### Phase 3: Graph Domain
1. Refactor existing graph implementation into clean domain structure
2. Separate content-addressable storage from business logic
3. Implement proper repository pattern for graph persistence

### Phase 4: Workflow Domain
1. Extract expression evaluation and execution logic
2. Implement proper dependency resolution and scheduling
3. Add support for async execution and progress tracking

### Phase 5: Collaboration Domain
1. Extract WebSocket logic into dedicated collaboration service
2. Implement CRDT or operational transformation for conflict resolution
3. Add proper presence management and user synchronization

### Phase 6: Search Domain
1. Extract search and embedding logic
2. Implement pluggable search providers
3. Add semantic search capabilities with vector databases

### Phase 7: Frontend Reorganization
1. Reorganize React components by domain
2. Implement domain-specific state management
3. Create reusable UI component library

## Benefits of This Architecture

### Improved Testability
- Pure business logic can be unit tested without infrastructure
- Mock implementations for external dependencies
- Integration tests focus on specific domain boundaries

### Enhanced Maintainability
- Clear separation of concerns
- Localized changes within domain boundaries
- Consistent patterns across domains

### Better Scalability
- Independent deployment of domains
- Horizontal scaling of specific services
- Event-driven communication reduces coupling

### Increased Composability
- Pluggable implementations via dependency injection
- Reusable components across domains
- Clear interfaces for third-party integrations

### Simplified Onboarding
- Clear domain boundaries reduce cognitive load
- Consistent patterns across codebase
- Self-contained modules with clear responsibilities