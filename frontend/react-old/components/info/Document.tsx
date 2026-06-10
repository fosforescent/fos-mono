/**
 * Document - Component for viewing and managing document content
 *
 * Features:
 * - Document text editing via textarea
 * - AI-powered document generation
 * - Document download as text file
 * - Template-based aggregation of child documents
 */

import React, { useState, useMemo, useCallback } from 'react'
import { BrainCircuit, Download, FileText, Plus } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { FosExpression } from '@fosforescent/shared/dag-implementation/expression'
import { AppStateLoaded, FosReactOptions } from "@fosforescent/shared/types"

interface DocumentProps {
  expression: FosExpression
  data: AppStateLoaded
  setData: (state: AppStateLoaded) => void
  options: FosReactOptions
  className?: string
}

interface DocumentInfo {
  content: string
  aggregated?: string
}

/**
 * Get document info from an expression, recursively aggregating child documents
 */
function getDocumentInfo(expression: FosExpression): DocumentInfo {
  const nodeData = expression.targetNode.getContent().data
  const content = nodeData.document?.content || ''

  const children = expression.getTargetChildren()

  if (children.length === 0) {
    return {
      content,
      aggregated: content
    }
  }

  // Aggregate child documents using template substitution ({{1}}, {{2}}, etc.)
  const aggregated = children.reduce((acc, child, index) => {
    const childDocInfo = getDocumentInfo(child)
    return acc.replace(`{{${index + 1}}}`, childDocInfo.aggregated || '')
  }, content)

  return {
    content,
    aggregated
  }
}

/**
 * Set document content on an expression
 */
function setDocumentContent(expression: FosExpression, content: string): void {
  const currentData = expression.targetNode.getContent().data
  expression.targetNode.setData({
    ...currentData,
    document: { content }
  })
}

/**
 * Check if expression has document content
 */
function hasDocumentContent(expression: FosExpression): boolean {
  const nodeData = expression.targetNode.getContent().data
  return !!nodeData.document?.content
}

/**
 * Main Document component
 */
export const Document: React.FC<DocumentProps> = ({
  expression,
  data,
  setData,
  options,
  className
}) => {
  const documentInfo = useMemo(() => getDocumentInfo(expression), [expression])

  const handleDocumentEdit = useCallback((value: string) => {
    setDocumentContent(expression, value)

    // Export and update state
    const updatedContext = expression.store.exportContext([])
    setData({
      ...data,
      data: updatedContext
    })
  }, [expression, data, setData])

  const handleDownloadDocument = useCallback(() => {
    const textContent = documentInfo.aggregated || documentInfo.content || ''
    const blob = new Blob([textContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }, [documentInfo])

  const handleSuggestDocument = useCallback(async () => {
    if (!options?.canPromptGPT || !options?.promptGPT) {
      console.error('AI suggestions not available')
      options?.toast?.({
        title: 'Error',
        description: 'AI suggestions require authentication',
        duration: 5000,
      })
      return
    }

    const description = expression.getDescription()
    const parentDescriptions: string[] = []
    let current = expression
    while (current.hasParent()) {
      current = current.getParent()
      const desc = current.getDescription()
      if (desc) parentDescriptions.push(desc)
    }

    const children = expression.getTargetChildren()
    const childDocs = children.map((child, index) => {
      const childInfo = getDocumentInfo(child)
      return `{{${index + 1}}} : ${childInfo.aggregated || ''}`
    }).join('\n')

    const hasChildren = children.length > 0

    const systemPrompt = 'Take a deep breath. Please respond only with a single valid JSON object with the key "document" and a string value'
    const userPrompt = hasChildren
      ? `Please provide text which is the fulfillment of these instructions: ${description} in the context of the task ${parentDescriptions.join(' subtask of the task ')}, but the following pieces are already written as part of child tasks. Please insert them with the template format eg {{ 1 }} for child #1. Do not be redundant with that information:\n${childDocs}`
      : `Please provide text which is the fulfillment of these instructions: ${description} in the context of the task ${parentDescriptions.join(' subtask of the task ')}`

    try {
      const response = await options.promptGPT(userPrompt, systemPrompt)
      const parsed = JSON.parse(response)
      if (parsed.document) {
        handleDocumentEdit(parsed.document)
      }
    } catch (error) {
      console.error('Error suggesting document', error)
      options?.toast?.({
        title: 'Error',
        description: `Error suggesting document: ${error}`,
        duration: 5000,
      })
    }
  }, [expression, options, handleDocumentEdit])

  const handleAddChildDocument = useCallback(async () => {
    await expression.addDocument('')

    const updatedContext = expression.store.exportContext([])
    setData({
      ...data,
      data: updatedContext
    })
  }, [expression, data, setData])

  const canSuggest = options?.canPromptGPT && options?.promptGPT
  const hasContent = hasDocumentContent(expression)

  return (
    <div className={className}>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Document
              </CardTitle>
              <CardDescription>
                {expression.getDescription() || 'Document content'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {canSuggest && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-emerald-900 hover:bg-emerald-800"
                  onClick={handleSuggestDocument}
                  disabled={hasContent}
                  title="Generate document with AI"
                >
                  <BrainCircuit className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownloadDocument}
                disabled={!documentInfo.content && !documentInfo.aggregated}
                title="Download document"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddChildDocument}
                title="Add child document section"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={documentInfo.content}
            onChange={(e) => handleDocumentEdit(e.target.value)}
            placeholder="Enter document content... Use {{1}}, {{2}} etc. to include child document sections."
            className="min-h-[200px]"
          />

          {documentInfo.aggregated && documentInfo.aggregated !== documentInfo.content && (
            <div className="mt-4">
              <div className="text-sm text-muted-foreground mb-2">Preview (with children):</div>
              <div className="p-3 bg-muted/30 rounded-md whitespace-pre-wrap text-sm">
                {documentInfo.aggregated}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Document row component for tree view
 */
export const DocumentRowComponent: React.FC<{
  expression: FosExpression
  data: AppStateLoaded
  setData: (state: AppStateLoaded) => void
}> = ({ expression, data, setData }) => {
  const handleAddChildDocument = useCallback(async () => {
    await expression.addDocument('')

    const updatedContext = expression.store.exportContext([])
    setData({
      ...data,
      data: updatedContext
    })
  }, [expression, data, setData])

  return (
    <Button
      variant="secondary"
      size="sm"
      className="bg-emerald-900 hover:bg-emerald-800 p-1"
      title="Add Child Document"
      onClick={handleAddChildDocument}
    >
      <FileText size="1rem" />
    </Button>
  )
}

/**
 * Module export for data field system
 */
export const documentModule = {
  icon: <FileText />,
  name: 'document',
  HeadComponent: Document,
  RowComponent: DocumentRowComponent
}

export default Document
