import { Request, Response, NextFunction } from 'express'

import { slowDown } from 'express-slow-down'

// Define a variable to track the number of requests
let requestCount = 0

// Middleware to cancel requests beyond a certain point
export const maxRequests = (numRequests: number) => (req: Request, res: Response, next: NextFunction) => {
  requestCount++
  const MAX_REQUESTS = numRequests // Define your maximum allowed requests here
  if (requestCount > MAX_REQUESTS) {
    setTimeout(() => {
      requestCount = 0
    }, 5 * 60 * 1000)
    return res.status(429).send('Too Many Requests')
  } else {
    const slow = slowDown({
      windowMs: 10 * 60 * 1000, // 15 minutes,
      delayAfter: 100, // allow 100 requests per 15 minutes, then...
      delayMs: (used) => (used) ** 1.3 * 500 // begin adding 500ms of delay per request above 100:
    })
    return slow(req, res, next)
  }
}
