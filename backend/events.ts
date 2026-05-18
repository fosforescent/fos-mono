import { Request, Response } from 'express'
import { ReqWithClients } from './clientManager';

export const getDataSSEvents = async (req: Request, res: Response) => {

  const reqWithClients = req as ReqWithClients;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Add client using the middleware-modified req object
  reqWithClients.eventClient.addClient(res);

}