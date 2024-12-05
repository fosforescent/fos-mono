import { FosExpression } from "@/shared/dag-implementation/expression"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { Send } from "lucide-react"
import React from "react"
import { AppState, FosReactGlobal } from "@/shared/types"

export const NodeActiviyInput = ({
  options,
  setData,
  expression,
  ...props
} : {
  options: FosReactGlobal
  setData: (state: AppState["data"]) => void
  expression: FosExpression
}) => {



  const [newMessage, setNewMessage] = React.useState("")



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault() 
    if (currentActivity === "todo") {
      addTodo(newMessage)
    } else if (currentActivity === "comment") {
      addComment(newMessage)
    }
    setNewMessage("")
  }


  return (
    <form onSubmit={handleSubmit} className="flex gap-2 px-10 py-5">
    {(isBase && currentActivity === "todo") && (<><Input
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