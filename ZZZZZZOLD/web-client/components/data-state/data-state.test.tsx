import * as React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { useDataState } from './data-state'; 
import { initialAppState, initialDataState } from '.';
import { FosContextData, FosNodeContent } from '@/react-client';
import { randomUUID } from 'crypto';

// console.log('Global crypto (test):', Object.keys(global.crypto));
// console.log('Global expect (test):', Object.keys((global as any).expect));





describe('useDataState hook', () => {

  
  test.skip('setAppData updates appState data correctly', async () => {

    
    const setAppData = jest.fn(async (x) => { console.log ('setAppState called'); return x}).mockImplementation(async (result: FosContextData) => { return result });
    const appData = initialAppState.data.appData


    const TestComponent = () => {

 
      const { setFosData, fosData } = useDataState({
        data: {
          ...initialDataState,
          appData
        },
        setData: setAppData,
        loggedIn: true
      });

      const rootTaskId = randomUUID();
      const startTaskId = randomUUID();


      const defaultContext: FosContextData = {
        focus: {
          route: [["root", rootTaskId], ["workflow", startTaskId]],
          char: 0
        },
        nodes: {
          [rootTaskId]: {
            data: {
              description: { content: "Fosforescent Root" }
            },
            content: [
              ["workflow", startTaskId]
            ]
          },
          [startTaskId]: {
            data: {
              description: { content: "" }
            },
            content: [
            ]
          }
        },
        trail: [["root", rootTaskId]]
      }
    
    
      const handleSetAppData = () => {
        
        const newNodeData : FosNodeContent = {
          data: {
            description: { content: "latest" }
          },
          content: [
            ["workflow", "task1"],
            ["workflow", "task2"],
            ["workflow", "task3"],
          ]
        }
        
    
      };
      
      return <button onClick={handleSetAppData}>Set App Data</button>;
    };
    
    


    const { getByText } = render(<TestComponent />);


    // Simulate button click
    fireEvent.click(getByText('Set App Data'));

    // Assert that setAppState is called with updated appState data

    const expectedArg = expect.objectContaining({
      data: expect.objectContaining({
        fosData: expect.objectContaining({
          nodes: [{ id: '1', label: 'Node 1' }],
        }),
      }),
    })

    await waitFor(() => {

      console.log('setAppState.mock.calls', setAppData.mock.calls.length, setAppData.mock.calls);
      // expect((setAppState.mock.calls[0] as any)[0]!.data).toEqual((setAppState.mock.calls[1] as any)[0].data);
      expect((setAppData.mock.calls as any).length).toEqual(1);
      // expect(setAppState.mock.calls[0]).toEqual([{
      //   "auth": 
      //   {"email": "", "jwt": null, "loggedIn": false, "password": "", "remember": false, "username": ""}, 
      //   "data": {
      //     "fosData": {"focus": {"char": 0, "route": [["root", "root"]]}, 
      //     "nodes": {
      //       "root": {"collapsed": false, "description": "root", "options": [{"content": [["workflow", "startTask"]], "description": "latest"}], "selectedOption": 0}, 
      //       "startTask": {"collapsed": false, "description": "startTask", "options": [{"content": [], "description": ""}], "selectedOption": 0}
      //     }, 
      //     "previousHash": "", 
      //     "trail": [["root", "root"]]
      //   }, 
      //   "lastStoreTime": 1713292990236, 
      //   "lastSyncTime": 0, 
      //   "locked": false, 
      //   "redoStack": [], 
      //   "stored": true, 
      //   "synced": false, 
      //   "undoStack": [[null, 0, 0]]}, 
      //   "info": {"cookies": undefined}, 
      //   "theme": "system"}]);
      // expect(setAppState).toHaveBeenCalledTimes(1);
    });
  });

  
});

