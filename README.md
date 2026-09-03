# ReplyMind for X (Automated AI Engagement Extension)

A smart, automated Google Chrome extension that reads your X (formerly Twitter) feed and posts highly authentic, human-like, context-aware replies using AI. It uses the Groq API (running `openai/gpt-oss-20b`) to generate natural comments and includes advanced humanized interactions like reading delays, sentiment matching, and dynamic contextual understanding.

## ✨ Core Features

- **🧠 Emotional Intelligence & Empathy**: The bot reads the underlying sentiment of a post. It shows empathy for struggles (like coding bugs or market dumps) and matches the hype for exciting announcements before dropping logical insights.
- **🗣️ Authentic Human Behavior**:
  - **Logical Disagreement**: Occasionally plays devil's advocate or gently disagrees (15-20% chance) to avoid sounding like a robotic "yes-man".
  - **Personal Anecdotes**: Frames its insights as personal experiences rather than generic facts (e.g., "I always struggled with this until...").
  - **Curiosity & Conversation Starters**: Frequently ends comments with open-ended questions to spark real engagement.
  - **Relatable Humor**: Uses mild internet sarcasm and self-deprecation where appropriate.
- **🧵 Context-Aware Comment Replies**: When used inside a comment section, the bot automatically extracts the Main Post's text. It feeds this context to the AI so the bot knows exactly what the overarching conversation is about before replying to a specific comment.
- **🎯 Dynamic Prompt Targeting**: Seamlessly adjusts its AI prompts based on whether it is reading a post on your home feed or replying to a comment inside a thread.
- **⭐ Action Modes**: Choose how the bot interacts:
  - **Reply Only**: Generates and posts comments.
  - **Like Only**: Automatically likes relevant tweets.
  - **Both**: Likes the tweet and posts a reply.
- **👑 Influence Score Filter (KOL Filter)**: Filter tweets based on the author's influence score (number of followers/stats found in their avatar info). Only interact with high-value accounts.
- **🔑 Multi-Key Rotation**: Input multiple Groq API keys (one per line). The bot automatically rotates to the next key if a rate limit (`429`) is hit, ensuring uninterrupted operation.

## 🚀 Installation

Since this is an unpacked extension, you'll need to load it in Developer Mode:

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. Select the folder containing the extension files.
6. The extension is now installed! You should see the ReplyMind icon in your Chrome toolbar.

## 🛠️ Usage

1. Click on the extension icon in your toolbar to open the popup.
2. Enter your **Groq API Keys** in the provided field (you can paste multiple keys, one per line) and click **Save Settings**.
3. Select your **Action Mode** (Both, Like, or Reply).
4. (Optional) Set an **Influence Score** threshold and toggle the filter ON if you only want to interact with larger accounts.
5. Toggle the **Bot Status** switch to turn the auto-replier ON. 
6. Open [X (Twitter)](https://x.com/) in a new tab. 
7. Watch as the bot automatically scans the feed, selects posts, reads the context, generates empathetic replies, and interacts on your behalf!

## ⚠️ Important Notes & Best Practices

- **Rate Limits & Bans**: Use automation on Twitter at your own risk. The random delays and human-like scrolling mechanics are designed to reduce the chances of your account being flagged, but X can still detect automated behavior. 
- **Screen Visibility**: The script scans the tweets currently visible in the DOM. Ensure your tab remains active for the most consistent behavior. 

## 💻 Technical Stack

- Vanilla JavaScript (ES6)
- Chrome Extension Manifest V3
- Groq API (`openai/gpt-oss-20b` via OpenAI-compatible endpoints)
- CSS3 (Glassmorphism & modern UI in popup)
