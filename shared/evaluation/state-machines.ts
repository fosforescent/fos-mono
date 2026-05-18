// import { Interpreter, StateMachine, TypegenDisabled, createMachine, interpret } from 'xstate'
import { NodeStatus, NodeStateSchema, NodeEvents } from '../dag-types'


// export function createOneOfStateMachine(): StateMachine<NodeStatus, NodeStateSchema, NodeEvents> {
//     return createMachine<NodeStatus, NodeEvents>({
//       id: 'oneOfNode',
//       initial: NodeStatus.NotStarted,
//       states: {
//         [NodeStatus.NotStarted]: {
//           on: {
//             ChildWasCompleted: {
//               target: NodeStatus.Done,
//               actions: (context, event) => this.handleChildWasCompleted(event.child),
//             },
//             ChildWasUncompleted: {
//               target: NodeStatus.NotStarted,
//               actions: (context, event) => this.handleChildWasUncompleted(event.child),
//             },
//             RejectNode: {
//               target: NodeStatus.Rejected,
//             },
//           },
//         },
//         [NodeStatus.Done]: {
//           on: {
//             ChildWasUncompleted: {
//               target: NodeStatus.NotStarted,
//               actions: (context, event) => this.handleChildWasUncompleted(event.child),
//             },
//             // ChildWasCompleted should never be received by a OneOfNode in state Done
//           },
//         },
//         [NodeStatus.Rejected]: {
//           on: {
//             // A OneOfNode in state Rejected should never receive any events from its children
//           },
//         },
//       },
//     })
//   }



// export function createTaskStateMachine(): StateMachine<NodeStatus, NodeStateSchema, NodeEvents> {
//     return createMachine<NodeStatus, NodeEvents>({
//       id: 'taskNode',
//       initial: NodeStatus.NotStarted,
//       states: {
//         [NodeStatus.NotStarted]: {
//           on: {
//             CompleteNode: {
//               target: NodeStatus.Done,
//               // eslint-disable-next-line @typescript-eslint/no-unused-vars
//               actions: (context, event) => this.notifyParents('ChildWasCompleted'),
//             },
//             ChildWasCompleted: [
//               {
//                 target: NodeStatus.NotStarted,
//                 // eslint-disable-next-line @typescript-eslint/no-unused-vars
//                 cond: (context, event) => {
//                   // If the one that just completed wasn't the last, then we stay in NotStarted
//                   return this.nChildrenRemaining() > 0
//                 },
//               },
//               {
//                 target: NodeStatus.Done,
//                 // eslint-disable-next-line @typescript-eslint/no-unused-vars
//                 cond: (context, event) => {
//                   // If the one that just completed was the last, then we transition to Done
//                   return this.nChildrenRemaining() == 0
//                 },
//                 // eslint-disable-next-line @typescript-eslint/no-unused-vars
//                 actions: (context, event) => this.notifyParents('ChildWasCompleted'),
//               },
//             ],
//             ChildWasUncompleted: {
//               target: NodeStatus.NotStarted,
//               actions: (context, event) => this.handleChildWasUncompleted(event.child),
//             },
//             RejectNode: {
//               target: NodeStatus.Rejected,
//             },
//           },
//         },
//         [NodeStatus.Done]: {
//           on: {
//             UncompleteNode: {
//               target: NodeStatus.NotStarted,
//               // eslint-disable-next-line @typescript-eslint/no-unused-vars
//               actions: (context, event) => this.notifyParents('ChildWasUncompleted'),
//             },
//             ChildWasUncompleted: {
//               target: NodeStatus.NotStarted,
//               actions: (context, event) => this.handleChildWasUncompleted(event.child),
//             },
//             // ChildWasCompleted should never be received by a Task in state Done
//           },
//         },
//         [NodeStatus.Rejected]: {
//           on: {
//             UnrejectNode: {
//               target: NodeStatus.NotStarted,
//             },
//           },
//         },
//       },
//     })
//   }