import { TrellisNodeInterface, TrellisNodeClass, TrellisMeta  } from "../../../react-trellis"
import { FosWrapper } from "./fosWrapper"
import { FosReactOptions } from "."


export type FosTrellisNode = TrellisNodeClass<FosWrapper, Partial<FosReactOptions> | undefined>


const getRoute = <T extends TrellisNodeInterface<T>>(node: T): T[] => {
  const helper =  <T extends TrellisNodeInterface<T>>(node: T, acc: T[]): T[] => {
    const parent = node.getParent()
    if (!parent) {
      return [node, ...acc]
    } else {
      return helper(parent, [node, ...acc])
    }
  }
  const result = helper(node, [])
  return result
}

const getUpNode =  (node: FosTrellisNode): FosTrellisNode | null => {
  const result: null | FosTrellisNode = getRoute(node).slice(0, -1).reverse().reduce((acc: null | FosTrellisNode, cur: FosTrellisNode, i: number) => {
    if (acc) {
      return acc
    } else {
      // console.log('cur', cur)
      const result = cur.getChildren().reduce((acc: null | FosTrellisNode, child: FosTrellisNode, j: number) => {
        // console.log('child', child.getId())
        if (child.getId() === node.getId()) {
          const upNode = cur.getChildren()[j - 1]
          if(upNode){
            // console.log('got upnode', j, i, upNode.getId())
            const lastDescendent = getLastDescendent(upNode, i)
            // console.log('lastDescendent', lastDescendent.getId())
            return lastDescendent
          }else {
            console.log('no upnode')
          }
        }
        return acc
      }, null)
      return result
    }
  }, null)
  console.log('result', result, node)
  return result
}

const getDownNode =  (node: FosTrellisNode): FosTrellisNode | null => {
  const result: null | FosTrellisNode = getRoute(node).reverse().reduce((acc: null | FosTrellisNode, cur: FosTrellisNode, i: number) => {
    if (acc) {
      return acc
    } else {
      console.log('cur', cur)
      const result = cur.getWrappedChildren(true).reduce((acc: null | FosTrellisNode, child: FosTrellisNode, j: number) => {
        if (child.getId() === node.getId()) {
          const upNode = cur.getWrappedChildren(true)[j + 1]
          if(upNode){
            return upNode
          }
        }
        return acc
      }, null)
      return result
    }
  }, null)

  return result
}


const moveUp =  (node: FosTrellisNode): FosTrellisNode | null => {
  const [parentInfo, ...rest] = getAncestors(node)
  if (!parentInfo) {
    throw new Error("node does not have a parent")
  }
  const [parent, indexInParent] = parentInfo
  if (indexInParent > 0){
    const upSibling = parent.getWrappedChildren(true)[indexInParent - 1]
    if (!upSibling) {
      throw new Error("upSibling not found")
    }
    moveNodeToUpSibling(node, upSibling)
  } else {
    if (rest.length === 0) {
      throw new Error("node does not have a grandparent")
    }
    
    rest.forEach(([ancestor, indexInAncestor], index) => {
      // if parent is not oldest sibling, move to last child of parent's older sibling
      if (indexInAncestor > 0){
        const upSibling = ancestor.getWrappedChildren(true)[indexInParent - 1]
        if (!upSibling) {
          throw new Error("upSibling not found")
        }
        moveNodeToUpSibling(node, upSibling)
      } else {
        // if parent is oldest sibling, move to last descendent up to n deep (n = number of generations up to grandparent + 1 )
        if (index === rest.length - 1) {
          const lastDescendent = getLastDescendent(ancestor, index)
          moveNodeToTopChild(node, lastDescendent)
        }
      }
    })

    // else if has parent, move to last child above parent


    // else if has grandparent, move to last descendent up to n deep (n = number of generations up to grandparent)

  }
  return node
}


