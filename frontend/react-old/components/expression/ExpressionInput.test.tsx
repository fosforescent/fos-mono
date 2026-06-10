import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ExpressionInput } from './ExpressionInput'
import { FosExpression } from '@fosforescent/shared/dag-implementation/expression'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { AppStateLoaded } from '@fosforescent/shared/types'
import { FosReactGlobal } from '../../types'

// Mock the dependencies
jest.mock('@fosforescent/shared/dag-implementation/expression')
jest.mock('@fosforescent/shared/dag-implementation/store')

describe('ExpressionInput', () => {
  let mockExpression: jest.Mocked<FosExpression>
  let mockStore: jest.Mocked<FosStore>
  let mockOptions: FosReactGlobal
  let mockData: AppStateLoaded
  let mockSetData: jest.Mock

  beforeEach(() => {
    // Create mock store
    mockStore = {
      getExpressionAtPath: jest.fn(),
      saveData: jest.fn(),
      exportContext: jest.fn().mockReturnValue({ fosData: {}, trellisData: {} }),
    } as any

    // Create mock expression
    mockExpression = {
      addTodo: jest.fn().mockResolvedValue(undefined),
      addComment: jest.fn().mockResolvedValue(undefined),
      currentActivity: jest.fn().mockReturnValue('todo'),
      isBase: jest.fn().mockReturnValue(true),
      store: mockStore,
    } as any

    // Create mock options
    mockOptions = {
      store: mockStore,
      setStore: jest.fn(),
    } as any

    // Create mock data
    mockData = {
      data: {},
      username: 'test@example.com',
    } as any

    // Create mock setData function
    mockSetData = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders todo input form when filter is todo', () => {
    render(
      <ExpressionInput
        options={mockOptions}
        data={mockData}
        setData={mockSetData}
        expression={mockExpression}
        currentFilter="todo"
      />
    )

    expect(screen.getByPlaceholderText('Add a new todo...')).toBeInTheDocument()
    expect(screen.getByText('Add Todo')).toBeInTheDocument()
  })

  it('renders comment input form when filter is comments', () => {
    render(
      <ExpressionInput
        options={mockOptions}
        data={mockData}
        setData={mockSetData}
        expression={mockExpression}
        currentFilter="comments"
      />
    )

    expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument()
    expect(screen.getByText('Add Comment')).toBeInTheDocument()
  })

  it('shows type selector when filter is all', () => {
    render(
      <ExpressionInput
        options={mockOptions}
        data={mockData}
        setData={mockSetData}
        expression={mockExpression}
        currentFilter="all"
      />
    )

    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Add a new todo...')).toBeInTheDocument()
  })

  it('calls addTodo when submitting a todo', async () => {
    render(
      <ExpressionInput
        options={mockOptions}
        data={mockData}
        setData={mockSetData}
        expression={mockExpression}
        currentFilter="todo"
      />
    )

    const input = screen.getByPlaceholderText('Add a new todo...')
    const submitButton = screen.getByText('Add Todo')

    // Type in the input
    fireEvent.change(input, { target: { value: 'Test todo item' } })

    // Submit the form
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockExpression.addTodo).toHaveBeenCalledWith('Test todo item')
    })

    // Input should be cleared after submission
    await waitFor(() => {
      expect(input).toHaveValue('')
    })
  })

  it('calls addComment when submitting a comment', async () => {
    render(
      <ExpressionInput
        options={mockOptions}
        data={mockData}
        setData={mockSetData}
        expression={mockExpression}
        currentFilter="comments"
      />
    )

    const input = screen.getByPlaceholderText('Add a comment...')
    const submitButton = screen.getByText('Add Comment')

    // Type in the input
    fireEvent.change(input, { target: { value: 'Test comment' } })

    // Submit the form
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockExpression.addComment).toHaveBeenCalledWith('Test comment')
    })

    // Input should be cleared after submission
    await waitFor(() => {
      expect(input).toHaveValue('')
    })
  })

  it('does not render form when expression is not base', () => {
    mockExpression.isBase.mockReturnValue(false)

    render(
      <ExpressionInput
        options={mockOptions}
        data={mockData}
        setData={mockSetData}
        expression={mockExpression}
        currentFilter="todo"
      />
    )

    expect(screen.queryByPlaceholderText('Add a new todo...')).not.toBeInTheDocument()
    expect(screen.queryByText('Add Todo')).not.toBeInTheDocument()
  })

  it('handles form submission with enter key', async () => {
    render(
      <ExpressionInput
        options={mockOptions}
        data={mockData}
        setData={mockSetData}
        expression={mockExpression}
        currentFilter="todo"
      />
    )

    const input = screen.getByPlaceholderText('Add a new todo...')
    const form = input.closest('form')!

    // Type in the input
    fireEvent.change(input, { target: { value: 'Test todo with enter' } })

    // Submit with enter key - submit the form directly
    fireEvent.submit(form)

    await waitFor(() => {
      expect(mockExpression.addTodo).toHaveBeenCalledWith('Test todo with enter')
    })
  })

  it('can switch between todo and comment types in all filter mode', async () => {
    render(
      <ExpressionInput
        options={mockOptions}
        data={mockData}
        setData={mockSetData}
        expression={mockExpression}
        currentFilter="all"
      />
    )

    const typeSelector = screen.getByRole('combobox')

    // Initially should be set to todo
    expect(screen.getByText('Add Todo')).toBeInTheDocument()

    // Change to comments - open the select
    fireEvent.click(typeSelector)
    
    // Wait for the dropdown to open and click on Comment option
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Comment' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('option', { name: 'Comment' }))

    // Now should show comment UI
    await waitFor(() => {
      expect(screen.getByText('Add Comment')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument()
    })

    // Type and submit a comment
    const commentInput = screen.getByPlaceholderText('Add a comment...')
    fireEvent.change(commentInput, { target: { value: 'Test comment from all filter' } })
    fireEvent.click(screen.getByText('Add Comment'))

    await waitFor(() => {
      expect(mockExpression.addComment).toHaveBeenCalledWith('Test comment from all filter')
    })
  })
})