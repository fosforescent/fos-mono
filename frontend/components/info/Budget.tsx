/**
 * Budget - Component for viewing and managing linear budget allocations
 *
 * Features:
 * - Tree view of budget allocations
 * - Parent budget with total amount
 * - Child allocations with adjustable amounts
 * - Remaining balance display
 * - Sub-allocation creation
 * - Spending tracking
 */

import React, { useState, useMemo, useCallback } from 'react'
import { FosExpression } from '@fosforescent/shared/dag-implementation/expression'
import { AppStateLoaded } from '@fosforescent/shared/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Wallet,
  Plus,
  ChevronRight,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Currency symbols
const CURRENCIES: Record<string, { symbol: string; name: string }> = {
  USD: { symbol: '$', name: 'US Dollar' },
  EUR: { symbol: '\u20AC', name: 'Euro' },
  GBP: { symbol: '\u00A3', name: 'British Pound' },
  JPY: { symbol: '\u00A5', name: 'Japanese Yen' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', name: 'Australian Dollar' },
  CHF: { symbol: 'CHF', name: 'Swiss Franc' },
}

interface BudgetData {
  id: string
  name: string
  total: number
  consumed: number
  currency: string
  children: BudgetData[]
  parentId?: string
}

interface BudgetProps {
  expression: FosExpression
  data: AppStateLoaded
  setData: (state: AppStateLoaded) => void
  className?: string
}

/**
 * Extract budget data from expression children
 */
function extractBudgetsFromExpression(expression: FosExpression): BudgetData[] {
  const budgets: BudgetData[] = []

  // Get all budget-type children from the expression
  const children = expression.getTargetChildren()

  for (const child of children) {
    const nodeData = child.targetNode.getContent().data
    if (nodeData.budget) {
      const budget: BudgetData = {
        id: child.targetNode.getId(),
        name: nodeData.budget.name || nodeData.description?.content || 'Unnamed Budget',
        total: nodeData.budget.total,
        consumed: nodeData.budget.consumed,
        currency: nodeData.budget.currency || 'USD',
        children: [],
        parentId: nodeData.budget.parentBudgetId
      }

      // Recursively get child budgets
      budget.children = extractBudgetsFromExpression(child)

      budgets.push(budget)
    }
  }

  return budgets
}

/**
 * Format currency amount
 */
function formatCurrency(amount: number, currencyCode: string): string {
  const currency = CURRENCIES[currencyCode] || { symbol: currencyCode }
  return `${currency.symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * BudgetNode - Individual budget item in the tree
 */
const BudgetNode: React.FC<{
  budget: BudgetData
  depth: number
  onAllocate: (parentId: string, amount: number, name: string) => void
  onSpend: (budgetId: string, amount: number, description: string) => void
}> = ({ budget, depth, onAllocate, onSpend }) => {
  const [isOpen, setIsOpen] = useState(true)
  const [showAllocateDialog, setShowAllocateDialog] = useState(false)
  const [showSpendDialog, setShowSpendDialog] = useState(false)

  const remaining = budget.total - budget.consumed
  const percentUsed = budget.total > 0 ? (budget.consumed / budget.total) * 100 : 0
  const isOverBudget = remaining < 0
  const isLowBudget = remaining > 0 && remaining < budget.total * 0.1

  // Child totals
  const childrenTotal = budget.children.reduce((sum, child) => sum + child.total, 0)
  const unallocated = budget.total - childrenTotal - budget.consumed

  return (
    <div className={cn("border rounded-lg", depth > 0 && "ml-4 mt-2")}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              {budget.children.length > 0 && (
                <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
              )}
              {budget.children.length === 0 && <div className="w-4" />}

              <Wallet className="h-5 w-5 text-muted-foreground" />

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{budget.name}</span>
                  {isOverBudget && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Over Budget
                    </Badge>
                  )}
                  {isLowBudget && !isOverBudget && (
                    <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800">
                      <AlertTriangle className="h-3 w-3" />
                      Low
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatCurrency(remaining, budget.currency)} remaining of {formatCurrency(budget.total, budget.currency)}
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center gap-1 text-sm">
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-muted-foreground">Spent:</span>
                  <span className={cn(isOverBudget && "text-red-500 font-medium")}>
                    {formatCurrency(budget.consumed, budget.currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2">
              <Progress
                value={Math.min(percentUsed, 100)}
                className={cn(
                  "h-2",
                  isOverBudget && "[&>div]:bg-red-500",
                  isLowBudget && !isOverBudget && "[&>div]:bg-amber-500"
                )}
              />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {/* Budget summary */}
          <div className="px-3 pb-2 border-t bg-muted/30">
            <div className="grid grid-cols-3 gap-4 py-2 text-sm">
              <div>
                <span className="text-muted-foreground">Total:</span>{' '}
                <span className="font-medium">{formatCurrency(budget.total, budget.currency)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Allocated to children:</span>{' '}
                <span className="font-medium">{formatCurrency(childrenTotal, budget.currency)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Unallocated:</span>{' '}
                <span className={cn("font-medium", unallocated < 0 && "text-red-500")}>
                  {formatCurrency(unallocated, budget.currency)}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2 border-t">
              <AllocateDialog
                budget={budget}
                maxAmount={unallocated}
                onAllocate={(amount, name) => onAllocate(budget.id, amount, name)}
              />
              <SpendDialog
                budget={budget}
                maxAmount={remaining}
                onSpend={(amount, desc) => onSpend(budget.id, amount, desc)}
              />
            </div>
          </div>

          {/* Child budgets */}
          {budget.children.length > 0 && (
            <div className="pb-3 px-3">
              {budget.children.map((child) => (
                <BudgetNode
                  key={child.id}
                  budget={child}
                  depth={depth + 1}
                  onAllocate={onAllocate}
                  onSpend={onSpend}
                />
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

/**
 * Dialog for allocating a sub-budget
 */
const AllocateDialog: React.FC<{
  budget: BudgetData
  maxAmount: number
  onAllocate: (amount: number, name: string) => void
}> = ({ budget, maxAmount, onAllocate }) => {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [name, setName] = useState('')

  const handleSubmit = () => {
    const numAmount = parseFloat(amount)
    if (numAmount > 0 && name.trim()) {
      onAllocate(numAmount, name.trim())
      setAmount('')
      setName('')
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={maxAmount <= 0}>
          <Plus className="h-3 w-3 mr-1" />
          Allocate Sub-budget
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Sub-budget</DialogTitle>
          <DialogDescription>
            Allocate from "{budget.name}" ({formatCurrency(maxAmount, budget.currency)} available)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="sub-budget-name">Name</Label>
            <Input
              id="sub-budget-name"
              placeholder="e.g., Marketing, Equipment"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sub-budget-amount">Amount ({budget.currency})</Label>
            <Input
              id="sub-budget-amount"
              type="number"
              step="0.01"
              min="0"
              max={maxAmount}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Slider
              value={[parseFloat(amount) || 0]}
              max={maxAmount}
              step={1}
              onValueChange={([v]) => setAmount(v.toString())}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!amount || !name.trim() || parseFloat(amount) > maxAmount}
          >
            Create Sub-budget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Dialog for recording spending
 */
const SpendDialog: React.FC<{
  budget: BudgetData
  maxAmount: number
  onSpend: (amount: number, description: string) => void
}> = ({ budget, maxAmount, onSpend }) => {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = () => {
    const numAmount = parseFloat(amount)
    if (numAmount > 0) {
      onSpend(numAmount, description.trim())
      setAmount('')
      setDescription('')
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <DollarSign className="h-3 w-3 mr-1" />
          Record Spending
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Spending</DialogTitle>
          <DialogDescription>
            Record spending from "{budget.name}" ({formatCurrency(maxAmount, budget.currency)} remaining)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="spend-amount">Amount ({budget.currency})</Label>
            <Input
              id="spend-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spend-description">Description (optional)</Label>
            <Input
              id="spend-description"
              placeholder="What was this for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!amount || parseFloat(amount) <= 0}
          >
            Record Spending
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Dialog for creating a new top-level budget
 */
const CreateBudgetDialog: React.FC<{
  onCreateBudget: (name: string, total: number, currency: string) => void
}> = ({ onCreateBudget }) => {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [total, setTotal] = useState('')
  const [currency, setCurrency] = useState('USD')

  const handleSubmit = () => {
    const numTotal = parseFloat(total)
    if (numTotal > 0 && name.trim()) {
      onCreateBudget(name.trim(), numTotal, currency)
      setName('')
      setTotal('')
      setCurrency('USD')
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Budget
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Budget</DialogTitle>
          <DialogDescription>
            Create a new budget to track spending
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="budget-name">Budget Name</Label>
            <Input
              id="budget-name"
              placeholder="e.g., Project Budget, Monthly Expenses"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget-currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="budget-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CURRENCIES).map(([code, { symbol, name }]) => (
                    <SelectItem key={code} value={code}>
                      {symbol} - {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-total">Total Amount</Label>
              <Input
                id="budget-total"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !total || parseFloat(total) <= 0}
          >
            Create Budget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Main Budget component
 */
export const Budget: React.FC<BudgetProps> = ({
  expression,
  data,
  setData,
  className
}) => {
  // Extract budgets from expression
  const budgets = useMemo(() => {
    return extractBudgetsFromExpression(expression)
  }, [expression])

  // Calculate totals
  const totals = useMemo(() => {
    let totalBudget = 0
    let totalSpent = 0

    const traverse = (items: BudgetData[]) => {
      for (const item of items) {
        // Only count leaf nodes or unallocated portions
        if (item.children.length === 0) {
          totalBudget += item.total
          totalSpent += item.consumed
        } else {
          // Count consumed at this level
          totalSpent += item.consumed
          traverse(item.children)
        }
      }
    }

    traverse(budgets)
    return { totalBudget, totalSpent, remaining: totalBudget - totalSpent }
  }, [budgets])

  // Handle creating a new budget
  const handleCreateBudget = useCallback((name: string, total: number, currency: string) => {
    // Create budget using expression's budget methods
    expression.createBudget(name, total, currency)

    // Export and update state
    const updatedContext = expression.store.exportContext([])
    setData({
      ...data,
      data: updatedContext
    })
  }, [expression, data, setData])

  // Handle allocating a sub-budget
  const handleAllocate = useCallback((parentId: string, amount: number, name: string) => {
    // This would use the allocateBudget method on the expression
    // For now, we'll create a new budget as a child
    expression.createBudget(name, amount, 'USD') // TODO: inherit currency from parent

    const updatedContext = expression.store.exportContext([])
    setData({
      ...data,
      data: updatedContext
    })
  }, [expression, data, setData])

  // Handle recording spending
  const handleSpend = useCallback((budgetId: string, amount: number, description: string) => {
    expression.spendBudget(budgetId, amount, description)

    const updatedContext = expression.store.exportContext([])
    setData({
      ...data,
      data: updatedContext
    })
  }, [expression, data, setData])

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with totals */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Budgets
              </CardTitle>
              <CardDescription>
                Track and manage budget allocations
              </CardDescription>
            </div>
            <CreateBudgetDialog onCreateBudget={handleCreateBudget} />
          </div>
        </CardHeader>
        {budgets.length > 0 && (
          <CardContent>
            <div className="grid grid-cols-3 gap-4 p-3 bg-muted/30 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(totals.totalBudget, 'USD')}
                </div>
                <div className="text-sm text-muted-foreground">Total Budget</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">
                  {formatCurrency(totals.totalSpent, 'USD')}
                </div>
                <div className="text-sm text-muted-foreground">Total Spent</div>
              </div>
              <div className="text-center">
                <div className={cn(
                  "text-2xl font-bold",
                  totals.remaining >= 0 ? "text-blue-600" : "text-red-600"
                )}>
                  {formatCurrency(totals.remaining, 'USD')}
                </div>
                <div className="text-sm text-muted-foreground">Remaining</div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Budget tree */}
      {budgets.length > 0 ? (
        <div className="space-y-2">
          {budgets.map((budget) => (
            <BudgetNode
              key={budget.id}
              budget={budget}
              depth={0}
              onAllocate={handleAllocate}
              onSpend={handleSpend}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No budgets yet</p>
            <p className="text-sm">Create a budget to start tracking spending</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default Budget
