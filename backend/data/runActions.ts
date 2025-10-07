import { FosExpression } from "@fosforescent/shared/dag-implementation/expression";
import { FosStore } from "@fosforescent/shared/dag-implementation/store";
import { mutableMapExpressions } from "@fosforescent/shared/utils";
import { executeSearch } from "./search";


export const runActionsOnStore = (store: FosStore ) => {

  /**
   * Action types that can be evaluated:
   * SEARCHQUERY - run search query
   * CREATEGROUP - create a new group
   * CREATEDM - create a DM between users
   * ADDMEMBERTOGROUP - add member to group
   * SENDGROUPMESSAGE - send message to group
   */

  const rootExpression = new FosExpression(store, [])


  mutableMapExpressions(store.exportContext(store.fosRoute), (resultMap, expression) => {

    if ( expression.isSearch() ){
      // run search query on expression
      executeSearch(expression, {
        limit: 10,
        minScore: 0.5,
        excludeIds: []
      })


      // expression.  
    }
  
  })
  






}



// const ctxData = store.exportContext(store.fosRoute)

//   mutableMapExpressions(ctxData, (resultMap, expression) => {

//     const { isSearch } = expression.getExpressionInfo()
//     if ( isSearch ){
//       // expression.  
//     }
  
//   })
  