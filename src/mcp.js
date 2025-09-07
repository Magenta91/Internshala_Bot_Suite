import { logger } from '../utils/logger.js';

export class MCPServer {
  constructor(bot) {
    this.bot = bot;
    this.tools = this.initializeTools();
  }

  initializeTools() {
    return {
      fetch_history: {
        name: 'fetch_history',
        description: 'Fetch chat history for a specific conversation',
        inputSchema: {
          type: 'object',
          properties: {
            conversation_id: {
              type: 'string',
              description: 'The ID of the conversation to fetch history for'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of messages to return (optional)',
              default: 100
            }
          },
          required: ['conversation_id']
        },
        handler: this.fetchHistory.bind(this)
      },

      listen_live: {
        name: 'listen_live',
        description: 'Start listening for live messages in a conversation',
        inputSchema: {
          type: 'object',
          properties: {
            conversation_id: {
              type: 'string',
              description: 'The ID of the conversation to listen to'
            },
            duration: {
              type: 'number',
              description: 'How long to listen in seconds (optional)',
              default: 300
            }
          },
          required: ['conversation_id']
        },
        handler: this.listenLive.bind(this)
      },

      send_message: {
        name: 'send_message',
        description: 'Send a message to a specific conversation',
        inputSchema: {
          type: 'object',
          properties: {
            conversation_id: {
              type: 'string',
              description: 'The ID of the conversation to send message to'
            },
            message: {
              type: 'string',
              description: 'The message text to send'
            }
          },
          required: ['conversation_id', 'message']
        },
        handler: this.sendMessage.bind(this)
      },

      get_conversations: {
        name: 'get_conversations',
        description: 'Get list of available conversations',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of conversations to return',
              default: 20
            }
          }
        },
        handler: this.getConversations.bind(this)
      },

      search_messages: {
        name: 'search_messages',
        description: 'Search for messages containing specific text',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Text to search for in messages'
            },
            conversation_id: {
              type: 'string',
              description: 'Limit search to specific conversation (optional)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
              default: 50
            }
          },
          required: ['query']
        },
        handler: this.searchMessages.bind(this)
      },

      get_bot_status: {
        name: 'get_bot_status',
        description: 'Get current status and statistics of the bot',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        handler: this.getBotStatus.bind(this)
      }
    };
  }

  async fetchHistory(params) {
    try {
      logger.info(`MCP: Fetching history for conversation ${params.conversation_id}`);
      
      const history = await this.bot.fetchHistory(params.conversation_id);
      
      // Apply limit if specified
      const limitedHistory = params.limit ? history.slice(-params.limit) : history;
      
      return {
        success: true,
        data: {
          conversation_id: params.conversation_id,
          messages: limitedHistory,
          total_count: limitedHistory.length,
          fetched_at: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('MCP: Failed to fetch history:', error);
      return {
        success: false,
        error: error.message,
        conversation_id: params.conversation_id
      };
    }
  }

  async listenLive(params) {
    try {
      logger.info(`MCP: Starting live listener for conversation ${params.conversation_id}`);
      
      // Start listening in background
      const listenPromise = this.bot.startListening(params.conversation_id);
      
      // Set timeout if duration specified
      if (params.duration) {
        setTimeout(() => {
          this.bot.stopListening();
          logger.info(`MCP: Stopped listening after ${params.duration} seconds`);
        }, params.duration * 1000);
      }
      
      return {
        success: true,
        data: {
          conversation_id: params.conversation_id,
          status: 'listening',
          duration: params.duration || 'indefinite',
          started_at: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('MCP: Failed to start live listener:', error);
      return {
        success: false,
        error: error.message,
        conversation_id: params.conversation_id
      };
    }
  }

  async sendMessage(params) {
    try {
      logger.info(`MCP: Sending message to conversation ${params.conversation_id}`);
      
      const messageData = await this.bot.sendMessage(params.conversation_id, params.message);
      
      return {
        success: true,
        data: {
          conversation_id: params.conversation_id,
          message: messageData,
          sent_at: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('MCP: Failed to send message:', error);
      return {
        success: false,
        error: error.message,
        conversation_id: params.conversation_id,
        message: params.message
      };
    }
  }

  async getConversations(params) {
    try {
      logger.info('MCP: Getting conversations list');
      
      // Navigate to chat page to get conversations
      await this.bot.navigateToChat();
      
      // Extract conversation list from page
      const conversations = await this.bot.page.evaluate((limit) => {
        const conversationElements = document.querySelectorAll(
          '.conversation-item, .chat-item, .contact-item, .message-thread'
        );
        
        return Array.from(conversationElements).map((el, index) => {
          const nameElement = el.querySelector('.name, .contact-name, .sender-name, .title');
          const lastMessageElement = el.querySelector('.last-message, .preview, .snippet');
          const timeElement = el.querySelector('.time, .timestamp, .date');
          
          return {
            id: el.getAttribute('data-id') || 
                el.getAttribute('data-conversation-id') || 
                `conv_${index}`,
            name: nameElement?.textContent?.trim() || 'Unknown Contact',
            last_message: lastMessageElement?.textContent?.trim() || '',
            last_activity: timeElement?.textContent?.trim() || '',
            url: el.querySelector('a')?.href || ''
          };
        }).slice(0, limit || 20);
      }, params.limit);
      
      return {
        success: true,
        data: {
          conversations: conversations,
          count: conversations.length,
          fetched_at: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('MCP: Failed to get conversations:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async searchMessages(params) {
    try {
      logger.info(`MCP: Searching messages for query: "${params.query}"`);
      
      const historyData = await this.bot.storage.loadChatHistory();
      const results = [];
      
      for (const [conversationId, conversation] of Object.entries(historyData)) {
        // Skip if conversation_id filter is specified and doesn't match
        if (params.conversation_id && conversationId !== params.conversation_id) {
          continue;
        }
        
        const matchingMessages = conversation.messages.filter(message =>
          message.text.toLowerCase().includes(params.query.toLowerCase())
        );
        
        for (const message of matchingMessages) {
          results.push({
            conversation_id: conversationId,
            message: message,
            match_context: this.getMatchContext(message.text, params.query)
          });
        }
      }
      
      // Sort by timestamp (most recent first)
      results.sort((a, b) => new Date(b.message.timestamp) - new Date(a.message.timestamp));
      
      // Apply limit
      const limitedResults = results.slice(0, params.limit || 50);
      
      return {
        success: true,
        data: {
          query: params.query,
          results: limitedResults,
          total_matches: results.length,
          returned_count: limitedResults.length,
          searched_at: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('MCP: Failed to search messages:', error);
      return {
        success: false,
        error: error.message,
        query: params.query
      };
    }
  }

  async getBotStatus(params) {
    try {
      logger.info('MCP: Getting bot status');
      
      const storageStats = await this.bot.storage.getStats();
      
      return {
        success: true,
        data: {
          status: {
            browser_active: this.bot.browser !== null,
            page_active: this.bot.page !== null,
            listening: this.bot.isListening,
            current_conversation: this.bot.currentConversation,
            initialized_at: this.bot.initializedAt || null
          },
          storage: storageStats,
          capabilities: {
            stealth_mode: true,
            captcha_solving: !!process.env.ANTICAPTCHA_API_KEY,
            auto_login: !!(process.env.USER_EMAIL && process.env.USER_PASSWORD),
            live_listening: true
          },
          checked_at: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('MCP: Failed to get bot status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  getMatchContext(text, query, contextLength = 50) {
    const queryIndex = text.toLowerCase().indexOf(query.toLowerCase());
    if (queryIndex === -1) return text;
    
    const start = Math.max(0, queryIndex - contextLength);
    const end = Math.min(text.length, queryIndex + query.length + contextLength);
    
    let context = text.substring(start, end);
    
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';
    
    return context;
  }

  // MCP Server Protocol Implementation
  start() {
    logger.info('MCP Server started - Tools available:');
    Object.keys(this.tools).forEach(toolName => {
      logger.info(`  - ${toolName}: ${this.tools[toolName].description}`);
    });
  }

  async handleToolCall(toolName, params) {
    if (!this.tools[toolName]) {
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
        available_tools: Object.keys(this.tools)
      };
    }
    
    try {
      logger.info(`MCP: Executing tool ${toolName} with params:`, params);
      const result = await this.tools[toolName].handler(params);
      logger.info(`MCP: Tool ${toolName} completed successfully`);
      return result;
      
    } catch (error) {
      logger.error(`MCP: Tool ${toolName} failed:`, error);
      return {
        success: false,
        error: error.message,
        tool: toolName,
        params: params
      };
    }
  }

  getToolSchema(toolName) {
    if (!this.tools[toolName]) {
      return null;
    }
    
    return {
      name: this.tools[toolName].name,
      description: this.tools[toolName].description,
      inputSchema: this.tools[toolName].inputSchema
    };
  }

  getAllToolSchemas() {
    return Object.keys(this.tools).map(toolName => this.getToolSchema(toolName));
  }
}