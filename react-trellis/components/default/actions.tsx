import { Button } from "@/components/ui/button"

import { PlusCircledIcon } from '@radix-ui/react-icons'

import { TrellisMeta, TrellisNodeClass, TrellisNodeInterface, TrellisSerializedData } from "@/react-trellis/trellis/types"

export type TrellisActionsComponentProps<T extends TrellisNodeInterface<T>, S> = {
  node: T,
  disabled: boolean,
  meta: TrellisMeta<T, S>
  state: TrellisSerializedData
  updateState: (state: TrellisSerializedData) => void
}

export const DefaultActionsComponent = <T extends TrellisNodeInterface<T>, S>({
  node: interfaceNode,
  meta,
  disabled,
  state,
  updateState
}: TrellisActionsComponentProps<T,S>) => {

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