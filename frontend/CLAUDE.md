# Frontend CLAUDE.md

## Directory Summary
The frontend directory contains the React/TypeScript single-page application that provides the user interface for Fosforescent. It includes authentication, dashboard functionality, graph visualization, subscription management, and console agent interactions.

## Key Components

### Core Application Structure
- `main.tsx` - Application entry point with routing
- `App.tsx` - Main application component
- `api.ts` - API client for backend communication
- `config.ts` - Configuration and environment variables

### Authentication & User Management
- `components/AuthLanding.tsx` - Landing page for unauthenticated users
- `components/menu/loggedOut/` - Login, registration, password reset components
- `components/menu/Account.tsx` - User account management

### Dashboard & Navigation
- `components/Dashboard.tsx` - Main dashboard component
- `components/DashboardRouter.tsx` - Dashboard routing logic
- `components/menu/HamburgerMenu.tsx` - Navigation menu
- `components/views/` - Different layout views (Browse, Focus, Query, Queue, Reports, Tree)

### Graph & Expression System
- `components/expression/` - Graph node expression handling
- `components/fields/` - Various field types for graph nodes
- `components/views/tree/` - Tree layout for graph visualization

### Admin Interface
- `components/admin/` - Admin dashboard and user management
- `components/mcp/` - MCP server management interface

### Subscription & Billing
- `components/subscription/` - Subscription dashboard
- `components/tokens/` - Token management and API tokens
- `components/tools/` - Tool pricing and usage history

### Console Agent
- `components/console/ConsoleAgent.tsx` - AI agent interface

### Desktop/Tauri Integration
- `tauri/api.ts` - TypeScript bindings for Tauri IPC commands
- `tauri/useTauri.ts` - React hook for desktop functionality (directory browsing, .fos operations)
- `tauri/auth.ts` - Browser-based authentication utilities for desktop
- `tauri/index.ts` - Re-exports all Tauri modules
- `components/peer/PeerConnectionDialog.tsx` - WebRTC peer connection for device sync

### UI Components
- `components/ui/` - Reusable UI components (Radix-based)
- `components/elements/` - Custom form elements
- `components/dialog/` - Modal dialogs and overlays

## Dependencies

### External Dependencies
- **React 18**: Component framework
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Utility-first styling
- **Radix UI**: Accessible component primitives
- **React Hook Form**: Form handling
- **Zustand**: State management
- **React Router**: Client-side routing

### Internal Dependencies
- `shared/` - Core graph types and utilities
- Backend API endpoints via `api.ts`

## Data Inputs/Outputs

### Input Sources
- User interactions (clicks, form submissions, keyboard input)
- API responses from backend
- WebSocket messages for real-time updates
- Local storage for session persistence
- Environment variables for configuration

### Output Destinations
- DOM updates via React rendering
- API requests to backend
- Local storage writes
- Browser navigation events
- WebSocket messages to backend

## Events Handled
- User authentication and session management
- Graph node creation and manipulation
- Search and filtering operations
- Subscription and payment flows
- Tool execution and monitoring
- Admin operations
- Real-time notifications

## Data Transformations
- API response parsing and normalization
- Form data validation and submission
- Graph data visualization and layout
- State management and caching
- Route parsing and navigation
- Error handling and user feedback

## Build Configuration

### Development
- Vite dev server with hot module replacement
- TypeScript compilation and type checking
- Tailwind CSS processing
- Environment variable loading

### Production (Docker)
- Multi-stage Docker build in `Dockerfile`
- Vite production build with optimizations
- Static asset generation and optimization
- Node.js server for serving built assets
- Exposes port 80 for production deployment

### Environment Variables
- `VITE_FOS_API_URL` - Backend API base URL
- `NODE_ENV` - Environment mode (development/production)

## Testing
- Jest unit tests for components and utilities
- React Testing Library for component testing
- Storybook for component development and documentation
- E2E tests via Playwright (located in `infra/e2e-tests/`)

## Styling Architecture
- Tailwind CSS for utility-first styling
- CSS modules for component-specific styles
- Radix UI for accessible component base
- Responsive design for mobile and desktop

## State Management
- Zustand stores for global state
- React Hook Form for form state
- Local component state with useState/useReducer
- API state management via custom hooks

## TODOs
- [ ] Implement comprehensive component testing
- [ ] Add accessibility testing and improvements
- [ ] Optimize bundle size and code splitting
- [ ] Implement progressive web app features
- [ ] Add offline functionality and caching
- [ ] Improve mobile responsiveness
- [ ] Add comprehensive error boundaries
- [ ] Implement performance monitoring
- [ ] Add internationalization support
- [ ] Optimize Docker build for faster deployments