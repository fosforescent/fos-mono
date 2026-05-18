const { Client, GatewayIntentBits } = require('discord.js');
const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const express = require('express');
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
    new winston.transports.File({ filename: 'discord-service.log' })
  ]
});

const app = express();
const port = process.env.PORT || 3001;

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
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

async function sendToInboxQueue(message) {
  try {
    const command = new SendMessageCommand({
      QueueUrl: INBOX_QUEUE_URL,
      MessageBody: JSON.stringify({
        source: 'discord',
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

async function sendDiscordMessage(channelId, messageContent) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel) {
      const sentMessage = await channel.send(messageContent);
      logger.info('Discord message sent', { channelId, messageId: sentMessage.id });
      return sentMessage;
    } else {
      throw new Error(`Channel ${channelId} not found`);
    }
  } catch (error) {
    logger.error('Failed to send Discord message', { error: error.message, channelId });
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
          
          if (messageData.destination === 'discord') {
            await sendDiscordMessage(messageData.channelId, messageData.message);
            
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

client.once('ready', () => {
  logger.info(`Discord bot logged in as ${client.user.tag}`);
  
  setInterval(pollOutboxQueue, 5000);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  try {
    const incomingMessage = {
      id: message.id,
      author: {
        id: message.author.id,
        username: message.author.username,
        displayName: message.author.displayName
      },
      channel: {
        id: message.channel.id,
        name: message.channel.name,
        type: message.channel.type
      },
      guild: message.guild ? {
        id: message.guild.id,
        name: message.guild.name
      } : null,
      content: message.content,
      timestamp: message.createdTimestamp
    };
    
    await sendToInboxQueue(incomingMessage);
    logger.info('Discord message processed', { 
      messageId: message.id, 
      author: message.author.username,
      channel: message.channel.name 
    });
  } catch (error) {
    logger.error('Failed to process Discord message', { 
      error: error.message,
      messageId: message.id 
    });
  }
});

client.on('error', (error) => {
  logger.error('Discord client error', { error: error.message });
});

client.on('disconnect', () => {
  logger.warn('Discord client disconnected');
});

client.on('reconnecting', () => {
  logger.info('Discord client reconnecting');
});

app.get('/health', (req, res) => {
  const isReady = client.readyAt !== null;
  res.json({ 
    status: isReady ? 'healthy' : 'starting',
    service: 'discord-echo-service',
    botReady: isReady,
    botUser: client.user?.tag || null,
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  logger.info(`Discord echo service health endpoint listening on port ${port}`);
});

async function gracefulShutdown() {
  logger.info('Shutting down gracefully...');
  
  if (client) {
    await client.destroy();
    logger.info('Discord client destroyed');
  }
  
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

client.login(DISCORD_TOKEN).catch(error => {
  logger.error('Failed to login to Discord', { error: error.message });
  process.exit(1);
});