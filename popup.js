document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('api-key');
    const toggleBot = document.getElementById('toggle-bot');
    const toggleJp = document.getElementById('toggle-jp');
    const toggleLike = document.getElementById('toggle-like');
    const saveBtn = document.getElementById('save-btn');
    const messageEl = document.getElementById('message');
    const statusText = document.getElementById('status-text');
    const statusDot = document.getElementById('status-dot');

    function updateUI(enabled) {
        if (enabled) {
            statusText.textContent = "Active";
            statusText.style.color = "#10b981";
            statusDot.classList.add("active");
            toggleBot.checked = true;
        } else {
            statusText.textContent = "Inactive";
            statusText.style.color = "#f87171";
            statusDot.classList.remove("active");
            toggleBot.checked = false;
        }
    }

    // Load saved settings
    chrome.storage.local.get(['apiKey', 'enabled', 'japaneseOnly', 'likeMode'], (result) => {
        if (result.apiKey) apiKeyInput.value = result.apiKey;
        if (result.japaneseOnly) toggleJp.checked = result.japaneseOnly;
        if (result.likeMode) toggleLike.checked = result.likeMode;
        updateUI(result.enabled);
    });

    // Save settings
    saveBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        const enabled = toggleBot.checked;
        const japaneseOnly = toggleJp.checked;
        const likeMode = toggleLike.checked;

        chrome.storage.local.set({ apiKey, enabled, japaneseOnly, likeMode }, () => {
            messageEl.textContent = 'Settings saved successfully!';
            updateUI(enabled);
            
            setTimeout(() => {
                messageEl.textContent = '';
            }, 2500);
        });
    });
});
