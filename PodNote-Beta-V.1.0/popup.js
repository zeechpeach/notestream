// Popup.js - Handles the extension popup functionality

// DOM elements
const elements = {
  currentVideoContainer: document.getElementById('current-video-container'),
  toggleSidebarButton: document.getElementById('toggle-sidebar'),
  recentVideosList: document.getElementById('recent-videos'),
  openDashboardButton: document.getElementById('open-dashboard')
};

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup DOM loaded');
  
  // Get current tab information
  getCurrentTab().then(tab => {
    console.log('Current tab:', tab.url);
    
    // Check if we're on a YouTube video page
    if (tab.url.includes('youtube.com/watch')) {
      console.log('On YouTube watch page, getting video info');
      
      // First, make sure NoteStream is initialized on the page
      chrome.tabs.sendMessage(tab.id, { action: 'initializeNoteStream' }, (initResponse) => {
        // Now get video information (after ensuring initialization)
        chrome.tabs.sendMessage(tab.id, { action: 'getVideoInfo' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log("Error getting video info:", chrome.runtime.lastError.message);
            retryContentScript(tab);
            return;
          }
          
          console.log('Received response:', response);
          
          if (response && response.videoInfo) {
            updateCurrentVideo(response.videoInfo);
            
            // Enable sidebar button
            elements.toggleSidebarButton.disabled = false;
          } else {
            console.log('No video info in response');
            showNoVideoMessage();
          }
        });
      });
    } else {
      console.log('Not on YouTube video page');
      showNoVideoMessage();
      elements.toggleSidebarButton.disabled = true;
      elements.toggleSidebarButton.textContent = 'Not on YouTube Video';
    }
  });
  
  // Set up event listeners
  setupEventListeners();
  
  // Load recent videos
  loadRecentVideos();
});

// Retry if content script isn't ready
function retryContentScript(tab) {
  console.log("Content script not ready or not loaded, showing message");
  showNoVideoMessage("Content script not ready. Please refresh the page.");
  
  // Set button to refresh page
  if (elements.toggleSidebarButton) {
    elements.toggleSidebarButton.textContent = "Refresh Page";
    elements.toggleSidebarButton.disabled = false;
    elements.toggleSidebarButton.addEventListener('click', () => {
      chrome.tabs.reload(tab.id);
      window.close();
    });
  }
}

// Get the current active tab
async function getCurrentTab() {
  const queryOptions = { active: true, currentWindow: true };
  const [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

// Update the current video display
function updateCurrentVideo(videoInfo) {
  console.log('Updating current video display:', videoInfo);
  
  // Verify we have valid videoInfo
  if (!videoInfo || !videoInfo.title) {
    console.log('Invalid video info received', videoInfo);
    showNoVideoMessage("Unable to get video information");
    return;
  }
  
  // Get note count (if available)
  chrome.storage.local.get(['noteStreamData'], (result) => {
    const noteStreamData = result.noteStreamData || {};
    const noteCount = noteStreamData[videoInfo.videoId]?.length || 0;
    
    elements.currentVideoContainer.innerHTML = `
      <div class="current-video">
        <div class="video-title">${videoInfo.title}</div>
        <div class="video-meta">
          ${videoInfo.channel} • ${formatDuration(videoInfo.duration)}
          <span class="note-count">${noteCount} notes</span>
        </div>
      </div>
    `;
  });
}

// Show message when no video is detected
function showNoVideoMessage(message = 'No YouTube video detected. Open a YouTube video to use NoteStream.') {
  console.log('Showing no video message');
  elements.currentVideoContainer.innerHTML = `
    <div class="no-video">
      ${message}
    </div>
  `;
}

// Format duration from seconds to HH:MM:SS
function formatDuration(seconds) {
  if (!seconds) return '--:--';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (hrs > 0) parts.push(hrs);
  parts.push(mins.toString().padStart(2, '0'));
  parts.push(secs.toString().padStart(2, '0'));
  
  return parts.join(':');
}

// Set up event listeners
function setupEventListeners() {
  console.log('Setting up event listeners');
  
  // Toggle sidebar button
  elements.toggleSidebarButton.addEventListener('click', async () => {
    console.log('Toggle sidebar button clicked');
    const tab = await getCurrentTab();
    
    if (tab.url.includes('youtube.com/watch')) {
      console.log('Sending messages to tab:', tab.id);
      
      // First try to initialize if needed
      chrome.tabs.sendMessage(tab.id, { action: 'initializeNoteStream' }, (initResponse) => {
        // Handle potential error
        if (chrome.runtime.lastError) {
          console.log("Error initializing:", chrome.runtime.lastError.message);
          retryContentScript(tab);
          return;
        }
        
        // Then toggle sidebar
        chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' }, (toggleResponse) => {
          if (chrome.runtime.lastError) {
            console.log("Error toggling sidebar:", chrome.runtime.lastError.message);
          } else {
            // Close the popup
            window.close();
          }
        });
      });
    }
  });
  
  // Open dashboard button
  elements.openDashboardButton.addEventListener('click', () => {
    console.log('Opening dashboard');
    chrome.tabs.create({ url: 'dashboard.html' });
  });
}

// Load recent videos from storage
function loadRecentVideos() {
  console.log('Loading recent videos');
  chrome.storage.local.get(['noteStreamData', 'recentVideos'], (result) => {
    const noteStreamData = result.noteStreamData || {};
    const recentVideos = result.recentVideos || [];
    
    console.log('Recent videos count:', recentVideos.length);
    
    if (recentVideos.length === 0) {
      elements.recentVideosList.innerHTML = `
        <div class="no-video">No recent videos</div>
      `;
      return;
    }
    
    // Clear the list
    elements.recentVideosList.innerHTML = '';
    
    // Add recent videos
    recentVideos.forEach(videoId => {
      // Skip if no data for this video
      if (!noteStreamData[videoId]) return;
      
      const videoNotes = noteStreamData[videoId] || [];
      if (videoNotes.length === 0) return;
      
      // Get the video info from any note that has it
      let videoInfo = {
        title: 'Unknown Video',
        channel: 'Unknown Channel'
      };
      
      // Try to find a note with video info
      for (const note of videoNotes) {
        if (note.videoInfo && note.videoInfo.title) {
          videoInfo = note.videoInfo;
          break;
        }
      }
      
      // Create list item
      const listItem = document.createElement('div');
      listItem.className = 'recent-item';
      listItem.innerHTML = `
        <div class="video-title">${videoInfo.title}</div>
        <div class="video-meta">
          ${videoInfo.channel}
          <span class="note-count">${videoNotes.length} notes</span>
        </div>
      `;
      
      // Add click event to open the video
      listItem.addEventListener('click', () => {
        chrome.tabs.create({ url: `https://youtube.com/watch?v=${videoId}` });
      });
      
      elements.recentVideosList.appendChild(listItem);
    });
  });
}