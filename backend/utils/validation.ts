import { Request, Response } from 'express'

/**
 * Get a required parameter from request params and throw an error if missing
 */
export const getRequiredParam = (req: Request, paramName: string): string => {
  const value = req.params[paramName]
  if (!value) {
    throw new ValidationError(`${paramName} is required`)
  }
  return value
}

/**
 * Get a required parameter as an integer and throw an error if missing or invalid
 */
export const getRequiredParamAsInt = (req: Request, paramName: string): number => {
  const value = getRequiredParam(req, paramName)
  const parsed = parseInt(value)
  if (isNaN(parsed)) {
    throw new ValidationError(`${paramName} must be a valid number`)
  }
  return parsed
}

/**
 * Get an optional parameter from request params
 */
export const getOptionalParam = (req: Request, paramName: string): string | undefined => {
  return req.params[paramName]
}

/**
 * Get an optional parameter as an integer
 */
export const getOptionalParamAsInt = (req: Request, paramName: string): number | undefined => {
  const value = req.params[paramName]
  if (!value) return undefined
  const parsed = parseInt(value)
  if (isNaN(parsed)) {
    throw new ValidationError(`${paramName} must be a valid number`)
  }
  return parsed
}

/**
 * Custom validation error for parameter validation
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Middleware wrapper to handle validation errors and return proper HTTP responses
 */
export const withValidation = (handler: (req: Request, res: Response) => Promise<Response | void>) => {
  return async (req: Request, res: Response) => {
    try {
      return await handler(req, res)
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message })
      }
      // Re-throw other errors to be handled by existing error handlers
      throw error
    }
  }
}