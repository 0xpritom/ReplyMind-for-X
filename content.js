let isEnabled = false;
let isRunning = false;
let statusBox = null;
let japaneseOnly = false;
let likeMode = false;

// --- Visual UI Setup ---
function createStatusUI() {
    if (document.getElementById('x-bot-status')) return;
    
    statusBox = document.createElement('div');
    statusBox.id = 'x-bot-status';
    statusBox.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 24px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 20px;
        color: #111827;
        z-index: 999999;
        font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        min-width: 280px;
        max-width: 320px;
        pointer-events: none;
        display: none;
        transform: translateY(0);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    
    const title = document.createElement('div');
    title.innerHTML = '✨ <b>Global Auto-Reply v2.1</b>';
    title.style.marginBottom = '12px';
    title.style.fontSize = '1.1rem';
    title.style.fontWeight = '800';
    title.style.color = '#111827';
    title.style.borderBottom = '1px solid #e2e8f0';
    title.style.paddingBottom = '8px';
    
    const text = document.createElement('div');
    text.id = 'x-bot-text';
    text.innerText = 'Initializing...';
    text.style.fontSize = '14.5px';
    text.style.lineHeight = '1.5';
    text.style.color = '#475569';
    
    statusBox.appendChild(title);
    statusBox.appendChild(text);
    document.body.appendChild(statusBox);
}

