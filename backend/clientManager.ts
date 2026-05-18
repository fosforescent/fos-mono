import { Request, Response, NextFunction } from 'express'

export type ReqWithClients = Request & { eventClient: ClientManager};



// const pingClient = async (req: Request) => {
//   setTimeout(() => {
//     console.log('pinging clients', Object.keys(req?.app?.locals?.eventClients || {}))
//     if (!req.closed){
//       Object.keys(req?.app?.locals?.eventClients || {}).forEach((user) => {
//         console.log('pinging client', user, req.app.locals.eventClients?.[user].clients.length)
          
//         req.app.locals.eventClients?.[user]?.sendEvent({
//           type: 'ping',
//           data: 'hello'
//         })
//       });
//       pingClient(req)
//     }
//   }, 30000)
// }




export const clientManagerMiddleware = async (req: Request, res: Response, next: NextFunction) => {

  const user = (req as any).claims.username;

  if (!req.app.locals.eventClients) {
      req.app.locals.eventClients = {};
  }

  if (!req.app.locals.eventClients[user]) {
    req.app.locals.eventClients[user] = new ClientManager();
  } else {
    req.app.locals.eventClients[user].addClient(res);
    // req.app.locals.eventClients[user].sendEvent({
    //   type: 'client connected',
    //   data: 'connect'
    // })
  }

  const reqWithClients = req as ReqWithClients;

  reqWithClients.eventClient = req.app.locals.eventClients[user];
  console.log('client connected', req.app.locals.eventClients, req.app.locals.eventClients[user].clients.length);

  // if(!req.closed){
  //   pingClient(reqWithClients)
  // }

  // Cleanup on client disconnect
  req.on('close', () => {
    req.app.locals.eventClients[user].removeClient(res);
    res.end();
  });

  return next();
}




class ClientManager {

  clients: Response[];

  constructor() {
      this.clients = [];
  }

  filterClients() {
      this.clients = this.clients.filter(client => !client.writableEnded && client.writable);
  }

  addClient(client: Response) {
    this.filterClients();
    this.clients.push(client);
  }

  removeClient(client: Response) {
    this.filterClients();
    this.clients = this.clients.filter(c => c !== client);
  }

  
  sendEvent(event: {
      type: string,
      data: any
  }) {
    console.log('sending event', event, this.clients.length);
    this.filterClients();
    this.clients.forEach(client => {
      if(!client.writableEnded && client.writable){
        client.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
      } else {
        console.log('removing client');
        this.removeClient(client);
      }
    });
  }

}


