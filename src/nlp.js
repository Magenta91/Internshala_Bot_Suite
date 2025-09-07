import { logger } from '../utils/logger.js';
import { SmartMatcher } from './smart-matching.js';

export class NLPProcessor {
  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.smartMatcher = new SmartMatcher();
    
    if (!this.geminiApiKey && !this.openaiApiKey) {
      logger.warn('No LLM API key found. Natural language processing will be limited.');
    }
  }

  async processNaturalLanguage(userInput, availableCommands = []) {
    try {
      logger.info(`🧠 Processing natural language: "${userInput}"`);
      
      if (this.geminiApiKey) {
        return await this.processWithGemini(userInput, availableCommands);
      } else if (this.openaiApiKey) {
        return await this.processWithOpenAI(userInput, availableCommands);
      } else {
        return this.fallbackProcessing(userInput);
      }
    } catch (error) {
      logger.error('NLP processing failed:', error);
      return this.fallbackProcessing(userInput);
    }
  }

  async processWithGemini(userInput, availableCommands) {
    const prompt = this.buildPrompt(userInput, availableCommands);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.candidates[0]?.content?.parts[0]?.text;
    
    if (result) {
      return this.parseAIResponse(result);
    } else {
      throw new Error('No response from Gemini');
    }
  }

  async processWithOpenAI(userInput, availableCommands) {
    const prompt = this.buildPrompt(userInput, availableCommands);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a command interpreter for an Internshala chat automation bot. Convert natural language to structured commands.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.choices[0]?.message?.content;
    
    if (result) {
      return this.parseAIResponse(result);
    } else {
      throw new Error('No response from OpenAI');
    }
  }

  buildPrompt(userInput, availableCommands) {
    return `
You are a command interpreter for an Internshala chat automation bot. Convert the user's natural language input into a structured command.

Available Commands:
- extract_chats: Extract chat messages from Internshala
- find_internships: Search for internships on Internshala
- view_files: View exported CSV files
- help: Show help message
- status: Get bot status  
- conversations: List available conversations
- history <conv_id>: Fetch chat history for conversation
- send <conv_id> <message>: Send message to conversation
- listen <conv_id>: Start listening for new messages
- search <query>: Search messages
- quit: Exit the program

User Input: "${userInput}"

Analyze the user's intent and respond with ONLY a JSON object in this format:
{
  "command": "command_name",
  "parameters": ["param1", "param2"],
  "confidence": 0.95,
  "interpretation": "What the user wants to do"
}

Examples:
- "show me all my chats" → {"command": "conversations", "parameters": [], "confidence": 0.9, "interpretation": "User wants to see all conversations"}
- "send hello to conversation 123" → {"command": "send", "parameters": ["123", "hello"], "confidence": 0.95, "interpretation": "User wants to send 'hello' to conversation 123"}
- "get chat history for conv_456" → {"command": "history", "parameters": ["conv_456"], "confidence": 0.9, "interpretation": "User wants chat history for conversation conv_456"}
- "search for internship messages" → {"command": "search", "parameters": ["internship"], "confidence": 0.85, "interpretation": "User wants to search for messages containing 'internship'"}
- "start listening to conversation abc123" → {"command": "listen", "parameters": ["abc123"], "confidence": 0.9, "interpretation": "User wants to listen for new messages in conversation abc123"}

Respond with ONLY the JSON object, no other text.
`;
  }

  parseAIResponse(response) {
    try {
      // Clean the response - remove any markdown formatting
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/, '').replace(/\n?```$/, '');
      }
      
      const parsed = JSON.parse(cleanResponse);
      
      // Validate the response structure
      if (!parsed.command || !Array.isArray(parsed.parameters)) {
        throw new Error('Invalid response structure');
      }
      
      logger.info(`🎯 AI interpreted: ${parsed.interpretation} (confidence: ${parsed.confidence})`);
      return parsed;
      
    } catch (error) {
      logger.error('Failed to parse AI response:', error);
      logger.debug('Raw AI response:', response);
      throw new Error('Could not parse AI response');
    }
  }

  fallbackProcessing(userInput) {
    logger.info('🔄 Using fallback NLP processing');
    
    const input = userInput.toLowerCase().trim();
    
    // Simple keyword-based matching
    const patterns = [
      {
        keywords: ['extract', 'chat', 'messages', 'download chat', 'get messages'],
        command: 'extract_chats',
        parameters: [],
        confidence: 0.9
      },
      {
        keywords: ['internship', 'job', 'find internship', 'search internship', 'internships'],
        command: 'find_internships',
        parameters: [],
        confidence: 0.9
      },
      {
        keywords: ['files', 'exported', 'csv', 'show files', 'view files'],
        command: 'view_files',
        parameters: [],
        confidence: 0.8
      },
      {
        keywords: ['help', 'commands', 'what can you do'],
        command: 'help',
        parameters: [],
        confidence: 0.8
      },
      {
        keywords: ['status', 'how are you', 'state', 'info'],
        command: 'status', 
        parameters: [],
        confidence: 0.7
      },
      {
        keywords: ['conversations', 'chats', 'list', 'show me'],
        command: 'conversations',
        parameters: [],
        confidence: 0.8
      },
      {
        keywords: ['history', 'messages', 'chat history'],
        command: 'history',
        parameters: this.extractConversationId(input),
        confidence: 0.6
      },
      {
        keywords: ['send', 'message', 'tell', 'say'],
        command: 'send',
        parameters: this.extractSendParameters(input),
        confidence: 0.7
      },
      {
        keywords: ['listen', 'monitor', 'watch'],
        command: 'listen',
        parameters: this.extractConversationId(input),
        confidence: 0.6
      },
      {
        keywords: ['search', 'find', 'look for'],
        command: 'search',
        parameters: this.extractSearchQuery(input),
        confidence: 0.7
      },
      {
        keywords: ['monitor', 'watch', 'listen'],
        command: 'listen',
        parameters: this.extractConversationId(input),
        confidence: 0.6
      },
      {
        keywords: ['quit', 'exit', 'bye', 'goodbye'],
        command: 'quit',
        parameters: [],
        confidence: 0.9
      }
    ];

    for (const pattern of patterns) {
      if (pattern.keywords.some(keyword => input.includes(keyword))) {
        return {
          command: pattern.command,
          parameters: pattern.parameters,
          confidence: pattern.confidence,
          interpretation: `Fallback interpretation: ${pattern.command} command detected`
        };
      }
    }

    // If no pattern matches, return help
    return {
      command: 'help',
      parameters: [],
      confidence: 0.3,
      interpretation: 'Could not understand the command, showing help'
    };
  }

  extractConversationId(input) {
    // Look for conversation IDs in various formats
    const patterns = [
      /conv[_-]?(\w+)/i,
      /conversation[_\s]+(\w+)/i,
      /chat[_\s]+(\w+)/i,
      /id[_\s]+(\w+)/i,
      /(\w+)/i // fallback to any word
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return [match[1]];
      }
    }
    
    return [];
  }

  extractSendParameters(input) {
    // Try to extract conversation ID and message
    const sendPatterns = [
      /send\s+"([^"]+)"\s+to\s+(\w+)/i,
      /send\s+(\w+)\s+"([^"]+)"/i,
      /tell\s+(\w+)\s+"([^"]+)"/i,
      /message\s+(\w+)\s+(.+)/i
    ];

    for (const pattern of sendPatterns) {
      const match = input.match(pattern);
      if (match) {
        if (pattern.source.includes('to')) {
          return [match[2], match[1]]; // [conv_id, message]
        } else {
          return [match[1], match[2]]; // [conv_id, message]
        }
      }
    }

    return [];
  }

  extractSearchQuery(input) {
    // Extract search query
    const searchPatterns = [
      /search\s+for\s+"([^"]+)"/i,
      /search\s+"([^"]+)"/i,
      /find\s+"([^"]+)"/i,
      /look\s+for\s+"([^"]+)"/i,
      /find\s+messages?\s+about\s+(.+)/i,
      /look\s+for\s+messages?\s+containing\s+(.+)/i,
      /search\s+for\s+(.+)/i,
      /find\s+(.+)/i
    ];

    for (const pattern of searchPatterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return [match[1].trim()];
      }
    }

    return [];
  }

  // Smart conversation ID suggestions
  async suggestConversationId(userInput, availableConversations = []) {
    if (availableConversations.length === 0) {
      return null;
    }

    // Use smart matching
    const bestMatch = this.smartMatcher.findBestConversationMatch(userInput, availableConversations);
    if (bestMatch) {
      return bestMatch.id;
    }

    // If only one conversation, suggest it
    if (availableConversations.length === 1) {
      return availableConversations[0].id;
    }

    return null;
  }

  // Get multiple conversation suggestions
  getConversationSuggestions(userInput, availableConversations = [], limit = 3) {
    return this.smartMatcher.suggestConversations(userInput, availableConversations, limit);
  }

  // Generate helpful suggestions
  generateSuggestions(command, parameters, availableConversations = []) {
    const suggestions = [];

    if (command === 'history' && parameters.length === 0) {
      suggestions.push('💡 Try: "get history for conv_123" or "show me chat history for [conversation_name]"');
      if (availableConversations.length > 0) {
        suggestions.push(`Available conversations: ${availableConversations.slice(0, 3).map(c => c.name || c.id).join(', ')}`);
      }
    }

    if (command === 'send' && parameters.length < 2) {
      suggestions.push('💡 Try: "send hello to conv_123" or "tell conv_123 your message here"');
    }

    if (command === 'search' && parameters.length === 0) {
      suggestions.push('💡 Try: "search for internship" or "find messages about interview"');
    }

    return suggestions;
  }
}