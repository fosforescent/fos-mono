import { Disc } from "lucide-react"
import { Card } from "../ui/card"
import { Button } from "../ui/button"
import React from "react"
import { FosExpression } from "@/shared/dag-implementation/expression"

export const ExpressionCard = ({
  expression,
  ...props
} : {
  expression: FosExpression
}) => {

  const [newMessage, setNewMessage] = React.useState("")

  const { 
    addComment, addTodo, currentActivity, isBase, hasUpvotes, hasDownvotes, 
    currentUserHasUpvoted, currentUserHasDownvoted, upvote, downvote, zoom
  } = expression.getExpressionInfo()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (currentActivity === "todo") {
      addTodo(newMessage)
    } else if (currentActivity === "comment") {
      addComment(newMessage)
    }
    setNewMessage("")
  }


  // if target is COMPLETION, then this is a todo, let's render it

  // if target is COMPLETION, then this is a todo, let's render it
  const queryResult = expression.store.query(expression.store.primitive.completeField)

  console.log('queryResult', queryResult)
  //
  
  
  //  if left is X



  







  return (<Card className="p-4 flex flex-row justify-around">
    <div>
      <Button variant="ghost" onClick={zoom}><Disc /></Button>
    </div>
    <div className="flex gap-2">
      <div className="flex-1">
        <div className="font-bold">{expression.getAuthorName()}</div>
        <div>{expression.getUpdatedTime()}</div>
      </div>
      {currentActivity === "comments" && <div>
        <div>{expression.getVotes()}</div>
      </div>}
      {currentActivity === "todo" && <div>
        <div>{expression.getVotes()}</div>
      </div>}
    </div>
    <div className="mt-2">
      {expression.getDescription()}
    </div>


  </Card>)



}




export const NodeCard = ({ 
  data,
  setData,
  options,
  nodeRoute: route,
  ...props
} : {
  options: FosReactGlobal
  data: AppState
  nodeRoute: FosPath
  setData: (state: AppState) => void
}) => {

  const setFosAndTrellisData = (state: AppState["data"]) => {
    setData({
      ...data,
       data: state
    })
  }
  
  const { nodeDescription } = getExpressionInfo(route, data.data)

  const { zoom } = getNodeOperations(options, data.data, setFosAndTrellisData, route)
  // const { getCommentInfo } = getNodeInfo(route, data)

  return (
  <Card 
    className={`transform transition-all duration-500 ${'translate-y-0 opacity-100'}`}
    // onAnimationEnd={() => onAnimationEnd(message.id)}
  >
    <CardContent className="p-4">
      // this should be the (readonly?) card for the type of node 
      <div className="text-gray-800">{nodeDescription || "This Todo is empty"}</div>
      {/* <div className="text-xs text-gray-500 mt-2">{message.timestamp}</div> */}
    </CardContent>
    <CardFooter className="flex items-center justify-between p-4">
      <Button variant="default" size="sm">
        <SendHorizonal />   
      </Button>
    </CardFooter>
  </Card>
  )
}