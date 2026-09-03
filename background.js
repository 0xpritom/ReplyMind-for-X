const casualWordBank = [
    "honestly", "literally", "actually", "basically", "kinda", "sorta", "tbh", "imo", "ngl", 
    "fr", "tho", "yep", "nope", "yeah", "nah", "yup", "btw", "haha", "lol", "damn", "bro", 
    "dude", "man", "guys", "fam", "folks", "mate", "wild", "crazy", "insane", "valid", 
    "based", "lowkey", "highkey", "deadass", "bruh", "100%", "facts", 
    "big facts", "no cap", "vibes", "fire", "dope", "sick", "legendary", "epic", 
    "goat", "bet", "word", "real", "true", "exactly", "spot on", 
    "nailed it", "frfr", "iykyk", "bullish", "bearish", "gem", 
    "alpha", "frens", "anon", "degens", "normies", "wagmi", "ngmi", "fud", "fomo", 
    "rekt", "moon", "lfg", "gm", "gn", "ser", 
    "based", "chad", "ape", "grind", "sheesh",
    "yikes", "oof", "rip", "gg", "af", "rn", "atm", "omg",
    "lmao", "smh", "nvm", "idk", "idc", "imho", "tldr", "fyi", "def", "totes", "obvs", "probs", "srsly",
    "legit", "literally", "basically", "essentially", "apparently",
    "obviously", "definitely", "absolutely", "totally", "completely",
    "wow", "whoa", "woah", "jeez", "heck",
    "yo", "hey", "sup", "peace",
    "cya", "later", "cheers", "thx", "ty", "my bad", "mb", "cool", "nice", "sweet", "awesome",
    "amazing", "great", "okay",
    "ok", "k", "kk", "alright", "aight", "sure", "fine", "whatever", "anyways",
    "like", "just", "really", "very", "so",
    "way", "crazy", "insane", "wild", "mad", "nutty", "ridiculous",
    "unreal", "epic",
    "legendary", "god tier", "top tier", "mid"
];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'generate') {
        generateComment(request.text, request.parentText, request.lang, request.author, request.isReply, request.wordCount)
            .then(reply => sendResponse({ reply }))
            .catch(error => sendResponse({ error: error.message }));
        return true;
    } else if (request.action === 'resetFeed') {
        chrome.tabs.create({ url: 'https://x.com/home' }, (newTab) => {
            if (sender.tab && sender.tab.id) {
                chrome.tabs.remove(sender.tab.id);
            }
        });
        return true;
    }
});