const moveDown =  (node: FosTrellisNode): FosTrellisNode | null => {


  const [parentInfo, ...rest] = getAncestors(node)
  if (!parentInfo) {
    throw new Error("node does not have a parent")
  }
  const [parent, indexInParent] = parentInfo
  if (indexInParent < parent.getChildren().length - 1){
    const downSibling = parent.getChildren()[indexInParent + 1]
    if (!downSibling) {
      throw new Error("upSibling not found")
    }
    moveNodeToDownSibling(node, downSibling)
  } else {
    if (rest.length === 0) {
      throw new Error("node does not have a grandparent")
    }
    
    rest.forEach(([ancestor, indexInAncestor], index) => {
      // if parent is not downest sibling, move to top child of parent's downer sibling
      const downSibling = ancestor.getChildren()[indexInParent + 1]
      if (downSibling){
        moveNodeToDownSibling(node, downSibling)
      } else {
        // if parent is downest sibling
        if (index === rest.length - 1) {
          const lastDescendent = getLastDescendent(ancestor, index + 1)
          moveNodeToTopChild(node, lastDescendent)
        }
      }
    })

  }
  return node
}

const moveLeft =  (node: FosTrellisNode): FosTrellisNode | null => {
  // if middle sibling, up siblings stay as children of parent, 
  // this node gets inserted as parent's down sibling.. this node down siblings become children of this node

    // if older sibling, move to first child of older sibling
  
  const [parentInfo, ...rest] = getAncestors(node)
  if (!parentInfo) {
    console.log('node', node, parentInfo, rest)
    throw new Error("node does not have a parent")
  }
  const [parent, indexInParent] = parentInfo
  
  return moveNodeToDownSibling(node, parent)


  
}

const moveRight =  (node: FosTrellisNode): FosTrellisNode => {
  // if older sibling, move to first child of older sibling
  
  const [parentInfo, ...rest] = getAncestors(node)
  if (!parentInfo) {
    throw new Error("node does not have a parent")
  }
  const [parent, indexInParent] = parentInfo
  if (indexInParent > 0){
    const upSibling = parent.getChildren()[indexInParent - 1]
    if (!upSibling) {
      throw new Error("upSibling not found")
    }
    return moveNodeToTopChild(node, upSibling)
  } else {
    throw new Error("node does not have an older sibling")
  }
  // else if parent has older sibling, move to child of last child of parent's older sibling

  // else if grandparent has older sibling, move to child of last descendent up to n deep (n = number of generations up to grandparent + 1 )



}





const moveNodeToTopChild = (sourceNode: FosTrellisNode, targetNode: FosTrellisNode): FosTrellisNode => {
  const thisParent = sourceNode.getParent()

  if (!thisParent) {
    throw new Error('moveNodeToOlderSibling on root node - node has no parent')
  }
  
  const thisNewChildren = thisParent?.getChildren().filter((child) => child.getId() !== sourceNode.getId()) || []

  const nodeChildren = targetNode.getChildren()

  const newChildren = [sourceNode, ...nodeChildren]

  targetNode.setChildren(newChildren)
  thisParent?.setChildren(thisNewChildren)

  const sourceNodeInNewPosition = targetNode.getChildren().find((child) => child.getId() === sourceNode.getId())

  if (!sourceNodeInNewPosition) {
    throw new Error('error moving node to new position')
  }

  return sourceNodeInNewPosition


}




const snip =  (node: FosTrellisNode): FosTrellisNode | null => {
  const parent = node.getParent()
  if (!parent) {
    throw new Error("node does not have a parent")
  }

  const thisChildren = node.getChildren()

  const newThisParentChildren = parent.getChildren().reduce((acc: FosTrellisNode[], cur: FosTrellisNode, index: number) => {
    if (cur.getId() === node.getId()) {
      return [...acc, ...thisChildren]
    } else {
      return [...acc, cur]
    }
  }, [])

  parent.setChildren(newThisParentChildren)
  return parent

}



