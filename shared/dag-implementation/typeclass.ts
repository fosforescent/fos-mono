import { FosExpression } from "./expression";







class AliasTypeClass {


  constructor(expression: FosExpression) {
    if (!expression.isAlias()) {
      throw new Error('Root expression is not alias')
    }

  }


  bindAlias() {


  }


  update() {

    if (!this.hasParent()) {

      const currentRootNode = this.store.getRootNode()

      const rootNodeWithNewTarget = currentRootNode.setAliasInfo({
        target: newTarget,
        instruction: newInstruction,
        prev: currentRootNode
      })

      this.targetNode = newTarget
      this.instructionNode = newInstruction
      this.store.setRootNode(rootNodeWithNewTarget)
      return [new FosExpression(this.store, [])]

    } else {
      const { parent } = this.getParentInfo() 

      let newParentExpression: FosExpression
      let newAncestors: FosExpression[] = []
      const parentIsAlias = parent.isAlias();

      if (parentIsAlias) {

        const newParentTarget = parent.targetNode.setAliasInfo({
          target: newTarget,
          instruction: newInstruction,
          prev: parent.targetNode
        })


        const [thisNewParentExpression, ...ancestors] = parent.update(parent.instructionNode, newParentTarget)
        newParentExpression = thisNewParentExpression
        newAncestors = ancestors
      } else {

        
        const parentContent = parent.targetNode.getContent()
        const newChildren: FosPathElem[]  = parent.targetNode.getEdges().map((edge, i) => {
          if (edge[0] === this.instructionNode.getId() && edge[1] === this.targetNode.getId()) {
            return [newInstruction.getId(), newTarget.getId()]
          }
          return edge
        })
        const newParentTarget = parent.store.create({
          data: parentContent.data,
          children: newChildren
        })
    
        const parentInstruction = parent.instructionNode.getContent()
        const newInstructionChildren: FosPathElem[] = parent.instructionNode.getEdges().map((edge, i) => {
          if (edge[0] === this.instructionNode.getId() && edge[1] === this.targetNode.getId()) {
            return [newInstruction.getId(), newTarget.getId()]
          }
          return edge
        })
        const newParentInstruction = parent.store.create({
          data: parentInstruction.data,
          children: newInstructionChildren
        })

        const [thisNewParentExpression, ...ancestors] = parent.update(newParentInstruction, newParentTarget)
        newParentExpression = thisNewParentExpression
        newAncestors = ancestors 
      }

      

      const isAlias = newParentExpression.isAlias()
      let exists = false

      if (isAlias) {
        const {
          instruction: aliasInstruction,
          target: aliasTarget
        } = newParentExpression.targetNode.getAliasTargetNodes()
        exists = aliasInstruction.getId() === newInstruction.getId() && aliasTarget.getId() === newTarget.getId()
      } else{
        exists = newParentExpression.getTargetChildren().some((child) => {
          const sameInstruction = child.targetNode.getId() === newTarget.getId()
          const sameTarget = child.instructionNode.getId() === this.instructionNode.getId()
          return sameInstruction && sameTarget
        })
      }
      if (!exists){
        throw new Error('Parent node does not contain this new child')
      }
      this.instructionNode = newInstruction
      this.targetNode = newTarget
      this.route = [...newParentExpression.route, [newInstruction.getId(), this.targetNode.getId()]]

      if (newParentExpression.store !== this.store) {
        throw new Error('Store not updated correctly')
      }

      this.store = newParentExpression.store
      const newExpression = new FosExpression(newParentExpression.store, [...newParentExpression.route, [newInstruction.getId(), this.targetNode.getId()]])
      if (newExpression.instructionNode.getEdges().length !== newInstruction.getEdges().length) {
        throw new Error('Instruction node not updated correctly')
      }

      return [newExpression, newParentExpression, ...newAncestors]
    }

  }

  getPrevList() {

  }


  getBranches() {

  }


  isAlias() {

  }


  followAlias() {

  }

  updateAlias() {


  }

  getComponents() {


  }

  

}





class EditableFosTypeClass {


  
  update() {

  }

}

