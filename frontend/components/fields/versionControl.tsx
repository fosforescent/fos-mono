
import { Button } from "../ui/button"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger

} from "../ui/dropdown-menu"
import { GitBranch, GitCommit, GitCommitIcon, GitMerge, GitPullRequest, History } from "lucide-react"
import { CommitIcon } from "@radix-ui/react-icons"
import TripleToggleSwitch from "../elements/tripleToggle"
import { getDragAndDropHandlers } from "../drag-drop"
import { FosExpression } from "@/shared/dag-implementation/expression"


/**
 * 
 * Meta component = component to modify item (changes node) -- let's just add an autocomplete dropdown to link or copy other nodes
 * 
 * Actual compoonent = component to modify information within item (changes node content -- e.g. edit description, complete, etc.)
 * 
 * Does this distinction matter?  Let's pretend it doesn't for now.
 * 
 * 
 */



export const VersionControlComponent = ({
  depthToShow,
  expression,
  // children,
  ...props
} : {
  depthToShow: number,
  // children: React.ReactNode,
  expression: FosExpression
}) => {


  const {
    locked,
    hasFocus, focusChar, isDragging, draggingOver,
    nodeDescription, isRoot, childRoutes, isBase,
    nodeType, nodeId, disabled, depth, isCollapsed,
    isTooDeep, isOption, hasChildren, getOptionInfo,
    currentActivity, currentMode, currentGroup
  } = expression.getExpressionInfo()

  const {
    // revertNStepsBack
    // revertToCommit
    // changeToBranch
    // openMergeRequest
    // approveMergeRequest
    // createBranch
    // createCommit
    // getDiffBranch
    // getOpenMergeRequests
    // commentOnMergeRequest
    // editComment
    // getBranches
    // getPrevCommits
    // isCommitted
    // isConflictNode
    // resolveConflictNode
    // setConflictTarget
    // setConflictInstruction
    // upvoteMergeRequest
    // downvoteMergeRequest
  } = expression.getActions()





  return (<div className={`pl-1 flex flex-row items-center gap-1`}>
    <DropdownMenu>
      <DropdownMenuTrigger className={`w-200`}><Button><GitBranch /></Button></DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem>Option 1</DropdownMenuItem>
          <DropdownMenuItem>Option 2</DropdownMenuItem>
          <DropdownMenuItem>Option 3</DropdownMenuItem>

        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
    <DropdownMenu>
      <DropdownMenuTrigger><Button><History /></Button></DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Billing</DropdownMenuItem>
        <DropdownMenuItem>Team</DropdownMenuItem>
        <DropdownMenuItem>Subscription</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Button><GitCommit /></Button>
    <Button><GitPullRequest /></Button>

    <TripleToggleSwitch />
  </div>)
}


