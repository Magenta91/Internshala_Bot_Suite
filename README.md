ntroduction to the Project
This GitHub repository, "Magenta91/Internshala_Bot_Suite" (available at https://github.com/Magenta91/Internshala_Bot_Suite), is an open-source automation tool I built for Internshala.com, a popular platform for internships in India. It's a professional-grade bot suite designed to automate two main tasks: extracting chat messages from your Internshala conversations and scraping internship listings based on custom filters. The project is written in Node.js and uses libraries like Playwright for browser automation, Apify for web scraping, and optional AI integrations (like Google's Gemini API) for natural language processing (NLP). It's licensed under MIT, meaning it's free for educational and personal use, but users must comply with Internshala's terms to avoid account issues.
The goal was to create a tool that saves time for students or job seekers by automating repetitive tasks, like pulling conversation history for record-keeping or searching for tailored internships without manual browsing. It's production-ready, tested on real accounts (including restricted ones), and exports data in clean CSV formats for easy analysis in tools like Excel or Google Sheets.
Key Features
The suite has three core pillars: chat automation, internship scraping, and an AI-powered interface. Here's a breakdown:

Chat Automation (Message Extraction):

Extracts all messages from your Internshala chats, including multi-conversation support.
Classifies messages as "sent" (by you) or "received" (from others).
Analyzes content: Detects links, mentions (@users), message lengths, timestamps, and DOM classes for accuracy.
Exports data to multiple CSV files: one for raw messages, one for conversation metadata (e.g., message count, last activity), and one for stats (e.g., total messages, sent vs. received).
Works even on "on hold" or restricted accounts, making it robust.


Internship Scraping:

Uses Apify (a cloud-based scraping platform) to fetch internship listings from Internshala.
Supports advanced filters: job category (e.g., "Machine Learning"), location (e.g., "REMOTE" or "Mumbai"), work type (full-time/part-time/work-from-home), minimum stipend, and pages to scrape.
Pulls detailed data: company name, location, duration, stipends, apply URLs, job URLs, and flags like "actively hiring" or "early applicant."
Exports to a CSV with all this info, plus scrape timestamps for tracking.


AI-Powered Interface:

Includes NLP for natural language commands (e.g., say "extract my chat messages" or "find internships in Mumbai" instead of typing rigid commands).
Intent recognition: Breaks down user input into tokens, matches keywords (e.g., "extract", "chat"), scores confidence, and executes the best match.
Optional integration with Google's Gemini API for better context awareness, conversation memory, and suggestions if commands are unclear.
Dual modes: Menu-driven (simple numbered options) or NLP mode for flexibility.


Data Export and Analysis:

All outputs are CSV files stored in an exports/ folder with timestamps (e.g., chat_history_2025-09-06.csv).
Includes analytics: For chats, stats like total messages or messages with links; for internships, summary trends.
Designed for easy import into spreadsheets for further analysis.



How It Works: Technical Architecture and Workflows
The project is structured as a modular Node.js application with a clear data flow. It uses Playwright for simulating browser interactions (like logging in and navigating pages) and Apify for heavy-duty scraping to avoid detection and handle scale.
Project Structure

src/: Core logic files (e.g., auth.js for login, chat.js for message extraction, internship-scraper.js for Apify calls, nlp.js for AI processing).
utils/: Helpers like logging (logger.js).
data/: Stores sessions (cookies.json), chat history (JSON cache), and other runtime data.
exports/: Where CSVs are saved.
logs/: Debug, error, and exception logs for troubleshooting.
Entry points: main.js (integrated app), working-bot.js (chat-only), test-simple-extraction.js (debugging).

Data flow: User input → Main app processes (with NLP if enabled) → Bot modules execute (scraping/extraction) → Data storage/processing → CSV export.
Chat Extraction Workflow

Authentication: Loads saved cookies from data/cookies.json. If invalid, logs in using email/password from .env, solves any CAPTCHA (via captcha.js), and saves new cookies for reuse.
Navigation: Uses Playwright to open a browser (headless by default, but visible with HEADFUL=true), goes to Internshala's chat page, identifies conversations.
Extraction: Queries DOM elements to pull messages. Classifies based on sender (e.g., "me" for your messages). Analyzes text for links/mentions using regex/smart-matching algorithms.
Processing: Cleans data (normalize timestamps, calculate lengths), generates metadata/stats.
Export: Writes to CSVs in exports/. Example row in messages CSV: Message ID, Sender, Text, Timestamp, Contains Links, etc.
Anti-Detection: Adds delays, random mouse movements, user-agent rotation to mimic human behavior.

This runs in 5-10 seconds for ~10 messages, with 100% accuracy in tests.
Internship Scraping Workflow

Configuration: User inputs filters via menu or NLP (e.g., category, location).
Scraping: Submits a job to Apify's Actor (via API token in .env). Apify handles the actual scraping on their cloud servers, monitoring progress and handling errors/rate limits.
Retrieval: Fetches results from Apify's dataset (JSON format), transforms it (e.g., adds flags like "actively hiring").
Analysis/Export: Applies final filters, generates stats, exports to CSV (e.g., Company, Stipend, Apply URL).
Performance: 30-60 seconds for 50+ internships, with high reliability via Apify's infrastructure.

AI Integration

Basic NLP: Uses predefined patterns in nlp.js (e.g., keywords like "find" trigger internship mode).
Advanced: If GEMINI_API_KEY is set, sends queries to Gemini for better parsing (e.g., understands "search for CS internships in remote mode").
Confidence-based: Scores matches (e.g., 0.9 for exact keywords) and suggests alternatives if low.

The whole system is retryable (up to 3 times) with timeouts (30s default) for reliability.
Technologies and Dependencies

Core: Node.js (ES6+ with async/await).
Browser Automation: Playwright (for login, navigation, extraction; installs browsers via npm run install-playwright).
Scraping: Apify API (cloud-based, requires token; handles anti-bot measures better than local scraping).
AI/NLP: Custom patterns + optional Gemini API.
Utilities: dotenv for .env, csv-writer for exports, winston for logging.
No internet for deps beyond npm; all local after install.

Setup and Usage

Installation: Clone repo, npm install, npm run install-playwright.
Config: Create .env with INTERNSHALA_EMAIL, PASSWORD, APIFY_API_TOKEN (optional for scraping), GEMINI_API_KEY (optional).
Run: npm run main for full app. Choose options from menu or use NLP. For debugging: npm run headful (visible browser) or DEBUG=true for logs.
Troubleshoot: Reset cookies/data with npm scripts; check logs in logs/.

Important Details: Security, Performance, and Best Practices

Security: Local-only data (no cloud upload), credential protection via .env, stealth features to avoid bans (e.g., randomized delays). Disclaimer: For personal/educational use; respect Internshala's TOS.
Performance: High success rate (100% for chats, 99% for scraping); fast and scalable via Apify.
Maintenance: Update deps with npm update; clear old data with scripts.
Contributing: Fork, branch, PR; follow code style (error handling, logging).
