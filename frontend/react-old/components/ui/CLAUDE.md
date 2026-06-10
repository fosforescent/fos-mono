# CLAUDE.md

## Directory Summary

Reusable UI component library built on Radix UI primitives with custom styling and TypeScript support for consistent design system across the Fosforescent application.

### Dependencies
- **@radix-ui/\***: Accessible UI primitives (react-slot, react-dialog, react-dropdown-menu, etc.)
- **class-variance-authority**: Type-safe CSS class variant management
- **clsx / cn**: Conditional CSS class name utilities
- **react**: React component framework and hooks
- **lucide-react**: Icon components (imported by consuming components)

### Data Inputs

#### Component Props
- **Variant Props**: Type-safe styling variants (size, color, state)
- **HTML Attributes**: Standard DOM element attributes with TypeScript support
- **Children**: React child elements and render props
- **Event Handlers**: onClick, onChange, onSubmit, etc.
- **Ref Forwarding**: React refs for DOM element access

#### Styling Inputs
- **CSS Classes**: Tailwind CSS utility classes
- **Theme Variables**: CSS custom properties for consistent theming
- **State Classes**: Hover, focus, disabled, active state styling
- **Responsive Classes**: Breakpoint-specific styling

### Data Outputs

#### Rendered Components
- **Accessible HTML**: ARIA-compliant markup from Radix primitives
- **Styled Elements**: Tailwind CSS-styled components
- **Interactive Elements**: Focus management, keyboard navigation
- **Responsive UI**: Mobile-first responsive design

#### Component Interfaces
- **TypeScript Types**: Fully typed component props and variants
- **Forwarded Refs**: Direct DOM element access
- **Event Callbacks**: Standardized event handling patterns
- **Composition Patterns**: Compound components and render props

### Events Handled
- **User Interactions**: Click, hover, focus, keyboard navigation
- **Form Events**: Input changes, form submission, validation
- **Dialog Management**: Open/close, backdrop clicks, escape key
- **Accessibility Events**: Screen reader announcements, focus traps

### Data Transformations
- **Variant → CSS Classes**: Type-safe variant props converted to Tailwind classes
- **Props → HTML Attributes**: React props mapped to appropriate DOM attributes
- **State → Visual Feedback**: Component state reflected in visual styling
- **Theme Values → CSS Variables**: Design tokens applied consistently

### Component Categories

#### Form Components
- **Input**: Text input with validation states and sizing variants
- **Button**: Action buttons with multiple variants (default, destructive, outline, ghost, link)
- **Select**: Dropdown selection with search and multi-select support
- **Checkbox**: Boolean input with indeterminate state
- **Radio Group**: Single selection from multiple options
- **Switch**: Toggle control for boolean settings
- **Textarea**: Multi-line text input with auto-resize
- **Form**: Form field wrapper with label and error handling

#### Layout Components
- **Card**: Content container with header, body, footer sections
- **Sheet**: Slide-out panel for secondary content
- **Dialog**: Modal dialogs with backdrop and escape handling
- **Drawer**: Mobile-friendly slide-up panels
- **Accordion**: Collapsible content sections
- **Tabs**: Tab navigation with keyboard support

#### Navigation Components
- **Dropdown Menu**: Context menus with nested submenus
- **Menubar**: Horizontal menu navigation
- **Command**: Command palette with search and filtering
- **Popover**: Floating content positioned relative to triggers

#### Feedback Components
- **Alert**: Status messages with severity levels
- **Alert Dialog**: Confirmation dialogs with action buttons
- **Toast**: Temporary notification messages
- **Progress**: Loading and progress indicators
- **Skeleton**: Loading placeholders with animation

#### Data Display
- **Table**: Data tables with sorting and selection
- **Badge**: Status indicators and labels
- **Scroll Area**: Custom scrollable regions
- **Carousel**: Image/content carousels with navigation

### Styling System
- **Variant System**: Consistent size and color variants across components
- **Focus Management**: Accessible focus indicators and keyboard navigation
- **State Styling**: Hover, active, disabled states with smooth transitions
- **Responsive Design**: Mobile-first breakpoint system
- **Dark Mode**: CSS variable-based theming support

### Accessibility Features
- **ARIA Support**: Proper labeling, roles, and states
- **Keyboard Navigation**: Full keyboard accessibility
- **Focus Traps**: Proper focus management in dialogs
- **Screen Reader**: Announcements and descriptions
- **Color Contrast**: WCAG-compliant color combinations

## TODOs