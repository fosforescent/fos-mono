# Groups Architecture

## Overview

Groups in Fosforescent are **structurally typed graph nodes** - their type emerges from their structure rather than being explicitly declared. This document explains how groups work within the FosExpression evaluation system.

## Core Principles

### 1. Structural Typing

A node becomes a "group" based on its structure:

- **User Default Group**: Every user's `fosNode` is their personal workspace/group
- **DM/Chat**: Node with exactly 2 `PERSON_FIELD` children + `COMMENT_FIELD` children
- **Custom Group**: Node with multiple `PERSON_FIELD` children
- **Project**: Node with `TODO_FIELD` children
- **Chat Room**: Node with `PERSON_FIELD` + `COMMENT_FIELD` children

### 2. Everything is a FosExpression

All group operations are implemented as FosExpression methods that:
1. Create immutable new nodes (never mutate)
2. Update the graph through expression evaluation
3. Return new FosExpression instances
4. Work identically via API or direct evaluation

## FosExpression Group Methods

### Creating Groups

```typescript
// Create a custom group
const groupExpr = await rootExpr.createGroup(
  'Team Name',           // name
  'Description',         // description (optional)
  'public' | 'private'   // visibility
)

// Create a DM
const dmExpr = await rootExpr.createDM(targetUserNodeCid)
```

### Managing Members

```typescript
// Add member to group
await groupExpr.addMemberToGroup(memberNodeCid)

// Members are stored as PERSON_FIELD children
// The group's data.group.userProfiles array is updated accordingly
```

### Messaging

```typescript
// Send a message to a group
const messageExpr = await groupExpr.sendGroupMessage(
  'Hello world',     // message
  authorCid,         // author's node CID
  'Author Name'      // author's display name
)

// Messages are stored as COMMENT_FIELD children
```

## API → Expression Flow

### Pattern

1. **Load user's store**: `dbToStore(prisma, user)`
2. **Get root expression**: `store.getRootExpression()`
3. **Call expression method**: `await rootExpr.createGroup(...)`
4. **Save store**: `storeToDb(prisma, user, store)`

### Example: Creating a Group via API

```typescript
export const createGroup = async (req: Request, res: Response) => {
  const user = await prisma.userModel.findUnique({...})
  const store = await dbToStore(prisma, user)
  const rootExpr = store.getRootExpression()

  // Use FosExpression method
  const groupExpr = await rootExpr.createGroup(name, description, visibility)

  await storeToDb(prisma, user, store)

  return res.json({ group: groupExpr.targetNode })
}
```

## Primitive Nodes

Group operations are defined as primitive action nodes:

```typescript
// In shared/dag-implementation/primitive-node.ts
export const createGroupAction = (store: FosStore) =>
  generateConstructor(store, "CREATEGROUP", {...})

export const addMemberToGroupAction = (store: FosStore) =>
  generateConstructor(store, "ADDMEMBERTOGROUP", {...})

export const sendGroupMessageAction = (store: FosStore) =>
  generateConstructor(store, "SENDGROUPMESSAGE", {...})
```

These are available in `store.primitive`:
- `createGroupActionNode`
- `addMemberToGroupActionNode`
- `removeMemberFromGroupActionNode`
- `createDMActionNode`
- `sendGroupMessageActionNode`

## Group Structure Examples

### User Default Group (Personal Workspace)

```json
{
  "data": {
    "group": {
      "id": "user-123",
      "name": "username's Workspace",
      "type": "user_default",
      "userProfiles": ["user-node-cid"]
    }
  },
  "children": [
    ["PERSON_FIELD", "user-node-cid"]
  ]
}
```

### DM/Direct Message

```json
{
  "data": {
    "group": {
      "id": "uuid",
      "name": "Alice & Bob",
      "type": "dm",
      "userProfiles": ["alice-cid", "bob-cid"]
    }
  },
  "children": [
    ["PERSON_FIELD", "alice-cid"],
    ["PERSON_FIELD", "bob-cid"],
    ["COMMENT_FIELD", "message-1-cid"],
    ["COMMENT_FIELD", "message-2-cid"]
  ]
}
```

