import { logger } from '../utils/logger.js';

export class SmartMatcher {
  constructor() {
    this.conversationCache = new Map();
  }

  // Smart conversation matching using fuzzy search
  findBestConversationMatch(userInput, availableConversations) {
    if (!availableConversations || availableConversations.length === 0) {
      return null;
    }

    const input = userInput.toLowerCase();
    const matches = [];

    for (const conv of availableConversations) {
      const score = this.calculateMatchScore(input, conv);
      if (score > 0) {
        matches.push({ conversation: conv, score });
      }
    }

    // Sort by score (highest first)
    matches.sort((a, b) => b.score - a.score);

    if (matches.length > 0 && matches[0].score > 0.3) {
      logger.info(`🎯 Smart match found: ${matches[0].conversation.name} (score: ${matches[0].score.toFixed(2)})`);
      return matches[0].conversation;
    }

    return null;
  }

  calculateMatchScore(input, conversation) {
    let score = 0;
    const name = (conversation.name || '').toLowerCase();
    const id = (conversation.id || '').toLowerCase();
    const lastMessage = (conversation.last_message || '').toLowerCase();

    // Exact name match
    if (input.includes(name) && name.length > 2) {
      score += 1.0;
    }

    // Partial name match
    const nameWords = name.split(/\s+/);
    for (const word of nameWords) {
      if (word.length > 2 && input.includes(word)) {
        score += 0.5;
      }
    }

    // ID match
    if (input.includes(id)) {
      score += 0.8;
    }

    // Keywords in last message
    if (lastMessage) {
      const inputWords = input.split(/\s+/);
      const messageWords = lastMessage.split(/\s+/);
      
      for (const inputWord of inputWords) {
        if (inputWord.length > 3) {
          for (const messageWord of messageWords) {
            if (messageWord.includes(inputWord) || inputWord.includes(messageWord)) {
              score += 0.2;
            }
          }
        }
      }
    }

    // Company/organization keywords
    const orgKeywords = ['company', 'startup', 'tech', 'hr', 'recruiter', 'manager'];
    for (const keyword of orgKeywords) {
      if (input.includes(keyword) && name.includes(keyword)) {
        score += 0.3;
      }
    }

    return Math.min(score, 1.0); // Cap at 1.0
  }

  // Extract conversation context from user input
  extractConversationContext(userInput) {
    const context = {
      mentionedNames: [],
      mentionedIds: [],
      keywords: [],
      intent: null
    };

    const input = userInput.toLowerCase();

    // Extract potential conversation IDs
    const idPatterns = [
      /conv[_-]?(\w+)/gi,
      /conversation[_\s]+(\w+)/gi,
      /chat[_\s]+(\w+)/gi,
      /id[_\s]*:?[_\s]*(\w+)/gi
    ];

    for (const pattern of idPatterns) {
      const matches = [...input.matchAll(pattern)];
      for (const match of matches) {
        context.mentionedIds.push(match[1]);
      }
    }

    // Extract quoted names
    const namePatterns = [
      /"([^"]+)"/g,
      /'([^']+)'/g
    ];

    for (const pattern of namePatterns) {
      const matches = [...input.matchAll(pattern)];
      for (const match of matches) {
        context.mentionedNames.push(match[1]);
      }
    }

    // Extract intent keywords
    const intentKeywords = {
      urgent: ['urgent', 'asap', 'quickly', 'immediately', 'important'],
      work: ['job', 'work', 'internship', 'position', 'role', 'career'],
      personal: ['friend', 'personal', 'family', 'private'],
      recent: ['recent', 'latest', 'new', 'today', 'yesterday'],
      main: ['main', 'primary', 'important', 'key', 'major']
    };

    for (const [intent, keywords] of Object.entries(intentKeywords)) {
      for (const keyword of keywords) {
        if (input.includes(keyword)) {
          context.intent = intent;
          context.keywords.push(keyword);
          break;
        }
      }
      if (context.intent) break;
    }

    return context;
  }

  // Suggest conversations based on context
  suggestConversations(userInput, availableConversations, limit = 3) {
    const context = this.extractConversationContext(userInput);
    const suggestions = [];

    // First, try exact matches
    for (const id of context.mentionedIds) {
      const conv = availableConversations.find(c => 
        c.id.toLowerCase().includes(id.toLowerCase())
      );
      if (conv) {
        suggestions.push({ conversation: conv, reason: `Matches ID: ${id}`, confidence: 0.9 });
      }
    }

    // Then try name matches
    for (const name of context.mentionedNames) {
      const conv = availableConversations.find(c => 
        c.name && c.name.toLowerCase().includes(name.toLowerCase())
      );
      if (conv && !suggestions.find(s => s.conversation.id === conv.id)) {
        suggestions.push({ conversation: conv, reason: `Matches name: ${name}`, confidence: 0.8 });
      }
    }

    // Intent-based suggestions
    if (context.intent && suggestions.length < limit) {
      const intentMatches = this.findConversationsByIntent(context.intent, availableConversations);
      for (const match of intentMatches) {
        if (!suggestions.find(s => s.conversation.id === match.id)) {
          suggestions.push({ 
            conversation: match, 
            reason: `Matches intent: ${context.intent}`, 
            confidence: 0.6 
          });
        }
      }
    }

    // Fuzzy matching as fallback
    if (suggestions.length < limit) {
      const fuzzyMatch = this.findBestConversationMatch(userInput, availableConversations);
      if (fuzzyMatch && !suggestions.find(s => s.conversation.id === fuzzyMatch.id)) {
        suggestions.push({ 
          conversation: fuzzyMatch, 
          reason: 'Best fuzzy match', 
          confidence: 0.5 
        });
      }
    }

    return suggestions.slice(0, limit);
  }

  findConversationsByIntent(intent, availableConversations) {
    const matches = [];

    for (const conv of availableConversations) {
      const name = (conv.name || '').toLowerCase();
      const lastMessage = (conv.last_message || '').toLowerCase();

      switch (intent) {
        case 'work':
          if (name.includes('hr') || name.includes('recruiter') || 
              name.includes('company') || name.includes('intern') ||
              lastMessage.includes('job') || lastMessage.includes('position')) {
            matches.push(conv);
          }
          break;
        case 'urgent':
          // Could be based on recent activity, unread messages, etc.
          matches.push(conv);
          break;
        case 'recent':
          // Sort by last activity (if available)
          matches.push(conv);
          break;
        case 'main':
          // Could be the most active conversation
          matches.push(conv);
          break;
      }
    }

    return matches;
  }

  // Cache conversation data for faster matching
  cacheConversations(conversations) {
    this.conversationCache.clear();
    for (const conv of conversations) {
      this.conversationCache.set(conv.id, {
        ...conv,
        searchableText: `${conv.name} ${conv.last_message} ${conv.id}`.toLowerCase()
      });
    }
    logger.debug(`Cached ${conversations.length} conversations for smart matching`);
  }

  // Get cached conversations
  getCachedConversations() {
    return Array.from(this.conversationCache.values());
  }
}