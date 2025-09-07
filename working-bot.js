#!/usr/bin/env node

/**
 * Working Internshala Chat Bot - Production Ready
 */

import { InternshalaBot } from './src/bot.js';
import { CSVExporter } from './src/csv-exporter.js';
import { logger } from './utils/logger.js';

class WorkingInternshalaBot {
  constructor() {
    this.bot = new InternshalaBot();
    this.csvExporter = new CSVExporter();
  }

  async initialize() {
    await this.bot.initialize(false); // Headless mode
    await this.bot.login();
  }

  async extractAllChats() {
    console.log('🔍 Starting comprehensive chat extraction...');
    
    try {
      // Get list of conversations (you can expand this)
      const conversations = [
        'c-105388670', // Your working conversation
        // Add more conversation IDs as needed
      ];
      
      const allMessages = [];
      const allConversations = [];
      
      for (const conversationId of conversations) {
        console.log(`\n💬 Processing conversation: ${conversationId}`);
        
        try {
          await this.bot.navigateToChat(conversationId);
          await this.bot.page.waitForTimeout(3000);
          
          // Extract messages with our working approach
          const messages = await this.bot.page.evaluate((convId) => {
            const messageElements = document.querySelectorAll('.message_inner');
            const extractedMessages = [];
            
            messageElements.forEach((el, index) => {
              const text = el.textContent?.trim();
              if (text && text.length > 0) {
                
                const isSent = el.classList.contains('message_sender') || 
                              el.closest('.message_sender') ||
                              text.includes('You:');
                
                extractedMessages.push({
                  id: `${convId}_msg_${index}`,
                  conversation_id: convId,
                  text: text,
                  sender: isSent ? 'me' : 'other',
                  timestamp: new Date().toISOString(),
                  type: isSent ? 'sent' : 'received',
                  element_class: el.className,
                  index: index
                });
              }
            });
            
            return extractedMessages;
          }, conversationId);
          
          console.log(`✅ Extracted ${messages.length} messages from ${conversationId}`);
          allMessages.push(...messages);
          
          // Add conversation metadata
          allConversations.push({
            id: conversationId,
            message_count: messages.length,
            last_activity: new Date().toISOString(),
            status: 'extracted'
          });
          
        } catch (error) {
          console.log(`❌ Failed to extract from ${conversationId}:`, error.message);
          allConversations.push({
            id: conversationId,
            message_count: 0,
            last_activity: new Date().toISOString(),
            status: 'failed',
            error: error.message
          });
        }
      }
      
      console.log(`\n📊 Total extracted: ${allMessages.length} messages from ${conversations.length} conversations`);
      
      // Export to CSV
      if (allMessages.length > 0) {
        console.log('📁 Exporting to CSV...');
        
        const messagesPath = await this.csvExporter.exportMessagesToCSV(allMessages, 'all_conversations');
        const conversationsPath = await this.csvExporter.exportConversationsToCSV(allConversations);
        const statsPath = await this.csvExporter.exportChatStatistics(allMessages, 'all_conversations');
        
        console.log('\n✅ Export completed:');
        console.log(`   📝 Messages: ${messagesPath}`);
        console.log(`   💬 Conversations: ${conversationsPath}`);
        console.log(`   📊 Statistics: ${statsPath}`);
        
        // Show summary
        this.showSummary(allMessages, allConversations);
      }
      
      return { messages: allMessages, conversations: allConversations };
      
    } catch (error) {
      console.error('❌ Extraction failed:', error);
      throw error;
    }
  }

  showSummary(messages, conversations) {
    console.log('\n📈 EXTRACTION SUMMARY:');
    console.log('=' .repeat(50));
    
    const sentMessages = messages.filter(m => m.type === 'sent');
    const receivedMessages = messages.filter(m => m.type === 'received');
    const messagesWithLinks = messages.filter(m => m.text.includes('http'));
    
    console.log(`📊 Total Messages: ${messages.length}`);
    console.log(`📤 Sent by You: ${sentMessages.length}`);
    console.log(`📥 Received: ${receivedMessages.length}`);
    console.log(`🔗 With Links: ${messagesWithLinks.length}`);
    console.log(`💬 Conversations: ${conversations.length}`);
    
    // Show longest message
    const longestMessage = messages.reduce((longest, current) => 
      current.text.length > longest.text.length ? current : longest, messages[0]);
    
    if (longestMessage) {
      console.log(`\n📝 Longest Message (${longestMessage.text.length} chars):`);
      console.log(`   "${longestMessage.text.substring(0, 100)}..."`);
    }
    
    // Show recent activity
    console.log(`\n⏰ Recent Activity:`);
    messages.slice(-3).forEach((msg, i) => {
      const preview = msg.text.substring(0, 60);
      console.log(`   ${i + 1}. [${msg.type}] ${preview}...`);
    });
  }

  async cleanup() {
    await this.bot.cleanup();
  }
}

// Main execution
async function main() {
  const workingBot = new WorkingInternshalaBot();
  
  try {
    console.log('🚀 Starting Working Internshala Bot...');
    
    await workingBot.initialize();
    console.log('✅ Bot initialized successfully');
    
    const results = await workingBot.extractAllChats();
    
    console.log('\n🎉 Bot completed successfully!');
    console.log('📁 Check the ./exports/ folder for your CSV files');
    
  } catch (error) {
    console.error('❌ Bot failed:', error);
    process.exit(1);
  } finally {
    await workingBot.cleanup();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { WorkingInternshalaBot };