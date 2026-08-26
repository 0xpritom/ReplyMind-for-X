document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('api-key');
    const toggleBot = document.getElementById('toggle-bot');
    const toggleJp = document.getElementById('toggle-jp');
    const saveBtn = document.getElementById('save-btn');
    const messageEl = document.getElementById('message');
    const statusText = document.getElementById('status-text');
    const statusDot = document.getElementById('status-dot');
    
    // Theme elements
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIconSun = document.getElementById('theme-icon-sun');
    const themeIconMoon = document.getElementById('theme-icon-moon');

    // Mode elements
    const modeBtns = document.querySelectorAll('.mode-btn');
    let currentActionMode = 'both';

    function updateUI(enabled) {
        if (enabled) {
            statusText.textContent = "Active";
            statusText.style.color = "var(--success-color)";
            statusDot.classList.add("active");
            toggleBot.checked = true;
        } else {
            statusText.textContent = "Inactive";
            statusText.style.color = "var(--error-color)";
            statusDot.classList.remove("active");
            toggleBot.checked = false;
        }
    }
    
    function applyTheme(isLightMode) {
        if (isLightMode) {
            document.body.classList.add('light-mode');
            themeIconSun.style.display = 'none';
            themeIconMoon.style.display = 'block';
        } else {
            document.body.classList.remove('light-mode');
            themeIconSun.style.display = 'block';
            themeIconMoon.style.display = 'none';
        }
    }

    function updateModeUI(mode) {
        currentActionMode = mode;
        modeBtns.forEach(btn => {
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            updateModeUI(btn.dataset.mode);
        });
    });

    // Load saved settings
    chrome.storage.local.get(['apiKey', 'apiKeys', 'enabled', 'japaneseOnly', 'likeMode', 'actionMode', 'isLightMode'], (result) => {
        if (result.apiKeys) {
            apiKeyInput.value = result.apiKeys;
        } else if (result.apiKey) {
            apiKeyInput.value = result.apiKey;
        }
        if (result.japaneseOnly) toggleJp.checked = result.japaneseOnly;
        
        let mode = result.actionMode;
        if (!mode) {
            // Fallback for previous users
            mode = result.likeMode ? 'both' : 'reply';
        }
        updateModeUI(mode);
        
        // Theme init (Default to dark if undefined)
        applyTheme(result.isLightMode || false);
        
        updateUI(result.enabled);
    });

    // Toggle theme on click
    themeToggleBtn.addEventListener('click', () => {
        const isLightMode = !document.body.classList.contains('light-mode');
        applyTheme(isLightMode);
        chrome.storage.local.set({ isLightMode });
    });

    // Save settings
    saveBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        const enabled = toggleBot.checked;
        const japaneseOnly = toggleJp.checked;
        const actionMode = currentActionMode;

        chrome.storage.local.set({ apiKey, apiKeys: apiKey, enabled, japaneseOnly, actionMode }, () => {
            messageEl.textContent = 'Settings saved successfully!';
            messageEl.classList.add('show');
            updateUI(enabled);
            
            setTimeout(() => {
                messageEl.classList.remove('show');
            }, 2500);
        });
    });
});
