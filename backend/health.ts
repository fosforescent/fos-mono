import { Request, Response } from 'express'

export const getHealthCheck = async (req: Request, res: Response) => {
  return res.status(200).json({
    routes: ['/', '/register', '/login', '/user_profile'],
    routes_info: {
      '/': 'GET this route',
      '/register': 'POST register a user with username and password',
      '/login': 'POST login with the credentials used for registering',
      '/user_profile': 'GET, POST view or update your user profile with the token received from /login',
      '/suggestion': 'GET, proxy for open AI chatGPT api'
    }
  })
}
