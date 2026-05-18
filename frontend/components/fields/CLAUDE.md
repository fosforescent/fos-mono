# CLAUDE.md

## Directory Summary

Specialized form field components for different data types in the Fosforescent workflow system, including todos, descriptions, costs, durations, file uploads, and various input types.

### Dependencies
- **@fosforescent/shared/dag-implementation/expression**: Core expression system
- **@fosforescent/shared/types**: Shared type definitions (FosExpression, AppState, etc.)
- **@fosforescent/shared/nodeOperations**: Node manipulation utilities
- **../ui/\***: UI component library (Button, Popover, Command, etc.)
- **../elements/inputDiv**: Custom input element
- **../drag-drop**: Drag and drop functionality
- **@dnd-kit/core**: Drag and drop primitives
- **lucide-react**: Icon components
- **lodash**: Data manipulation utilities

### Data Inputs

#### Expression Context
- **expression**: FosExpression instance providing node context
- **nodeDescription**: Current node description text
- **nodeType**: Type of field being rendered (todo, description, cost, etc.)
- **nodeId**: Unique identifier for the current node
- **childRoutes**: Navigation paths to child nodes

#### Field-Specific Data
- **Todo Fields**: Completion status, priority, due dates
- **Cost Fields**: Amount, currency, allocation type
- **Duration Fields**: Time estimates, units (hours, days, weeks)
- **File Fields**: File uploads, attachments, metadata
- **Choice Fields**: Option selections, multiple choice data

#### UI State
- **hasFocus**: Current focus state for editing
- **isDragging**: Drag operation status
- **isCollapsed**: Expansion state for hierarchical data
- **depth**: Nesting level in hierarchy
- **disabled**: Field interaction state

### Data Outputs

#### Graph Updates
- **Node Mutations**: Direct node content modifications
- **Status Changes**: Todo completion, priority updates
- **Content Updates**: Description and text field changes
- **File Attachments**: Uploaded file references
- **Choice Selections**: Option selection updates

#### UI Events
- **Field Updates**: Real-time field value changes
- **Drag Operations**: Node reordering and hierarchy changes
- **Focus Changes**: Field selection and editing state
- **Expansion State**: Collapsing/expanding hierarchical content

#### Action Triggers
- **Completion Actions**: Todo item completion workflows
- **File Operations**: Upload, download, delete file operations
- **Validation Events**: Field validation and error reporting
- **Submission Events**: Form field submission and processing

### Events Handled
- **Text Input**: Real-time text editing with debouncing
- **Status Toggles**: Completion checkboxes and status changes
- **File Selection**: File picker and drag-drop upload
- **Choice Selection**: Option picking from dropdowns
- **Drag and Drop**: Node reordering and hierarchy modification
- **Focus Management**: Field focusing and blur events

### Data Transformations
- **User Input → Node Content**: Field values converted to graph node data
- **Node Data → Field Values**: Graph content displayed in appropriate field types
- **Validation → Error Display**: Field validation results shown to user
- **File Data → Attachments**: File uploads converted to node attachments
- **Choice Options → UI Elements**: Available choices rendered as selectable options

### Field Component Types

#### Todo Fields
- **Completion Checkbox**: Toggle todo completion status
- **Priority Selection**: Priority level assignment
- **Due Date Picker**: Date selection for deadlines
- **Progress Tracking**: Completion percentage display

#### Text Fields
- **Description**: Multi-line text editing with formatting
- **Comments**: Comment threads and discussions
- **Notes**: Freeform text annotations
- **Tags**: Label and categorization inputs

#### Numeric Fields
- **Cost**: Currency input with amount and allocation
- **Duration**: Time estimation with unit selection
- **Progress**: Percentage completion tracking
- **Quantities**: Numeric values with units

#### File Fields
- **File Upload**: Drag-drop file attachment
- **Image Display**: Image preview and editing
- **Document Links**: File references and downloads
- **Version Control**: File versioning and history

#### Choice Fields
- **Single Select**: Radio button and dropdown selections
- **Multi Select**: Checkbox groups and tag selection
- **Options**: Dynamic choice management
- **Confirmations**: Yes/no and approval workflows

### Interactive Features
- **Inline Editing**: Direct field editing without mode switching
- **Auto-save**: Automatic saving of field changes
- **Validation**: Real-time field validation and error display
- **Drag and Drop**: Visual node reordering
- **Keyboard Navigation**: Full keyboard accessibility
- **Responsive Design**: Mobile-friendly field layouts

### Integration Patterns
- **Expression Binding**: Two-way binding with FosExpression system
- **Event Propagation**: Field changes propagated to parent components
- **State Synchronization**: Real-time updates across collaborative sessions
- **Error Handling**: Graceful handling of validation and save errors

## TODOs