let isEnabled = false;
let isRunning = false;
let statusBox = null;
let kolFilter = false;
let influenceScoreThreshold = 10;
let actionMode = 'both';

// --- Premium Visual UI Setup ---
function createStatusUI() {
    if (document.getElementById('x-bot-status')) return;
    
    // Inject premium animations
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes rm-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes rm-shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
        .x-bot-highlight {
            position: relative;
            border-radius: 16px !important;
            box-shadow: 0 0 0 2px #1d9bf0, 0 8px 32px rgba(29, 155, 240, 0.15) !important;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            z-index: 99;
        }
        .x-bot-highlight::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            border-radius: 16px;
            pointer-events: none;
            background: linear-gradient(90deg, rgba(29, 155, 240, 0) 0%, rgba(29, 155, 240, 0.08) 50%, rgba(29, 155, 240, 0) 100%);
            background-size: 1000px 100%;
            animation: rm-shimmer 2.5s infinite linear;
        }
        #x-bot-status.visible {
            opacity: 1 !important;
            transform: translateX(-50%) translateY(0) !important;
        }
    `;
    document.head.appendChild(style);

    statusBox = document.createElement('div');
    statusBox.id = 'x-bot-status';
    statusBox.style.cssText = `
        position: fixed;
        bottom: 40px;
        left: 50%;
        transform: translateX(-50%) translateY(40px);
        background: rgba(15, 20, 25, 0.85);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        padding: 14px 28px;
        color: #F7F9F9;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255,255,255,0.05) inset;
        display: flex;
        align-items: center;
        gap: 14px;
        pointer-events: none;
        opacity: 0;
        transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease;
    `;
    
    const spinner = document.createElement('div');
    spinner.style.cssText = `
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 2.5px solid rgba(255, 255, 255, 0.15);
        border-top-color: #1d9bf0;
        animation: rm-spin 0.8s linear infinite;
        flex-shrink: 0;
    `;
    
    const text = document.createElement('div');
    text.id = 'x-bot-text';
    text.innerText = 'Initializing...';
    text.style.fontSize = '14.5px';
    text.style.fontWeight = '500';
    text.style.letterSpacing = '0.2px';
    text.style.lineHeight = '1';
    text.style.whiteSpace = 'nowrap';
    
    statusBox.appendChild(spinner);
    statusBox.appendChild(text);
    document.body.appendChild(statusBox);
}

function updateStatus(message, tweetElement = null) {
    if (!statusBox) createStatusUI();
    
    if (isEnabled) {
        statusBox.style.display = 'flex';
        // Small delay to allow display:flex to apply before adding visible class for transition
        setTimeout(() => statusBox.classList.add('visible'), 10);
    } else {
        statusBox.classList.remove('visible');
        setTimeout(() => { if (!statusBox.classList.contains('visible')) statusBox.style.display = 'none'; }, 400);
    }
    
    const textEl = document.getElementById('x-bot-text');
    if (textEl) textEl.innerText = message.split('\n')[0]; // Keep it single line for the pill
    console.log("[Auto-Replier]", message);
    
    // Clear old highlights
    document.querySelectorAll('.x-bot-highlight').forEach(el => {
        el.style.boxShadow = el.dataset.oldShadow || '';
        el.style.borderRadius = el.dataset.oldRadius || '';
        el.classList.remove('x-bot-highlight');
    });
    
    // Highlight current tweet with premium effect
    if (tweetElement) {
        tweetElement.dataset.oldShadow = tweetElement.style.boxShadow;
        tweetElement.dataset.oldRadius = tweetElement.style.borderRadius;
        tweetElement.classList.add('x-bot-highlight');
        
        // Ensure tweet is somewhat visible on screen, accounting for sticky headers
        const rect = tweetElement.getBoundingClientRect();
        if (rect.top < 70 || rect.bottom > window.innerHeight - 20) {
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

chrome.storage.local.get(['enabled', 'repliedHistory', 'kolFilter', 'influenceScore', 'likeMode', 'actionMode'], (res) => {
    isEnabled = res.enabled || false;
    kolFilter = res.kolFilter || false;
    influenceScoreThreshold = res.influenceScore || 10;
    actionMode = res.actionMode || (res.likeMode ? 'both' : 'reply');
    repliedHistory = res.repliedHistory || [];
    if (isEnabled && !isRunning) startBot();
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled !== undefined) {
        isEnabled = changes.enabled.newValue;
        if (isEnabled && !isRunning) startBot();
        else if (!isEnabled) updateStatus("Bot disabled.");
    }
    if (changes.kolFilter !== undefined) {
        kolFilter = changes.kolFilter.newValue;
    }
    if (changes.influenceScore !== undefined) {
        influenceScoreThreshold = changes.influenceScore.newValue;
    }
    if (changes.actionMode !== undefined) {
        actionMode = changes.actionMode.newValue;
    }
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min, max) => sleep(Math.floor(Math.random() * (max - min + 1)) + min);

async function forceReload() {
    const closeBtn = document.querySelector('[aria-label="Close"]');
    if (closeBtn) {
        simulateClick(closeBtn);
        await sleep(1000);
        const discardBtn = document.querySelector('[data-testid="confirmationSheetConfirm"]');
        if (discardBtn) {
            simulateClick(discardBtn);
            await sleep(1000);
        }
    }
    window.location.reload();
}

async function checkIfBigAccount(tweet) {
    const avatarContainer = tweet.querySelector('[data-testid="Tweet-User-Avatar"]');
    if (avatarContainer) {
        const text = avatarContainer.innerText.trim();
        const match = text.match(/\d+/);
        if (match) {
            const score = parseInt(match[0]);
            if (score >= influenceScoreThreshold) {
                return true;
            }
        }
    }
    return false;
}

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
                updateStatus("Unwanted popup detected. Refreshing page...");
                await randomDelay(1000, 2000);
                await forceReload();
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

                let shouldApplyKolFilter = kolFilter;
                if (window.location.pathname.includes('/search')) {
                    shouldApplyKolFilter = false; // Bypass filter on search pages
                }

                if (shouldApplyKolFilter) {
                    const isBig = await checkIfBigAccount(tweet);
                    if (!isBig) {
                        updateStatus(`Skipping: Account score is below ${influenceScoreThreshold} (Filter is ON).`, tweet);
                        await randomDelay(500, 1000);
                        continue;
                    }
                }

                // Explicitly scroll tweet to the center of the screen so user can see it before action
                tweet.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await randomDelay(1200, 1500); // Give it time to scroll smoothly

                // STRICT CHECK: Ensure tweet is still attached to DOM and visible after scrolling
                if (!tweet.isConnected) {
                    updateStatus("Tweet disappeared from DOM. Re-fetching...");
                    break; // DOM changed significantly, break loop to fetch fresh tweets
                }
                const rect = tweet.getBoundingClientRect();
                // A tweet is completely out of view if its bottom is above the viewport or its top is below the viewport.
                // Tall tweets may have top < 0 and bottom > window.innerHeight, which is perfectly fine.
                if (rect.bottom < 0 || rect.top > window.innerHeight) {
                    updateStatus("Tweet not properly visible in center. Skipping...");
                    // Keep data-auto-replied=true and continue so we don't get stuck in an infinite loop
                    continue; 
                }

                updateStatus(`Reading tweet...\n"${tweetText.substring(0, 40)}..."`, tweet);
                
                // Simulate human reading time based on text length, with more randomness
                const readingTime = Math.min(2500, tweetText.length * 15);
                await randomDelay(readingTime, readingTime + 1500);

                if (actionMode === 'like') {
                    const likeBtn = tweet.querySelector('[data-testid="like"]');
                    if (likeBtn) {
                        tweet.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await sleep(500);
                        updateStatus(`Clicking like button...`, tweet);
                        simulateClick(likeBtn);
                        await randomDelay(500, 1000);
                        
                        chrome.storage.local.get(['repliedCount'], (res) => {
                            const count = res.repliedCount || 0;
                            if (postUrl) {
                                repliedHistory.push(postUrl);
                                if (repliedHistory.length > 500) repliedHistory.shift();
                            }
                            chrome.storage.local.set({ 
                                repliedCount: count + 1, 
                                repliedHistory: repliedHistory 
                            });
                        });
                        
                        updateStatus(`Like finished! Cooling down...`, tweet);
                        window.scrollBy({ top: window.innerHeight * 0.5, behavior: 'smooth' });
                        await randomDelay(5000, 7000);
                    } else {
                        updateStatus(`Already liked.`, tweet);
                        await randomDelay(2000, 3000);
                    }
                    break; // Break loop to fetch fresh tweets instead of continuing with stale DOM
                }

                let isReply = false;
                let parentPostText = null;
                
                if (window.location.pathname.includes('/status/')) {
                    // Extract the very first tweet on the page to use as the main context
                    const firstTweet = document.querySelector('article[data-testid="tweet"]');
                    if (firstTweet) {
                        const firstTweetTextEl = firstTweet.querySelector('div[data-testid="tweetText"]');
                        if (firstTweetTextEl) {
                            parentPostText = firstTweetTextEl.innerText;
                        }
                    }
                    
                    if (postUrl) {
                        const currentStatusMatch = window.location.pathname.match(/\/status\/(\d+)/);
                        const postStatusMatch = postUrl.match(/\/status\/(\d+)/);
                        if (currentStatusMatch && postStatusMatch && currentStatusMatch[1] !== postStatusMatch[1]) {
                            isReply = true;
                        }
                    }
                }
                const wordCount = tweetText.trim().split(/\s+/).length;

                updateStatus(`Thinking of a reply using Grok AI...`, tweet);
                
                let replyText = null;
                try {
                    replyText = await new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage({ action: 'generate', text: tweetText, parentText: parentPostText, lang: tweetLang, author: authorName, isReply: isReply, wordCount: wordCount }, (response) => {
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
                    tweet.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await sleep(500);
                    updateStatus(`Clicking reply button...`, tweet);
                    simulateClick(replyBtn);
                    
                    // CRITICAL: Wait for Twitter's modal fade-in animation to finish!
                    await randomDelay(800, 1200);
                    
                    let textBox = null;
                    let replyRestricted = false;
                    for (let i = 0; i < 20; i++) { // Poll every 500ms for up to 10 seconds
                        textBox = document.querySelector('[data-testid="tweetTextarea_0"]');
                        if (textBox) break;
                        
                        // Check for restricted reply modal
                        const dialogs = document.querySelectorAll('[role="dialog"]');
                        for (const dialog of dialogs) {
                            if (dialog.innerText.includes('Who can reply?') || dialog.innerText.includes('Only some accounts can reply')) {
                                replyRestricted = true;
                                break;
                            }
                        }
                        if (replyRestricted) break;

                        await sleep(500);
                    }
                    
                    if (replyRestricted) {
                        updateStatus(`Skipping: Comment option is closed for this tweet.`, tweet);
                        console.log("Comment option is closed. Modal detected.");
                        
                        // Dismiss the modal
                        const gotItBtn = Array.from(document.querySelectorAll('[role="button"]')).find(b => b.innerText.includes('Got it'));
                        if (gotItBtn) {
                            simulateClick(gotItBtn);
                            await randomDelay(500, 1000);
                        } else {
                            const closeBtn = document.querySelector('[aria-label="Close"]');
                            if (closeBtn) {
                                simulateClick(closeBtn);
                                await randomDelay(500, 1000);
                            }
                        }

                        // Like the tweet since we couldn't reply
                        const likeBtn = tweet.querySelector('[data-testid="like"]');
                        if (likeBtn) {
                            updateStatus(`Clicking like button instead...`, tweet);
                            simulateClick(likeBtn);
                            await randomDelay(500, 1000);
                        }
                        
                        // Scroll down
                        window.scrollBy({ top: window.innerHeight * 0.6, behavior: 'smooth' });
                        await randomDelay(1000, 3000);
                        break; // Break the inner loop to fetch a fresh list of tweets
                    }
                    
                    if (textBox) {
                        updateStatus(`Typing reply...`, tweet);
                        textBox.focus();
                        await randomDelay(200, 400);
                        
                        if (replyText.startsWith("[GIF:") && replyText.endsWith("]")) {
                            const gifKeyword = replyText.substring(5, replyText.length - 1).trim();
                            updateStatus(`Searching for GIF: ${gifKeyword}...`, tweet);
                            
                            const gifButton = document.querySelector('[aria-label="Add a GIF"], [data-testid="gifSearchButton"]');
                            if (gifButton) {
                                simulateClick(gifButton);
                                await randomDelay(1000, 1500);
                                
                                const searchBox = document.querySelector('input[placeholder*="Search for GIFs"], input[aria-label*="Search"]');
                                if (searchBox) {
                                    searchBox.focus();
                                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                                    nativeInputValueSetter.call(searchBox, gifKeyword);
                                    searchBox.dispatchEvent(new Event('input', { bubbles: true }));
                                    
                                    await randomDelay(2500, 3500); // wait for search results
                                    
                                    const dialog = document.querySelector('[role="dialog"]');
                                    if (dialog) {
                                        // Twitter GIF results are usually images inside role="button" or similar grids
                                        const results = Array.from(dialog.querySelectorAll('div[role="button"]')).filter(btn => btn.querySelector('img'));
                                        if (results.length > 0) {
                                            const targetGif = results[Math.floor(Math.random() * Math.min(3, results.length))];
                                            simulateClick(targetGif);
                                            await randomDelay(1500, 2000);
                                        } else {
                                            updateStatus(`No GIF found, typing keyword instead.`, tweet);
                                            const dataTransfer = new DataTransfer();
                                            dataTransfer.setData('text/plain', `*${gifKeyword}*`);
                                            textBox.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dataTransfer, bubbles: true, cancelable: true }));
                                            await randomDelay(500, 1000);
                                        }
                                    }
                                }
                            }
                        } else {
                            const dataTransfer = new DataTransfer();
                            dataTransfer.setData('text/plain', replyText);
                            textBox.dispatchEvent(new ClipboardEvent('paste', {
                                clipboardData: dataTransfer,
                                bubbles: true,
                                cancelable: true
                            }));
                            
                            await randomDelay(500, 1000);
                        }
                        
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
                            
                            await randomDelay(1500, 2500); // Wait for modal to close
                            
                            if (actionMode === 'both') {
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
                            
                        } else {
                            updateStatus(`Error: Send button not found or disabled. Refreshing page...`, tweet);
                            await randomDelay(2000, 3000);
                            await forceReload();
                            return;
                        }
                        
                        updateStatus(`Reply process finished! Cooling down...`, tweet);
                    } else {
                        updateStatus(`Error: Could not find text box in modal! Refreshing page...`, tweet);
                        await randomDelay(2000, 3000);
                        await forceReload();
                        return;
                    }
                } else {
                    updateStatus(`Error: Could not find reply button on tweet!`, tweet);
                    await randomDelay(3000, 3000);
                }
                
                updateStatus(`Cooling down... (Waiting 1-3s)`);
                // Scroll down visually after a comment to adjust viewport and move to next content
                window.scrollBy({ top: window.innerHeight * 0.6, behavior: 'smooth' });
                await randomDelay(1000, 3000);
                
                break; // STRICT FIX: Break the inner loop to fetch a fresh list of tweets, preventing detached DOM errors
            }
            
        } catch (error) {
            updateStatus(`Fatal Error: ${error.message}\nRefreshing page...`);
            console.error(error);
            await randomDelay(2000, 3000);
            await forceReload();
            return;
        }
    }
    
    isRunning = false;
    updateStatus("Bot stopped.");
}

