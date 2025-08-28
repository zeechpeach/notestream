// Main content script that runs on YouTube pages
// Debugging log
console.log('NoteStream content script loaded on: ' + window.location.href);

// Track the current URL
let currentUrl = window.location.href;

// Sidebar state variables
let sidebarVisible = false;
let sidebarInjected = false;

// Check if we're on YouTube watch page
function checkForYouTubeVideo() {
  console.log('Checking if on YouTube watch page:', window.location.pathname);
  
  if (window.location.hostname.includes('youtube.com') && window.location.pathname.includes('/watch')) {
    console.log('YouTube video detected, initializing NoteStream');
    
    // This function will repeatedly check if the video element exists
    function waitForVideoElement(retries = 0, maxRetries = 10) {
      const video = document.querySelector('video');
      const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer, .title');
      
      if ((video && titleElement) || retries >= maxRetries) {
        if (video && titleElement) {
          console.log('Video element found, NoteStream ready');
          console.log('Video title found:', titleElement.textContent.trim());
          initializeSidebar();
          addFloatingButton();
          
          // Notify background script that we're on a video page
          const videoId = new URLSearchParams(window.location.search).get('v');
          if (videoId) {
            chrome.runtime.sendMessage({
              action: 'recordVideoView',
              videoId: videoId
            });
          }
        } else {
          console.warn('Failed to find video element after maximum retries');
        }
      } else {
        console.log(`Waiting for video element (attempt ${retries + 1}/${maxRetries})...`);
        setTimeout(() => waitForVideoElement(retries + 1, maxRetries), 1000);
      }
    }
    
    waitForVideoElement();
  } else {
    console.log('NoteStream not on a YouTube watch page: ' + window.location.pathname);
  }
}

// Run initial check
checkForYouTubeVideo();

// Set up an observer to detect URL changes (for YouTube's SPA navigation)
const observer = new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    console.log('URL changed from', currentUrl, 'to', window.location.href);
    currentUrl = window.location.href;
    checkForYouTubeVideo();
  }
});

// Start observing the document
observer.observe(document, { subtree: true, childList: true });

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.action === 'toggleSidebar') {
    toggleSidebar();
    sendResponse({status: 'success'});
  } else if (message.action === 'getCurrentTime') {
    sendResponse({currentTime: getCurrentVideoTime()});
  } else if (message.action === 'jumpToTime') {
    jumpToVideoTime(message.time);
    sendResponse({status: 'success'});
  } else if (message.action === 'getVideoInfo') {
    const videoInfo = getVideoInfo();
    console.log('Sending video info back to caller:', videoInfo);
    sendResponse({videoInfo: videoInfo, status: 'success'});
  } else if (message.action === 'initializeNoteStream') {
    console.log('Forced NoteStream initialization');
    if (!sidebarInjected) {
      initializeSidebar();
    }
    if (!document.querySelector('.notestream-floating-button')) {
      addFloatingButton();
    }
    sendResponse({status: 'success'});
  }
  
  return true; // Keep the message channel open for async responses
});

// Add floating button to activate the sidebar
function addFloatingButton() {
  console.log('Attempting to add floating button');
  
  // Check if button already exists
  if (document.querySelector('.notestream-floating-button')) {
    console.log('Button already exists');
    return;
  }
  
  // Create the button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'notestream-floating-button';
  
  // Create the button with icon
  buttonContainer.innerHTML = `
    <button title="Take notes with NoteStream (Alt+N)">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
      </svg>
    </button>
  `;
  
  // Add styles for the floating button
  const style = document.createElement('style');
  style.textContent = `
    .notestream-floating-button {
      position: fixed;
      bottom: 70px;
      right: 20px;
      z-index: 9999;
      transition: opacity 0.3s;
      opacity: 0.7;
    }
    
    .notestream-floating-button:hover {
      opacity: 1;
    }
    
    .notestream-floating-button button {
      background-color: #6366f1;
      color: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
      transition: transform 0.2s, background-color 0.2s;
    }
    
    .notestream-floating-button button:hover {
      transform: scale(1.1);
      background-color: #4f46e5;
    }
  `;
  document.head.appendChild(style);
  
  console.log('Trying to attach button to page');
  
  // Add button directly to body instead of player
  document.body.appendChild(buttonContainer);
  
  // Add click event to toggle sidebar
  buttonContainer.addEventListener('click', () => {
    console.log('Button clicked, toggling sidebar');
    toggleSidebar();
  });
  
  // Add keyboard shortcut listener (Alt+N)
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'n') {
      console.log('Keyboard shortcut detected');
      toggleSidebar();
    }
  });
  
  console.log('Floating button added successfully');
}

