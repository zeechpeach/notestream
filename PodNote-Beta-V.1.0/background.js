// Background script for NoteStream extension

// Listen for installation or update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('NoteStream installed or updated:', details.reason);
  
  // Set up initial data structure if needed
  if (details.reason === 'install') {
    chrome.storage.local.set({
      noteStreamData: {},
      recentVideos: [],
      globalTags: [], // Initialize empty global tags array
      noteStreamSettings: {
        autoActivateMinutes: 0,
        rememberChannels: true
      }
    }, () => {
      console.log('Initial data structure created');
    });
  }
  
  // If this is an update from an older version that didn't have global tags
  if (details.reason === 'update') {
    chrome.storage.local.get(['globalTags', 'podNoteData', 'podNoteSettings'], (result) => {
      const updates = {};
      
      // Initialize global tags if it doesn't exist
      if (!result.globalTags) {
        updates.globalTags = [];
        console.log('Global tags array initialized for update');
      }
      
      // Migrate old PodNote data to NoteStream if it exists
      if (result.podNoteData && !result.noteStreamData) {
        updates.noteStreamData = result.podNoteData;
        console.log('Migrated podNoteData to noteStreamData');
      }
      
      // Migrate old settings
      if (result.podNoteSettings && !result.noteStreamSettings) {
        updates.noteStreamSettings = result.podNoteSettings;
        console.log('Migrated podNoteSettings to noteStreamSettings');
      }
      
      if (Object.keys(updates).length > 0) {
        chrome.storage.local.set(updates);
      }
    });
  }
});

// Listen for tab updates to detect YouTube navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if this is a YouTube video page and the page has finished loading
  if (
    changeInfo.status === 'complete' && 
    tab.url && 
    tab.url.includes('youtube.com/watch')
  ) {
    console.log('YouTube video page detected:', tab.url);
    
    // Extract video ID from URL
    const videoId = new URL(tab.url).searchParams.get('v');
    
    // Get settings to check if autoActivate is enabled
    chrome.storage.local.get(['noteStreamSettings', 'channelPreferences', 'recentVideos'], (result) => {
      const settings = result.noteStreamSettings || {};
      const channelPreferences = result.channelPreferences || {};
      const recentVideos = result.recentVideos || [];
      
      // Add this video to recent videos if not already there
      if (videoId && !recentVideos.includes(videoId)) {
        // Add to beginning and limit to 10 recent videos
        const updatedRecentVideos = [videoId, ...recentVideos.slice(0, 9)];
        chrome.storage.local.set({ recentVideos: updatedRecentVideos });
      }
      
      // Auto-activate based on settings - this will be handled by the content script
      // since it needs to know the channel name, which we can't get here
    });
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);
  
  if (message.action === 'recordVideoView') {
    // Record that the user viewed this video
    if (message.videoId) {
      updateRecentVideos(message.videoId);
    }
    sendResponse({ status: 'success' });
  } else if (message.action === 'openTagsPage') {
    // Open the dashboard with the tags tab active
    chrome.tabs.create({ url: 'dashboard.html#tags' });
    sendResponse({ status: 'success' });
  }
  
  // Return true to indicate we'll send a response asynchronously
  return true;
});

// Update the list of recently viewed videos
function updateRecentVideos(videoId) {
  chrome.storage.local.get(['recentVideos'], (result) => {
    const recentVideos = result.recentVideos || [];
    
    // Add to beginning and remove duplicate if exists
    const updatedRecentVideos = [
      videoId,
      ...recentVideos.filter(id => id !== videoId)
    ].slice(0, 10); // Keep only the 10 most recent
    
    chrome.storage.local.set({ recentVideos: updatedRecentVideos });
  });
}