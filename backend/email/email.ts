import { Request, Response } from 'express'
import { InboundEmail, OutboundEmail } from '@prisma/client'
import { randomBytes } from 'crypto'

import { Client as PostmarkClient } from 'postmark'
import { ClientDetails } from '../clientDetails'
import {prisma} from '../prismaClient'

const EMAIL_WEBHOOK_PASSWORD = process.env.EMAIL_WEBHOOK_PASSWORD

if (!EMAIL_WEBHOOK_PASSWORD) {
  console.error('EMAIL_WEBHOOK_PASSWORD not set')
  throw new Error('EMAIL_WEBHOOK_PASSWORD not set')
}

const POSTMARK_API_TOKEN = process.env.POSTMARK_API_TOKEN

if (!POSTMARK_API_TOKEN) {
  console.error('POSTMARK_API_TOKEN not set')
  throw new Error('POSTMARK_API_TOKEN not set')
}

const postmarkClient = new PostmarkClient(POSTMARK_API_TOKEN)


export const generateLinkToken = () => {
  return {
    token: randomBytes(48).toString('hex'),
    expiration: new Date(Date.now() + 3 * 60 * 60 * 1000) // 3 hours from now
  }
}

export const deliverEmail = async (outboundEmail: OutboundEmail) => {
  await postmarkClient.sendEmailWithTemplate({
    From: outboundEmail.from,
    To: outboundEmail.to,
    TemplateAlias: outboundEmail.templateAlias,
    TemplateModel: typeof outboundEmail.templateModel === 'object' ? outboundEmail.templateModel as object : { value: outboundEmail.templateModel }
  }, async (error, result) => {
    if (error) {
      console.error('Failed to send email:', error)
      await prisma.outboundDeliveryAttempt.create({
        data: {
          emailId: outboundEmail.id,
          status: 'fail',
          reason: error.message

        }
      })
    } else {
      console.log('Email sent:', result)
      await prisma.outboundDeliveryAttempt.create({
        data: {
          emailId: outboundEmail.id,
          status: 'success'
        }
      })
    }
  })
}

export const deliverInboundEmail = async (inboundEmail: InboundEmail) => {
  // Send to support email
  await postmarkClient.sendEmail({
    From: inboundEmail.from,
    To: 'dmn322@gmail.com',
    Subject: `Fos Inbound <${inboundEmail.to}>: ${inboundEmail.subject || 'Fos inbound email'}`,
    TextBody: inboundEmail.textBody || 'Fos inboud email body --- no text body'
  }, (error, result) => {
    if (error) {
      console.error('Failed to send email:', error)
    }
  })
}

export const sendConfirmationEmail = async (email: string, token: string, clientDetails: ClientDetails) => {
  // Send password reset email
  const actionUrl = `http://www.fosforescent.com/?confirm-email-token=${token}`

  const outboundEmail = await prisma.outboundEmail.create({
    data: {
      from: 'auth@fosforescent.com',
      to: email,
      templateAlias: 'email-confirmation',
      templateModel: {
        action_url: actionUrl,
        product_name: 'Fosforescent',
        name: email,
        operating_system: clientDetails?.os,
        browser_name: clientDetails?.browser,
        ip_address: clientDetails?.ipAddress
      }
    }
  })

  await deliverEmail(outboundEmail)
}

export const sendPasswordResetEmail = async (email: string, token: string, clientDetails: ClientDetails) => {
  // Send password reset email
  const actionUrl = `http://www.fosforescent.com/?reset-password-token=${token}`

  const outboundEmail = await prisma.outboundEmail.create({
    data: {
      from: 'auth@fosforescent.com',
      to: email,
      templateAlias: 'password-reset',
      templateModel: {
        action_url: actionUrl,
        product_name: 'Fosforescent',
        name: email,
        operating_system: clientDetails.os,
        browser_name: clientDetails.browser,
        ip_address: clientDetails.ipAddress
      }
    }
  })

  await deliverEmail(outboundEmail)
}

export const sendUpdatePasswordEmail = async (email: string, clientDetails: ClientDetails) => {
  // Send password reset email

  const outboundEmail = await prisma.outboundEmail.create({
    data: {
      from: 'auth@fosforescent.com',
      to: email,
      templateAlias: 'password-changed',
      templateModel: {
        product_name: 'Fosforescent',
        name: email,
        operating_system: clientDetails.os,
        browser_name: clientDetails.browser,
        ip_address: clientDetails.ipAddress
      }
    }
  })

  await deliverEmail(outboundEmail)
}

export const postEmailWebhook = async (req: Request, res: Response) => {
  const auth = { login: 'email_user', password: EMAIL_WEBHOOK_PASSWORD } // change this

  // parse login and password from headers
  const b64auth = (req.headers.authorization || '').split(' ')[1] || ''
  const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':')

  // Verify login and password are set and correct
  if (login && password && login === auth.login && password === auth.password) {

  } else {
    res.set('WWW-Authenticate', 'Basic realm="401"') // change this
    res.status(401).send('Authentication required.') // custom message
    return
  }

  const { From, To, Subject, TextBody, HtmlBody } = req.body

  try {
    const inboundEmail = await prisma.inboundEmail.create({
      data: {
        from: From,
        to: To,
        subject: Subject,
        textBody: TextBody,
        htmlBody: HtmlBody
      }
    })

    deliverInboundEmail(inboundEmail)

    res.status(201).json(inboundEmail)
  } catch (error) {
    console.error('Failed to save inbound email:', error)
    res.status(500).json({ message: 'Internal Server Error' })
  }
}
