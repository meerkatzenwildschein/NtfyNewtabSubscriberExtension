document.addEventListener('DOMContentLoaded', function () {
  const urlInput = document.getElementById('url');
  const accessTokenInput = document.getElementById('accessToken');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const topicsInput = document.getElementById('topics');
  const saveButton = document.getElementById('saveSettings');
  const errorMessage = document.getElementById('errorMessage');

  // Load saved settings
  chrome.storage.sync.get(['url', 'accessToken', 'username', 'password', 'topics'], (data) => {
    if (data.url) urlInput.value = data.url;
    if (data.accessToken) accessTokenInput.value = data.accessToken;
    if (data.username) usernameInput.value = data.username;
    if (data.password) passwordInput.value = data.password;
    if (data.topics) topicsInput.value = data.topics;
  });

  // Save settings
  saveButton.addEventListener('click', () => {
    const url = urlInput.value.trim();
    const accessToken = accessTokenInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const topics = topicsInput.value.split(',').map(topic => topic.trim()).join(',');
    const lastMessageTime = Math.floor(Date.now() / 1000);

    // Check if URL and topics are provided
    if (!url || !topics) {
      errorMessage.innerText = 'URL and Topics are mandatory fields.';
      errorMessage.style.display = 'block';
      return;
    }

    // Validate URL
    if (!isValidUrl(url)) {
      errorMessage.innerText = 'Please enter a valid URL.';
      errorMessage.style.display = 'block';
      return;
    }

    // Validate authentication input
    const isAuthValid = (username && password && !accessToken) || (!username && !password && accessToken);

    if (!isAuthValid) {
      errorMessage.innerText = 'Either provide Username and Password, or an Access Token, but not both.';
      errorMessage.style.display = 'block';
      return;
    }

    // Save data and hide the error message
    errorMessage.style.display = 'none';
    chrome.storage.sync.set({ url, accessToken, username, password, topics, lastMessageTime }, () => {
      alert('Settings saved!');
      chrome.runtime.reload();
    });
  });

// Helper function to validate URL
  function isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }
});