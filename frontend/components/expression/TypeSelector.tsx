/**
 * TypeSelector - Component for selecting or constructing types
 *
 * When a type cannot be inferred, this component allows users to:
 * 1. Choose from existing types in scope
 * 2. Construct a new type by composing type constructors
 */

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, Plus, Type, Hash, Calendar, DollarSign, Clock, List, User, FileText, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FosExpression } from '@fosforescent/shared/dag-implementation/expression'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { FosNode } from '@fosforescent/shared/dag-implementation/node'

/**
 * Built-in primitive types with their icons and descriptions
 */
export const PRIMITIVE_TYPES = [
  { id: 'string', name: 'Text', icon: Type, description: 'Plain text value' },
  { id: 'number', name: 'Number', icon: Hash, description: 'Numeric value' },
  { id: 'boolean', name: 'Yes/No', icon: Check, description: 'True or false' },
  { id: 'date', name: 'Date', icon: Calendar, description: 'Date value' },
  { id: 'time', name: 'Time', icon: Clock, description: 'Time value' },
  { id: 'duration', name: 'Duration', icon: Clock, description: 'Time duration' },
  { id: 'currency', name: 'Currency', icon: DollarSign, description: 'Monetary amount' },
  { id: 'list', name: 'List', icon: List, description: 'List of items' },
  { id: 'person', name: 'Person', icon: User, description: 'Contact/person' },
  { id: 'document', name: 'Document', icon: FileText, description: 'Rich text document' },
] as const

export type PrimitiveTypeId = typeof PRIMITIVE_TYPES[number]['id']

/**
 * Type definition for a selected type
 */
export interface SelectedType {
  kind: 'primitive' | 'custom' | 'constructed'
  id: string
  name: string
  /** For constructed types, the child type arguments */
  typeArgs?: SelectedType[]
  /** Node ID if this is a custom type from scope */
  nodeId?: string
}

interface TypeSelectorProps {
  /** Currently selected type (if any) */
  value?: SelectedType
  /** Called when a type is selected */
  onChange: (type: SelectedType) => void
  /** Expression context for finding types in scope */
  expression?: FosExpression
  /** Store for accessing type definitions */
  store?: FosStore
  /** Whether to show the full type construction UI */
  allowConstruction?: boolean
  /** Placeholder text */
  placeholder?: string
  /** Additional CSS classes */
  className?: string
}

