import { logger } from '../utils/logger.js';

export class ChatManager {
  constructor() {
    this.messageSelectors = [
      '.message_container .message',
      '.message_inner',
      '.text-message',
      '.message_history_element',
      '.message_receiver',
      '.message_sender',
      '.chat_element .message',
      '.message-item',
      '.chat-message', 
      '.message-bubble',
      '.conversation-message',
      '.msg-item',
      '.message',
      '.chat-msg',
      '.msg',
      '.message-row',
      '.chat-bubble',
      '[class*="message"]',
      '[class*="msg"]',
      '[class*="chat-"]',
      '.message-content'
    ];
    
    this.inputSelectors = [
      '#message-input',
      '.message-input',
      'textarea[placeholder*="message"]',
      'input[placeholder*="message"]',
      '.chat-input textarea',
      '.compose-message textarea'
    ];
    
    this.sendButtonSelectors = [
      '.send-btn',
      '.send-button',
      'button[type="submit"]',
      '.message-send',
      '.chat-send'
    ];
  }

  async fetchChatHistory(page, stealth) {
    logger.info('Fetching chat history...');
    
    try {
      // Wait for chat container to load - updated selectors for current Internshala
      const chatSelectors = [
        '.message_container',
        '.chat_element_container', 
        '.message_history_element',
        '.chat_box',
        '.chat_message_flex',
        '.message',
        '.message_inner',
        '.chat-container',
        '.messages-container', 
        '.conversation-container',
        '.chat-messages',
        '.message-list',
        '.chat-content',
        '.conversation-messages',
        '#chat-messages',
        '.chat-window',
        '.messages-wrapper'
      ];
      
      let chatContainer = null;
      for (const selector of chatSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          chatContainer = selector;
          logger.info(`Found chat container with selector: ${selector}`);
          break;
        } catch (error) {
          // Try next selector
        }
      }
      
      if (!chatContainer) {
        // Fallback: wait for any element that might contain messages
        logger.info('Trying fallback selectors...');
        try {
          await page.waitForSelector('body', { timeout: 5000 });
          await stealth.randomDelay(3000, 5000); // Give more time for dynamic content
          
          // Check if we're on a chat page by looking for message-related elements
          const hasMessages = await page.evaluate(() => {
            const possibleSelectors = [
              '[class*="message"]',
              '[class*="chat"]', 
              '[class*="conversation"]',
              '[id*="message"]',
              '[id*="chat"]'
            ];
            
            for (const selector of possibleSelectors) {
              if (document.querySelector(selector)) {
                return true;
              }
            }
            return false;
          });
          
          if (!hasMessages) {
            throw new Error('No chat elements found on page. Make sure you are on a valid chat conversation page.');
          }
          
        } catch (error) {
          throw new Error(`Could not find chat container. Available selectors tried: ${chatSelectors.join(', ')}`);
        }
      } else {
        await stealth.randomDelay(2000, 3000);
      }
      
      // Scroll to load more messages
      await this.scrollToLoadHistory(page, stealth);
      
      // Extract messages
      const messages = await this.extractMessages(page);
      
      logger.info(`Extracted ${messages.length} messages from chat history`);
      return messages;
      
    } catch (error) {
      logger.error('Failed to fetch chat history:', error);
      throw error;
    }
  }

  async scrollToLoadHistory(page, stealth) {
    logger.info('Scrolling to load chat history...');
    
    const maxScrollAttempts = 10;
    let scrollAttempt = 0;
    let previousMessageCount = 0;
    
    while (scrollAttempt < maxScrollAttempts) {
      // Get current message count
      const currentMessageCount = await this.getMessageCount(page);
      
      if (currentMessageCount === previousMessageCount && scrollAttempt > 2) {
        logger.info('No new messages loaded, stopping scroll');
        break;
      }
      
      // Scroll to top to load older messages
      await page.evaluate(() => {
        const chatContainer = document.querySelector('.chat-container, .messages-container, .conversation-container');
        if (chatContainer) {
          chatContainer.scrollTop = 0;
        } else {
          window.scrollTo(0, 0);
        }
      });
      
      await stealth.randomDelay(1500, 2500);
      
      // Check for loading indicators
      const loadingIndicator = await page.$('.loading, .spinner, .chat-loading');
      if (loadingIndicator) {
        await page.waitForSelector('.loading, .spinner, .chat-loading', { 
          state: 'hidden', 
          timeout: 5000 
        }).catch(() => {});
      }
      
      previousMessageCount = currentMessageCount;
      scrollAttempt++;
    }
  }

  async getMessageCount(page) {
    let count = 0;
    
    for (const selector of this.messageSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > count) {
          count = elements.length;
        }
      } catch (error) {
        // Continue with next selector
      }
    }
    
    return count;
  }

  async extractMessages(page) {
    const messages = [];
    
    // Try different message selectors
    for (const selector of this.messageSelectors) {
      try {
        const messageElements = await page.$$(selector);
        
        if (messageElements.length > 0) {
          logger.info(`Found ${messageElements.length} messages with selector: ${selector}`);
          
          for (let i = 0; i < messageElements.length; i++) {
            const element = messageElements[i];
            const message = await this.extractMessageData(page, element, i);
            
            if (message && message.text) {
              messages.push(message);
            }
          }
          
          break; // Use the first selector that finds messages
        }
      } catch (error) {
        logger.debug(`Failed to extract with selector ${selector}:`, error.message);
      }
    }
    
    // Sort messages by timestamp
    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Remove duplicates based on text and timestamp
    const uniqueMessages = messages.filter((message, index, array) => {
      return index === array.findIndex(m => 
        m.text === message.text && 
        Math.abs(new Date(m.timestamp) - new Date(message.timestamp)) < 1000
      );
    });
    
    return uniqueMessages;
  }

  async extractMessageData(page, element, index) {
    try {
      const messageData = await element.evaluate((el, idx) => {
        // Extract text content
        const textElement = el.querySelector('.message-text, .msg-text, .text-content') || el;
        const text = textElement.textContent?.trim();
        
        if (!text) return null;
        
        // Determine sender
        const isOwnMessage = el.classList.contains('own-message') || 
                           el.classList.contains('sent') ||
                           el.classList.contains('outgoing') ||
                           el.classList.contains('message_sender') ||
                           el.closest('.own-message, .sent, .outgoing, .message_sender');
        
        // Extract timestamp
        const timeElement = el.querySelector('.timestamp, .time, .message-time, .msg-time');
        let timestamp = timeElement?.textContent?.trim() || 
                       el.getAttribute('data-time') ||
                       el.getAttribute('timestamp');
        
        // If no timestamp found, use current time with offset
        if (!timestamp) {
          const now = new Date();
          now.setMinutes(now.getMinutes() - idx);
          timestamp = now.toISOString();
        } else {
          // Try to create a valid timestamp
          try {
            // If it's already a valid ISO string, keep it
            if (timestamp.includes('T') && timestamp.includes('Z')) {
              // Validate it's a proper date
              const testDate = new Date(timestamp);
              if (isNaN(testDate.getTime())) {
                throw new Error('Invalid date');
              }
            } else {
              // For relative timestamps like "2 hours ago" or "12:47 AM"
              const now = new Date();
              now.setMinutes(now.getMinutes() - idx);
              timestamp = now.toISOString();
            }
          } catch (error) {
            // Fallback to current time with offset
            const now = new Date();
            now.setMinutes(now.getMinutes() - idx);
            timestamp = now.toISOString();
          }
        }
        
        // Extract sender name
        const senderElement = el.querySelector('.sender-name, .msg-sender, .author');
        const sender = senderElement?.textContent?.trim() || (isOwnMessage ? 'me' : 'other');
        
        // Extract message ID
        const messageId = el.getAttribute('data-id') || 
                         el.getAttribute('id') || 
                         `msg_${Date.now()}_${idx}`;
        
        return {
          id: messageId,
          text: text,
          sender: sender,
          timestamp: timestamp,
          type: isOwnMessage ? 'sent' : 'received',
          element_class: el.className
        };
        
        function parseTimestamp(timeStr) {
          const now = new Date();
          
          // Handle relative timestamps
          if (timeStr.includes('ago')) {
            const match = timeStr.match(/(\\d+)\\s*(minute|hour|day|week)s?\\s*ago/i);
            if (match) {
              const value = parseInt(match[1]);
              const unit = match[2].toLowerCase();
              
              switch (unit) {
                case 'minute':
                  now.setMinutes(now.getMinutes() - value);
                  break;
                case 'hour':
                  now.setHours(now.getHours() - value);
                  break;
                case 'day':
                  now.setDate(now.getDate() - value);
                  break;
                case 'week':
                  now.setDate(now.getDate() - (value * 7));
                  break;
              }
              return now.toISOString();
            }
          }
          
          // Try to parse as date
          const parsed = new Date(timeStr);
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString();
          }
          
          // Default to current time
          return now.toISOString();
        }
        
      }, element, index);
      
      return messageData;
      
    } catch (error) {
      logger.debug(`Failed to extract message data:`, error);
      return null;
    }
  }

  async sendMessage(page, messageText, stealth) {
    logger.info(`Sending message: "${messageText.substring(0, 50)}..."`);
    
    try {
      // Find message input
      let messageInput = null;
      for (const selector of this.inputSelectors) {
        messageInput = await page.$(selector);
        if (messageInput) {
          logger.debug(`Found input with selector: ${selector}`);
          break;
        }
      }
      
      if (!messageInput) {
        throw new Error('Could not find message input field');
      }
      
      // Clear existing text and type new message
      await messageInput.click();
      await stealth.randomDelay(200, 500);
      
      await page.keyboard.press('Control+A');
      await stealth.randomDelay(100, 200);
      
      await stealth.humanType(page, messageInput, messageText);
      await stealth.randomDelay(500, 1000);
      
      // Send message
      await this.sendMessageAction(page, stealth);
      
      logger.info('Message sent successfully');
      
    } catch (error) {
      logger.error('Failed to send message:', error);
      throw error;
    }
  }

  async sendMessageAction(page, stealth) {
    // Try to find and click send button
    let sendButton = null;
    for (const selector of this.sendButtonSelectors) {
      sendButton = await page.$(selector);
      if (sendButton) {
        await stealth.humanClick(page, sendButton);
        return;
      }
    }
    
    // If no send button found, try Enter key
    logger.debug('No send button found, trying Enter key');
    await page.keyboard.press('Enter');
    await stealth.randomDelay(500, 1000);
  }

  async startLiveListener(page, conversationId, storage, isListeningCallback) {
    logger.info('Starting live message listener...');
    
    try {
      // Set up mutation observer for new messages
      await page.evaluate((selectors) => {
        window.messageObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // Check if it's a message element
                const isMessage = selectors.some(selector => {
                  return node.matches && node.matches(selector);
                });
                
                if (isMessage) {
                  // Mark as new message for processing
                  node.setAttribute('data-new-message', 'true');
                  
                  // Dispatch custom event
                  window.dispatchEvent(new CustomEvent('newMessage', {
                    detail: { element: node }
                  }));
                }
              }
            });
          });
        });
        
        // Start observing
        const chatContainer = document.querySelector('.chat-container, .messages-container, .conversation-container') || document.body;
        window.messageObserver.observe(chatContainer, {
          childList: true,
          subtree: true
        });
        
      }, this.messageSelectors);
      
      // Listen for new messages
      while (isListeningCallback()) {
        try {
          // Check for new messages
          const newMessages = await page.$$('[data-new-message="true"]');
          
          for (const element of newMessages) {
            const messageData = await this.extractMessageData(page, element, 0);
            
            if (messageData && messageData.sender !== 'me') {
              logger.info(`New message received: "${messageData.text.substring(0, 50)}..."`);
              
              // Save to storage
              if (conversationId) {
                await storage.appendMessage(conversationId, messageData);
              }
              
              // Remove the marker
              await page.evaluate(el => el.removeAttribute('data-new-message'), element);
            }
          }
          
          // Wait before next check
          await stealth.randomDelay(1000, 2000);
          
        } catch (error) {
          logger.error('Error in live listener:', error);
          await stealth.randomDelay(5000, 10000);
        }
      }
      
    } catch (error) {
      logger.error('Failed to start live listener:', error);
      throw error;
    } finally {
      // Clean up observer
      await page.evaluate(() => {
        if (window.messageObserver) {
          window.messageObserver.disconnect();
          delete window.messageObserver;
        }
      }).catch(() => {});
    }
  }
}