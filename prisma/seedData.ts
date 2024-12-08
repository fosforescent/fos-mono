import { FosExpression } from "@/shared/dag-implementation/expression";
import { FosStore } from "@/shared/dag-implementation/store";
import { FosContextData, FosNodeContent, FosNodeId, FosNodesData } from "@/shared/types";

export type GeneratedResult = FosStore

export const generateSeedContext = (): GeneratedResult  => {


  const store = new FosStore()

  const rootExpr = store.getRootExpression()

  const [changeBranch, newRoot1] = rootExpr.addBranch("Change Branch")

  const thisLabel = newRoot1.getShortLabel()



  const [todo1, rootExprv0] =newRoot1.addTodo(`${thisLabel} Todo1`)
  const [todo2, rootExprv1] = rootExprv0.addTodo(`${thisLabel} Todo2`)
  const [todo2_1, todo2v0] = todo2.addTodo(`${thisLabel} Todo2.1`)
  const [todo2_2, todo2v1] = todo2v0.addTodo(`${thisLabel} Todo2.2`)
  const [todo2_3, todo2v2] = todo2v1.addTodo(`${thisLabel} Todo2.3`)

  const [todo2_2_choiceA, todo2v3] = todo2v2.addChoice(`${thisLabel}Todo2.2 a`)
  const [todo2_2_choiceB, todo2v4] = todo2v3.addChoice(`${thisLabel}Todo2.2 b`)
  const [todo2_2_choiceC, todo2v5] = todo2v4.addChoice(`${thisLabel}Todo2.2 c`)
  
  const [comment1, rootExprv2] = todo2v5.store.getRootExpression().addComment(`${thisLabel} this is a comment!`)
  const [comment2, rootExprv3] = rootExprv2.addComment(`${thisLabel}this is another comment!`)


  const [workflow1, rootExprv4] = rootExprv3.addWorkflow(`${thisLabel} Workflow 1`)
  const [workflow1_1, workflow1v0] = workflow1.addWorkflow(`${thisLabel}Workflow 1.1`)
  const [workflow1_2, workflow1v1] = workflow1v0.addWorkflow(`${thisLabel}Workflow 1.2`)




  const [group1Store, group1Root] = workflow1v1.store.addGroup(`${thisLabel} Group 1`)


  const [groupBranch1, group1Rootv0] = group1Root.addBranch(`${thisLabel} Group Branch 1`)


  const [document1, group1Rootv1] = group1Rootv0.addDocument(`${thisLabel} -Document 1`)
  const [document1_1, document1v0] = document1.addDocument(`${thisLabel}Document 1.1`)
  const [document1_2, document1v1] = document1v0.addDocument(`${thisLabel}Document 1.2`)



  const [groupTodo1, group1Rootv2] = document1v1.store.getRootExpression().addTodo(`${thisLabel} Group Todo 1`)
  const [group_todo2, group1Rootv3] = group1Rootv2.addTodo(`${thisLabel} Group Todo 2`)
  const [group_todo2_1, group_todo2v0] = group_todo2.addTodo(`${thisLabel} Group Todo 2.1`)
  const [group_todo2_3, group_todo2v1] = group_todo2v0.addTodo(`${thisLabel} Group Todo 2.3`)
  const [group_todo2_2, group_todo2v2] = group_todo2v1.addTodo(`${thisLabel} Group Todo 2.2`)

  const [group_todo2_2_choiceA, grouptodo2_2v0] = group_todo2_2.addChoice(`${thisLabel} Group Todo2.2 a`)
  const [group_todo2_2_choiceB, grouptodo2_2v1] = grouptodo2_2v0.addChoice(`${thisLabel} Group Todo2.2 b`)
  const [group_todo2_2_choiceC, grouptodo2_2v2] = grouptodo2_2v1.addChoice(`${thisLabel} Group Todo2.2 c`)

  const [groupComment1, grouproot] = grouptodo2_2v2.store.getRootExpression().addComment(`${thisLabel} Group Comment 1`)
  const [groupComment2, grouprootv0] = grouproot.addComment(`${thisLabel} Group Comment 2`)

  const [document2, grouprootv1] = grouprootv0.addDocument(`${thisLabel} Group Document 1`)
  const [document3, grouprootv2] = grouprootv1.addDocument(`${thisLabel} Group Document 2`)
  const [document4, grouprootv3] = grouprootv2.addDocument(`${thisLabel} Group Document 3`)
  const [document5, grouprootv4] = grouprootv3.addDocument(`${thisLabel} Group Document 4`)


  // const [document1, group1Rootv1] = groupBranch1.proposeChange()

  // const [document1, group1Rootv1] = workflow1.registerMarketService(`${thisLabel} Market Service 1`)

  // const [document1, group1Rootv1] = todo2_3.registerMarketRequest(`${thisLabel}Market Request 1`)

  store.commit()


  return store


}