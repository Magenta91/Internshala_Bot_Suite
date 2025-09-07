import winston from 'winston';
import path from 'path';

// Create logs directory
import fs from 'fs';
const logsDir = './logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = ' ' + JSON.stringify(meta);
    }
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  defaultMeta: { service: 'internshala-bot' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: fileFormat
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: fileFormat
    }),
    
    // Daily rotate file for debugging
    new winston.transports.File({
      filename: path.join(logsDir, 'debug.log'),
      level: 'debug',
      maxsize: 10485760, // 10MB
      maxFiles: 3,
      format: fileFormat
    })
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: fileFormat
    })
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: fileFormat
    })
  ]
});

// Add custom logging methods
logger.success = (message, meta = {}) => {
  logger.info(`✅ ${message}`, meta);
};

logger.step = (message, meta = {}) => {
  logger.info(`🔄 ${message}`, meta);
};

logger.warning = (message, meta = {}) => {
  logger.warn(`⚠️  ${message}`, meta);
};

logger.critical = (message, meta = {}) => {
  logger.error(`🚨 CRITICAL: ${message}`, meta);
};

// Performance logging
logger.time = (label) => {
  logger.startTime = logger.startTime || {};
  logger.startTime[label] = Date.now();
  logger.debug(`⏱️  Timer started: ${label}`);
};

logger.timeEnd = (label) => {
  if (logger.startTime && logger.startTime[label]) {
    const duration = Date.now() - logger.startTime[label];
    logger.info(`⏱️  ${label}: ${duration}ms`);
    delete logger.startTime[label];
  }
};

// Network request logging
logger.request = (method, url, status = null) => {
  const statusEmoji = status >= 400 ? '❌' : status >= 300 ? '🔄' : '✅';
  const statusText = status ? ` [${status}]` : '';
  logger.debug(`🌐 ${statusEmoji} ${method} ${url}${statusText}`);
};

// Browser action logging
logger.action = (action, details = '') => {
  logger.debug(`🎭 ${action}${details ? ': ' + details : ''}`);
};

// Captcha logging
logger.captcha = (message, meta = {}) => {
  logger.info(`🤖 CAPTCHA: ${message}`, meta);
};

// Chat logging
logger.chat = (direction, message, conversationId = null) => {
  const arrow = direction === 'sent' ? '📤' : '📥';
  const preview = message.length > 50 ? message.substring(0, 50) + '...' : message;
  const convText = conversationId ? ` [${conversationId}]` : '';
  logger.info(`${arrow} ${direction.toUpperCase()}${convText}: "${preview}"`);
};

// Storage logging
logger.storage = (operation, details = '') => {
  logger.debug(`💾 STORAGE ${operation.toUpperCase()}${details ? ': ' + details : ''}`);
};

// MCP logging
logger.mcp = (operation, details = '') => {
  logger.info(`🔌 MCP ${operation.toUpperCase()}${details ? ': ' + details : ''}`);
};

// Export logger as default
export default logger;