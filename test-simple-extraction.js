#!/usr/bin/env node

/**
 * Simple message extraction test
 */

import { InternshalaBot } from './src/bot.js';
import { logger } from './utils/logger.js';

async function testSimpleExtraction() {
  const bot = new InternshalaBot();
  
  try {
    console.log('🔍 Testing simple message extraction...');
    
    await bot.initialize(true); // Visible mode for debugging
    await bot.login();
    
    // Navigate to chat
    const conversationId = 'c-105388670';
    await bot.navigateToChat(conversationId);
    await bot.page.waitForTimeout(5000);
    
    console.log('📝 Extracting messages with simple approach...');
    
    // Simple extraction without complex timestamp parsing
    const messages = await bot.page.evaluate(() => {
      const messageElements = document.querySelectorAll('.message_inner');
      const extractedMessages = [];
      
      messageElements.forEach((el, index) => {
        const text = el.textContent?.trim();
        if (text && text.length > 0) {
          
          // Determine if it's sent or received
          const isSent = el.classList.contains('message_sender') || 
                        el.closest('.message_sender') ||
                        text.includes('You:');
          
          extractedMessages.push({
            id: `msg_${index}`,
            text: text,
            sender: isSent ? 'me' : 'other',
            timestamp: new Date().toISOString(), // Simple current timestamp
            type: isSent ? 'sent' : 'received',
            element_class: el.className,
            index: index
          });
        }
      });
      
      return extractedMessages;
    });
    
    console.log(`✅ Successfully extracted ${messages.length} messages!`);
    
    if (messages.length > 0) {
      console.log('\n📝 Extracted messages:');
      messages.forEach((msg, i) => {
        console.log(`  ${i + 1}. [${msg.type}] ${msg.text.substring(0, 100)}...`);
        console.log(`      Class: ${msg.element_class}`);
        console.log(`      Sender: ${msg.sender}`);
        console.log('');
      });
      
      // Try to export to CSV
      console.log('📊 Attempting CSV export...');
      try {
        const { CSVExporter } = await import('./src/csv-exporter.js');
        const csvExporter = new CSVExporter();
        
        const csvPath = await csvExporter.exportMessagesToCSV(messages, conversationId);
        if (csvPath) {
          console.log(`✅ Messages exported to: ${csvPath}`);
        }
      } catch (exportError) {
        console.log('❌ CSV export failed:', exportError.message);
      }
    }
    
    // Take screenshot
    await bot.page.screenshot({ path: './simple-extraction.png', fullPage: true });
    console.log('📸 Screenshot saved as simple-extraction.png');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    console.log('\n⏳ Keeping browser open for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    await bot.cleanup();
  }
}

testSimpleExtraction().catch(error => {
  console.error('Test script failed:', error);
  process.exit(1);
});