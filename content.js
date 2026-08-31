let isEnabled = false;
let isRunning = false;
let statusBox = null;
let kolFilter = false;
let influenceScoreThreshold = 10;
let actionMode = 'both';

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
    title.innerHTML = '✨ <b>ReplyMind for X v2.2</b>';
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
                window.location.reload();
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
                if (window.location.pathname.includes('/status/') && postUrl) {
                    const currentStatusMatch = window.location.pathname.match(/\/status\/(\d+)/);
                    const postStatusMatch = postUrl.match(/\/status\/(\d+)/);
                    if (currentStatusMatch && postStatusMatch && currentStatusMatch[1] !== postStatusMatch[1]) {
                        isReply = true;
                    }
                }
                const wordCount = tweetText.trim().split(/\s+/).length;

                updateStatus(`Thinking of a reply using Grok AI...`, tweet);
                
                let replyText = null;
                try {
                    replyText = await new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage({ action: 'generate', text: tweetText, lang: tweetLang, author: authorName, isReply: isReply, wordCount: wordCount }, (response) => {
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
                    for (let i = 0; i < 20; i++) { // Poll every 500ms for up to 10 seconds
                        textBox = document.querySelector('[data-testid="tweetTextarea_0"]');
                        if (textBox) break;
                        await sleep(500);
                    }
                    
                    if (textBox) {
                        updateStatus(`Typing reply...`, tweet);
                        textBox.focus();
                        await randomDelay(200, 400);
                        
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
                            window.location.reload();
                            return;
                        }
                        
                        updateStatus(`Reply process finished! Cooling down...`, tweet);
                    } else {
                        updateStatus(`Error: Could not find text box in modal! Refreshing page...`, tweet);
                        await randomDelay(2000, 3000);
                        window.location.reload();
                        return;
                    }
                } else {
                    updateStatus(`Error: Could not find reply button on tweet!`, tweet);
                    await randomDelay(3000, 3000);
                }
                
                updateStatus(`Cooling down... (Waiting 5-7s)`);
                // Scroll down visually after a comment to adjust viewport and move to next content
                window.scrollBy({ top: window.innerHeight * 0.6, behavior: 'smooth' });
                await randomDelay(5000, 7000);
                
                break; // STRICT FIX: Break the inner loop to fetch a fresh list of tweets, preventing detached DOM errors
            }
            
        } catch (error) {
            updateStatus(`Fatal Error: ${error.message}\nRefreshing page...`);
            console.error(error);
            await randomDelay(2000, 3000);
            window.location.reload();
            return;
        }
    }
    
    isRunning = false;
    updateStatus("Bot stopped.");
}

