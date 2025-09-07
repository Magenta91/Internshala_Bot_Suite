# 🚀 Internshala Bot Suite

A professional automation suite for Internshala with chat message extraction and internship scraping capabilities.

## ✨ Quick Start

```bash
# Install dependencies
npm install
npm run install-playwright

# Configure credentials in .env file
INTERNSHALA_EMAIL=[your-email]
INTERNSHALA_PASSWORD=[your-password]

# Run the main application
npm run main
```

## 🎯 Core Features

- **💬 Chat Extraction**: Extract and export chat messages to CSV
- **🔍 Internship Scraping**: Find and export internship data
- **🤖 AI Interface**: Natural language command processing
- **📊 Data Export**: Professional CSV files for analysis

## 🚀 Available Commands

```bash
npm run main          # 🎯 Main integrated application (RECOMMENDED)
npm run chat          # 💬 Chat extraction only
npm run test-simple   # 🧪 Simple test with visual browser
npm run headful       # 👁️ Run with visible browser
```

## 📁 Project Structure

```
internshala-bot-suite/
├── 📁 src/              # Core source code
├── 📁 exports/          # Generated CSV files
├── 📁 data/             # Application data & cookies
├── 📁 logs/             # Application logs
├── main.js              # 🎯 Main application
├── working-bot.js       # 💬 Chat extraction
├── test-simple-extraction.js  # 🧪 Simple test
└── PROJECT-DOCUMENTATION.md   # 📚 Complete documentation
```

## 📊 Real Results

✅ **Proven Working**: Successfully extracts real chat messages and internship data  
✅ **CSV Export**: Professional data export for Excel/Google Sheets  
✅ **Account Compatible**: Works with restricted accounts  
✅ **Production Ready**: Tested with real Internshala data  

## 📚 Documentation

For complete documentation, workflow explanations, and technical details, see:
**[📖 PROJECT-DOCUMENTATION.md](./PROJECT-DOCUMENTATION.md)**

## ⚙️ Configuration

Create a `.env` file:
```env
INTERNSHALA_EMAIL=[your-email]
INTERNSHALA_PASSWORD=[your-password]
APIFY_API_TOKEN=[your-apify-token]  # Optional: for internship scraping
HEADFUL=false
DEBUG=false
```

## 🛠️ Troubleshooting

```bash
# Clear data and retry
npm run reset-cookies
npm run reset-data

# Run with visible browser for debugging
npm run headful

# Check logs
cat logs/debug.log
```

## 📄 License

MIT License - For educational and personal use only.

---

**🎉 Ready to automate your Internshala workflow!**