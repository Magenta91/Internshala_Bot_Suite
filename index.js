#!/usr/bin/env node

import { program } from 'commander';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
import { InternshalaBot } from './src/bot.js';
import { MCPServer } from './src/mcp.js';

dotenv.config();

const bot = new InternshalaBot();
const mcpServer = new MCPServer(bot);

program
  .name('internshala-chat-bot')
  .description('Automated Internshala chat with MCP integration')
  .version('1.0.0');

program
  .command('start')
  .description('Start the chat automation')
  .option('-h, --headful', 'Run browser in visible mode')
  .option('-c, --conversation <id>', 'Target conversation ID')
  .action(async (options) => {
    try {
      logger.info('Starting Internshala Chat Bot...');
      
      await bot.initialize(options.headful);
      await bot.login();
      
      if (options.conversation) {
        await bot.navigateToChat(options.conversation);
        await bot.startListening();
      }
      
      // Start MCP server
      mcpServer.start();
      
      logger.info('Bot is ready! Use MCP tools to interact with chats.');
      
    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  });

program
  .command('fetch-history')
  .description('Fetch chat history for a conversation')
  .requiredOption('-c, --conversation <id>', 'Conversation ID')
  .action(async (options) => {
    try {
      await bot.initialize();
      await bot.login();
      const history = await bot.fetchHistory(options.conversation);
      console.log(JSON.stringify(history, null, 2));
    } catch (error) {
      logger.error('Failed to fetch history:', error);
      process.exit(1);
    }
  });

program
  .command('send-message')
  .description('Send a message to a conversation')
  .requiredOption('-c, --conversation <id>', 'Conversation ID')
  .requiredOption('-m, --message <text>', 'Message text')
  .action(async (options) => {
    try {
      await bot.initialize();
      await bot.login();
      await bot.sendMessage(options.conversation, options.message);
      logger.info('Message sent successfully');
    } catch (error) {
      logger.error('Failed to send message:', error);
      process.exit(1);
    }
  });

// Default action
if (process.argv.length === 2) {
  program.parse(['node', 'index.js', 'start']);
} else {
  program.parse();
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await bot.cleanup();
  process.exit(0);
});