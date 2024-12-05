import { FosExpression } from "@/shared/dag-implementation/expression";
import { FosStore } from "@/shared/dag-implementation/store";
import { mutableMapExpressions } from "@/shared/utils";
import { executeSearch } from "./search";


export const runActionsOnStore = (store: FosStore ) => {

  /**
   * e.g. 
   * SEARCHQUERY --- run x function
   * BLAHBLAH --- run y function
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
  