import { FosStore } from "@/shared/dag-implementation/store";
import { FosContextData, FosNodeContent, FosNodeId, FosNodesData } from "@/shared/types";

import { v4 as uuidv4 } from 'uuid';

export type GeneratedResult = FosStore

export const generateSeedContext = (): GeneratedResult  => {


  const store = new FosStore()

  const rootExpr = store.getRootExpression()
  const thisLabel = thisId.slice(0, 8)



  const todo1 = rootExpr.addTodo(`${thisLabel} Todo1`)
  const todo2 = rootExpr.addTodo(`${thisLabel} Todo2`)
  const todo2_1 = todo2.addTodoChild(`${thisLabel} Todo2.1`)
  const todo2_2 = todo2.addTodoChild(`${thisLabel} Todo2.2`)
  const todo2_3 = todo2.addTodoChild(`${thisLabel} Todo2.3`)

  const todo2_2_choiceA = todo2_2.addChoice(`${thisLabel}Todo2.2 a`)
  const todo2_2_choiceB = todo2_2.addChoice(`${thisLabel}Todo2.2 b`)
  const todo2_2_choiceC = todo2_2.addChoice(`${thisLabel}Todo2.2 c`)
  
  rootExpr.addComment(`${thisLabel} this is a comment!`)
  rootExpr.addComment(`${thisLabel}this is another comment!`)


  const workflow1 = rootExpr.addWorkflow(`${thisLabel} Workflow 1`)
  const workflow1_1 = workflow1.addWorkflowChild(`${thisLabel}Workflow 1.1`)
  const workflow1_2 = workflow1.addWorkflowChild(`${thisLabel}Workflow 1.2`)

  const group1 = rootExpr.addGroup(`${thisLabel}Group 1`)

  const document = rootExpr.addDocument(`${thisLabel} -Document 1`)
  const document1_1 = document.addDocumentChild(`${thisLabel}Document 1.1`)
  const document1_2 = document.addDocumentChild(`${thisLabel}Document 1.2`)

  workflow1.registerMarketService(`${thisLabel} Market Service 1`)

  todo2_3.registerMarketRequest(`${thisLabel}Market Request 1`)



    return store


}