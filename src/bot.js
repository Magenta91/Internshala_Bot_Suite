import { chromium } from 'playwright';
import { logger } from '../utils/logger.js';
import { StealthManager } from './stealth.js';
import { AuthManager } from './auth.js';
import { ChatManager } from './chat.js';
import { CaptchaManager } from './captcha.js';
import { StorageManager } from './storage.js';

export class InternshalaBot {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    
    this.stealth = new StealthManager();
    this.auth = new AuthManager();
    this.chat = new ChatManager();
    this.captcha = new CaptchaManager();
    this.storage = new StorageManager();
    
    this.isListening = false;
    this.currentConversation = null;
  }

  async initialize(headful = false) {
    try {
      logger.info('Initializing browser...');
      
      const browserOptions = {
        headless: !headful && process.env.HEADFUL !== 'true',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      };

      this.browser = await chromium.launch(browserOptions);
      
      // Create context with stealth settings
      this.context = await this.browser.newContext(
        await this.stealth.getContextOptions()
      );
      
      // Apply stealth patches
      await this.stealth.applyStealthPatches(this.context);
      
      this.page = await this.context.newPage();
      
      // Set up page event listeners
      this.setupPageListeners();
      
      logger.info('Browser initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  setupPageListeners() {
    this.page.on('dialog', async dialog => {
      logger.info(`Dialog appeared: ${dialog.message()}`);
      await dialog.accept();
    });

    this.page.on('response', response => {
      if (response.url().includes('api') || response.url().includes('chat')) {
        logger.debug(`API Response: ${response.status()} ${response.url()}`);
      }
    });
  }

  async login() {
    try {
      logger.info('Starting login process...');
      
      // Try to load existing cookies first
      const cookies = await this.storage.loadCookies();
      if (cookies && cookies.length > 0) {
        await this.context.addCookies(cookies);
        logger.info('Loaded existing cookies');
        
        // Verify if still logged in
        await this.page.goto('https://internshala.com/student/dashboard');
        await this.page.waitForTimeout(2000);
        
        if (await this.isLoggedIn()) {
          logger.info('Already logged in with existing cookies');
          return;
        }
      }
      
      // Perform fresh login
      await this.auth.performLogin(this.page, this.stealth, this.captcha);
      
      // Save cookies after successful login
      const newCookies = await this.context.cookies();
      await this.storage.saveCookies(newCookies);
      
      logger.info('Login completed successfully');
      
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  async isLoggedIn() {
    try {
      // Check for account issues first
      const accountIssue = await this.page.$('.error_content, .account_hold, .violation');
      if (accountIssue) {
        const errorText = await accountIssue.textContent();
        if (errorText && errorText.includes('put on hold')) {
          logger.error('⚠️  Account is on hold. Please contact Internshala support.');
          return false;
        }
      }
      
      // Check for dashboard elements or user profile
      const dashboardElement = await this.page.$('.dashboard-container, .user-profile, .student-dashboard');
      return dashboardElement !== null;
    } catch {
      return false;
    }
  }

  async navigateToChat(conversationId = null) {
    try {
      logger.info(`Navigating to chat${conversationId ? ` (${conversationId})` : ''}...`);
      
      const chatUrl = conversationId 
        ? `https://internshala.com/chat/${conversationId}`
        : 'https://internshala.com/chat';
        
      await this.page.goto(chatUrl, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(2000);
      
      this.currentConversation = conversationId;
      logger.info('Successfully navigated to chat');
      
    } catch (error) {
      logger.error('Failed to navigate to chat:', error);
      throw error;
    }
  }

  async fetchHistory(conversationId) {
    try {
      logger.info(`Fetching chat history for conversation: ${conversationId}`);
      
      if (this.currentConversation !== conversationId) {
        await this.navigateToChat(conversationId);
      }
      
      const history = await this.chat.fetchChatHistory(this.page, this.stealth);
      
      // Save to storage
      await this.storage.saveChatHistory(conversationId, history);
      
      logger.info(`Fetched ${history.length} messages`);
      return history;
      
    } catch (error) {
      logger.error('Failed to fetch chat history:', error);
      throw error;
    }
  }

  async sendMessage(conversationId, message) {
    try {
      logger.info(`Sending message to conversation: ${conversationId}`);
      
      if (this.currentConversation !== conversationId) {
        await this.navigateToChat(conversationId);
      }
      
      await this.chat.sendMessage(this.page, message, this.stealth);
      
      // Log the sent message
      const messageData = {
        id: Date.now().toString(),
        text: message,
        sender: 'me',
        timestamp: new Date().toISOString(),
        type: 'sent'
      };
      
      await this.storage.appendMessage(conversationId, messageData);
      
      logger.info('Message sent successfully');
      return messageData;
      
    } catch (error) {
      logger.error('Failed to send message:', error);
      throw error;
    }
  }

  async startListening(conversationId = null) {
    if (conversationId && this.currentConversation !== conversationId) {
      await this.navigateToChat(conversationId);
    }
    
    if (this.isListening) {
      logger.warn('Already listening for messages');
      return;
    }
    
    this.isListening = true;
    logger.info('Started listening for new messages...');
    
    await this.chat.startLiveListener(
      this.page, 
      this.currentConversation,
      this.storage,
      () => this.isListening
    );
  }

  async stopListening() {
    this.isListening = false;
    logger.info('Stopped listening for messages');
  }

  async cleanup() {
    try {
      this.isListening = false;
      
      if (this.page) {
        await this.page.close();
      }
      
      if (this.context) {
        await this.context.close();
      }
      
      if (this.browser) {
        await this.browser.close();
      }
      
      logger.info('Cleanup completed');
      
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}