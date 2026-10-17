import { Request, Response } from 'express'
import { InboundEmailModel, OutboundEmailModel } from '@prisma/client'
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
/** Where emailed links point: the web app (Cloudflare Pages in production). */
const WEB_URL = (process.env.WEB_URL ?? process.env.FRONTEND_URL ?? 'https://fosforescent.com').replace(/\/$/, '')


export const generateLinkToken = () => {
  return {
    token: randomBytes(48).toString('hex'),
    expiration: new Date(Date.now() + 3 * 60 * 60 * 1000) // 3 hours from now
  }
}

export const deliverEmail = async (outboundEmail: OutboundEmailModel) => {
  await postmarkClient.sendEmailWithTemplate({
    From: outboundEmail.from,
    To: outboundEmail.to,
    TemplateAlias: outboundEmail.templateAlias,
    TemplateModel: typeof outboundEmail.templateModel === 'object' ? outboundEmail.templateModel as object : { value: outboundEmail.templateModel }
  }, async (error, result) => {
    if (error) {
      console.error('Failed to send email:', error)
      await prisma.outboundDeliveryAttemptModel.create({
        data: {
          emailId: outboundEmail.id,
          status: 'fail',
          reason: error.message

        }
      })
    } else {
      console.log('Email sent:', result)
      await prisma.outboundDeliveryAttemptModel.create({
        data: {
          emailId: outboundEmail.id,
          status: 'success'
        }
      })
    }
  })
}

export const deliverInboundEmail = async (inboundEmail: InboundEmailModel) => {
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

/**
 * The account confirmation code, as a plain email (no Postmark template to keep in step): the six digits to type into
 * the app, and the link that confirms in one click. Recorded as an outbound email like the templated ones.
 */
export const sendConfirmationCodeEmail = async (email: string, code: string, actionUrl: string) => {
  const outboundEmail = await prisma.outboundEmailModel.create({
    data: { from: 'auth@fosforescent.com', to: email, templateAlias: 'confirmation-code', templateModel: { action_url: actionUrl, product_name: 'Fosforescent', name: email } }
  })
  const text = `Your Fosforescent confirmation code is ${code}\n\nEnter it in the app, or open this link to confirm in one step:\n${actionUrl}\n\nThe code expires in 15 minutes. If you did not create a Fosforescent account, ignore this message.`
  const html = `<p>Your Fosforescent confirmation code is</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;font-family:ui-monospace,monospace">${code}</p><p>Enter it in the app, or <a href="${actionUrl}">confirm in one step</a>.</p><p style="color:#667">The code expires in 15 minutes. If you did not create a Fosforescent account, ignore this message.</p>`
  try {
    await postmarkClient.sendEmail({ From: 'auth@fosforescent.com', To: email, Subject: `${code} is your Fosforescent confirmation code`, TextBody: text, HtmlBody: html, MessageStream: 'outbound' })
    await prisma.outboundDeliveryAttemptModel.create({ data: { emailId: outboundEmail.id, status: 'success' } })
  } catch (error) {
    await prisma.outboundDeliveryAttemptModel.create({ data: { emailId: outboundEmail.id, status: 'fail', reason: error instanceof Error ? error.message : String(error) } })
    throw error
  }
}

/** From address for mail the account server sends on a user's behalf (`-mail` requirements). */
const MAIL_FROM = process.env.EMAIL_FROM ?? 'auth@fosforescent.com'
/**
 * A plain email the fos `mail` handler sends for a `-mail` requirement: recorded as an outbound email with its
 * delivery attempt, like the templated ones. Throws when Postmark refuses it, so the requirement stays open.
 */
export const sendPlainEmail = async (to: string, subject: string, text: string, onBehalfOf: string) => {
  const outboundEmail = await prisma.outboundEmailModel.create({ data: { from: MAIL_FROM, to, templateAlias: 'plain', templateModel: { subject, text, onBehalfOf } } })
  try {
    await postmarkClient.sendEmail({ From: MAIL_FROM, To: to, Subject: subject, TextBody: `${text}\n\n— sent through Fosforescent on behalf of @${onBehalfOf}`, MessageStream: 'outbound' })
    await prisma.outboundDeliveryAttemptModel.create({ data: { emailId: outboundEmail.id, status: 'success' } })
  } catch (error) {
    await prisma.outboundDeliveryAttemptModel.create({ data: { emailId: outboundEmail.id, status: 'fail', reason: error instanceof Error ? error.message : String(error) } })
    throw error
  }
}

export const sendConfirmationEmail = async (email: string, token: string, clientDetails: ClientDetails) => {
  // Send password reset email
  const actionUrl = `${WEB_URL}/?confirm-email-token=${token}`

  const outboundEmail = await prisma.outboundEmailModel.create({
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
  const actionUrl = `${WEB_URL}/?reset-password-token=${token}`

  const outboundEmail = await prisma.outboundEmailModel.create({
    data: {
      from: 'auth@fosforescent.com',
      to: email,
      templateAlias: 'password-reset',
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

export const sendUpdatePasswordEmail = async (email: string, clientDetails: ClientDetails) => {
  // Send password reset email

  const outboundEmail = await prisma.outboundEmailModel.create({
    data: {
      from: 'auth@fosforescent.com',
      to: email,
      templateAlias: 'password-changed',
      templateModel: {
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
    const inboundEmail = await prisma.inboundEmailModel.create({
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
