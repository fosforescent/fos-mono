import { Request, Response } from 'express'

export const getVerifyJwt = async (req: Request, res: Response) => {
  const claims = (req as any).claims
  console.log('claims', claims)
  return res.json(claims)
}
