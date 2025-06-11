# CLAUDE.md

## Directory Summary

Tree-based hierarchical view components for displaying and interacting with graph structures in a collapsible tree format within the Fosforescent workflow system.

### Dependencies
- **@fosforescent/shared/dag-implementation/expression**: Core expression and graph system
- **@fosforescent/shared/types**: Shared type definitions
- **../ui/\***: UI component library
- **React**: Component framework and hooks
- **Tree Navigation Libraries**: Likely tree manipulation utilities

### Data Inputs

#### Tree Structure
- **Graph Nodes**: Hierarchical node relationships from FosExpression
- **Route Context**: Current navigation path through the tree
- **Expansion State**: Which nodes are collapsed/expanded
- **Selection State**: Currently selected nodes and focus

#### Node Data
- **Node Content**: Individual node data and metadata
- **Child Relationships**: Parent-child connections in the tree
- **Node Types**: Different node types requiring different display
- **Status Information**: Completion status, progress, priorities

### Data Outputs

#### Tree Display
- **Hierarchical Layout**: Visual tree structure with indentation
- **Collapsible Nodes**: Expandable/collapsible tree branches
- **Node Rendering**: Individual node display with context
- **Navigation Controls**: Tree traversal and manipulation tools

#### Interactive Elements
- **Row Components**: Individual tree row rendering and interaction
- **Menu Systems**: Context menus for node operations
- **Drag and Drop**: Tree restructuring through drag operations
- **Selection Feedback**: Visual feedback for selected items

### Events Handled
- **Node Expansion**: Collapsing and expanding tree branches
- **Node Selection**: Selecting and focusing on tree items
- **Tree Navigation**: Moving through the hierarchical structure
- **Node Operations**: Adding, editing, deleting tree nodes
- **Drag and Drop**: Restructuring tree hierarchy

### Data Transformations
- **Graph Structure → Tree Display**: Converting graph relationships to visual tree
- **User Interactions → Tree Updates**: User actions updating tree structure
- **Selection State → Visual Feedback**: Selection reflected in tree display
- **Navigation → Route Updates**: Tree navigation updating application state

### Component Structure

#### TreeLayout
- **Overall Structure**: Main tree container and layout management
- **Scroll Management**: Handling large tree structures
- **Performance Optimization**: Virtual scrolling for large trees
- **Responsive Design**: Mobile-friendly tree display

#### Tree Rows
- **Row Rendering**: Individual tree item display
- **Indentation Logic**: Visual hierarchy through indentation
- **Node Content**: Displaying node-specific information
- **Interactive Elements**: Buttons, checkboxes, expand/collapse controls

#### Tree Menu
- **Context Menus**: Right-click and action menus for nodes
- **Bulk Operations**: Multi-select operations on tree items
- **Quick Actions**: Common operations accessible from tree
- **Keyboard Shortcuts**: Keyboard navigation and actions

### Tree Features
- **Hierarchical Display**: Clear parent-child relationships
- **Lazy Loading**: Loading tree branches on demand
- **Search Integration**: Finding and highlighting items in tree
- **Filter Capabilities**: Showing/hiding tree items based on criteria
- **Drag and Drop**: Visual tree restructuring
- **Keyboard Navigation**: Full keyboard accessibility

### Performance Considerations
- **Virtual Scrolling**: Handling large tree structures efficiently
- **Memoization**: Preventing unnecessary re-renders
- **Incremental Loading**: Loading tree data as needed
- **State Management**: Efficient tree state updates

### Accessibility
- **ARIA Support**: Screen reader compatibility
- **Keyboard Navigation**: Full keyboard tree traversal
- **Focus Management**: Proper focus handling in tree
- **Visual Indicators**: Clear visual hierarchy and state

## TODOs