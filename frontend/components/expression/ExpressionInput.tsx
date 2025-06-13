import { FosExpression } from "@fosforescent/shared/dag-implementation/expression"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { Send } from "lucide-react"
import React, { useState } from "react"
import { AppState, AppStateLoaded } from "@fosforescent/shared/types"
import { FosReactGlobal } from "../../types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

export const ExpressionInput = ({
  options,
  setData,
  expression,
  data,
  currentFilter,
  ...props
}: {
  options: FosReactGlobal
  data: AppStateLoaded
  setData: (state: AppStateLoaded) => void
  expression: FosExpression
  currentFilter?: string
}) => {



  const [newMessage, setNewMessage] = useState("")
  const [selectedItemType, setSelectedItemType] = useState("todo")

  const activeFilter = currentFilter || expression.currentActivity()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const itemTypeToCreate = activeFilter === "all" ? selectedItemType : activeFilter

    if (itemTypeToCreate === "todo") {
      await expression.addTodo(newMessage)
    } else if (itemTypeToCreate === "comments") {
      await expression.addComment(newMessage)
    }

    // Update the UI with the new data from the store - export from root to get all data
    const updatedData = expression.store.exportContext([])
    console.log('ExpressionInput: updatedData after todo creation:', updatedData)
    console.log('ExpressionInput: calling setData with:', {
      ...data,
      data: updatedData
    })
    setData({
      ...data,
      data: updatedData
    })

    setNewMessage("")
  }

  const getPlaceholderText = () => {
    const itemType = activeFilter === "all" ? selectedItemType : activeFilter
    switch (itemType) {
      case "todo":
        return "Add a new todo..."
      case "comments":
        return "Add a comment..."
      default:
        return "Type a message..."
    }
  }

  const getButtonText = () => {
    const itemType = activeFilter === "all" ? selectedItemType : activeFilter
    switch (itemType) {
      case "todo":
        return "Add Todo"
      case "comments":
        return "Add Comment"
      default:
        return "Send"
    }
  }


  const shouldShowForm = expression.isBase() && (activeFilter === "todo" || activeFilter === "comments" || activeFilter === "all")

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 px-10 py-5">
      {shouldShowForm && (
        <>
          {activeFilter === "all" && (
            <Select value={selectedItemType} onValueChange={setSelectedItemType}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">Todo</SelectItem>
                <SelectItem value="comments">Comment</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Input
            type="text"
            value={newMessage}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
            placeholder={getPlaceholderText()}
            className="flex-1"
          />
          <Button type="submit" variant="default">
            <Send className="h-4 w-4 mr-2" />
            {getButtonText()}
          </Button>
        </>
      )}
    </form>
  )

}