const CONNECTION_WAIT_TIMEOUT_IN_MILLISECONDS = 58000;

async function createSSEConnection() {
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
            const lastMessageTime = await getFromStorage('lastMessageTime');
            console.log(`Connecting: Url=${sseUrl}, lastMessageTime=${lastMessageTime}`);
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
                console.log('Reading...');

                // Waiting for data
                const { value, done } = await reader.read();

                if (done) {
                    console.log('Stream closed');
                    break;
                }
                
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

function openInTabGroup(tabUrl, topic) {
  chrome.tabs.create({ url: tabUrl });
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

// https://stackoverflow.com/questions/66618136/persistent-service-worker-in-chrome-extension/66618269#66618269
async function createOffscreen() {
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['BLOBS'],
    justification: 'keep service worker running',
  }).catch(() => {});
}
chrome.runtime.onStartup.addListener(createOffscreen);
self.onmessage = e => {}; // keepAlive
createOffscreen();