const moveNodeToUpSibling =  (sourceNode: FosTrellisNode, targetNode: FosTrellisNode): FosTrellisNode | null => {
  const sourceParent: FosTrellisNode | null = sourceNode.getParent()
  if (!sourceParent) {
    throw new Error("sourceNode does not have a parent")
  }
  sourceParent.setChildren(sourceParent.getChildren().filter((child) => child.getId() !== sourceNode.getId()))

  const targetParent = targetNode.getParent()

  if (!targetParent) {
    throw new Error("targetNode does not have a parent")
  }
  const newTargetParentChildren = targetParent.getChildren().reduce((acc: FosTrellisNode[], cur: FosTrellisNode, index: number) => {
    if (cur.getId() === targetNode.getId()) {
      return [...acc, sourceNode, cur]
    } else {
      return [...acc, cur]
    }
  }, [])
  targetParent.setChildren(newTargetParentChildren)
  const sourceNodeInNewPosition = targetParent.getChildren().find((child) => child.getId() === sourceNode.getId())
  return sourceNodeInNewPosition || null
};

const moveNodeToDownSibling =  (sourceNode: FosTrellisNode, targetNode: FosTrellisNode): FosTrellisNode =>  {
  const sourceParent = sourceNode.getParent()
  if (!sourceParent) {
    throw new Error("sourceNode does not have a parent")
  }
  sourceParent.setChildren(sourceParent.getChildren().filter((child) => child.getId() !== sourceNode.getId()))

  const targetParent = targetNode.getParent()

  if (!targetParent) {
    throw new Error("targetNode does not have a parent")
  }
  const newTargetParentChildren = targetParent.getChildren().reduce((acc: FosTrellisNode[], cur: FosTrellisNode, index: number) => {
    if (cur.getId() === targetNode.getId()) {
      return [...acc, cur, sourceNode]
    } else {
      return [...acc, cur]
    }
  }, [])
  targetParent.setChildren(newTargetParentChildren)
  const sourceNodeInNewPosition = targetParent.getChildren().find((child) => child.getId() === sourceNode.getId())

  if (!sourceNodeInNewPosition) {
    throw new Error('error moving node to new position')
  }

  return sourceNodeInNewPosition
};



const getLastDescendent =  (node: FosTrellisNode, nthGen?: number): FosTrellisNode => {
  const children = node.getChildren()
  const lastChild = children[children.length - 1]
  if (!lastChild) {
    return node
  } else {
    return getLastDescendent(lastChild)
  }
}

const addDownSibling =  (node: FosTrellisNode): FosTrellisNode | null => {
  const parent = node.getParent()
  if (!parent) {
    throw new Error("node does not have a parent")
  }
  const thisChildren = parent.getChildren()
  const thisIndex = thisChildren.findIndex((child) => child.getId() === node.getId())
  const newSibling = parent.newChild()

  const newThisParentChildren = thisChildren.reduce((acc: FosTrellisNode[], cur: FosTrellisNode, index: number) => {
    if (index === thisIndex) {
      return [...acc, cur, newSibling]
    } else {
      return [...acc, cur]
    }
  }, [])

  parent.setChildren(newThisParentChildren)

  const newSiblingInNewPosition = parent.getChildren().find((child) => child.getId() === newSibling.getId())

  return newSiblingInNewPosition || null
}


export const getAncestors =  (node: FosTrellisNode): [FosTrellisNode, number][] => {

  const helper =  (node: FosTrellisNode, acc: [FosTrellisNode, number][]): [FosTrellisNode, number][] => {
    const parent = node.getParent()
    if (!parent) {
      return acc
    } else {
      const index = parent.getChildren().findIndex((child) => child.getId() === node.getId())
      return helper(parent, [...acc, [parent, index]])
    }
  }

  return helper(node, [])

}


const deleteNode = (node: FosTrellisNode): FosTrellisNode | null => {
  const parent = node.getParent()
  if (!parent) {
    throw new Error("node does not have a parent")
  }
  parent.setChildren(parent.getChildren().filter((child) => child.getId() !== node.getId()))
  return parent
}




export const getFosUtilFunctions = () => {
  return {
    getUpNode,
    getDownNode,
    moveNodeToTopChild,
    moveNodeToUpSibling,
    moveNodeToDownSibling,
    moveLeft,
    moveRight,
    moveUp,
    moveDown,
    snipNode: snip,
    deleteNode,
    addDownSibling,
  }
}