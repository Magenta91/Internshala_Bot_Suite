import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
import { CSVExporter } from './csv-exporter.js';

export class StorageManager {
  constructor() {
    this.dataDir = './data';
    this.cookiesFile = path.join(this.dataDir, 'cookies.json');
    this.chatHistoryFile = path.join(this.dataDir, 'chat_history.json');
    this.sessionsFile = path.join(this.dataDir, 'sessions.json');
    this.csvExporter = new CSVExporter();
    
    this.ensureDataDirectory();
  }

  async ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create data directory:', error);
    }
  }

  // Cookie management
  async saveCookies(cookies) {
    try {
      const cookieData = {
        cookies: cookies,
        timestamp: new Date().toISOString(),
        domain: 'internshala.com'
      };
      
      await fs.writeFile(this.cookiesFile, JSON.stringify(cookieData, null, 2));
      logger.info(`Saved ${cookies.length} cookies`);
      
    } catch (error) {
      logger.error('Failed to save cookies:', error);
    }
  }

  async loadCookies() {
    try {
      const data = await fs.readFile(this.cookiesFile, 'utf8');
      const cookieData = JSON.parse(data);
      
      // Check if cookies are not too old (7 days)
      const cookieAge = Date.now() - new Date(cookieData.timestamp).getTime();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (cookieAge > maxAge) {
        logger.info('Cookies are too old, will perform fresh login');
        return null;
      }
      
      logger.info(`Loaded ${cookieData.cookies.length} cookies`);
      return cookieData.cookies;
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Failed to load cookies:', error);
      }
      return null;
    }
  }

  async clearCookies() {
    try {
      await fs.unlink(this.cookiesFile);
      logger.info('Cookies cleared');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Failed to clear cookies:', error);
      }
    }
  }

  // Chat history management
  async saveChatHistory(conversationId, messages) {
    try {
      let historyData = {};
      
      // Load existing history
      try {
        const existingData = await fs.readFile(this.chatHistoryFile, 'utf8');
        historyData = JSON.parse(existingData);
      } catch (error) {
        // File doesn't exist or is invalid, start fresh
      }
      
      // Update conversation history
      historyData[conversationId] = {
        messages: messages,
        lastUpdated: new Date().toISOString(),
        messageCount: messages.length
      };
      
      await fs.writeFile(this.chatHistoryFile, JSON.stringify(historyData, null, 2));
      logger.info(`Saved ${messages.length} messages for conversation ${conversationId}`);
      
      // Also export to CSV
      try {
        const csvPath = await this.csvExporter.exportMessagesToCSV(messages, conversationId);
        if (csvPath) {
          logger.success(`📊 Chat history also exported to CSV: ${csvPath}`);
        }
      } catch (csvError) {
        logger.warn('Failed to export to CSV, but JSON saved successfully:', csvError.message);
      }
      
    } catch (error) {
      logger.error('Failed to save chat history:', error);
    }
  }

  async loadChatHistory(conversationId = null) {
    try {
      const data = await fs.readFile(this.chatHistoryFile, 'utf8');
      const historyData = JSON.parse(data);
      
      if (conversationId) {
        return historyData[conversationId] || { messages: [], lastUpdated: null, messageCount: 0 };
      }
      
      return historyData;
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Failed to load chat history:', error);
      }
      return conversationId ? { messages: [], lastUpdated: null, messageCount: 0 } : {};
    }
  }

  async appendMessage(conversationId, message) {
    try {
      const historyData = await this.loadChatHistory();
      
      if (!historyData[conversationId]) {
        historyData[conversationId] = {
          messages: [],
          lastUpdated: null,
          messageCount: 0
        };
      }
      
      // Check for duplicate messages
      const existingMessage = historyData[conversationId].messages.find(m => 
        m.text === message.text && 
        Math.abs(new Date(m.timestamp) - new Date(message.timestamp)) < 5000
      );
      
      if (!existingMessage) {
        historyData[conversationId].messages.push(message);
        historyData[conversationId].lastUpdated = new Date().toISOString();
        historyData[conversationId].messageCount = historyData[conversationId].messages.length;
        
        await fs.writeFile(this.chatHistoryFile, JSON.stringify(historyData, null, 2));
        logger.debug(`Appended new message to conversation ${conversationId}`);
      }
      
    } catch (error) {
      logger.error('Failed to append message:', error);
    }
  }

  // Session management
  async saveSession(sessionData) {
    try {
      let sessions = {};
      
      try {
        const existingData = await fs.readFile(this.sessionsFile, 'utf8');
        sessions = JSON.parse(existingData);
      } catch (error) {
        // File doesn't exist, start fresh
      }
      
      const sessionId = sessionData.id || Date.now().toString();
      sessions[sessionId] = {
        ...sessionData,
        timestamp: new Date().toISOString()
      };
      
      await fs.writeFile(this.sessionsFile, JSON.stringify(sessions, null, 2));
      logger.info(`Saved session: ${sessionId}`);
      
      return sessionId;
      
    } catch (error) {
      logger.error('Failed to save session:', error);
      return null;
    }
  }

  async loadSession(sessionId = null) {
    try {
      const data = await fs.readFile(this.sessionsFile, 'utf8');
      const sessions = JSON.parse(data);
      
      if (sessionId) {
        return sessions[sessionId] || null;
      }
      
      // Return most recent session if no ID specified
      const sessionIds = Object.keys(sessions);
      if (sessionIds.length === 0) {
        return null;
      }
      
      const mostRecent = sessionIds.reduce((latest, current) => {
        return new Date(sessions[current].timestamp) > new Date(sessions[latest].timestamp) ? current : latest;
      });
      
      return sessions[mostRecent];
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Failed to load session:', error);
      }
      return null;
    }
  }

  // Backup and export
  async exportData(outputPath = './internshala_backup.json') {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        cookies: await this.loadCookies(),
        chatHistory: await this.loadChatHistory(),
        sessions: await this.loadSession()
      };
      
      await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2));
      logger.info(`Data exported to: ${outputPath}`);
      
    } catch (error) {
      logger.error('Failed to export data:', error);
    }
  }

  async importData(inputPath) {
    try {
      const data = await fs.readFile(inputPath, 'utf8');
      const importData = JSON.parse(data);
      
      if (importData.cookies) {
        await this.saveCookies(importData.cookies);
      }
      
      if (importData.chatHistory) {
        await fs.writeFile(this.chatHistoryFile, JSON.stringify(importData.chatHistory, null, 2));
      }
      
      if (importData.sessions) {
        await fs.writeFile(this.sessionsFile, JSON.stringify(importData.sessions, null, 2));
      }
      
      logger.info(`Data imported from: ${inputPath}`);
      
    } catch (error) {
      logger.error('Failed to import data:', error);
    }
  }

  // Cleanup old data
  async cleanup(maxAge = 30) {
    try {
      const maxAgeMs = maxAge * 24 * 60 * 60 * 1000; // Convert days to milliseconds
      const cutoffDate = new Date(Date.now() - maxAgeMs);
      
      // Clean up old chat history
      const historyData = await this.loadChatHistory();
      let cleanedConversations = 0;
      
      for (const [conversationId, conversation] of Object.entries(historyData)) {
        if (conversation.lastUpdated && new Date(conversation.lastUpdated) < cutoffDate) {
          delete historyData[conversationId];
          cleanedConversations++;
        }
      }
      
      if (cleanedConversations > 0) {
        await fs.writeFile(this.chatHistoryFile, JSON.stringify(historyData, null, 2));
        logger.info(`Cleaned up ${cleanedConversations} old conversations`);
      }
      
      // Clean up old sessions
      const sessions = await this.loadSession();
      if (sessions) {
        const sessionData = JSON.parse(await fs.readFile(this.sessionsFile, 'utf8'));
        let cleanedSessions = 0;
        
        for (const [sessionId, session] of Object.entries(sessionData)) {
          if (session.timestamp && new Date(session.timestamp) < cutoffDate) {
            delete sessionData[sessionId];
            cleanedSessions++;
          }
        }
        
        if (cleanedSessions > 0) {
          await fs.writeFile(this.sessionsFile, JSON.stringify(sessionData, null, 2));
          logger.info(`Cleaned up ${cleanedSessions} old sessions`);
        }
      }
      
    } catch (error) {
      logger.error('Failed to cleanup old data:', error);
    }
  }

  // Get storage statistics
  async getStats() {
    try {
      const stats = {
        cookies: 0,
        conversations: 0,
        totalMessages: 0,
        sessions: 0,
        diskUsage: 0
      };
      
      // Cookie stats
      const cookies = await this.loadCookies();
      if (cookies) {
        stats.cookies = cookies.length;
      }
      
      // Chat history stats
      const historyData = await this.loadChatHistory();
      stats.conversations = Object.keys(historyData).length;
      stats.totalMessages = Object.values(historyData).reduce((total, conv) => total + conv.messageCount, 0);
      
      // Session stats
      try {
        const sessionData = await fs.readFile(this.sessionsFile, 'utf8');
        const sessions = JSON.parse(sessionData);
        stats.sessions = Object.keys(sessions).length;
      } catch (error) {
        // No sessions file
      }
      
      // Disk usage
      try {
        const files = [this.cookiesFile, this.chatHistoryFile, this.sessionsFile];
        for (const file of files) {
          try {
            const fileStat = await fs.stat(file);
            stats.diskUsage += fileStat.size;
          } catch (error) {
            // File doesn't exist
          }
        }
      } catch (error) {
        // Error calculating disk usage
      }
      
      return stats;
      
    } catch (error) {
      logger.error('Failed to get storage stats:', error);
      return null;
    }
  }
}