# CLAUDE.md

## Directory Summary

React components for displaying and interacting with graph expressions, including input forms, result displays, and grid layouts for the Fosforescent workflow system.

### Dependencies
- **@fosforescent/shared/dag-implementation/expression**: Core expression evaluation logic
- **@fosforescent/shared/types**: Shared type definitions (AppState, FosExpression, etc.)
- **../ui/\***: Radix UI component library (Input, Button, Select, etc.)
- **lucide-react**: Icon components (Send, etc.)
- **react**: React hooks and component lifecycle

### Data Inputs

#### Props from Parent Components
- **expression**: FosExpression instance for current node context
- **data**: AppStateLoaded with complete application state
- **setData**: State update callback function
- **options**: FosReactGlobal configuration object
- **currentFilter**: Active filter type ("todo", "comments", "all")

#### User Interactions
- **Text Input**: User-typed content for new todos/comments
- **Form Submissions**: Enter key or button clicks to create items
- **Type Selection**: Dropdown selection for item type when filter is "all"
- **Grid Cell Edits**: Direct cell value modifications

#### Expression Context
- **Node Data**: Current expression's node content and metadata
- **Route Context**: Path to current expression in graph
- **Activity State**: Current view mode and filtering

### Data Outputs

#### State Updates
- **Graph Mutations**: New todos/comments added to expression store
- **UI State**: Updated AppStateLoaded via setData callback
- **Form Reset**: Input field cleared after successful submission

#### Expression Operations
- **expression.addTodo(message)**: Creates new todo item in current expression
- **expression.addComment(message)**: Creates new comment in current expression
- **expression.store.exportContext(route)**: Exports updated graph state

#### DOM Updates
- **Form Rendering**: Conditional form display based on expression context
- **Placeholder Text**: Dynamic placeholder based on selected item type
- **Button Labels**: Context-aware button text ("Add Todo", "Add Comment")

### Events Handled
- **Form Submit**: Prevents default, creates item, updates state, resets form
- **Text Input Change**: Updates local component state for controlled input
- **Type Selection**: Updates selected item type for "all" filter mode
- **Expression Updates**: Responds to expression state changes

### Data Transformations
- **User Input → Graph Items**: Text input converted to structured todo/comment nodes
- **Filter Context → UI State**: Activity filter determines form visibility and options
- **Expression State → React State**: Graph updates trigger React component re-renders
- **Form Data → Store Updates**: Form submission triggers graph mutations

### Component Responsibilities

#### ExpressionInput
- **Form Management**: Handles input state and submission
- **Type Selection**: Dropdown for item type when filter is "all"
- **Dynamic UI**: Placeholder and button text based on context
- **Graph Integration**: Creates todos/comments via expression methods

#### ExpressionResult
- **Result Display**: Shows computed expression results
- **Error Handling**: Displays evaluation errors and exceptions
- **Loading States**: Handles async computation states

#### ExpressionCard
- **Node Visualization**: Card-based display of expression nodes
- **Interaction Handlers**: Click/hover handlers for node interaction
- **Metadata Display**: Shows node information and relationships

#### ExpressionRow
- **List Display**: Row-based layout for expression items
- **Nested Rendering**: Handles hierarchical expression display
- **Action Buttons**: Inline actions for expression manipulation

#### ExpressionGridCell
- **Cell Editing**: In-place editing for grid-based expression views
- **Value Formatting**: Proper display formatting for different data types
- **Validation**: Input validation and error display

#### ExpressionFields
- **Field Management**: Handles various expression field types
- **Type-Specific Rendering**: Different UI for different field types
- **Data Binding**: Two-way binding between UI and expression data

### UI Patterns
- **Conditional Rendering**: Form visibility based on expression context
- **Controlled Components**: React state management for form inputs
- **Callback Patterns**: Parent component communication via function props
- **Error Boundaries**: Graceful handling of expression evaluation errors

## TODOs