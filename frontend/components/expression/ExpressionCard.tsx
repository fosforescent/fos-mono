import { Disc } from "lucide-react"
import { Card } from "../ui/card"
import { Button } from "../ui/button"
import React from "react"
import { FosExpression } from "@/shared/dag-implementation/expression"
import { AppState, FosPath, FosReactOptions } from "@/shared/types"
import { ExpressionFields } from "./ExpressionFields"

export const ExpressionCard = ({ 
  data,
  setData,
  options,
  nodeRoute,
  activity,
  expression, 
  ...props
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: FosPath
  activity: string
  expression: FosExpression
  setData: (state: AppState) => void
}) => {

  const [newMessage, setNewMessage] = React.useState("")

  const { 
    addComment, addTodo, currentActivity, isBase, 
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

  
  //  if left is X



  
  console.log('expression', expression)

  const { isTodo } = expression.getExpressionInfo()

  const todoInfo = isTodo ? expression.getTodoInfo() : undefined




  return (<Card className="p-4 flex flex-row justify-around">
    <ExpressionFields
      depthToShow={1}
      mode={["read"]}
      expression={expression}
      data={data}
      setData={setData}
      options={options}
      nodeRoute={nodeRoute}
      />

  </Card>)



}


