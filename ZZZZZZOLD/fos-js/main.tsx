import React from 'react'
import ReactDOM from 'react-dom/client'
import { Trellis } from '../react-trellis'
import { IFosNode } from './fosforescent/temp-types'
import { defaultContext } from './initialNodes'
import { FosRootNode } from './fosforescent/fosNodeBase'


const App = () => {



  // const [state, setState] = React.useState(defaultContext)

  const [fosState, setFosState] = React.useState(defaultContext)

  // const [rootInstruction, rootId] = fosState.trail?.[0] || []

  const rootNode: IFosNode = new FosRootNode(fosState, async (newState) => setFosState(newState))


  return (<div>
    <Trellis 
      rootNode={rootNode}
      />
    </div>
  )
}


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
