import { Button } from "@/components/ui/button"

import { PlusCircledIcon } from '@radix-ui/react-icons'

import { AppState, FosReactOptions,  } from "@/fos-combined/types"

export const DefaultActionsComponent = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: [string, string][]
  setData: (state: AppState) => void
}) => {

  const node = meta.trellisNode
  const parentNode = meta.trellisNode
  

  const handleAddNewRow = () => {
    console.log('clicked')
    const newChild = node.newChild()
    newChild.setFocus(0)
  }

  const trail = node.getMeta().zoom?.route || []

  const route = [...parentNode.getRoute(), parentNode]

  // console.log('trail', trail, 'route', route, route.length - trail.length, route.length - trail.length <= 0, route.length, trail.length)

  return <div>{(route.length - trail.length) <= 0 && <div className='py-1' key={`-1`}>
      <Button 
        onClick={() => handleAddNewRow()}
        className={`bg-secondary/30 text-white-900 hover:bg-secondary/80 px-2 shadow-none`}
        // style={{padding: !isSmallWindow ? '15px 15px 15px 15px' : '31px 3px'}}
        >
        <PlusCircledIcon height={'1rem'} width={'1rem'}/>
      </Button>

    </div>}</div>
}