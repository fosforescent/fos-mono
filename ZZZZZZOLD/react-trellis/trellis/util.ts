import { TrellisNodeInterface, TrellisNodeClass, TrellisMeta } from "./types"
import { TrellisWrapper } from "./wrapper"


export const getRoute = <T extends TrellisNodeInterface<T>>(node: T): T[] => {
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

export const getUpNode =  <T extends TrellisNodeInterface<T>>(node: T): T | null => {
  const result: null | T = getRoute(node).slice(0, -1).reverse().reduce((acc: null | T, cur: T, i: number) => {
    if (acc) {
      return acc
    } else {
      // console.log('cur', cur)
      const result = cur.getChildren().reduce((acc: null | T, child: T, j: number) => {
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

export const getDownNode =  <T extends TrellisNodeInterface<T>, S>(node: TrellisNodeClass<T, S>): TrellisNodeClass<T, S> | null => {
  const result: null | TrellisNodeClass<T, S> = getRoute(node).reverse().reduce((acc: null | TrellisNodeClass<T, S>, cur: TrellisNodeClass<T, S>, i: number) => {
    if (acc) {
      return acc
    } else {
      console.log('cur', cur)
      const result = cur.getWrappedChildren(true).reduce((acc: null | TrellisNodeClass<T, S>, child: TrellisNodeClass<T, S>, j: number) => {
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


export const moveUp =  <T extends TrellisNodeInterface<T>, S>(node: TrellisNodeClass<T, S>) => {

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
  
}


export const moveDown =  <T extends TrellisNodeInterface<T>>(node: T) => {

  // if has down sibling, move below down sibling

  // else move to parent down sibling

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
  
}

export const moveLeft =  <T extends TrellisNodeInterface<T>>(node: T): T => {
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

export const moveRight =  <T extends TrellisNodeInterface<T>, S>(node: TrellisNodeClass<T, S>): TrellisNodeClass<T, S> => {
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



export const moveNodeToYoungerSibling =  <T extends TrellisNodeInterface<T>>(sourceNode: T, targetNode: T): T => {

  const thisParent = sourceNode.getParent()

  if (!thisParent) {
    throw new Error('moveNodeToYoungerSibling on root node - node has no parent')
  }
  
  const thisNewChildren = thisParent?.getChildren().filter((child) => child.getId() !== sourceNode.getId()) || []

  const nodeParent = targetNode.getParent()
  if (!nodeParent) {
    throw new Error('moveNodeToYoungerSibling on root node - node has no parent')
  }

  const nodeIndex = nodeParent.getChildren().findIndex((child) => child.getId() === targetNode.getId())

  const newChildren: T[] = nodeParent.getChildren().reduce((acc: T[], child: T, index: number): T[] => {
    if (index === nodeIndex ){
      return [...acc, child, sourceNode]
    } else {
      return [...acc, child]
    }
  }, [])

  thisParent?.setChildren(thisNewChildren)
  nodeParent.setChildren(newChildren)
  const sourceNodeInNewPosition = nodeParent.getChildren().find((child) => child.getId() === sourceNode.getId())

  if (!sourceNodeInNewPosition) {
    throw new Error('error moving node to new position')
  }

  return sourceNodeInNewPosition
}


export const moveNodeToTopChild = <T extends TrellisNodeInterface<T>>(sourceNode: T, targetNode: T): T => {
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




export const snip =  <T extends TrellisNodeInterface<T>>(node: T): void => {
  const parent = node.getParent()
  if (!parent) {
    throw new Error("node does not have a parent")
  }

  const thisChildren = node.getChildren()

  const newThisParentChildren = parent.getChildren().reduce((acc: T[], cur: T, index: number) => {
    if (cur.getId() === node.getId()) {
      return [...acc, ...thisChildren]
    } else {
      return [...acc, cur]
    }
  }, [])

  parent.setChildren(newThisParentChildren)


}


// const thisParent = this.getParent()

// if (!thisParent) {
//   throw new Error('moveNodeToOlderSibling on root node - node has no parent')
// }

// const thisNewChildren = thisParent?.getChildren().filter((child) => child.getId() !== this.getId()) || []

// const nodeParent = node.getParent()
// if (!nodeParent) {
//   throw new Error('moveNodeToOlderSibling on root node - node has no parent')
// }

// const nodeIndex = nodeParent.getChildren().findIndex((child) => child.getId() === node.getId())

// const newChildren = nodeParent.getChildren().reduce((acc: TrellisNodeClass<T, S>[] , child: TrellisNodeClass<T, S>, index) => {
//   if (index === nodeIndex ){
//     return [...acc, this, child]
//   } else {
//     return [...acc, child]
//   }
// }, [])

// thisParent?.setChildren(thisNewChildren)
// nodeParent.setChildren(newChildren)

export const moveNodeToUpSibling =  <T extends TrellisNodeInterface<T>>(sourceNode: T, targetNode: T): void => {
  const sourceParent: T | null = sourceNode.getParent()
  if (!sourceParent) {
    throw new Error("sourceNode does not have a parent")
  }
  sourceParent.setChildren(sourceParent.getChildren().filter((child) => child.getId() !== sourceNode.getId()))

  const targetParent = targetNode.getParent()

  if (!targetParent) {
    throw new Error("targetNode does not have a parent")
  }
  const newTargetParentChildren = targetParent.getChildren().reduce((acc: T[], cur: T, index: number) => {
    if (cur.getId() === targetNode.getId()) {
      return [...acc, sourceNode, cur]
    } else {
      return [...acc, cur]
    }
  }, [])
  targetParent.setChildren(newTargetParentChildren)

};

export const moveNodeToDownSibling =  <T extends TrellisNodeInterface<T>>(sourceNode: T, targetNode: T): T =>  {
  const sourceParent = sourceNode.getParent()
  if (!sourceParent) {
    throw new Error("sourceNode does not have a parent")
  }
  sourceParent.setChildren(sourceParent.getChildren().filter((child) => child.getId() !== sourceNode.getId()))

  const targetParent = targetNode.getParent()

  if (!targetParent) {
    throw new Error("targetNode does not have a parent")
  }
  const newTargetParentChildren = targetParent.getChildren().reduce((acc: T[], cur: T, index: number) => {
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



export const getLastDescendent =  <T extends TrellisNodeInterface<T>>(node: T, nthGen?: number): T => {
  const children = node.getChildren()
  const lastChild = children[children.length - 1]
  if (!lastChild) {
    return node
  } else {
    return getLastDescendent(lastChild)
  }
}

export const addYoungerSibling =  <T extends TrellisNodeInterface<T>>(node: T): void => {
  const parent = node.getParent()
  if (!parent) {
    throw new Error("node does not have a parent")
  }
  const thisChildren = parent.getChildren()
  const thisIndex = thisChildren.findIndex((child) => child.getId() === node.getId())
  const newSibling = parent.newChild()

  const newThisParentChildren = thisChildren.reduce((acc: T[], cur: T, index: number) => {
    if (index === thisIndex) {
      return [...acc, cur, newSibling]
    } else {
      return [...acc, cur]
    }
  }, [])

  parent.setChildren(newThisParentChildren)
  return
}


export const getAncestors =  <T extends TrellisNodeInterface<T>>(node: T): [T, number][] => {

  const helper =  (node: T, acc: [T, number][]): [T, number][] => {
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


export const getMeta = <F extends TrellisNodeInterface<F>, S>(wrappedNode: TrellisNodeClass<F, S>): TrellisMeta<F, S> => {

  const root = wrappedNode.getRoot()


  
  const helper = (node: TrellisNodeClass<F, S>, trail: TrellisNodeClass<F, S>[]): TrellisNodeClass<F, S>[] => {
    const zoomChild = node.getChildren().find((child) => child.hasZoom())
    if (zoomChild) {
      return helper(zoomChild, [...trail, zoomChild])
    } else {
      return trail
    }
  }
  const zoomedRoute = helper(root, [])


  const focusRouteHelper = (node: TrellisNodeClass<F, S>, acc: TrellisNodeClass<F, S>[], focusChar: number | null): { route: TrellisNodeClass<F,S>[], focusChar: number | null } => {
    const focusChild = node.getChildren().find((child) => child.hasFocus() !== null)
    if (focusChild) {
      return focusRouteHelper(focusChild, [...acc, node], node.hasFocus())
    } else {
      return { route: [...acc, node], focusChar: node.hasFocus()}
    }
  }

  const focusInfo = focusRouteHelper(root, [], null)

  return {
    zoom: {
      route: zoomedRoute
    },
    focus: focusInfo,
    trellisNode: wrappedNode,
    node: wrappedNode.getInterfaceNode(),
    keyDownEvents: (e: React.KeyboardEvent) => wrappedNode.keyDownEvents(e),
    keyUpEvents: (e: React.KeyboardEvent) => wrappedNode.keyUpEvents(e),
    isBeingDragged: wrappedNode.isBeingDragged(),
    isBeingDraggedOver: wrappedNode.isBeingDraggedOver(),
    dragging: wrappedNode.userIsDragging(),
    isFocused: wrappedNode.hasFocus(),
    acquireFocus: (char: number | null) => wrappedNode.setFocus(char),
    isCollapsed: () => wrappedNode.isCollapsed(),
    toggleCollapse: () => wrappedNode.toggleCollapse(),
  }

}

export const isEndOfString = <T extends TrellisNodeInterface<T>, S>(node: TrellisNodeClass<T, S>): boolean => {
  console.log('isEndOfString', JSON.stringify(node.getString()), node.getString().length, JSON.stringify(node.hasFocus()))
  const sameLength = node.getString().length === node.hasFocus()
  if (node.hasFocus() === 0){
    return false
  }
  if (sameLength) {
    return true
  } else {
    const lastCharIsNewline = node.getString().slice(-1) === "\n"
    const focusIsOneLessThanLength = node.hasFocus() === node.getString().length - 1
    if (lastCharIsNewline && focusIsOneLessThanLength) {
      return true
    }else{
      const last2CharsAreNewline = node.getString().slice(-2) === "\n\n"

      const focusIsTwoLessThanLength = node.hasFocus() === node.getString().length - 2
      if (last2CharsAreNewline && focusIsTwoLessThanLength) {
        return true
      }else{
        const last3CharsAreNewline = node.getString().slice(-3) === "\n\n\n"
        console.log('last3CharsAreNewline', last3CharsAreNewline, node.getString().slice)
        const focusIsThreeLessThanLength = node.hasFocus() === node.getString().length - 3
        if (last3CharsAreNewline && focusIsThreeLessThanLength) {
          return true
        }
      }
    }
  }
  console.log('not end of string')
  return false
}