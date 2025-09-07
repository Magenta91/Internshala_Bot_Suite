#!/usr/bin/env node



import { WorkingInternshalaBot } from './working-bot.js';
import { InternshipScraper } from './src/internship-scraper.js';
import { CSVExporter } from './src/csv-exporter.js';
import { NLPProcessor } from './src/nlp.js';
import { logger } from './utils/logger.js';

class MainInternshalaBot {
  constructor() {
    this.chatBot = null;
    this.internshipScraper = new InternshipScraper();
    this.csvExporter = new CSVExporter();
    this.nlpProcessor = new NLPProcessor();
  }

  async initialize() {
    console.log('🚀 Initializing Internshala Bot Suite...');
    console.log('=' .repeat(50));
  }

  async showMainMenu() {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise((resolve) => {
      rl.question(prompt, resolve);
    });

    try {
      console.log('\n🎯 Internshala Bot Suite');
      console.log('=' .repeat(30));
      console.log('1. 💬 Extract Chat Messages');
      console.log('2. 🔍 Find Internships');
      console.log('3. 📊 View Exported Files');
      console.log('4. 🤖 Natural Language Mode');
      console.log('5. ❌ Exit');
      console.log('');

      const choice = await question('Select an option (1-5): ');
      rl.close();
      return choice.trim();

    } catch (error) {
      rl.close();
      throw error;
    }
  }

  async handleNaturalLanguage() {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise((resolve) => {
      rl.question(prompt, resolve);
    });

    try {
      console.log('\n🤖 Natural Language Mode');
      console.log('=' .repeat(30));
      console.log('You can type commands like:');
      console.log('- "extract my chat messages"');
      console.log('- "find internships in Mumbai"');
      console.log('- "search for computer science internships"');
      console.log('- "show my exported files"');
      console.log('');

      const userInput = await question('What would you like to do? ');
      rl.close();

      if (!userInput.trim()) {
        console.log('❌ Please provide a command.');
        return;
      }

      console.log('🧠 Processing your request...');
      
    
      const intent = await this.nlpProcessor.processCommand(userInput);
      
      console.log(`🎯 Detected intent: ${intent.action} (confidence: ${(intent.confidence * 100).toFixed(1)}%)`);

     
      switch (intent.action) {
        case 'extract_chats':
          await this.handleChatExtraction();
          break;
        case 'find_internships':
          await this.handleInternshipSearch();
          break;
        case 'view_files':
          await this.handleViewFiles();
          break;
        default:
          console.log('🤔 I\'m not sure what you want to do. Please try again with a clearer command.');
          break;
      }

    } catch (error) {
      rl.close();
      console.error('❌ Natural language processing failed:', error.message);
    }
  }

  async handleChatExtraction() {
    try {
      console.log('\n💬 Starting Chat Message Extraction...');
      console.log('=' .repeat(40));

      if (!this.chatBot) {
        this.chatBot = new WorkingInternshalaBot();
        await this.chatBot.initialize();
      }

      const results = await this.chatBot.extractAllChats();
      
      console.log('\n✅ Chat extraction completed successfully!');
      console.log(`📊 Extracted ${results.messages.length} messages from ${results.conversations.length} conversations`);

    } catch (error) {
      console.error('❌ Chat extraction failed:', error.message);
      logger.error('Chat extraction error:', error);
    }
  }

  async handleInternshipSearch() {
    try {
      console.log('\n🔍 Starting Internship Search...');
      console.log('=' .repeat(40));

      const inputs = await this.internshipScraper.promptUserInputs();
      console.log('\n📋 Search Configuration:');
      console.log(JSON.stringify(inputs, null, 2));

      const results = await this.internshipScraper.runScraper(inputs);
      
      if (results && results.length > 0) {
        this.internshipScraper.formatResults(results);
        await this.internshipScraper.exportToCSV(results, this.csvExporter);
      } else {
        console.log('📭 No internships found matching your criteria.');
      }

    } catch (error) {
      console.error('❌ Internship search failed:', error.message);
      logger.error('Internship search error:', error);
    }
  }

  async handleViewFiles() {
    try {
      console.log('\n📊 Exported Files');
      console.log('=' .repeat(30));

      const files = await this.csvExporter.listExportedFiles();
      
      if (files.length === 0) {
        console.log('📭 No exported files found.');
        return;
      }

      console.log(`Found ${files.length} exported files:\n`);
      
      files.forEach((file, index) => {
        const sizeKB = Math.round(file.size / 1024);
        const date = file.modified.toLocaleDateString();
        const time = file.modified.toLocaleTimeString();
        
        console.log(`${index + 1}. ${file.filename}`);
        console.log(`   📁 Size: ${sizeKB}KB`);
        console.log(`   📅 Modified: ${date} ${time}`);
        console.log(`   📍 Path: ${file.path}`);
        console.log('');
      });

    } catch (error) {
      console.error('❌ Failed to list files:', error.message);
      logger.error('File listing error:', error);
    }
  }

  async run() {
    try {
      await this.initialize();

      while (true) {
        const choice = await this.showMainMenu();

        switch (choice) {
          case '1':
            await this.handleChatExtraction();
            break;
          case '2':
            await this.handleInternshipSearch();
            break;
          case '3':
            await this.handleViewFiles();
            break;
          case '4':
            await this.handleNaturalLanguage();
            break;
          case '5':
            console.log('👋 Goodbye!');
            process.exit(0);
            break;
          default:
            console.log('❌ Invalid choice. Please select 1-5.');
            break;
        }

       
        console.log('\nPress Enter to continue...');
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        await new Promise(resolve => {
          rl.question('', () => {
            rl.close();
            resolve();
          });
        });
      }

    } catch (error) {
      console.error('❌ Application failed:', error);
      logger.error('Main application error:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async cleanup() {
    try {
      if (this.chatBot) {
        await this.chatBot.cleanup();
      }
      console.log('🧹 Cleanup completed');
    } catch (error) {
      logger.error('Cleanup error:', error);
    }
  }
}


process.on('SIGINT', async () => {
  console.log('\n🛑 Received interrupt signal. Cleaning up...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received termination signal. Cleaning up...');
  process.exit(0);
});


async function main() {
  console.log('🚀 Starting main application...');
  const mainBot = new MainInternshalaBot();
  await mainBot.run();
}


const isMainModule = process.argv[1] && process.argv[1].endsWith('main.js');
if (isMainModule) {
  console.log('📍 Main script detected, starting...');
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
} else {
  console.log('📍 Main script imported as module');
}


export { MainInternshalaBot };