// Function to inject the sidebar iframe
function initializeSidebar() {
  // Only inject if not already done
  if (sidebarInjected) {
    console.log('Sidebar already injected');
    return;
  }
  
  console.log('Initializing sidebar');
  
  // Create the sidebar container
  const sidebarContainer = document.createElement('div');
  sidebarContainer.id = 'notestream-sidebar-container';
  sidebarContainer.style.display = 'none'; // Hidden by default
  
  // Create the iframe for our sidebar
  const sidebarIframe = document.createElement('iframe');
  sidebarIframe.id = 'notestream-sidebar';
  sidebarIframe.src = chrome.runtime.getURL('sidebar.html');
  sidebarIframe.style.height = '100%';
  sidebarIframe.style.width = '100%';
  sidebarIframe.style.border = 'none';
  
  // Add iframe to container
  sidebarContainer.appendChild(sidebarIframe);
  
  // Add container to body
  document.body.appendChild(sidebarContainer);
  sidebarInjected = true;
  
  // Set up message listener for iframe communication
  window.addEventListener('message', handleSidebarMessages);
  
  // Send video info to sidebar once it's loaded
  sidebarIframe.onload = () => {
    console.log('Sidebar iframe loaded');
    const videoInfo = getVideoInfo();
    console.log('Sending video info to sidebar:', videoInfo);
    sidebarIframe.contentWindow.postMessage({
      action: 'videoLoaded',
      videoInfo: videoInfo
    }, '*');
  };
  
  console.log('Sidebar initialization complete');
}

// Toggle sidebar visibility
function toggleSidebar() {
  console.log('Toggle sidebar called');
  
  const sidebarContainer = document.getElementById('notestream-sidebar-container');
  if (!sidebarContainer) {
    console.log('Sidebar container not found, initializing');
    initializeSidebar();
    setTimeout(toggleSidebar, 500); // Try again after initialization
    return;
  }
  
  // Toggle visibility
  sidebarVisible = !sidebarVisible;
  console.log('Setting sidebar visible:', sidebarVisible);
  
  if (sidebarVisible) {
    // Show sidebar with animation - no player resizing
    sidebarContainer.style.display = 'block';
    sidebarContainer.classList.remove('notestream-slide-out');
    sidebarContainer.classList.add('notestream-slide-in');
    
    // Notify sidebar that it's now visible
    const sidebarIframe = document.getElementById('notestream-sidebar');
    const videoInfo = getVideoInfo();
    console.log('Sending updated video info to sidebar on open:', videoInfo);
    sidebarIframe.contentWindow.postMessage({
      action: 'sidebarOpened',
      videoInfo: videoInfo,
      currentTime: getCurrentVideoTime()
    }, '*');
    
    // Save user preference for this channel
    const channelName = getChannelName();
    if (channelName) {
      saveChannelPreference(channelName, true);
    }
  } else {
    // Hide sidebar with animation
    sidebarContainer.classList.remove('notestream-slide-in');
    sidebarContainer.classList.add('notestream-slide-out');
    
    // Wait for animation to complete before hiding
    setTimeout(() => {
      sidebarContainer.style.display = 'none';
    }, 300);
  }
}

