import { AppState, MockEvent } from '../types';

export const mockEvents: MockEvent[] = [
  {
    type: 'updateData',
    payload: {
      fosData: {
        nodes: {
          'node-1': {
            data: {
              document: {
                content: 'Updated document content',
              },
            },
            content: [],
          },
        },
        route: [['node-1', 'node-2']],
      },
      trellisData: {
        focusRoute: [['node-1', 'node-2']],
        focusChar: 5,
        collapsedList: [['node-1', 'node-2']],
        rowDepth: 2,
        dragInfo: {
          dragging: null,
          dragOverInfo: null,
        },
      },
    },
  },
  // Add more mock events as needed
];

export const applyMockEvent = (appState: AppState, event: MockEvent): AppState => {
  return {
    ...appState,
    data: {
      fosData: {
        ...appState.data.fosData,
        ...event.payload.fosData,
      },
      trellisData: {
        ...appState.data.trellisData,
        ...event.payload.trellisData,
      },
    },
  };
};
