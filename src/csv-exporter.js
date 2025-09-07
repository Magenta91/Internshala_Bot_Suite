import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

export class CSVExporter {
  constructor() {
    this.csvDir = './exports';
    this.ensureExportDirectory();
  }

  async ensureExportDirectory() {
    try {
      await fs.mkdir(this.csvDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create exports directory:', error);
    }
  }

  // Convert messages to CSV format
  async exportMessagesToCSV(messages, conversationId, filename = null) {
    try {
      if (!messages || messages.length === 0) {
        logger.warn('No messages to export');
        return null;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const csvFilename = filename || `chat_history_${conversationId}_${timestamp}.csv`;
      const csvPath = path.join(this.csvDir, csvFilename);

      // CSV Headers
      const headers = [
        'Message ID',
        'Conversation ID', 
        'Timestamp',
        'Date',
        'Time',
        'Sender',
        'Message Type',
        'Message Text',
        'Message Length',
        'Contains Links',
        'Contains Mentions',
        'Element Class'
      ];

      // Convert messages to CSV rows
      const csvRows = [headers.join(',')];

      for (const message of messages) {
        const row = this.messageToCSVRow(message, conversationId);
        csvRows.push(row);
      }

      const csvContent = csvRows.join('\n');
      await fs.writeFile(csvPath, csvContent, 'utf8');

      logger.success(`✅ Exported ${messages.length} messages to: ${csvPath}`);
      return csvPath;

    } catch (error) {
      logger.error('Failed to export messages to CSV:', error);
      throw error;
    }
  }

  messageToCSVRow(message, conversationId) {
    const timestamp = new Date(message.timestamp);
    const date = timestamp.toISOString().split('T')[0];
    const time = timestamp.toTimeString().split(' ')[0];
    
    // Clean text for CSV (escape quotes and remove newlines)
    const cleanText = this.cleanTextForCSV(message.text || '');
    
    // Analyze message content
    const hasLinks = /https?:\/\/[^\s]+/.test(message.text || '');
    const hasMentions = /@\w+/.test(message.text || '');
    
    const row = [
      this.escapeCSV(message.id || ''),
      this.escapeCSV(conversationId || ''),
      this.escapeCSV(message.timestamp || ''),
      this.escapeCSV(date),
      this.escapeCSV(time),
      this.escapeCSV(message.sender || ''),
      this.escapeCSV(message.type || ''),
      this.escapeCSV(cleanText),
      (message.text || '').length,
      hasLinks ? 'Yes' : 'No',
      hasMentions ? 'Yes' : 'No',
      this.escapeCSV(message.element_class || '')
    ];

    return row.join(',');
  }

  cleanTextForCSV(text) {
    return text
      .replace(/\n/g, ' ') // Replace newlines with spaces
      .replace(/\r/g, '') // Remove carriage returns
      .replace(/\t/g, ' ') // Replace tabs with spaces
      .trim();
  }

  escapeCSV(value) {
    if (typeof value !== 'string') {
      value = String(value);
    }
    
    // If the value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    
    return value;
  }

  // Export conversation list to CSV
  async exportConversationsToCSV(conversations, filename = null) {
    try {
      if (!conversations || conversations.length === 0) {
        logger.warn('No conversations to export');
        return null;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const csvFilename = filename || `conversations_${timestamp}.csv`;
      const csvPath = path.join(this.csvDir, csvFilename);

      const headers = [
        'Conversation ID',
        'Name',
        'Last Message',
        'Last Activity',
        'URL',
        'Export Date'
      ];

      const csvRows = [headers.join(',')];

      for (const conv of conversations) {
        const row = [
          this.escapeCSV(conv.id || ''),
          this.escapeCSV(conv.name || ''),
          this.escapeCSV(this.cleanTextForCSV(conv.last_message || '')),
          this.escapeCSV(conv.last_activity || ''),
          this.escapeCSV(conv.url || ''),
          this.escapeCSV(new Date().toISOString())
        ];
        csvRows.push(row.join(','));
      }

      const csvContent = csvRows.join('\n');
      await fs.writeFile(csvPath, csvContent, 'utf8');

      logger.success(`✅ Exported ${conversations.length} conversations to: ${csvPath}`);
      return csvPath;

    } catch (error) {
      logger.error('Failed to export conversations to CSV:', error);
      throw error;
    }
  }

  // Export search results to CSV
  async exportSearchResultsToCSV(searchResults, query, filename = null) {
    try {
      if (!searchResults || searchResults.length === 0) {
        logger.warn('No search results to export');
        return null;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const csvFilename = filename || `search_results_${query.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.csv`;
      const csvPath = path.join(this.csvDir, csvFilename);

      const headers = [
        'Search Query',
        'Conversation ID',
        'Message ID',
        'Timestamp',
        'Sender',
        'Message Text',
        'Match Context',
        'Relevance Score'
      ];

      const csvRows = [headers.join(',')];

      for (const result of searchResults) {
        const message = result.message;
        const row = [
          this.escapeCSV(query),
          this.escapeCSV(result.conversation_id || ''),
          this.escapeCSV(message.id || ''),
          this.escapeCSV(message.timestamp || ''),
          this.escapeCSV(message.sender || ''),
          this.escapeCSV(this.cleanTextForCSV(message.text || '')),
          this.escapeCSV(this.cleanTextForCSV(result.match_context || '')),
          result.relevance_score || 0
        ];
        csvRows.push(row.join(','));
      }

      const csvContent = csvRows.join('\n');
      await fs.writeFile(csvPath, csvContent, 'utf8');

      logger.success(`✅ Exported ${searchResults.length} search results to: ${csvPath}`);
      return csvPath;

    } catch (error) {
      logger.error('Failed to export search results to CSV:', error);
      throw error;
    }
  }

  // Generate summary statistics CSV
  async exportChatStatistics(messages, conversationId, filename = null) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const csvFilename = filename || `chat_stats_${conversationId}_${timestamp}.csv`;
      const csvPath = path.join(this.csvDir, csvFilename);

      const stats = this.calculateChatStatistics(messages);

      const headers = ['Metric', 'Value'];
      const csvRows = [headers.join(',')];

      for (const [metric, value] of Object.entries(stats)) {
        csvRows.push(`${this.escapeCSV(metric)},${this.escapeCSV(String(value))}`);
      }

      const csvContent = csvRows.join('\n');
      await fs.writeFile(csvPath, csvContent, 'utf8');

      logger.success(`✅ Exported chat statistics to: ${csvPath}`);
      return csvPath;

    } catch (error) {
      logger.error('Failed to export chat statistics:', error);
      throw error;
    }
  }

  calculateChatStatistics(messages) {
    if (!messages || messages.length === 0) {
      return { 'Total Messages': 0 };
    }

    const stats = {
      'Total Messages': messages.length,
      'Messages from Me': messages.filter(m => m.sender === 'me').length,
      'Messages from Others': messages.filter(m => m.sender !== 'me').length,
      'Average Message Length': Math.round(messages.reduce((sum, m) => sum + (m.text || '').length, 0) / messages.length),
      'Longest Message': Math.max(...messages.map(m => (m.text || '').length)),
      'Messages with Links': messages.filter(m => /https?:\/\/[^\s]+/.test(m.text || '')).length,
      'Messages with Mentions': messages.filter(m => /@\w+/.test(m.text || '')).length,
      'First Message Date': messages.length > 0 ? new Date(messages[0].timestamp).toISOString().split('T')[0] : 'N/A',
      'Last Message Date': messages.length > 0 ? new Date(messages[messages.length - 1].timestamp).toISOString().split('T')[0] : 'N/A'
    };

    // Calculate daily message counts
    const dailyCounts = {};
    messages.forEach(m => {
      const date = new Date(m.timestamp).toISOString().split('T')[0];
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });

    stats['Most Active Day'] = Object.entries(dailyCounts).reduce((max, [date, count]) => 
      count > max.count ? { date, count } : max, { date: 'N/A', count: 0 }).date;

    stats['Most Active Day Count'] = Object.entries(dailyCounts).reduce((max, [date, count]) => 
      count > max ? count : max, 0);

    return stats;
  }

  // Export internships to CSV
  async exportInternshipsToCSV(internships) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `internships_${timestamp}.csv`;
      const filepath = path.join(this.csvDir, filename);
      
      const headers = [
        'ID',
        'Company',
        'Location', 
        'Duration',
        'Actively Hiring',
        'Early Applicant',
        'Stipend',
        'Apply URL',
        'Job URL',
        'Scraped At'
      ];
      
      const rows = internships.map(internship => [
        internship.id,
        internship.company,
        internship.location,
        internship.duration,
        internship.actively_hiring ? 'Yes' : 'No',
        internship.early_applicant ? 'Yes' : 'No',
        internship.stipend,
        internship.apply_url,
        internship.job_url,
        internship.scraped_at
      ]);
      
      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      
      await fs.writeFile(filepath, csvContent, 'utf8');
      
      logger.info(`✅ Exported ${internships.length} internships to: ${filepath}`);
      return filepath;
      
    } catch (error) {
      logger.error('Failed to export internships to CSV:', error);
      throw error;
    }
  }

  // List all exported files
  async listExportedFiles() {
    try {
      const files = await fs.readdir(this.csvDir);
      const csvFiles = files.filter(file => file.endsWith('.csv'));
      
      const fileDetails = [];
      for (const file of csvFiles) {
        const filePath = path.join(this.csvDir, file);
        const stats = await fs.stat(filePath);
        fileDetails.push({
          filename: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        });
      }

      return fileDetails.sort((a, b) => b.modified - a.modified);

    } catch (error) {
      logger.error('Failed to list exported files:', error);
      return [];
    }
  }
}