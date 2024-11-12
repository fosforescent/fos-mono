import React from 'react'
import ReactDOM from 'react-dom/client'
import { Trellis } from '.'
import { defaultContext, FosRootNode, IFosNode } from '@/fos-js'
import "./testApp.css"

const TestApp = () => {



  const [state, setState] = React.useState(defaultContext)


  const rootNode: IFosNode = new FosRootNode(state, async (newData) => {
    console.log("data changed", newData)
    setState(newData);
  })

  return (<div className="w-4/5 mx-auto bg-slate pt-5">
    <Trellis 
      rootNode={rootNode}
      theme="light"
      />
    </div>
  )
  // return (<div>
  //   <Trellis 
  //     data={{ 
  //     ...state,

  //   }} setData={setState} />
  //   </div>
  // )
}










ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TestApp />
  </React.StrictMode>,
)
