# Wanna grab coffee? ☕

Never miss your next connection

Developed by violinmeiling for the Photon team 🔥

## Overview

You know when you meet a really interesting person at a party, and then you get their number, and you two are like, "Yo, we should get coffee sometime", and then you just...never follow up with them? It's especially bad when you've also had a few drinks. The last thing you want is to meet the person who could potentially be your next greatest networking connection (or date (or both, why not?)) and totally forget about them when you wake up in the morning. 

So, I built a text message app that lets you quickly log a new person as soon as you meet them, and you can request a reminder text + message draft for whenever you've sobered up and are ready to send that coffee chat follow-up.

## Demo



## How to use

- Text yourself, "Met [NAME] at [EVENT], [INCLUDE ANY OPTIONAL DETAILS HERE]"
- We'll scan your Google Calendar and find some times (>1 hour gap) you're available to get coffee with them
- We'll write a short text inviting them to get coffee with you with your available times
- You can set a reminder for the following morning, in X hours, or none at all
- Type "summary" for a list of everyone you've met recently

## Requirements

- You will need a Macbook
- Allow Full Disk Access for Terminal/VSCode/whatever you are running this in
- Google Calendar API
- OpenAI API key

## Get started

1. **Clone and Install**
   ```bash
   git clone [your-repo-url]
   cd wanna-grab-coffee
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and settings
   ```

3. **Grant Permissions**
   - Open System Settings → Privacy & Security → Full Disk Access
   - Add your terminal/IDE (Terminal, VS Code, etc.)

4. **Configure APIs**
   - Set up Google Calendar OAuth (see setup guide below)
   - Get OpenAI API key

5. **Build and Run**
   ```bash
   npm run build
   npm start
   ```

6. **Test It Out**
   Send yourself a text: `"met Benjamin at Penn, he founded this university"`

## Setup Guide

### Google Calendar API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Google Calendar API
4. Create credentials (OAuth 2.0 Client ID) - choose "Desktop application"
5. Download the credentials JSON file and save as `credentials.json` in project root

### OpenAI API

1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add `OPENAI_API_KEY` to your `.env`

## Usage

### Basic Commands

You can text yourself any of these messages:

- `"met Benjamin at Penn, he founded this university"` - Log a new contact
- `"summary"` - Get recent contacts summary

### Follow-up Flow

1. **Log Contact**: Text about meeting someone in the format `met [NAME] at [EVENT], [CONTEXT]`
2. **Choose Timing**: Reply with when to remind you:
   - `"now"` - Send it immediately
   - `"tomorrow"` - Remind me tomorrow morning
   - `"in 2 hours"` - Custom timing
   - `"no"` - Don't set a reminder
   - `"cancel"` - Don't save contact

3. **Get Reminded**: Receive follow-up prompt at scheduled time

## Architecture

```
src/
├── services/
│   ├── calendarService.ts      # Google Calendar integration
│   ├── aiService.ts           # OpenAI integration  
│   ├── schedulerService.ts    # Reminder scheduling
│   └── databaseService.ts     # SQLite contact storage
├── utils/
│   └── messageParser.ts       # Message format parsing
├── types/
│   └── index.ts              # TypeScript definitions
├── coffeeNetworkingApp.ts    # Main application logic
└── index.ts                  # Entry point
```

## Configuration

### Environment Variables

```bash
# OpenAI API
OPENAI_API_KEY="sk-your-openai-key"

# Database (optional - uses default if not specified)
DATABASE_PATH="./data/coffee_network.db"
```

## Troubleshooting

### Permission Issues
- Ensure Full Disk Access is granted to your terminal/IDE
- Try running from Terminal.app first
- Check System Settings → Privacy & Security

### API Issues  
- Verify OpenAI API key in `.env`
- Check Google Cloud Console quotas
- Ensure Calendar API is enabled

### Message Not Parsing
- Use exact format: "met [Name] at [Event], [optional context]"
- Check for typos in contact names
- Use "summary" command to verify app is working

## Privacy & Security

- **Local Storage**: All contacts stored in local SQLite database
- **No External Data**: Contact info never sent to external services
- **API Usage**: Only sends anonymous context to AI for message generation
- **iMessage Access**: Read-only access to your message database

## Development

```bash
# Development mode with hot reload
npm run dev

# Type checking
npm run type-check

# Build for production  
npm run build

# Run tests
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

Having issues? Email me at violinmeiling@gmail.com