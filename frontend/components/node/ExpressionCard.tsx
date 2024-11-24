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