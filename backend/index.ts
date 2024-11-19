import express, { application } from 'express'

import { verifyJWTMiddleware } from './verifyJwt'
import { clientDetailsMiddleware } from './clientDetails'

import { postRegister, deleteAccount } from './auth/register'
import { postLogin } from './auth/login'
import { getVerifyJwt } from './auth/verifyJwt'
import { postConfirmEmail, postConfirmEmailInit } from './auth/confirmEmail'
import { postResetPwd, postResetPwdUpdate } from './auth/resetPwd'
import { postUpdatePwd } from './auth/updatePwd'
import { postCreatePortalSession } from './subscription/portalSession'
import { postCreateCheckoutSession } from './subscription/checkoutSession'
import { postSubscriptionWebhook } from './subscription/webhook'
import { postEmailWebhook } from './email/email'
import { getHealthCheck } from './health'
import { postUpdateEmail } from './auth/updateEmail'
import { checkUsernameExists } from './auth/checkUsername'
import { postContactMessage } from './email/contactMessage'

import { getUserData,  deleteUserData, postUserDataPartial } from './data'
import { getSuggest } from './suggest'

import { slowDown } from 'express-slow-down'

import cors from 'cors'

import { config } from 'dotenv'
import { getUserProfile, postUserProfile } from './user'
import { putError } from './error'
import { maxRequests } from './maxRequests'
// import { clientManagerMiddleware } from './clientManager'

import jwt from 'jsonwebtoken'
import bodyparser from 'body-parser'

const http = require('http');


var jsonParser = bodyparser.json()

config()


const app = express()


const stripeRoute = express.Router()


stripeRoute.use( slowDown({
  windowMs: 10 * 60 * 1000, // 15 minutes,
  delayAfter: 500, // allow 3 requests per 15 minutes, then...
  delayMs: (used) => (2 ** used) * 50 // begin adding 500ms of delay per request above 100:
}))
stripeRoute.use(express.raw({type: '*/*'}));



// const publicRoutes = express.Router();
const protectedRoutes = express.Router()
const dataRoutes = express.Router()

// Define your list of allowed origins
const allowedOrigins = [
  'localhost', 
  'fosforescent.com', 
  'fos-prod.pages.dev', 
  'www.fosforescent.com',
  "fos-mono.pages.dev",
  /^.*\.fosforescent\.com$/,
  /^.*\.fos-mono.pages\.dev$/,
  /^localhost\:[0-9]+$/,
  
]

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: any) => {
    if (allowedOrigins.find((item) => {
        const exactMatch = origin?.indexOf(item || '!@#$%^') !== -1
        const regexMatch = origin?.match(item)
        return exactMatch || regexMatch
      }) 
      || !origin
      || allowedOrigins.find((item) => origin.match(item))
    ) {
      callback(null, true)
    } else {
      console.log('origin', origin, allowedOrigins)
      callback(new Error('Not allowed by CORS'))
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Specify allowed methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Explicitly require Authorization header
  credentials: true // This might be necessary depending on your auth method
}

// Enable CORS with the above options
app.use(cors(corsOptions))
app.set('trust proxy', '10.244.0.96');
app.set('trust proxy', '10.124.0.3');
// Handle preflight requests for all routes
app.options('*', cors(corsOptions)) // Respond to preflight requests

stripeRoute.post('/', postSubscriptionWebhook)

app.use('/subscription/webhook', stripeRoute)

// protectedRoutes.use(express.json());
// dataRoutes.use(express.json());
app.use(express.json())

protectedRoutes.use((req, res, next) => {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
      console.log(`X-Forwarded-For: ${xForwardedFor}`); // Log the IP addresses
  } else {
      console.log(`Direct access, no forwarding IP`);
  }
  next();
});


protectedRoutes.use(clientDetailsMiddleware)

app.get('/', getHealthCheck)
app.post('/auth/register', slowDown({
  windowMs: 10 * 60 * 1000, // 15 minutes,
  delayAfter: 1, // allow 3 requests per 15 minutes, then...
  delayMs: (used) => (3 ** used) * 500 // begin adding 500ms of delay per request above 100:
}), postRegister)
app.post('/auth/login', slowDown({
  windowMs: 10 * 60 * 1000, // 15 minutes,
  delayAfter: 3, // allow 3 requests per 15 minutes, then...
  delayMs: (used) => (2 ** used) * 500 // begin adding 500ms of delay per request above 100:
}), postLogin)
app.post('/auth/reset-pwd', slowDown({
  windowMs: 10 * 60 * 1000, // 15 minutes,
  delayAfter: 1, // allow 3 requests per 15 minutes, then...
  delayMs: (used) => (3 ** used) * 500 // begin adding 500ms of delay per request above 100:
}), postResetPwd)
app.post('/auth/reset-pwd-update', slowDown({
  windowMs: 10 * 60 * 1000, // 15 minutes,
  delayAfter: 1, // allow 3 requests per 15 minutes, then...
  delayMs: (used) => (3 ** used) * 500 // begin adding 500ms of delay per request above 100:
}), postResetPwdUpdate)
// TODO: add middleware to reject requests from non-stripe IPs

