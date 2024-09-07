const keepAlive = (i => state => {
    if (state && !i) {
        if (performance.now() > 20e3) chrome.runtime.getPlatformInfo();
        i = setInterval(chrome.runtime.getPlatformInfo, 20e3);
    } else if (!state && i) {
        clearInterval(i);
        i = 0;
    }
})();

const RENEW_CONNECTION_EACH_IN_MILLISECONDS = 60000;

async function createSSEConnection() {
    keepAlive(true);
    const {
        url,
        accessToken,
        username,
        password,
        topics
    } = await getSettings();
    
    if(!url || !topics) {
        console.log('No Connection defined.');
        return
    }
    
    const sseUrl = `${url}/${topics.join(',')}/sse`;
    const headers = new Headers();
    headers.set('Accept', 'application/json');

    if(username && password) {
        const credentials = btoa(`${username}:${password}`);
        headers.set('Authorization', `Basic ${credentials}`);
    }
    if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
    }

    while (true) {
        try {
            console.log('Connecting to: ', sseUrl);
            const lastMessageTime = await getFromStorage('lastMessageTime');
            const response = await fetch(sseUrl + '?since=' + lastMessageTime, {
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`Failed to connect to SSE stream: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');

            let buffer = '';

            while (true) {
                const readPromise = reader.read();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Read timeout')), RENEW_CONNECTION_EACH_IN_MILLISECONDS)
                );

                console.log('Connected');

                // Wait for data or timeout
                const { value } = await Promise.race([readPromise, timeoutPromise]);


                buffer += decoder.decode(value, {
                    stream: true
                });

                let position;
                while ((position = buffer.indexOf('\n\n')) !== -1) {
                    const chunk = buffer.slice(0, position);
                    buffer = buffer.slice(position + 2); // Remove "\n\n" from buffer

                    if (chunk.startsWith('data: ')) {
                        const eventData = chunk.slice(6); // Remove "data: "
                        await handleSSEMessage(eventData);
                    }
                }
            }
        } catch (error) {
            console.error('SSE connection error:', error);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

function getSettings() {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['url', 'accessToken', 'username', 'password', 'topics'], (data) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError));
            } else {
                resolve({
                    url: data.url || '',
                    accessToken: data.accessToken || '',
                    username: data.username || '',
                    password: data.password || '',
                    topics: data.topics ? data.topics.split(',').map(topic => topic.trim()) : []
                });
            }
        });
    });
}

async function handleSSEMessage(data) {
    console.log('Received SSE message:', data);
    const message = JSON.parse(data);

    if (message.event === 'message') {
        const title = message.title || message.topic;
        const topic = message.topic;
        const content = message.message;
        const attachment_url = message?.attachment?.url;
        const attachment_name = message?.attachment?.name;

        if (attachment_url && isURL(attachment_url)) {
            // If the message has an attachment that is a valid URL, open it in a new browser tab
            createMessageTab(topic, title, content, attachment_url, attachment_name)
        } else if (isURL(content)) {
            // If the message is a URL, open it in a new browser tab
            openInTabGroup(content, topic);
        } else {
            // If the content is neither a URL nor an image, display it as text
            createMessageTab(topic, title, content)
        }
    }

    await setInStorage('lastMessageTime', message.time + 1)
}

function createMessageTab(topic, title, content, attachment_url, attachment_name) {
    let imageTag = '';
    let downloadButton = '';
    
    if (isImageUrl(attachment_url)) {
        imageTag = `<img src="${attachment_url}" alt="Image" style="max-width: 100%; max-height: 100%;"><br>`;
    } 
    if(attachment_url) {
        downloadButton = `<a href="${attachment_url}" download="attachment" style="margin-top: 10px; padding: 10px 20px; background-color: #8FBCBB; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">Download ${attachment_name}</a>`;
    }
    
    const tabHtmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #2E3440;
                color: #D8DEE9;
                margin: 0;
                display: flex;
                justify-content: flex-start;
                align-items: center;
                height: 100vh;
                text-align: center;
                flex-direction: column;
            }
            .container {
                background-color: #4C566A;
                border-radius: 8px;
                padding: 30px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                width: 100%;
                box-sizing: border-box;
                max-width: 100%;
            }
            h1 {
                color: #8FBCBB;
            }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>${title}</h1>
                <p>${content}</p>
                ${imageTag}
                ${downloadButton}
            </div>
        </body>
        </html>`
    
    const tabUrl = 'data:text/html,' + encodeURIComponent(tabHtmlContent);
    openInTabGroup(tabUrl, topic);
}

function openInTabGroup(tabUrl, topic)
{
    chrome.tabs.create({ url: tabUrl }, (tab) => {
        const tabGroupName = topic;

        // Get all tab groups
        chrome.tabGroups.query({}, (groups) => {
            let group = groups.find(g => g.title === tabGroupName);

            if (group) {
                // If the group exists, capture the groupId
                chrome.tabs.group({ groupId: group.id, tabIds: tab.id });
            } else {
                // If the group does not exist, create a new group and add the tab to it
                chrome.tabs.group({ tabIds: tab.id }, (groupId) => {
                    chrome.tabGroups.update(groupId, { title: tabGroupName });
                });
            }
        });
    });
}

function getFromStorage(key) {
    return new Promise((resolve) => {
        chrome.storage.sync.get(key, (data) => {
            if (chrome.runtime.lastError) {
                resolve(null);
            } else {
                resolve(data[key]);
            }
        });
    });
}

function setInStorage(key, value) {
    return new Promise((resolve, reject) => {
        const data = {};
        data[key] = value;
        chrome.storage.sync.set(data, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}

function isURL(string) {
    const urlPattern = /^https?:\/\/.+/;
    return urlPattern.test(string);
}

function isImageUrl(url) {
    return /\.(jpeg|jpg|gif|png|bmp|webp)$/i.test(url);
}

createSSEConnection();