function updateStatus(message, tweetElement = null) {
    if (!statusBox) createStatusUI();
    
    statusBox.style.display = isEnabled ? 'block' : 'none';
    
    const textEl = document.getElementById('x-bot-text');
    if (textEl) textEl.innerText = message;
    console.log("[Auto-Replier]", message);
    
    // Clear old highlights
    document.querySelectorAll('.x-bot-highlight').forEach(el => {
        el.style.border = el.dataset.oldBorder || '';
        el.style.borderRadius = el.dataset.oldRadius || '';
        el.classList.remove('x-bot-highlight');
    });
    
    // Highlight current tweet
    if (tweetElement) {
        tweetElement.dataset.oldBorder = tweetElement.style.border;
        tweetElement.dataset.oldRadius = tweetElement.style.borderRadius;
        tweetElement.style.border = '2px dashed #17BF63';
        tweetElement.style.borderRadius = '16px';
        tweetElement.classList.add('x-bot-highlight');
        
        // Ensure tweet is somewhat visible on screen
        const rect = tweetElement.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
            tweetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

// React often ignores standard .click(). We need a full mouse simulation.
function simulateClick(element) {
    const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    events.forEach(ev => {
        element.dispatchEvent(new MouseEvent(ev, {
            view: window,
            bubbles: true,
            cancelable: true,
            buttons: 1
        }));
    });
}
// ----------------------

// Load settings on startup
let repliedHistory = [];

chrome.storage.local.get(['enabled', 'repliedHistory', 'japaneseOnly', 'likeMode'], (res) => {
    isEnabled = res.enabled || false;
    japaneseOnly = res.japaneseOnly || false;
    likeMode = res.likeMode || false;
    repliedHistory = res.repliedHistory || [];
    if (isEnabled && !isRunning) startBot();
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled !== undefined) {
        isEnabled = changes.enabled.newValue;
        if (isEnabled && !isRunning) startBot();
        else if (!isEnabled) updateStatus("Bot disabled.");
    }
    if (changes.japaneseOnly !== undefined) {
        japaneseOnly = changes.japaneseOnly.newValue;
    }
    if (changes.likeMode !== undefined) {
        likeMode = changes.likeMode.newValue;
    }
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min, max) => sleep(Math.floor(Math.random() * (max - min + 1)) + min);

async function startBot() {
    if (isRunning) return;
    isRunning = true;
    createStatusUI();
    updateStatus("Starting up...");

    while (isEnabled) {
        try {
            updateStatus("Scanning for new tweets on screen...");
            
            // Check for unwanted blocking modals/popups before scanning
            const blockingModal = document.querySelector('[role="dialog"]');
            if (blockingModal) {
                updateStatus("Unwanted popup detected. Opening feed in a new tab...");
                await randomDelay(1000, 2000);
                chrome.runtime.sendMessage({ action: 'resetFeed' });
                return;
            }

            // Try to find logged-in user
            let loggedInUserHandle = null;
            const profileLink = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
            if (profileLink) {
                const href = profileLink.getAttribute('href');
                if (href) {
                    loggedInUserHandle = href.split('?')[0].replace('/', '').toLowerCase();
                }
            }

            const tweets = Array.from(document.querySelectorAll('article[data-testid="tweet"]:not([data-auto-replied])'));
            
            if (tweets.length === 0) {
                updateStatus("No new tweets found. Scrolling down...");
                window.scrollBy({ top: 700, behavior: 'smooth' });
                await randomDelay(3000, 5000);
                continue;
            }

            for (let tweet of tweets) {
                if (!isEnabled) break;
                
                tweet.setAttribute('data-auto-replied', 'true');
                
                // Extract Unique Post URL and Author Handle
                const timeLink = tweet.querySelector('a[href*="/status/"]');
                let postUrl = null;
                let authorHandle = null;
                if (timeLink) {
                    const match = timeLink.href.match(/([^/]+)\/status\/(\d+)/);
                    if (match) {
                        authorHandle = match[1].toLowerCase();
                        postUrl = `/${match[1]}/status/${match[2]}`;
                    }
                }
                
                let authorName = null;
                const userNameEl = tweet.querySelector('div[data-testid="User-Name"]');
                if (userNameEl) {
                    authorName = userNameEl.innerText.split('\n')[0].trim();
                }
                
                if (loggedInUserHandle && authorHandle === loggedInUserHandle) {
                    updateStatus("Skipping: This is my own post.", tweet);
                    continue; 
                }
                
                if (postUrl && repliedHistory.includes(postUrl)) {
                    // We already interacted with this post in the past
                    updateStatus("Skipping: Already interacted with this post in the past.", tweet);
                    continue; // No need for delay here, just skip instantly
                }
                
                // Check if already liked (indicates we likely already interacted with it)
                const unlikeBtn = tweet.querySelector('[data-testid="unlike"]');
                if (unlikeBtn) {
                    updateStatus("Skipping: Post is already liked.", tweet);
                    continue;
                }
                
                const textElement = tweet.querySelector('div[data-testid="tweetText"]');
                if (!textElement) {
                    updateStatus("Skipping: No text found in this tweet.", tweet);
                    await randomDelay(500, 1000);
                    continue; 
                }
                
                const tweetText = textElement.innerText;
                let tweetLang = textElement.getAttribute('lang') || 'unknown';
                
                const translationMatch = tweet.innerText.match(/Translated from ([A-Za-z]+)/i);
                if (translationMatch && translationMatch[1]) {
                    tweetLang = translationMatch[1]; // e.g. "Japanese"
                }
                
                if (tweetText.trim() === "") {
                    updateStatus("Skipping: Tweet text is empty.", tweet);
                    await randomDelay(500, 1000);
                    continue;
                }

                if (japaneseOnly && tweetLang !== 'ja' && tweetLang !== 'Japanese') {
                    updateStatus("Skipping: Not a Japanese comment (JP Only mode is ON).", tweet);
                    await randomDelay(500, 1000);
                    continue;
                }

                updateStatus(`Reading tweet...\n"${tweetText.substring(0, 40)}..."`, tweet);
                
                // Simulate human reading time based on text length, with more randomness
                const readingTime = Math.min(2500, tweetText.length * 15);
                await randomDelay(readingTime, readingTime + 1500);



                updateStatus(`Thinking of a reply using Grok AI...`, tweet);
                
                let replyText = null;
                try {
                    replyText = await new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage({ action: 'generate', text: tweetText, lang: tweetLang, author: authorName }, (response) => {
                            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                            else if (response && response.error) reject(new Error(response.error));
                            else resolve(response.reply);
                        });
                    });
                } catch (e) {
                    updateStatus(`API Error: ${e.message}\n(Skipping post)`, tweet);
                    await randomDelay(4000, 5000);
                    continue; 
                }

                if (!replyText || replyText.trim() === "") {
                    updateStatus("Skipping: Grok generated an empty reply.", tweet);
                    await randomDelay(2000, 2000);
                    continue;
                }

                updateStatus(`Generated Reply:\n"${replyText}"\n\nPreparing to click...`, tweet);
                await randomDelay(500, 1000);

                const replyBtn = tweet.querySelector('[data-testid="reply"]');
                if (replyBtn) {
                    if (likeMode) {
                        const likeBtn = tweet.querySelector('[data-testid="like"]');
                        if (likeBtn) {
                            updateStatus(`Clicking like button...`, tweet);
                            simulateClick(likeBtn);
                            await randomDelay(500, 1000);
                        } else {
                            const unlikeBtn = tweet.querySelector('[data-testid="unlike"]');
                            if (unlikeBtn) {
                                updateStatus(`Already liked.`, tweet);
                            }
                        }
                    }

                    updateStatus(`Clicking reply button...`, tweet);
                    simulateClick(replyBtn);
                    
                    await randomDelay(1000, 1500); 
                    
                    const textBox = document.querySelector('[data-testid="tweetTextarea_0"]');
                    if (textBox) {
                        updateStatus(`Typing reply...`, tweet);
                        textBox.focus();
                        
                        const dataTransfer = new DataTransfer();
                        dataTransfer.setData('text/plain', replyText);
                        textBox.dispatchEvent(new ClipboardEvent('paste', {
                            clipboardData: dataTransfer,
                            bubbles: true,
                            cancelable: true
                        }));
                        
                        await randomDelay(500, 1000);
                        
                        const submitBtn = document.querySelector('[data-testid="tweetButton"]');
                        if (submitBtn && !submitBtn.disabled) {
                            updateStatus(`Clicking send...`, tweet);
                            simulateClick(submitBtn);
                            
                            // Increment Stats Counter and Update History
                            chrome.storage.local.get(['repliedCount'], (res) => {
                                const count = res.repliedCount || 0;
                                if (postUrl) {
                                    repliedHistory.push(postUrl);
                                    if (repliedHistory.length > 500) repliedHistory.shift(); // Keep only last 500
                                }
                                chrome.storage.local.set({ 
                                    repliedCount: count + 1, 
                                    repliedHistory: repliedHistory 
                                });
                            });
                            
                        } else {
                            updateStatus(`Error: Send button not found or disabled. Opening feed in a new tab...`, tweet);
                            await randomDelay(3000, 3000);
                            chrome.runtime.sendMessage({ action: 'resetFeed' });
                            return;
                        }
                        
                        updateStatus(`Reply process finished! Cooling down...`, tweet);
                    } else {
                        updateStatus(`Error: Could not find text box in modal! Opening feed in a new tab...`, tweet);
                        await randomDelay(3000, 3000);
                        chrome.runtime.sendMessage({ action: 'resetFeed' });
                        return;
                    }
                } else {
                    updateStatus(`Error: Could not find reply button on tweet!`, tweet);
                    await randomDelay(3000, 3000);
                }
                
                updateStatus(`Cooling down... (Waiting 5-7s)`);
                await randomDelay(5000, 7000);
            }
            
        } catch (error) {
            updateStatus(`Fatal Error: ${error.message}\nOpening feed in a new tab...`);
            console.error(error);
            await randomDelay(3000, 5000);
            chrome.runtime.sendMessage({ action: 'resetFeed' });
            return;
        }
    }
    
    isRunning = false;
    updateStatus("Bot stopped.");
}
