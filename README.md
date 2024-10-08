# Ntfy Newtab Subscriber

Ntfy Newtab Subscriber is a Chrome extension that listens to one or more [ntfy.sh](https://ntfy.sh) topics and displays the messages in new browser tabs.

## Features

- **Tab Groups**: Automatically groups related tabs together based on the topic.
- **Basic Authentication**: Support for Basic Auth to protected ntfy.sh services.
- **Cached-History Support**: Keeps track of the message history to ensure no message is missed, even if the browser was closed.
- **Attachments Support**: Displays messages with attachments directly within the tabs.
- **Images Support**: Automatically shows images embedded in messages.

## Known Issues
Google Crome sets plugins to idle state, which unfortunately can only be prevented to a limited extent, so that messages are sometimes only delivered after a browser restart. As a work-around, you can open the configuration dialogue and press the save button without making any changes. The plugin will then be reloaded.

## Installation

1. Clone the repository or download the zip file and extract it.
2. Go to `chrome://extensions/` in your Chrome browser.
3. Enable "Developer mode" by toggling the switch in the top right corner.
4. Click on "Load unpacked" and select the directory where you cloned/extracted the extension.

## Usage

1. Click on the extension icon to open the settings popup.
2. Enter the ntfy.sh URL, your username, password, and the topics you want to subscribe to (comma-separated).
3. Click "Save Settings".

The extension will start listening to the specified ntfy.sh topics and will display new messages in separate tabs.

## Screens
![Configuration Popup](/assets/config_screen.png)  
*Configuration Popup*

![An image received and displayed in a new browser tab](/assets/browser_screenshot_1.png)  
*An image received and displayed in a new browser tab*

![A file received and displayed in a new browser tab](/assets/browser_screenshot_2.png)  
*A file received and displayed in a new browser tab*

![A text message received and sent and displayed in a new browser tab](/assets/browser_screenshot_3.png)  
*A text message received and sent and displayed in a new browser tab*
