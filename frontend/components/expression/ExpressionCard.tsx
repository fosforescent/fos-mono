import { Disc, SendHorizonal } from "lucide-react"
import { Card, CardContent, CardFooter } from "../ui/card"
import { Button } from "../ui/button"
import React from "react"
import { FosExpression } from "@/shared/dag-implementation/expression"
import { AppState, AppStateLoaded, FosPath, FosReactGlobal, FosReactOptions } from "@/shared/types"
import { ExpressionFields } from "./ExpressionFields"

export const ExpressionCard = ({ 
  setData,
  options,
  expression,
  data,
  ...props
} : {
  options: FosReactOptions
  expression: FosExpression
  data: AppStateLoaded
  setData: (state: AppStateLoaded) => void
}) => {

  const [newMessage, setNewMessage] = React.useState("")



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (expression.currentActivity() === "todo") {
      expression.addTodo(newMessage)
    } else if (expression.currentActivity() === "comment") {
      expression.addComment(newMessage)
    }
    setNewMessage("")
  }


  // if target is COMPLETION, then this is a todo, let's render it

  
  //  if left is X



  
  console.log('expression', expression)

  

  const todoInfo = expression.isTodo() ? expression.getTodoInfo() : undefined




  return (<Card className="p-4 flex flex-row justify-around">
    <ExpressionFields
      depthToShow={1}
      mode={["read"]}
      expression={expression}
      setData={setData}
      options={options}
      data={data}
      />

  </Card>)



}




export const NodeCard = ({ 
  data,
  setData,
  options,
  expression,
  ...props
} : {
  options: FosReactGlobal
  data: AppStateLoaded
  expression: FosExpression
  setData: (state: AppStateLoaded) => void
}) => {

  const setFosAndTrellisData = (state: AppStateLoaded["data"]) => {
    setData({
      ...data,
       data: state
    })
  }

  
  return (
  <Card 
    className={`transform transition-all duration-500 ${'translate-y-0 opacity-100'}`}
    // onAnimationEnd={() => onAnimationEnd(message.id)}
  >
    <CardContent className="p-4">
      // this should be the (readonly?) card for the type of node 
      <div className="text-gray-800">{expression.getDescription() || "This Todo is empty"}</div>
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