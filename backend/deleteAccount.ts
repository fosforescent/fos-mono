import { Request, Response, NextFunction } from 'express'
import axios from 'axios'
import {prisma} from './prismaClient'


export const deleteAccount = async (req: Request, res: Response): Promise<Response> => {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    return res.status(401).send('No auth header provided')
  }

  try {

    
      // delete from prisma
      const username = (res as any).user.username as string // Replace with actual logic to extract claims

      const user = await prisma.user.delete({
        where: { user_name: username }
      })

      const dataHistory = await prisma.dataHistory.deleteMany({
        where: { group_id: user.fosGroupId }
      })

      return res.status(200).send('Account deleted')
    
      
  } catch (error) {
    if ((error as any).response.status < 500 && (error as any).response.status >= 400) {
      console.error('Error deleting account', (error as any).response.statusText)
      return res.status(401).send((error as any).response.statusText)
    } else {
      console.error('Error deleting account', (error as any).message)
      console.log('error', error)
      return res.status(500).send('Error deleting account')
    }
  }
}
