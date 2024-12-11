import { FosStore } from "@/shared/dag-implementation/store";
import { FosContextData, FosNodeContent, FosNodeId, FosNodesData } from "@/shared/types";

export type GeneratedResult = FosStore

export const generateSeedContext = (): GeneratedResult  => {


  const store = new FosStore()

  const rootExpr = store.getRootExpression()

  const changeBranch = rootExpr.addBranch("Change Branch")

  const thisLabel = rootExpr.getShortLabel()

  if (!rootExpr.isRoot()){
    throw new Error('Root expression is not root')
  }

  if (!rootExpr.isAlias()){
    throw new Error('Root expression is not alias')
  }

  const aliasRoot = rootExpr.followAlias()

  if (aliasRoot.targetNode.getId() !== store.primitive.terminal.getId()){
    throw new Error('Alias root is not terminal')
  }



  const [todo1] = rootExpr.addTodo(`${thisLabel} Todo1`)

  if (aliasRoot.targetNode.getId() !== store.primitive.terminal.getId()){
    throw new Error('Alias root is not terminal')
  }


  const [todo2] = rootExpr.addTodo(`${thisLabel} Todo2`)
  const [todo2_1] = todo2.addSubtask(`${thisLabel} Todo2.1`)
  const [todo2_2] = todo2.addSubtask(`${thisLabel} Todo2.2`)
  const [todo2_3] = todo2.addSubtask(`${thisLabel} Todo2.3`)

  const [todo2_2_choiceA] = todo2_2.addChoice(`${thisLabel}Todo2.2 a`)
  const [todo2_2_choiceB] = todo2_2.addChoice(`${thisLabel}Todo2.2 b`)
  const [todo2_2_choiceC] = todo2_2.addChoice(`${thisLabel}Todo2.2 c`)
  
  rootExpr.addComment(`${thisLabel} this is a comment!`)
  rootExpr.addComment(`${thisLabel}this is another comment!`)


  const [workflow1] = rootExpr.addWorkflow(`${thisLabel} Workflow 1`)
  const [workflow1_1] = workflow1.addWorkflow(`${thisLabel}Workflow 1.1`)
  const [workflow1_2] = workflow1.addWorkflow(`${thisLabel}Workflow 1.2`)




  const [group1Store, group1Root] = store.addGroup(`${thisLabel} Group 1`)


  const [groupBranch1] = group1Root.addBranch(`${thisLabel} Group Branch 1`)


  const [document] = rootExpr.addDocument(`${thisLabel} -Document 1`)
  const [document1_1] = document.addDocument(`${thisLabel}Document 1.1`)
  const [document1_2] = document.addDocument(`${thisLabel}Document 1.2`)



  const [group_todo1] = group1Root.addTodo(`${thisLabel} Group Todo 1`)
  const [group_todo2] = group1Root.addTodo(`${thisLabel} Group Todo 2`)
  const [group_todo2_1] = group_todo2.addSubtask(`${thisLabel} Group Todo 2.1`)
  const [group_todo2_2] = group_todo2.addSubtask(`${thisLabel} Group Todo 2.2`)
  const [group_todo2_3] = group_todo2.addSubtask(`${thisLabel} Group Todo 2.3`)

  const [group_todo2_2_choiceA] = group_todo2_2.addChoice(`${thisLabel} Group Todo2.2 a`)
  const [group_todo2_2_choiceB] = group_todo2_2.addChoice(`${thisLabel} Group Todo2.2 b`)
  const [group_todo2_2_choiceC] = group_todo2_2.addChoice(`${thisLabel} Group Todo2.2 c`)

  group1Root.addComment(`${thisLabel} Group Comment 1`)
  group1Root.addComment(`${thisLabel} Group Comment 2`)

  group1Root.addDocument(`${thisLabel} Group Document 1`)
  group1Root.addDocument(`${thisLabel} Group Document 2`)
  group1Root.addDocument(`${thisLabel} Group Document 3`)
  group1Root.addDocument(`${thisLabel} Group Document 4`)

  groupBranch1.proposeChange()

  workflow1.registerMarketService(`${thisLabel} Market Service 1`)

  todo2_3.registerMarketRequest(`${thisLabel}Market Request 1`)

  store.commit()


  return store


}