export const TypeSelector: React.FC<TypeSelectorProps> = ({
  value,
  onChange,
  expression,
  store,
  allowConstruction = true,
  placeholder = 'Select type...',
  className
}) => {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [constructingType, setConstructingType] = useState(false)

  // Get custom types from scope if expression is provided
  const customTypes = useMemo(() => {
    if (!expression || !store) return []

    // Query for TYPE nodes in scope
    try {
      const facts = expression.queryFacts()
      // Filter for type definitions
      return facts
        .filter(f => {
          const data = f.targetNode.getData()
          return data.description?.content?.startsWith('Type:')
        })
        .map(f => ({
          id: f.targetNode.getId(),
          name: f.targetNode.getData().description?.content?.replace('Type:', '').trim() || 'Custom Type',
          nodeId: f.targetNode.getId()
        }))
    } catch {
      return []
    }
  }, [expression, store])

  // Filter types based on search query
  const filteredPrimitives = PRIMITIVE_TYPES.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredCustom = customTypes.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSelectPrimitive = (typeId: PrimitiveTypeId) => {
    const type = PRIMITIVE_TYPES.find(t => t.id === typeId)
    if (type) {
      onChange({
        kind: 'primitive',
        id: type.id,
        name: type.name
      })
      setOpen(false)
    }
  }

  const handleSelectCustom = (customType: typeof customTypes[number]) => {
    onChange({
      kind: 'custom',
      id: customType.id,
      name: customType.name,
      nodeId: customType.nodeId
    })
    setOpen(false)
  }

  const getTypeIcon = () => {
    if (!value) return <Type className="h-4 w-4" />
    const primitive = PRIMITIVE_TYPES.find(t => t.id === value.id)
    if (primitive) {
      const Icon = primitive.icon
      return <Icon className="h-4 w-4" />
    }
    return <Type className="h-4 w-4" />
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between min-w-[200px]", className)}
        >
          <div className="flex items-center gap-2">
            {getTypeIcon()}
            {value ? (
              <span>{value.name}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronRight className={cn("ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-90")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search types..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No types found.</CommandEmpty>

            {/* Primitive Types */}
            <CommandGroup heading="Basic Types">
              {filteredPrimitives.map((type) => {
                const Icon = type.icon
                return (
                  <CommandItem
                    key={type.id}
                    value={type.id}
                    onSelect={() => handleSelectPrimitive(type.id)}
                    className="flex items-center gap-2"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{type.name}</span>
                      <span className="text-xs text-muted-foreground">{type.description}</span>
                    </div>
                    {value?.id === type.id && (
                      <Check className="ml-auto h-4 w-4" />
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>

            {/* Custom Types from Scope */}
            {filteredCustom.length > 0 && (
              <CommandGroup heading="Custom Types">
                {filteredCustom.map((type) => (
                  <CommandItem
                    key={type.id}
                    value={type.id}
                    onSelect={() => handleSelectCustom(type)}
                    className="flex items-center gap-2"
                  >
                    <Type className="h-4 w-4 text-muted-foreground" />
                    <span>{type.name}</span>
                    {value?.id === type.id && (
                      <Check className="ml-auto h-4 w-4" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Type Construction */}
            {allowConstruction && (
              <CommandGroup heading="Create New">
                <CommandItem
                  value="construct"
                  onSelect={() => setConstructingType(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  <span>Construct new type...</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>

        {/* Type Construction Panel */}
        {constructingType && (
          <TypeConstructor
            onConstruct={(type) => {
              onChange(type)
              setConstructingType(false)
              setOpen(false)
            }}
            onCancel={() => setConstructingType(false)}
            store={store}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}

/**
 * TypeConstructor - Sub-component for building complex types
 */
interface TypeConstructorProps {
  onConstruct: (type: SelectedType) => void
  onCancel: () => void
  store?: FosStore
}

const TypeConstructor: React.FC<TypeConstructorProps> = ({
  onConstruct,
  onCancel,
  store
}) => {
  const [typeName, setTypeName] = useState('')
  const [baseType, setBaseType] = useState<PrimitiveTypeId>('string')

  const handleCreate = () => {
    const name = typeName.trim() || `Custom ${PRIMITIVE_TYPES.find(t => t.id === baseType)?.name}`
    onConstruct({
      kind: 'constructed',
      id: `constructed_${Date.now()}`,
      name,
      typeArgs: [{
        kind: 'primitive',
        id: baseType,
        name: PRIMITIVE_TYPES.find(t => t.id === baseType)?.name || baseType
      }]
    })
  }

  return (
    <div className="border-t p-3 space-y-3">
      <div className="space-y-2">
        <Label htmlFor="type-name">Type Name</Label>
        <Input
          id="type-name"
          value={typeName}
          onChange={(e) => setTypeName(e.target.value)}
          placeholder="e.g., Email Address"
        />
      </div>

      <div className="space-y-2">
        <Label>Base Type</Label>
        <Select value={baseType} onValueChange={(v) => setBaseType(v as PrimitiveTypeId)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIMITIVE_TYPES.map((type) => {
              const Icon = type.icon
              return (
                <SelectItem key={type.id} value={type.id}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {type.name}
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleCreate}>
          Create Type
        </Button>
      </div>
    </div>
  )
}

/**
 * Helper to render a type badge
 */
export const TypeBadge: React.FC<{ type: SelectedType; className?: string }> = ({ type, className }) => {
  const primitive = PRIMITIVE_TYPES.find(t => t.id === type.id)
  const Icon = primitive?.icon || Type

  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <Icon className="h-3 w-3" />
      {type.name}
    </Badge>
  )
}

export default TypeSelector