async function generateComment(text, parentText, langCode, authorHandle, isReply, wordCount) {
    const data = await chrome.storage.local.get(['apiKey', 'apiKeys', 'currentApiKeyIndex', 'userMemory']);
    let apiKeysList = [];
    if (data.apiKeys) {
        apiKeysList = data.apiKeys.split(/[\r\n,]+/).map(k => k.trim()).filter(k => k);
    } else if (data.apiKey) {
        apiKeysList = [data.apiKey.trim()];
    }
    
    if (apiKeysList.length === 0) {
        throw new Error("No API key set in extension popup.");
    }
    
    let currentIndex = data.currentApiKeyIndex || 0;
    if (currentIndex >= apiKeysList.length) currentIndex = 0;

    const url = "https://api.groq.com/openai/v1/chat/completions";
    
    let userMemory = data.userMemory || {};
    let memoryInstruction = "";
    if (authorHandle && userMemory[authorHandle]) {
        memoryInstruction = `\nMEMORY/RELATIONSHIP: You have interacted with this user (@${authorHandle}) before! Your last interaction with them was: "${userMemory[authorHandle]}". You MUST casually acknowledge them like an old internet friend or mutual (e.g., "good to see u again", "still at it I see", or reference the past interaction).`;
    }

    let languageInstruction = `CRITICAL RULE: The original post was written in this language: "${langCode}". You MUST write your reply entirely in that exact language (e.g., if it says Japanese or 'ja', you must reply in Japanese).`;
    if (!langCode || langCode === 'unknown') {
        languageInstruction = `CRITICAL RULE: You must write the comment in the EXACT SAME LANGUAGE as the original post.`;
    }
    
    // (Removed old contradictory mentionInstruction logic)
    
    let randomLengthInstruction = "";
    if (isReply && wordCount > 0) {
        const targetWords = Math.max(2, Math.floor(wordCount / 2));
        const minWords = Math.max(2, targetWords - 2);
        const maxWords = targetWords + 2;
        randomLengthInstruction = `CRITICAL RULE FOR REPLIES: You are replying to a comment. Your reply MUST be approximately HALF the length of the comment you are replying to. The comment is ${wordCount} words long, so your reply MUST be strictly between ${minWords} and ${maxWords} words.`;
    } else {
        const lengthVariations = [
            "Keep the comment short and punchy, around 4 to 8 words.",
            "Keep the comment moderate in length, around 8 to 12 words.",
            "Keep the comment slightly detailed, around 12 to 16 words."
        ];
        randomLengthInstruction = lengthVariations[Math.floor(Math.random() * lengthVariations.length)];
    }
    
    let authorInstruction = "";
    if (authorHandle && Math.random() < 0.01) {
        const firstName = authorHandle.split(' ')[0];
        authorInstruction = `CRITICAL RULE: You MUST start your comment by casually addressing the poster by their first name: "${firstName}" (e.g. "${firstName}, tbh this is wild"). NEVER put their name in the middle or at the end. NEVER put an '@' symbol before their name.`;
    }
    
    const shuffledWords = casualWordBank.sort(() => 0.5 - Math.random());
    const randomWords = shuffledWords.slice(0, 6).join(", ");
    
    // Extract @mentions from the text to enforce their usage
    const projectMentions = (text || "").match(/@\w+/g);
    let exactMentionRule = "Do not use the '@' symbol or any @usernames in your reply.";
    if (projectMentions && projectMentions.length > 0) {
        if (Math.random() < 0.05) {
            const uniqueMentions = [...new Set(projectMentions)].join(', ');
            const exampleMention = projectMentions[0];
            exactMentionRule = `\nCRITICAL RULE ABOUT PROJECTS: The original post tags these specific handles: ${uniqueMentions}. You MUST casually mention the project in your reply. When you do, YOU ABSOLUTELY MUST INCLUDE THE '@' SYMBOL. For example, write "${exampleMention}". DO NOT write the name without the '@'. DO NOT use any other @usernames.`;
        }
    }
    
    let parentContextInstruction = "";
    let targetLabel = 'Post:';
    if (parentText && isReply) {
        parentContextInstruction = `CONTEXT: You are replying to a comment under a main post. The main post is: "${parentText}". Use this context to better understand the comment you are replying to.\n`;
        targetLabel = 'Comment to reply to:';
    }

    const prompt = `Act as a regular, everyday Twitter user casually scrolling through your feed. The posts in your feed are heavily project-related. Write a 'mindshare' style comment that adds real value or shares a thoughtful opinion about the core idea or project in the post.

CRITICAL RULES FOR HUMAN-LIKE REPLIES:
1. Meaningful but Casual: You MUST provide an actual insight or relevant opinion about the project/topic. DO NOT just write an empty reaction like "damn bro this is crazy". However, your insight MUST be written in an extremely casual, lazy, internet-native tone.
2. Vocabulary: DO NOT use formal or AI-like vocabulary (e.g., 'insightful', 'delve', 'realm', 'crucial', 'testament'). Write like a real, everyday human on Crypto/Tech Twitter. 
IMPORTANT: Never start your comments with the same word repeatedly (do NOT always start with 'Tbh', 'Honestly', or 'Bro'). Use varied, natural sentence structures and a casual vibe.
Optional Vibe Check: If it feels completely natural, you may casually use words similar to these: [ ${randomWords} ]. But DO NOT force them. Just adopt their casual vibe.
3. Mindshare & Projects: Casually react to the main project or topic. ${exactMentionRule}
4. Short Greetings & General Comments: If the post is a simple short greeting (like "GN", "GM", "hello", "good night"), DO NOT just repeat the exact same greeting. Mix it up naturally with casual, non-professional variations and modern viral internet slang (e.g., if someone says "GN", you could say "catch you tomorrow", "night bro", "sleep well", or use slangs like "W", "bet", "fr", "real"). Never sound like a stiff professional; keep the vibe super natural, casual, and use current internet slang when appropriate. Do not try to overanalyze or find a project in these short greetings.
5. Tone: Keep it conversational, raw, and direct. Do not sound like an analytical essay.
6. Formatting & Punctuation: Keep formatting extremely lazy. DO NOT use commas (,), hyphens (-), or underscores (_). Start with a lowercase letter and use no final period. Do not provide explanations or enclose the comment in quotes.
7. ${randomLengthInstruction} 
8. ${languageInstruction} 
9. ${authorInstruction}
10. Do not use hashtags. 
11. Emotional Intelligence: Analyze the emotional tone of the post. If they are frustrated, show empathy or shared pain. If excited, match their hype. Connect emotionally before dropping logic.
12. Logical Disagreement: Occasionally (about 15-20% of the time), gently disagree, play devil's advocate, or point out a logical flaw (e.g., 'good point but what about...', 'not sure if that scales tbh').
13. Personal Anecdotes: Instead of always stating facts, sometimes frame your insight as a personal experience (e.g., 'always struggled with this until...', 'tried this last week and...').
14. Curiosity: Sometimes end your comment with a casual, open-ended question to spark a conversation (e.g., 'how long did that take u?', 'curious how u handled [X]').
15. Sarcasm & Humor: Use mild, relatable internet humor or self-deprecation when appropriate, especially on topics like coding struggles or market crashes.
16. Moderation & Restraint (CRITICAL): Do NOT overuse viral internet slang, questions, disagreements, or anecdotes in every single reply. Use these features sparingly and ONLY if the context naturally calls for it. A real human doesn't try to be funny, use slang, or ask a question in every single sentence. Sometimes a simple, straight-to-the-point casual insight is best.
17. Media & GIFs: If the post is extremely relatable, funny, or frustrating, you can choose to reply with JUST a GIF instead of text. To do this, your ENTIRE response must be EXACTLY: [GIF: keyword] (e.g., [GIF: facepalm], [GIF: laughing], [GIF: crying]). Use this about 5-10% of the time instead of a text reply.

${parentContextInstruction}${memoryInstruction}
${targetLabel} "${text}"`;
    
    let maxRetries = apiKeysList.length;
    let attempt = 0;
    let lastError = null;
    let comment = "";

    while (attempt < maxRetries) {
        const apiKey = apiKeysList[currentIndex];
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "openai/gpt-oss-20b", 
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7
                })
            });

            const result = await response.json();
            
            if (response.status === 429 || (result.error && result.error.message && result.error.message.toLowerCase().includes('rate limit'))) {
                console.log(`Key at index ${currentIndex} rate limited. Switching to next key.`);
                currentIndex = (currentIndex + 1) % apiKeysList.length;
                await chrome.storage.local.set({ currentApiKeyIndex: currentIndex });
                attempt++;
                lastError = new Error(result.error ? result.error.message : "Rate limit exceeded");
                continue;
            }
            
            if (result.error) {
                throw new Error(result.error.message);
            }
            
            comment = result.choices[0].message.content.trim();
            
            if (comment.startsWith('"') && comment.endsWith('"')) {
                comment = comment.substring(1, comment.length - 1);
            }
            
            comment = comment.replace(/[.。]+$/, '').trim();
            
            if (comment.length > 0 && !comment.startsWith("[GIF:")) {
                comment = comment.charAt(0).toUpperCase() + comment.slice(1);
                comment = applyImperfections(comment);
            }

            // Save memory
            if (authorHandle && !comment.startsWith("[GIF:")) {
                const keys = Object.keys(userMemory);
                if (keys.length > 500) {
                    delete userMemory[keys[0]];
                }
                userMemory[authorHandle] = `They posted: "${text.substring(0, 50)}..." and you replied: "${comment}"`;
                await chrome.storage.local.set({ userMemory });
            }

            return comment;

        } catch (e) {
            console.error("Groq API Error:", e);
            if (e.message && e.message.toLowerCase().includes('rate limit')) {
                currentIndex = (currentIndex + 1) % apiKeysList.length;
                await chrome.storage.local.set({ currentApiKeyIndex: currentIndex });
                attempt++;
                lastError = e;
                continue;
            }
            throw e; // Non-rate limit error, throw immediately
        }
    }
    
    throw lastError || new Error("All API keys are rate limited or failed.");
}

function applyImperfections(text) {
    if (Math.random() > 0.3) return text; // 30% chance to apply any imperfection
    
    let modified = text;
    
    // 1. Swap 'the' with 'teh'
    if (Math.random() < 0.3) modified = modified.replace(/\bthe\b/g, "teh");
    
    // 2. Remove trailing punctuation
    if (Math.random() < 0.5) modified = modified.replace(/[.,!?]+$/, "");
    
    // 3. Lowercase first letter occasionally
    if (Math.random() < 0.5 && modified.length > 0) {
        modified = modified.charAt(0).toLowerCase() + modified.slice(1);
    }
    
    // 4. Just -> jsut
    if (Math.random() < 0.2) modified = modified.replace(/\bjust\b/g, "jsut");
    
    return modified;
}