// TODO add middleware to reject requests from non-postmarkapp IPs
app.post('/email/webhook', slowDown({
  windowMs: 10 * 60 * 1000, // 15 minutes,
  delayAfter: 500, // allow 3 requests per 15 minutes, then...
  delayMs: (used) => (2 ** used) * 50 // begin adding 500ms of delay per request above 100:
}), postEmailWebhook)
app.post('/email/contact-message', slowDown({
  windowMs: 10 * 60 * 1000, // 15 minutes,
  delayAfter: 1, // allow 3 requests per 15 minutes, then...
  delayMs: (used) => (3 ** used) * 500 // begin adding 500ms of delay per request above 100:
}), postContactMessage)
app.post('/auth/check-username', slowDown({
  windowMs: 10 * 60 * 1000, // 15 minutes,
  delayAfter: 500, // allow 3 requests per 15 minutes, then...
  delayMs: (used) => (2 ** used) * 50 // begin adding 500ms of delay per request above 100:
}), checkUsernameExists)
app.put('/error', maxRequests(10), putError)

dataRoutes.use(verifyJWTMiddleware)
// dataRoutes.use(clientManagerMiddleware)
dataRoutes.post('/', slowDown({
  windowMs: 1 * 60 * 1000, // 1 minute,
  delayAfter: 100, // allow 100 requests per 1 minute, then...
  delayMs: (used) => 1.5 ** (used - 100) // begin adding 500ms of delay per request above 100:
}), postUserDataPartial)

// dataRoutes.use(clientManagerMiddleware)
dataRoutes.get('/', slowDown({
  windowMs: 1 * 60 * 1000, // 1 minute,
  delayAfter: 100, // allow 100 requests per 1 minute, then...
  delayMs: (used) => 1.5 ** (used - 100) // begin adding 500ms of delay per request above 100:
}), getUserData)


protectedRoutes.use(slowDown({
  windowMs: 10 * 60 * 1000, // 15 minutes,
  delayAfter: 100, // allow 100 requests per 15 minutes, then...
  delayMs: (used) => (used) ** 1.3 * 500 // begin adding 500ms of delay per request above 100:
}))

// Protected routes
protectedRoutes.use(verifyJWTMiddleware)

protectedRoutes.get('/auth/verify-jwt', getVerifyJwt)
protectedRoutes.post('/auth/confirm-email-init', postConfirmEmailInit)
protectedRoutes.post('/auth/confirm-email', postConfirmEmail)
protectedRoutes.post('/auth/update-password', postUpdatePwd)
protectedRoutes.post('/auth/update-email', postUpdateEmail)

protectedRoutes.post('/subscription/connect-session',postCreateOrGetConnectAccount)
protectedRoutes.post('/subscription/checkout-session', postCreateCheckoutSession)
protectedRoutes.post('/subscription/portal-session', postCreatePortalSession)
protectedRoutes.get('/user/profile', getUserProfile)
protectedRoutes.post('/user/profile', postUserProfile)
protectedRoutes.delete('/user', deleteAccount)

// protectedRoutes.get('/user/data', getUserData)
// protectedRoutes.delete('/user/data', deleteUserData)
// protectedRoutes.delete('/user', deleteAccount)

dataRoutes.post('/suggest', getSuggest)

// dataRoutes.get('/data/events', clientManagerMiddleware, getDataSSEvents)

app.use('/user/data', dataRoutes)
app.use('/', protectedRoutes)



const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  console.error('JWT_SECRET not set')
  throw new Error('JWT_SECRET not set')
}

import {prisma} from './prismaClient'
import { attachWs } from './ws'
import { postCreateOrGetConnectAccount } from './subscription/connectSession'


export interface Claims {
  username: string;
  exp: number;
  // Add other properties as needed
}



const server = http.createServer(app);


attachWs(server)

// Start the server
const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/{jwt}`);
});


// Also mount the app here
// server.on('request', app);

// const port = process.env.PORT || 80
// app.listen(port, () => {
//   console.log(`Server running on http://localhost:${port}`)
// })


// // Your Socket.IO code here, e.g., handling connections
// io.on('connection', (socket: Socket ) => {
//   console.log('a user connected:', socket.id);

//   // Example event
//   socket.on('message', (msg) => {
//     console.log('message: ' + msg);
//   });
// });