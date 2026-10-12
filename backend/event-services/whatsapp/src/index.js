const express = require('express');
const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const axios = require('axios');
const winston = require('winston');
require('dotenv').config();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'whatsapp-service.log' })
  ]
});

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const INBOX_QUEUE_URL = process.env.INBOX_QUEUE_URL;
const OUTBOX_QUEUE_URL = process.env.OUTBOX_QUEUE_URL;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

async function sendToInboxQueue(message) {
  try {
    const command = new SendMessageCommand({
      QueueUrl: INBOX_QUEUE_URL,
      MessageBody: JSON.stringify({
        source: 'whatsapp',
        timestamp: new Date().toISOString(),
        data: message
      })
    });
    
    await sqsClient.send(command);
    logger.info('Message sent to inbox queue', { messageId: message.id });
  } catch (error) {
    logger.error('Failed to send message to inbox queue', { error: error.message });
    throw error;
  }
}

async function sendWhatsAppMessage(to, message) {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        text: { body: message }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    logger.info('WhatsApp message sent', { to, messageId: response.data.messages?.[0]?.id });
    return response.data;
  } catch (error) {
    logger.error('Failed to send WhatsApp message', { error: error.message, to });
    throw error;
  }
}

async function pollOutboxQueue() {
  try {
    const command = new ReceiveMessageCommand({
      QueueUrl: OUTBOX_QUEUE_URL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 10
    });
    
    const result = await sqsClient.send(command);
    
    if (result.Messages) {
      for (const message of result.Messages) {
        try {
          const messageData = JSON.parse(message.Body);
          
          if (messageData.destination === 'whatsapp') {
            await sendWhatsAppMessage(messageData.to, messageData.message);
            
            await sqsClient.send(new DeleteMessageCommand({
              QueueUrl: OUTBOX_QUEUE_URL,
              ReceiptHandle: message.ReceiptHandle
            }));
            
            logger.info('Processed outbox message', { messageId: message.MessageId });
          }
        } catch (error) {
          logger.error('Failed to process outbox message', { 
            error: error.message, 
            messageId: message.MessageId 
          });
        }
      }
    }
  } catch (error) {
    logger.error('Failed to poll outbox queue', { error: error.message });
  }
}

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    logger.info('Webhook verified');
    res.status(200).send(challenge);
  } else {
    logger.warn('Webhook verification failed');
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  try {
    logger.info('Received webhook', { body: req.body });
    
    const { entry } = req.body;
    
    if (entry) {
      for (const entryItem of entry) {
        const { changes } = entryItem;
        
        if (changes) {
          for (const change of changes) {
            if (change.field === 'messages') {
              const { messages } = change.value;
              
              if (messages) {
                for (const message of messages) {
                  if (message.type === 'text') {
                    const incomingMessage = {
                      id: message.id,
                      from: message.from,
                      text: message.text.body,
                      timestamp: message.timestamp
                    };
                    
                    await sendToInboxQueue(incomingMessage);
                  }
                }
              }
            }
          }
        }
      }
    }
    
    res.sendStatus(200);
  } catch (error) {
    logger.error('Webhook processing failed', { error: error.message });
    res.sendStatus(500);
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'whatsapp-echo-service',
    timestamp: new Date().toISOString()
  });
});

setInterval(pollOutboxQueue, 5000);

app.listen(port, () => {
  logger.info(`WhatsApp echo service listening on port ${port}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});