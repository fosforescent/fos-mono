import { FosExpression } from "@/shared/dag-implementation/expression"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { Send } from "lucide-react"
import React from "react"
import { AppState, AppStateLoaded, FosReactGlobal } from "@/shared/types"

export const ExpressionInput = ({
  options,
  setData,
  expression,
  data,
  ...props
} : {
  options: FosReactGlobal
  data: AppStateLoaded
  setData: (state: AppStateLoaded["data"]) => void
  expression: FosExpression
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


  return (
    <form onSubmit={handleSubmit} className="flex gap-2 px-10 py-5">
    {(expression.isBase() && expression.currentActivity() === "todo") && (<><Input
      type="text"
      value={newMessage}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
      placeholder="Type a message..."
      className="flex-1"
    />
    <Button type="submit" variant="default">
      <Send className="h-4 w-4 mr-2" type="submit" />
      Send
    </Button></>)}
</form>
  )

}