### Custom Group

```json
{
  "data": {
    "group": {
      "id": "uuid",
      "name": "Engineering Team",
      "type": "custom",
      "visibility": "private",
      "userProfiles": ["user1-cid", "user2-cid", "user3-cid"],
      "createdBy": "user1-cid"
    },
    "description": {
      "content": "Team workspace for engineering projects"
    }
  },
  "children": [
    ["PERSON_FIELD", "user1-cid"],
    ["PERSON_FIELD", "user2-cid"],
    ["PERSON_FIELD", "user3-cid"],
    ["GROUP_FIELD", "nested-group-cid"]  // Can contain nested groups!
  ]
}
```

## Type Transformations

A document can transform into different types by adding children:

### Document → Project
```typescript
// Start with document
const docExpr = await rootExpr.createDocument('Project Plan')

// Add todos → becomes a project
await docExpr.addTodo('Task 1')
await docExpr.addTodo('Task 2')

// Structure now has TODO_FIELD children, so it's a project
```

### Document → Chat Room
```typescript
// Start with document
const docExpr = await rootExpr.createDocument('Team Discussion')

// Add members → becomes a group
await docExpr.addMemberToGroup('user1-cid')
await docExpr.addMemberToGroup('user2-cid')

// Add messages → becomes a chat room
await docExpr.sendGroupMessage('Hello team!', 'user1-cid', 'User 1')

// Structure now has PERSON_FIELD + COMMENT_FIELD children, so it's a chat
```

## Event Propagation

### Pattern

1. **Message sent to group**: Creates `COMMENT_FIELD` child
2. **Traverse members**: Find all `PERSON_FIELD` children
3. **Traverse nested groups**: Find all `GROUP_FIELD` children
4. **Emit to all**: Send event to each member's active connections

### Implementation (To Be Done)

```typescript
// Propagate event through group structure
function propagateEvent(groupExpr: FosExpression, event: GroupEvent) {
  // Get direct members (PERSON_FIELD children)
  const members = groupExpr.getTargetChildren()
    .filter(child => child.instructionNode.getId() === store.primitive.personField.getId())

  // Get nested groups (GROUP_FIELD children)
  const nestedGroups = groupExpr.getTargetChildren()
    .filter(child => child.instructionNode.getId() === store.primitive.groupField.getId())

  // Emit to all members
  for (const member of members) {
    emitToUser(member.targetNode.getId(), event)
  }

  // Recursively propagate to nested groups
  for (const nested of nestedGroups) {
    propagateEvent(nested, event)
  }
}
```

## Database Querying

### Finding Groups

Since groups are just nodes with certain structures, we query by structure:

```typescript
// Find all groups where user is a member
const groups = await prisma.fosNodeModel.findMany({
  where: {
    data: {
      path: ['children'],
      array_contains: [personFieldCid, userNodeCid]
    }
  }
})

// Find public groups
const publicGroups = await prisma.fosNodeModel.findMany({
  where: {
    data: {
      path: ['group', 'visibility'],
      equals: 'public'
    }
  }
})
```

## Benefits of This Approach

1. **No Schema Changes**: Everything lives in `FosNode.data` and `children`
2. **Immutable History**: Every change creates a new node
3. **Content-Addressable**: CID-based node identification
4. **Composable**: Groups can contain groups, documents become projects/chats
5. **Uniform API**: Same operations work via API, UI, or direct evaluation
6. **Type Flexibility**: Structure determines type, not rigid schemas

## Next Steps

- [ ] Implement WebSocket/SSE for real-time event propagation
- [ ] Add group permissions system (using existing access control)
- [ ] Implement message history pagination
- [ ] Add typing indicators and read receipts
- [ ] Create group discovery/search UI
- [ ] Add group analytics and activity feeds
