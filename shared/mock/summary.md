# Shared Mock Directory Summary

## Purpose
Provides example workflow definitions and test data for demonstrating graph-based task creation, dependency management, and interpreter functionality in the Fosforescent system.

## Dependencies
- **../dag-types**: Core type definitions (INode, IFosInterpreter)
- **../dag-implementation/node-data**: Data structures (Duration, Cost, CostAllocation)
- **../utils**: Utility functions (assert)

## Data Inputs

### Workflow Definitions
- **Root Interpreters**: Base interpreter instances for workflow construction
- **Task Descriptions**: String names for workflow tasks
- **Dependencies**: Task prerequisite relationships
- **Example Data**: Predefined workflow templates

### Task Parameters
- **Task Names**: Human-readable task identifiers
- **Dependency Arrays**: Lists of prerequisite tasks
- **Cost Information**: Resource allocation and budgeting data
- **Duration Estimates**: Time-based task planning

## Data Outputs

### Example Workflows
- **Lasagna Making Workflow**: Multi-step cooking process with dependencies
- **Task Hierarchies**: Parent-child task relationships
- **Interpreter Stacks**: Complete workflow execution contexts
- **Test Assertions**: Validation of workflow construction

### Workflow Components
- **assemble-layers**: Top-level task with subtask dependencies
- **make-white-sauce**: Sauce preparation subtask
- **make-red-sauce**: Alternative sauce preparation
- **precook-pasta**: Pasta preparation prerequisite

## Events Handled
- **Workflow Construction**: Building complete task hierarchies
- **Task Creation**: Creating individual workflow steps
- **Dependency Resolution**: Establishing task prerequisites
- **Interpreter Validation**: Testing workflow integrity

## Data Transformations
- **Workflow Definitions → Interpreter Trees**: Converting workflow specs to executable interpreters
- **Task Names → Named Interpreters**: Attaching human-readable names to tasks
- **Dependencies → Graph Edges**: Converting prerequisites to graph relationships
- **Example Data → Test Cases**: Using mock data for system validation

## Example Workflow: Lasagna Making

### Task Structure
```
Root
└── assemble-layers
    ├── make-white-sauce
    ├── make-red-sauce
    └── precook-pasta
```

### Workflow Steps
1. **Root Task Creation**: Initialize root interpreter
2. **Assembly Task**: Create main "assemble-layers" task
3. **Sauce Tasks**: Add white and red sauce preparation
4. **Pasta Task**: Add pasta precooking requirement
5. **Validation**: Assert correct task hierarchy construction

### Assertions and Testing
- **Task Count Validation**: Verify correct number of subtasks
- **Name Verification**: Ensure tasks have correct identifiers
- **Hierarchy Validation**: Check parent-child relationships
- **Stack Integrity**: Validate interpreter stack consistency

## Mock Data Features
- **Realistic Examples**: Cooking workflow mirrors real-world task dependencies
- **Incremental Construction**: Step-by-step workflow building
- **Validation Testing**: Comprehensive assertion checking
- **Stack Management**: Proper interpreter hierarchy handling

## Development Support
- **Example Templates**: Ready-to-use workflow patterns
- **Testing Framework**: Assertion-based validation
- **Debug Output**: Console logging for workflow construction
- **Extensible Design**: Easy addition of new example workflows

## Cost and Resource Modeling
- **Cost Allocation**: Budget distribution across tasks
- **Resource Planning**: Time and cost estimation
- **Alternative Paths**: Multiple approaches to same goal (expensive vs cheap white sauce)
- **Optimization Scenarios**: Cost-benefit analysis examples