// Handle messages from the sidebar iframe
function handleSidebarMessages(event) {
  // Security check - only accept messages from our sidebar
  const sidebarIframe = document.getElementById('notestream-sidebar');
  if (!sidebarIframe || event.source !== sidebarIframe.contentWindow) {
    return;
  }
  
  const message = event.data;
  console.log('Received message from sidebar:', message);
  
  switch (message.action) {
    case 'getCurrentTime':
      event.source.postMessage({
        action: 'timeUpdate',
        currentTime: getCurrentVideoTime()
      }, '*');
      break;
      
    case 'jumpToTime':
      jumpToVideoTime(message.time);
      break;
      
    case 'closeSidebar':
      toggleSidebar();
      break;
      
    case 'sidebarReady':
      // If the sidebar is telling us it's ready, send the current video info
      const videoInfo = getVideoInfo();
      console.log('Sidebar is ready, sending video info:', videoInfo);
      event.source.postMessage({
        action: 'videoLoaded',
        videoInfo: videoInfo
      }, '*');
      break;
      
    // Add more message handlers as needed
  }
}

// Get current video time in seconds
function getCurrentVideoTime() {
  const video = document.querySelector('video');
  return video ? video.currentTime : 0;
}

// Jump to a specific time in the video
function jumpToVideoTime(timeInSeconds) {
  const video = document.querySelector('video');
  if (video) {
    video.currentTime = timeInSeconds;
  }
}

// Get channel name
function getChannelName() {
  const channelElement = document.querySelector('#channel-name a, #owner-name a');
  return channelElement ? channelElement.textContent.trim() : null;
}

// Save user preference for a channel
function saveChannelPreference(channelName, enabled) {
  chrome.storage.local.get(['channelPreferences'], (result) => {
    const channelPreferences = result.channelPreferences || {};
    channelPreferences[channelName] = {
      enabled: enabled,
      timestamp: new Date().toISOString()
    };
    
    chrome.storage.local.set({ channelPreferences });
  });
}

// Get current video information
function getVideoInfo() {
  console.log('Getting video info');
  
  const videoId = new URLSearchParams(window.location.search).get('v');
  if (!videoId) {
    console.error('Could not extract video ID from URL');
    return null;
  }
  
  // Use multiple selectors to try to find the title
  let titleSelectors = [
    // New YouTube layout selectors
    'h1.ytd-video-primary-info-renderer',
    // More specific selectors to try
    'h1 yt-formatted-string',
    '#title h1',
    '#title .title',
    // Older YouTube selectors
    '.title',
    // Very specific selector
    '#container h1.title'
  ];
  
  let title = 'Unknown Title';
  
  // Try each selector until we find something
  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      title = element.textContent.trim();
      console.log(`Found title "${title}" using selector "${selector}"`);
      break;
    }
  }
  
  // If still unknown, try a more aggressive approach
  if (title === 'Unknown Title') {
    // Try to find any large text that might be the title
    const possibleTitleElements = document.querySelectorAll('h1, h2, .title, [id*="title"]');
    
    for (const element of possibleTitleElements) {
      const text = element.textContent.trim();
      if (text && text.length > 5 && text.length < 200) {
        title = text;
        console.log(`Found potential title using fallback: "${title}"`);
        break;
      }
    }
  }
  
  // Channel name selectors
  let channelSelectors = [
    // Common selectors
    '#channel-name a', 
    '#owner-name a',
    // More specific selectors
    '.ytd-channel-name a', 
    '#owner a',
    '.ytd-video-owner-renderer a',
    // Specific to various YouTube layouts
    '#upload-info a',
    '#meta a',
    '#owner-container a'
  ];
  
  let channel = 'Unknown Channel';
  
  // Try each selector until we find something
  for (const selector of channelSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      channel = element.textContent.trim();
      console.log(`Found channel "${channel}" using selector "${selector}"`);
      break;
    }
  }
  
  // If still unknown, try a more aggressive approach
  if (channel === 'Unknown Channel') {
    // Look for any link that might contain the channel name
    const possibleChannelElements = document.querySelectorAll('a[href*="channel"], a[href*="user"], a[href*="@"]');
    
    for (const element of possibleChannelElements) {
      const text = element.textContent.trim();
      if (text && text.length > 0 && text.length < 50) {
        channel = text;
        console.log(`Found potential channel using fallback: "${channel}"`);
        break;
      }
    }
  }
  
  // Get video duration
  const video = document.querySelector('video');
  const duration = video ? video.duration : 0;
  
  const videoInfo = {
    videoId,
    title,
    channel,
    duration,
    url: window.location.href
  };
  
  console.log('Video info collected:', videoInfo);
  return videoInfo;
}