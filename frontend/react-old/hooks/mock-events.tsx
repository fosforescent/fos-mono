import { AppState, MockEvent } from '../../shared/types';

export const getMockEvents: (appState: AppState) => MockEvent[] = (appState) => [
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
              description: {
                content: 'Updated description content',
              },
            },
            children: [],
          },
        },
        route: [['todo', 'node-1']],
      },
      trellisData: {
        focusRoute: [['todo', 'node-1']],
        focusChar: 5,
        collapsedList: [],
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
