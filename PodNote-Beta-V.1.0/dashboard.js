// Load settings
function loadSettings() {
  console.log('Loading settings');
  chrome.storage.local.get(['noteStreamSettings', 'podNoteSettings'], (result) => {
    // Support both old and new storage keys for migration
    const settings = result.noteStreamSettings || result.podNoteSettings || {
      autoActivateMinutes: 0,
      rememberChannels: true
    };
    
    if (elements.autoActivateSelect) {
      elements.autoActivateSelect.value = settings.autoActivateMinutes.toString();
    }
    if (elements.rememberChannelsCheckbox) {
      elements.rememberChannelsCheckbox.checked = settings.rememberChannels;
    }
    
    console.log('Settings loaded:', settings);
  });
}

// Save settings
function saveSettings() {
  console.log('Saving settings');
  const settings = {
    autoActivateMinutes: parseInt(elements.autoActivateSelect?.value || '0', 10),
    rememberChannels: elements.rememberChannelsCheckbox?.checked || false
  };
  
  chrome.storage.local.set({ noteStreamSettings: settings });
  console.log('Settings saved:', settings);
}// Dashboard.js - Enhanced with analytics, edit/delete, and selective export

// Global state
let currentView = 'videos';
let currentVideoId = null;
let allNotes = [];
let allVideos = [];
let allTags = [];
let globalTags = []; // Persistent global tags
let filteredNotes = [];
let activeTagFilter = null;
let selectedNotesForExport = new Set(); // Track selected notes for export
let contentThemes = {}; // Analytics data

// Helper functions for tags
// Helper function to generate consistent colors for tags
function generateTagColors(tagName) {
  // Simple hash function to generate deterministic but distributed values
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate HSL color with fixed saturation and lightness
  const hue = ((hash % 360) + 360) % 360;
  
  // Background with high lightness (90%)
  const bgColor = `hsl(${hue}, 70%, 90%)`;
  // Text with low lightness (30%) for contrast
  const textColor = `hsl(${hue}, 70%, 30%)`;
  
  return { bgColor, textColor };
}

// Content Analysis Functions
function analyzeContentThemes() {
  const themes = {};
  const concepts = {};
  const learningPatterns = {
    totalNotes: allNotes.length,
    totalVideos: allVideos.length,
    averageNotesPerVideo: 0,
    topChannels: {},
    tagDistribution: {},
    timeSpentAnalysis: {
      shortVideos: 0, // < 10 min
      mediumVideos: 0, // 10-30 min  
      longVideos: 0 // > 30 min
    }
  };

  // Analyze notes for themes and patterns
  allNotes.forEach(note => {
    // Count tag usage
    if (note.tags) {
      note.tags.forEach(tag => {
        learningPatterns.tagDistribution[tag] = (learningPatterns.tagDistribution[tag] || 0) + 1;
      });
    }

    // Analyze note content for concepts (simple keyword detection)
    const text = note.text.toLowerCase();
    const commonConcepts = [
      'react', 'javascript', 'python', 'css', 'html', 'node', 'api', 'database', 
      'machine learning', 'ai', 'docker', 'kubernetes', 'aws', 'tutorial', 
      'example', 'pattern', 'best practice', 'performance', 'security', 'testing'
    ];
    
    commonConcepts.forEach(concept => {
      if (text.includes(concept)) {
        concepts[concept] = (concepts[concept] || 0) + 1;
      }
    });

    // Channel analysis
    if (note.videoInfo && note.videoInfo.channel) {
      const channel = note.videoInfo.channel;
      learningPatterns.topChannels[channel] = (learningPatterns.topChannels[channel] || 0) + 1;
    }
  });

  // Video duration analysis
  allVideos.forEach(video => {
    const duration = video.duration || 0;
    if (duration < 600) { // < 10 min
      learningPatterns.timeSpentAnalysis.shortVideos++;
    } else if (duration < 1800) { // 10-30 min
      learningPatterns.timeSpentAnalysis.mediumVideos++;
    } else {
      learningPatterns.timeSpentAnalysis.longVideos++;
    }
  });

  learningPatterns.averageNotesPerVideo = allVideos.length > 0 
    ? (allNotes.length / allVideos.length).toFixed(1) 
    : 0;

  contentThemes = {
    concepts: Object.entries(concepts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([concept, count]) => ({ concept, count })),
    patterns: learningPatterns
  };

  console.log('Content themes analyzed:', contentThemes);
  return contentThemes;
}

// Smart tag categorization
function suggestTagsForNote(noteText, videoInfo) {
  const suggestions = [];
  const text = noteText.toLowerCase();
  const title = videoInfo?.title?.toLowerCase() || '';
  
  // Content type suggestions
  if (text.includes('example') || text.includes('demo') || title.includes('tutorial')) {
    suggestions.push('tutorial');
  }
  if (text.includes('question') || text.includes('?') || text.includes('doubt')) {
    suggestions.push('question');
  }
  if (text.includes('important') || text.includes('key') || text.includes('remember')) {
    suggestions.push('key-concept');
  }
  if (text.includes('todo') || text.includes('try') || text.includes('practice')) {
    suggestions.push('action-item');
  }
  
  // Technical topic suggestions
  const techTopics = {
    'react': ['react', 'frontend'],
    'javascript': ['javascript', 'programming'],
    'python': ['python', 'programming'],
    'css': ['css', 'styling'],
    'api': ['api', 'backend'],
    'database': ['database', 'data']
  };
  
  Object.entries(techTopics).forEach(([keyword, tags]) => {
    if (text.includes(keyword) || title.includes(keyword)) {
      suggestions.push(...tags);
    }
  });
  
  // Remove duplicates and limit suggestions
  return [...new Set(suggestions)].slice(0, 4);
}

// DOM Elements
const elements = {
  // Navigation
  navItems: document.querySelectorAll('.nav-item'),
  views: document.querySelectorAll('.view'),
  backToVideosBtn: document.getElementById('back-to-videos'),
  
  // Videos View
  videosContainer: document.getElementById('videos-container'),
  videoSearch: document.getElementById('video-search'),
  videoSearchBtn: document.getElementById('video-search-btn'),
  
  // All Notes View
  allNotesContainer: document.getElementById('all-notes-container'),
  notesSearch: document.getElementById('notes-search'),
  notesSearchBtn: document.getElementById('notes-search-btn'),
  tagFilter: document.getElementById('tag-filter'),
  
  // Single Video View
  videoInfo: document.getElementById('video-info'),
  videoTimeline: document.getElementById('video-timeline'),
  videoNotesContainer: document.getElementById('video-notes-container'),
  videoTagFilter: document.getElementById('video-tag-filter'),
  exportVideoNotesBtn: document.getElementById('export-video-notes'),
  openInYoutubeBtn: document.getElementById('open-in-youtube'),
  
  // Settings View
  autoActivateSelect: document.getElementById('auto-activate'),
  rememberChannelsCheckbox: document.getElementById('remember-channels'),
  exportAllDataBtn: document.getElementById('export-all-data'),
  clearAllDataBtn: document.getElementById('clear-all-data'),
  
  // Export Modal
  exportModal: document.getElementById('export-modal'),
  closeModalBtn: document.querySelector('.close-modal'),
  exportFormatSelect: document.getElementById('export-format'),
  includeTimestampsCheckbox: document.getElementById('include-timestamps'),
  includeTagsCheckbox: document.getElementById('include-tags'),
  cancelExportBtn: document.getElementById('cancel-export'),
  confirmExportBtn: document.getElementById('confirm-export')
};

// Initialize the dashboard
function initDashboard() {
  console.log('Initializing dashboard');
  
  try {
    setupEventListeners();
    loadGlobalTags(); // Load persistent tags first
    loadData();
    loadSettings();
    console.log('Dashboard initialization complete');
  } catch (error) {
    console.error('Error initializing dashboard:', error);
  }
} 

// Load persistent global tags
function loadGlobalTags() {
  chrome.storage.local.get(['globalTags'], (result) => {
    globalTags = result.globalTags || [];
    console.log('Loaded global tags:', globalTags);
  });
}

// Save persistent global tags
function saveGlobalTags() {
  chrome.storage.local.set({ globalTags }, () => {
    console.log('Global tags saved:', globalTags);
  });
}

// Add new tag to global tags
function addToGlobalTags(tagName) {
  if (!globalTags.includes(tagName)) {
    globalTags.push(tagName);
    saveGlobalTags();
  }
}

// Set up event listeners
function setupEventListeners() {
  console.log('Setting up event listeners');
  
  // Navigation
  if (elements.navItems) {
    elements.navItems.forEach(item => {
      if (item) {
        item.addEventListener('click', () => {
          switchView(item.dataset.view);
        });
      }
    });
  }
  
  // Back button
  if (elements.backToVideosBtn) {
    elements.backToVideosBtn.addEventListener('click', () => {
      switchView('videos');
    });
  }
  
  // Search functionality
  if (elements.videoSearch) {
    elements.videoSearch.addEventListener('input', filterVideos);
  }
  if (elements.notesSearch) {
    elements.notesSearch.addEventListener('input', filterAllNotes);
  }
  
  // Tag filters
  if (elements.tagFilter) {
    elements.tagFilter.addEventListener('change', () => {
      activeTagFilter = elements.tagFilter.value;
      filterAllNotes();
    });
  }
  if (elements.videoTagFilter) {
    elements.videoTagFilter.addEventListener('change', () => {
      filterVideoNotes(elements.videoTagFilter.value);
    });
  }
  
  // Export buttons - FIXED
if (elements.exportVideoNotesBtn) {
  elements.exportVideoNotesBtn.addEventListener('click', () => {
    console.log('Export video notes clicked');
    showSelectiveExportModal('video');
  });
}
if (elements.exportAllDataBtn) {
  elements.exportAllDataBtn.addEventListener('click', () => {
    console.log('Export all data clicked');
    showSelectiveExportModal('all');
  });
}
  
  // Other buttons
  if (elements.openInYoutubeBtn) {
    elements.openInYoutubeBtn.addEventListener('click', () => {
      if (currentVideoId) {
        chrome.tabs.create({ url: `https://youtube.com/watch?v=${currentVideoId}` });
      }
    });
  }
  
  if (elements.clearAllDataBtn) {
    elements.clearAllDataBtn.addEventListener('click', confirmClearAllData);
  }
  
  // Settings
  if (elements.autoActivateSelect) {
    elements.autoActivateSelect.addEventListener('change', saveSettings);
  }
  if (elements.rememberChannelsCheckbox) {
    elements.rememberChannelsCheckbox.addEventListener('change', saveSettings);
  }
  
  // Export modal
  if (elements.closeModalBtn) {
    elements.closeModalBtn.addEventListener('click', closeExportModal);
  }
  if (elements.cancelExportBtn) {
    elements.cancelExportBtn.addEventListener('click', closeExportModal);
  }
  if (elements.confirmExportBtn) {
    elements.confirmExportBtn.addEventListener('click', handleSelectiveExport);
  }
  
  console.log('Event listeners set up complete');
}

// Switch between views
function switchView(viewName, videoId = null) {
  console.log('Switching to view:', viewName, videoId ? `with videoId: ${videoId}` : '');
  
  elements.views.forEach(view => {
    view.classList.add('hidden');
  });
  
  elements.navItems.forEach(item => {
    if (item.dataset.view === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  if (viewName === 'single-video' && videoId) {
    currentVideoId = videoId;
    document.getElementById('single-video-view').classList.remove('hidden');
    loadSingleVideoView(videoId);
    return;
  }
  
  // Add analytics view to videos view
  if (viewName === 'videos') {
    renderAnalyticsDashboard();
  }
  
  document.getElementById(`${viewName}-view`).classList.remove('hidden');
  currentView = viewName;
}

// Load data from storage
function loadData() {
  console.log('Loading data from storage');
  
  chrome.storage.local.get(['noteStreamData', 'recentVideos'], (result) => {
    // Support both old and new storage keys for migration
    const noteStreamData = result.noteStreamData || result.podNoteData || {};
    
    allNotes = [];
    allVideos = [];
    
    const uniqueTags = new Set();
    
    Object.keys(noteStreamData).forEach(videoId => {
      const videoNotes = noteStreamData[videoId] || [];
      
      if (videoNotes.length === 0) return;
      
      videoNotes.forEach(note => {
        if (!note.videoId) {
          note.videoId = videoId;
        }
        
        if (note.tags && Array.isArray(note.tags)) {
          note.tags.forEach(tag => {
            uniqueTags.add(tag);
            addToGlobalTags(tag); // Add to persistent global tags
          });
        }
        
        allNotes.push(note);
      });
      
      let videoInfo = {
        title: 'Unknown Title',
        channel: 'Unknown Channel',
        duration: 0
      };
      
      for (const note of videoNotes) {
        if (note.videoInfo && note.videoInfo.title && note.videoInfo.title !== 'Unknown Title') {
          videoInfo = note.videoInfo;
          break;
        }
      }
      
      allVideos.push({
        id: videoId,
        title: videoInfo.title || 'Unknown Title',
        channel: videoInfo.channel || 'Unknown Channel',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        noteCount: videoNotes.length,
        lastUpdated: videoNotes[0].createdAt || new Date().toISOString(),
        duration: videoInfo.duration || 0
      });
    });
    
    allTags = Array.from(uniqueTags).map(tag => ({
      id: tag,
      name: tag
    }));
    
    allVideos.sort((a, b) => {
      return new Date(b.lastUpdated) - new Date(a.lastUpdated);
    });
    
    console.log('Processed videos:', allVideos.length);
    console.log('Processed notes:', allNotes.length);
    
    // Analyze content themes
    analyzeContentThemes();
    
    renderVideos();
    renderAllNotes();
    updateTagFilters();
  });
}

// Render analytics dashboard
function renderAnalyticsDashboard() {
  if (!contentThemes.concepts) return;
  
  // Check if analytics section already exists
  let analyticsSection = document.getElementById('analytics-section');
  if (analyticsSection) {
    analyticsSection.remove();
  }
  
  // Create analytics section
  analyticsSection = document.createElement('div');
  analyticsSection.id = 'analytics-section';
  analyticsSection.className = 'analytics-dashboard';
  
  const topConcepts = contentThemes.concepts.slice(0, 5);
  const patterns = contentThemes.patterns;
  
  analyticsSection.innerHTML = `
    <div class="analytics-header">
      <h3>📊 Learning Analytics</h3>
    </div>
    <div class="analytics-grid">
      <div class="analytics-card">
        <h4>📝 Learning Overview</h4>
        <div class="stat-row">
          <span class="stat-label">Total Notes:</span>
          <span class="stat-value">${patterns.totalNotes}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Videos Watched:</span>
          <span class="stat-value">${patterns.totalVideos}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Avg Notes/Video:</span>
          <span class="stat-value">${patterns.averageNotesPerVideo}</span>
        </div>
      </div>
      
      <div class="analytics-card">
        <h4>🔥 Top Concepts</h4>
        ${topConcepts.map(({concept, count}) => `
          <div class="concept-row">
            <span class="concept-name">${concept}</span>
            <span class="concept-count">${count} notes</span>
          </div>
        `).join('')}
      </div>
      
      <div class="analytics-card">
        <h4>🏷️ Tag Usage</h4>
        ${Object.entries(patterns.tagDistribution)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([tag, count]) => `
            <div class="tag-usage-row">
              <span class="tag-name">${tag}</span>
              <span class="tag-count">${count}</span>
            </div>
          `).join('')}
      </div>
      
      <div class="analytics-card">
        <h4>📺 Content Preferences</h4>
        <div class="stat-row">
          <span class="stat-label">Short videos (&lt;10m):</span>
          <span class="stat-value">${patterns.timeSpentAnalysis.shortVideos}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Medium videos (10-30m):</span>
          <span class="stat-value">${patterns.timeSpentAnalysis.mediumVideos}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Long videos (&gt;30m):</span>
          <span class="stat-value">${patterns.timeSpentAnalysis.longVideos}</span>
        </div>
      </div>
    </div>
  `;
  
  // Insert analytics before videos grid
  const videosView = document.getElementById('videos-view');
  const videosContainer = elements.videosContainer;
  if (videosView && videosContainer) {
    videosView.insertBefore(analyticsSection, videosContainer);
  }
}

// Enhanced render all notes with edit/delete functionality
function renderAllNotes() {
  console.log('Rendering all notes');
  
  const container = elements.allNotesContainer;
  if (!container) return;
  
  container.innerHTML = '';
  
  if (allNotes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="#e5e7eb">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path>
        </svg>
        <p>No notes found</p>
        <p class="subtitle">Start taking notes on YouTube videos</p>
        <button id="create-first-note-btn">Create First Note</button>
      </div>
    `;
    document.getElementById('create-first-note-btn')?.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://youtube.com' });
    });
    return;
  }
  
  // Apply filters
  filteredNotes = allNotes;
  if (elements.notesSearch && elements.notesSearch.value) {
    const searchTerm = elements.notesSearch.value.toLowerCase().trim();
    filteredNotes = filteredNotes.filter(note => 
      note.text.toLowerCase().includes(searchTerm)
    );
  }
  
  if (activeTagFilter) {
    filteredNotes = filteredNotes.filter(note => 
      note.tags && note.tags.includes(activeTagFilter)
    );
  }
  
  filteredNotes.sort((a, b) => {
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
  
  if (filteredNotes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No notes match current filters</p>
        <button id="clear-filters-btn">Clear Filters</button>
      </div>
    `;
    document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
      if (elements.notesSearch) elements.notesSearch.value = '';
      if (elements.tagFilter) elements.tagFilter.value = '';
      activeTagFilter = null;
      renderAllNotes();
    });
    return;
  }
  
  // Add each note with edit/delete functionality
  filteredNotes.forEach(note => {
    const video = allVideos.find(v => v.id === note.videoId) || {
      id: note.videoId,
      title: (note.videoInfo && note.videoInfo.title) || 'Unknown Video',
      channel: (note.videoInfo && note.videoInfo.channel) || 'Unknown Channel'
    };
    
    const noteItem = document.createElement('div');
    noteItem.className = 'note-item';
    noteItem.dataset.noteId = note.id;
    
    // Add checkbox for selective export
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'note-select-checkbox';
    checkbox.dataset.noteId = note.id;
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedNotesForExport.add(note.id);
      } else {
        selectedNotesForExport.delete(note.id);
      }
    });
    
    const metadataDiv = document.createElement('div');
    metadataDiv.className = 'note-metadata';
    
    const videoLink = document.createElement('div');
    videoLink.className = 'note-video';
    videoLink.textContent = video.title;
    videoLink.addEventListener('click', () => {
      switchView('single-video', note.videoId);
    });
    videoLink.style.cursor = 'pointer';
    
    const timestamp = document.createElement('div');
    timestamp.className = 'note-timestamp';
    timestamp.textContent = note.timestampFormatted || '00:00';
    timestamp.addEventListener('click', () => {
      chrome.tabs.create({ 
        url: `https://youtube.com/watch?v=${note.videoId}&t=${Math.floor(note.timestamp)}s` 
      });
    });
    
    // Note actions (edit/delete)
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'note-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-note-btn';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Edit note';
    editBtn.addEventListener('click', () => showEditNoteModal(note));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-note-btn';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Delete note';
    deleteBtn.addEventListener('click', () => deleteNoteFromDashboard(note.id));
    
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    
    metadataDiv.appendChild(checkbox);
    metadataDiv.appendChild(videoLink);
    metadataDiv.appendChild(timestamp);
    metadataDiv.appendChild(actionsDiv);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'note-content';
    contentDiv.textContent = note.text;
    
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'note-tags';
    
    if (note.tags && note.tags.length > 0) {
      note.tags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.className = 'tag';
        
        // Generate colors for the tag
        const { bgColor, textColor } = generateTagColors(tag);
        tagElement.style.backgroundColor = bgColor;
        tagElement.style.color = textColor;
        tagElement.style.border = `1px solid ${textColor}`;
        
        tagElement.textContent = tag;
        
        tagElement.addEventListener('click', () => {
          activeTagFilter = tag;
          if (elements.tagFilter) elements.tagFilter.value = tag;
          renderAllNotes();
        });
        
        tagsDiv.appendChild(tagElement);
      });
    }
    
    noteItem.appendChild(metadataDiv);
    noteItem.appendChild(contentDiv);
    noteItem.appendChild(tagsDiv);
    
    container.appendChild(noteItem);
  });
}

// Delete note from dashboard
function deleteNoteFromDashboard(noteId) {
  if (!confirm('Are you sure you want to delete this note?')) return;
  
  // Find and remove the note
  const noteIndex = allNotes.findIndex(note => note.id === noteId);
  if (noteIndex === -1) return;
  
  const note = allNotes[noteIndex];
  allNotes.splice(noteIndex, 1);
  
  // Update storage
  chrome.storage.local.get(['noteStreamData'], (result) => {
    const noteStreamData = result.noteStreamData || {};
    if (noteStreamData[note.videoId]) {
      noteStreamData[note.videoId] = noteStreamData[note.videoId].filter(n => n.id !== noteId);
      chrome.storage.local.set({ noteStreamData });
    }
  });
  
  // Re-analyze themes and update UI
  analyzeContentThemes();
  renderAllNotes();
  updateTagFilters();
}

// Show edit note modal
function showEditNoteModal(note) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  
  const allAvailableTags = [...new Set([...globalTags, ...allTags.map(t => t.name)])];
  
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Edit Note</h3>
        <button class="close-modal">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Note Content</label>
          <textarea id="edit-note-text" rows="4">${note.text}</textarea>
        </div>
        <div class="form-group">
          <label>Tags</label>
          <div class="tags-input">
            <div class="current-tags" id="current-tags">
              <!-- Will be populated by updateTagDisplay -->
            </div>
            <div class="available-tags">
              <!-- Will be populated by updateTagDisplay -->
            </div>
            <div class="new-tag-input">
              <input type="text" id="new-tag-input" placeholder="Add new tag...">
              <button id="add-new-tag">Add</button>
            </div>
            
            <!-- Smart suggestions -->
            <div class="smart-suggestions">
              <h5>💡 Smart Suggestions:</h5>
              <div id="tag-suggestions">
                ${suggestTagsForNote(note.text, note.videoInfo).map(tag => {
                  const { bgColor, textColor } = generateTagColors(tag);
                  return `<span class="tag suggested-tag" data-tag="${tag}" style="background-color: ${bgColor}; color: ${textColor}; border: 1px solid ${textColor};">${tag}</span>`;
                }).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button id="cancel-edit" class="secondary-button">Cancel</button>
        <button id="save-edit" class="primary-button">Save Changes</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Event handlers
  let currentTags = [...(note.tags || [])];
  
  // Initialize tag display with colors
  updateTagDisplay();
  
  modal.querySelector('.close-modal').addEventListener('click', () => document.body.removeChild(modal));
  modal.querySelector('#cancel-edit').addEventListener('click', () => document.body.removeChild(modal));
  
  // Remove tag handler
  modal.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-tag')) {
      const tag = e.target.dataset.tag;
      currentTags = currentTags.filter(t => t !== tag);
      updateTagDisplay();
    }
  });
  
  // Add tag handlers
  modal.addEventListener('click', (e) => {
    if (e.target.classList.contains('available-tag') || e.target.classList.contains('suggested-tag')) {
      const tag = e.target.dataset.tag;
      if (!currentTags.includes(tag)) {
        currentTags.push(tag);
        updateTagDisplay();
      }
    }
  });
  
  // New tag handler
  modal.querySelector('#add-new-tag').addEventListener('click', () => {
    const newTag = modal.querySelector('#new-tag-input').value.trim();
    if (newTag && !currentTags.includes(newTag)) {
      currentTags.push(newTag);
      addToGlobalTags(newTag); // Add to persistent global tags
      updateTagDisplay();
      modal.querySelector('#new-tag-input').value = '';
    }
  });
  
  // Save handler
  modal.querySelector('#save-edit').addEventListener('click', () => {
    const newText = modal.querySelector('#edit-note-text').value.trim();
    if (newText) {
      updateNoteInDashboard(note.id, newText, currentTags);
      document.body.removeChild(modal);
    }
  });
  
  function updateTagDisplay() {
    const currentTagsContainer = modal.querySelector('#current-tags');
    const availableTagsContainer = modal.querySelector('.available-tags');
    const allAvailableTags = [...new Set([...globalTags, ...allTags.map(t => t.name)])];
    
    // Update current tags with colors
    currentTagsContainer.innerHTML = '';
    currentTags.forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'tag editable-tag';
      const { bgColor, textColor } = generateTagColors(tag);
      tagElement.style.backgroundColor = bgColor;
      tagElement.style.color = textColor;
      tagElement.style.border = `1px solid ${textColor}`;
      
      tagElement.innerHTML = `
        ${tag}
        <span class="remove-tag" data-tag="${tag}">×</span>
      `;
      currentTagsContainer.appendChild(tagElement);
    });
    
    // Update available tags with colors
    const availableTags = allAvailableTags.filter(tag => !currentTags.includes(tag));
    availableTagsContainer.innerHTML = '<h5>Available Tags:</h5>';
    availableTags.forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'tag available-tag';
      tagElement.dataset.tag = tag;
      const { bgColor, textColor } = generateTagColors(tag);
      tagElement.style.backgroundColor = bgColor;
      tagElement.style.color = textColor;
      tagElement.style.border = `1px solid ${textColor}`;
      tagElement.textContent = tag;
      availableTagsContainer.appendChild(tagElement);
    });
  }
}

// Update note in dashboard
function updateNoteInDashboard(noteId, newText, newTags) {
  const noteIndex = allNotes.findIndex(note => note.id === noteId);
  if (noteIndex === -1) return;
  
  allNotes[noteIndex].text = newText;
  allNotes[noteIndex].tags = newTags;
  allNotes[noteIndex].updatedAt = new Date().toISOString();
  
  // Add new tags to global tags
  newTags.forEach(tag => addToGlobalTags(tag));
  
  // Update storage
  chrome.storage.local.get(['noteStreamData'], (result) => {
    const noteStreamData = result.noteStreamData || {};
    if (noteStreamData[allNotes[noteIndex].videoId]) {
      const videoNotes = noteStreamData[allNotes[noteIndex].videoId];
      const noteIndexInVideo = videoNotes.findIndex(n => n.id === noteId);
      if (noteIndexInVideo !== -1) {
        videoNotes[noteIndexInVideo] = allNotes[noteIndex];
        chrome.storage.local.set({ noteStreamData });
      }
    }
  });
  
  // Re-analyze themes and update UI
  analyzeContentThemes();
  renderAllNotes();
  updateTagFilters();
}

// Show selective export modal
function showSelectiveExportModal(exportType) {
  selectedNotesForExport.clear();
  
  const modal = document.createElement('div');
  modal.className = 'modal export-modal';
  
  let notesToShow = exportType === 'video' && currentVideoId 
    ? allNotes.filter(note => note.videoId === currentVideoId)
    : allNotes;
  
  // Group notes by video
  const notesByVideo = {};
  notesToShow.forEach(note => {
    const video = allVideos.find(v => v.id === note.videoId) || {
      title: 'Unknown Video',
      channel: 'Unknown Channel'
    };
    
    if (!notesByVideo[note.videoId]) {
      notesByVideo[note.videoId] = {
        video: video,
        notes: []
      };
    }
    notesByVideo[note.videoId].notes.push(note);
  });
  
  modal.innerHTML = `
    <div class="modal-content export-modal-content">
      <div class="modal-header">
        <h3>📤 Selective Export</h3>
        <button class="close-modal">×</button>
      </div>
      <div class="modal-body">
        <div class="export-controls">
          <div class="selection-controls">
            <button id="select-all-notes" class="secondary-button">Select All</button>
            <button id="deselect-all-notes" class="secondary-button">Deselect All</button>
            <span id="selection-count">0 notes selected</span>
          </div>
          
          <div class="export-options">
            <div class="form-group">
              <label>Export Format:</label>
              <select id="export-format">
                <option value="markdown">📝 Lesson Plan (Markdown)</option>
                <option value="study-guide">📚 Study Guide</option>
                <option value="text">📄 Plain Text</option>
                <option value="json">💻 JSON Data</option>
                <option value="csv">📊 CSV Spreadsheet</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="include-timestamps" checked>
                Include timestamps & video links
              </label>
            </div>
            
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="include-tags" checked>
                Include tags
              </label>
            </div>
            
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="group-by-video" checked>
                Group notes by video
              </label>
            </div>
          </div>
        </div>
        
        <div class="notes-selection">
          <h4>Select Notes to Export:</h4>
          <div class="notes-by-video">
            ${Object.entries(notesByVideo).map(([videoId, {video, notes}]) => `
              <div class="video-group">
                <div class="video-header">
                  <label class="video-checkbox">
                    <input type="checkbox" class="video-select" data-video-id="${videoId}">
                    <strong>${video.title}</strong>
                  </label>
                  <span class="video-meta">${video.channel} • ${notes.length} notes</span>
                </div>
                <div class="video-notes">
                  ${notes.map(note => `
                    <label class="note-checkbox">
                      <input type="checkbox" class="note-select" data-note-id="${note.id}" data-video-id="${videoId}">
                      <div class="note-preview">
                        <span class="note-timestamp">${note.timestampFormatted}</span>
                        <span class="note-text">${note.text.substring(0, 100)}${note.text.length > 100 ? '...' : ''}</span>
                        ${note.tags ? `<div class="note-tags-preview">${note.tags.map(tag => {
                          const { bgColor, textColor } = generateTagColors(tag);
                          return `<span class="tag-mini" style="background-color: ${bgColor}; color: ${textColor}; border: 1px solid ${textColor};">${tag}</span>`;
                        }).join('')}</div>` : ''}
                      </div>
                    </label>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button id="cancel-export" class="secondary-button">Cancel</button>
        <button id="confirm-export" class="primary-button" disabled>Export Selected Notes</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Event handlers for selective export
  const updateSelectionCount = () => {
    const count = selectedNotesForExport.size;
    modal.querySelector('#selection-count').textContent = `${count} notes selected`;
    modal.querySelector('#confirm-export').disabled = count === 0;
  };
  
  // Individual note selection
  modal.querySelectorAll('.note-select').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const noteId = e.target.dataset.noteId;
      if (e.target.checked) {
        selectedNotesForExport.add(noteId);
      } else {
        selectedNotesForExport.delete(noteId);
      }
      updateSelectionCount();
      
      // Update video checkbox state
      const videoId = e.target.dataset.videoId;
      const videoCheckbox = modal.querySelector(`.video-select[data-video-id="${videoId}"]`);
      const videoNoteCheckboxes = modal.querySelectorAll(`.note-select[data-video-id="${videoId}"]`);
      const checkedVideoNotes = Array.from(videoNoteCheckboxes).filter(cb => cb.checked);
      
      if (checkedVideoNotes.length === videoNoteCheckboxes.length) {
        videoCheckbox.checked = true;
        videoCheckbox.indeterminate = false;
      } else if (checkedVideoNotes.length > 0) {
        videoCheckbox.checked = false;
        videoCheckbox.indeterminate = true;
      } else {
        videoCheckbox.checked = false;
        videoCheckbox.indeterminate = false;
      }
    });
  });
  
  // Video selection (select/deselect all notes in video)
  modal.querySelectorAll('.video-select').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const videoId = e.target.dataset.videoId;
      const videoNoteCheckboxes = modal.querySelectorAll(`.note-select[data-video-id="${videoId}"]`);
      
      videoNoteCheckboxes.forEach(noteCheckbox => {
        noteCheckbox.checked = e.target.checked;
        const noteId = noteCheckbox.dataset.noteId;
        if (e.target.checked) {
          selectedNotesForExport.add(noteId);
        } else {
          selectedNotesForExport.delete(noteId);
        }
      });
      updateSelectionCount();
    });
  });
  
  // Select/deselect all buttons
  modal.querySelector('#select-all-notes').addEventListener('click', () => {
    modal.querySelectorAll('.note-select').forEach(checkbox => {
      checkbox.checked = true;
      selectedNotesForExport.add(checkbox.dataset.noteId);
    });
    modal.querySelectorAll('.video-select').forEach(checkbox => {
      checkbox.checked = true;
      checkbox.indeterminate = false;
    });
    updateSelectionCount();
  });
  
  modal.querySelector('#deselect-all-notes').addEventListener('click', () => {
    modal.querySelectorAll('.note-select').forEach(checkbox => {
      checkbox.checked = false;
    });
    modal.querySelectorAll('.video-select').forEach(checkbox => {
      checkbox.checked = false;
      checkbox.indeterminate = false;
    });
    selectedNotesForExport.clear();
    updateSelectionCount();
  });
  
  // Close modal
  modal.querySelector('.close-modal').addEventListener('click', () => document.body.removeChild(modal));
  modal.querySelector('#cancel-export').addEventListener('click', () => document.body.removeChild(modal));
  
  // Confirm export
  modal.querySelector('#confirm-export').addEventListener('click', () => {
    handleSelectiveExport(modal);
    document.body.removeChild(modal);
  });
}

// Handle selective export
function handleSelectiveExport(modal) {
  const format = modal.querySelector('#export-format').value;
  const includeTimestamps = modal.querySelector('#include-timestamps').checked;
  const includeTags = modal.querySelector('#include-tags').checked;
  const groupByVideo = modal.querySelector('#group-by-video').checked;
  
  // Get selected notes
  const selectedNotes = allNotes.filter(note => selectedNotesForExport.has(note.id));
  
  if (selectedNotes.length === 0) return;
  
  // Sort by video and timestamp
  selectedNotes.sort((a, b) => {
    if (groupByVideo && a.videoId !== b.videoId) {
      return a.videoId.localeCompare(b.videoId);
    }
    return a.timestamp - b.timestamp;
  });
  
  let content = '';
  let filename = '';
  
  // Generate filename
  if (selectedNotes.length === 1) {
    const note = selectedNotes[0];
    const video = allVideos.find(v => v.id === note.videoId);
    filename = sanitizeFilename(`${video?.title || 'Note'} - Note.${getFileExtension(format)}`);
  } else {
    filename = `NoteStream-Export-${new Date().toISOString().slice(0, 10)}.${getFileExtension(format)}`;
  }
  
  // Generate content based on format
  switch (format) {
    case 'markdown':
      content = generateLessonPlanExport(selectedNotes, includeTimestamps, includeTags, groupByVideo);
      break;
    case 'study-guide':
      content = generateStudyGuideExport(selectedNotes, includeTimestamps, includeTags, groupByVideo);
      break;
    case 'text':
      content = generateTextExport(selectedNotes, includeTimestamps, includeTags, groupByVideo);
      break;
    case 'json':
      content = JSON.stringify(selectedNotes, null, 2);
      break;
    case 'csv':
      content = generateCsvExport(selectedNotes, includeTimestamps, includeTags);
      break;
  }
  
  // Download file
  downloadFile(content, filename, format);
  
  // Show success message
  showToast(`Exported ${selectedNotes.length} notes successfully!`);
}

// Generate lesson plan export
function generateLessonPlanExport(notes, includeTimestamps, includeTags, groupByVideo) {
  let markdown = '# 📚 Lesson Plan\n\n';
  
  // Generate learning objectives from tags
  const allTags = [...new Set(notes.flatMap(note => note.tags || []))];
  if (allTags.length > 0) {
    markdown += '## 🎯 Learning Objectives\n';
    allTags.forEach(tag => {
      markdown += `- Master **${tag}** concepts and applications\n`;
    });
    markdown += '\n';
  }
  
  // Content sections
  if (groupByVideo) {
    const notesByVideo = {};
    notes.forEach(note => {
      if (!notesByVideo[note.videoId]) {
        notesByVideo[note.videoId] = [];
      }
      notesByVideo[note.videoId].push(note);
    });
    
    Object.entries(notesByVideo).forEach(([videoId, videoNotes]) => {
      const video = allVideos.find(v => v.id === videoId) || { 
        title: 'Unknown Video', 
        channel: 'Unknown Channel' 
      };
      
      markdown += `## 📺 ${video.title}\n`;
      markdown += `*Source: ${video.channel}*\n\n`;
      
      videoNotes.forEach((note, index) => {
        markdown += `### Section ${index + 1}`;
        if (includeTimestamps) {
          markdown += ` - [${note.timestampFormatted}](https://youtube.com/watch?v=${videoId}&t=${Math.floor(note.timestamp)}s)`;
        }
        markdown += '\n\n';
        
        markdown += `**Key Concept**: ${note.text}\n\n`;
        
        if (includeTags && note.tags && note.tags.length > 0) {
          markdown += `**Tags**: ${note.tags.join(', ')}\n\n`;
        }
        
        // Add suggested activities
        markdown += `**Suggested Activity**: \n`;
        if (note.tags && note.tags.includes('tutorial')) {
          markdown += `- Follow along with the demonstration\n- Practice the technique independently\n`;
        } else if (note.tags && note.tags.includes('question')) {
          markdown += `- Discuss this question in small groups\n- Research and present findings\n`;
        } else {
          markdown += `- Reflect on how this concept applies to your projects\n- Create examples demonstrating this principle\n`;
        }
        markdown += '\n';
        
        markdown += '---\n\n';
      });
    });
  } else {
    notes.forEach((note, index) => {
      const video = allVideos.find(v => v.id === note.videoId);
      
      markdown += `## Section ${index + 1}`;
      if (includeTimestamps && video) {
        markdown += ` - [${note.timestampFormatted}](https://youtube.com/watch?v=${note.videoId}&t=${Math.floor(note.timestamp)}s)`;
      }
      markdown += '\n\n';
      
      if (video) {
        markdown += `*From: ${video.title} by ${video.channel}*\n\n`;
      }
      
      markdown += `${note.text}\n\n`;
      
      if (includeTags && note.tags && note.tags.length > 0) {
        markdown += `**Tags**: ${note.tags.join(', ')}\n\n`;
      }
      
      markdown += '---\n\n';
    });
  }
  
  return markdown;
}

// Generate study guide export
function generateStudyGuideExport(notes, includeTimestamps, includeTags, groupByVideo) {
  let content = '# 📖 Study Guide\n\n';
  
  // Quick reference section
  const keyTopics = [...new Set(notes.flatMap(note => note.tags || []))];
  if (keyTopics.length > 0) {
    content += '## 🔑 Key Topics\n';
    keyTopics.forEach(topic => {
      const topicNotes = notes.filter(note => note.tags && note.tags.includes(topic));
      content += `- **${topic}** (${topicNotes.length} notes)\n`;
    });
    content += '\n';
  }
  
  // Main content
  if (groupByVideo) {
    const notesByVideo = {};
    notes.forEach(note => {
      if (!notesByVideo[note.videoId]) {
        notesByVideo[note.videoId] = [];
      }
      notesByVideo[note.videoId].push(note);
    });
    
    Object.entries(notesByVideo).forEach(([videoId, videoNotes]) => {
      const video = allVideos.find(v => v.id === videoId) || { 
        title: 'Unknown Video', 
        channel: 'Unknown Channel' 
      };
      
      content += `## 📺 ${video.title}\n`;
      
      videoNotes.forEach(note => {
        content += `### `;
        if (includeTimestamps) {
          content += `[${note.timestampFormatted}] `;
        }
        content += `${note.text.substring(0, 50)}...\n\n`;
        content += `${note.text}\n\n`;
        
        if (includeTags && note.tags && note.tags.length > 0) {
          content += `*Related topics: ${note.tags.join(', ')}*\n\n`;
        }
      });
      
      content += '\n';
    });
  } else {
    notes.forEach(note => {
      const video = allVideos.find(v => v.id === note.videoId);
      
      content += `### `;
      if (includeTimestamps) {
        content += `[${note.timestampFormatted}] `;
      }
      content += `${note.text.substring(0, 50)}...\n\n`;
      
      content += `${note.text}\n\n`;
      
      if (video) {
        content += `*Source: ${video.title}*\n`;
      }
      
      if (includeTags && note.tags && note.tags.length > 0) {
        content += `*Topics: ${note.tags.join(', ')}*\n`;
      }
      
      content += '\n---\n\n';
    });
  }
  
  return content;
}

// Generate enhanced text export
function generateTextExport(notes, includeTimestamps, includeTags, groupByVideo) {
  let text = 'NOTESTREAM EXPORT\n';
  text += '=================\n\n';
  text += `Generated: ${new Date().toLocaleString()}\n`;
  text += `Total Notes: ${notes.length}\n\n`;
  
  if (groupByVideo) {
    const notesByVideo = {};
    notes.forEach(note => {
      if (!notesByVideo[note.videoId]) {
        notesByVideo[note.videoId] = [];
      }
      notesByVideo[note.videoId].push(note);
    });
    
    Object.entries(notesByVideo).forEach(([videoId, videoNotes]) => {
      const video = allVideos.find(v => v.id === videoId) || { 
        title: 'Unknown Video', 
        channel: 'Unknown Channel' 
      };
      
      text += `VIDEO: ${video.title}\n`;
      text += `Channel: ${video.channel}\n`;
      text += `Notes: ${videoNotes.length}\n\n`;
      
      videoNotes.forEach((note, index) => {
        text += `${index + 1}. `;
        if (includeTimestamps) {
          text += `[${note.timestampFormatted}] `;
        }
        text += `${note.text}\n`;
        
        if (includeTags && note.tags && note.tags.length > 0) {
          text += `   Tags: ${note.tags.join(', ')}\n`;
        }
        text += '\n';
      });
      
      text += '---\n\n';
    });
  } else {
    notes.forEach((note, index) => {
      const video = allVideos.find(v => v.id === note.videoId);
      
      text += `${index + 1}. `;
      if (includeTimestamps) {
        text += `[${note.timestampFormatted}] `;
      }
      text += `${note.text}\n`;
      
      if (video) {
        text += `   Video: ${video.title}\n`;
      }
      
      if (includeTags && note.tags && note.tags.length > 0) {
        text += `   Tags: ${note.tags.join(', ')}\n`;
      }
      
      text += '\n';
    });
  }
  
  return text;
}

// Generate CSV export (same as before)
function generateCsvExport(notes, includeTimestamps, includeTags) {
  let csv = 'Video Title,Video Channel,Video ID';
  
  if (includeTimestamps) {
    csv += ',Timestamp,Timestamp (seconds)';
  }
  
  csv += ',Note';
  
  if (includeTags) {
    csv += ',Tags';
  }
  
  csv += '\n';
  
  notes.forEach(note => {
    const video = allVideos.find(v => v.id === note.videoId) || { title: 'Unknown Video', channel: 'Unknown Channel' };
    
    const escapeCsv = (field) => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };
    
    csv += `${escapeCsv(video.title)},${escapeCsv(video.channel)},${note.videoId}`;
    
    if (includeTimestamps) {
      csv += `,${note.timestampFormatted || '00:00'},${note.timestamp || 0}`;
    }
    
    csv += `,${escapeCsv(note.text)}`;
    
    if (includeTags && note.tags) {
      csv += `,${escapeCsv(note.tags.join('; '))}`;
    }
    
    csv += '\n';
  });
  
  return csv;
}

// Helper functions
function getFileExtension(format) {
  const extensions = {
    'markdown': 'md',
    'study-guide': 'md',
    'text': 'txt',
    'json': 'json',
    'csv': 'csv'
  };
  return extensions[format] || 'txt';
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 3000);
}

// Load settings, render functions, and other existing functions remain the same...
// (continuing with existing functions)

function loadSettings() {
  console.log('Loading settings');
  chrome.storage.local.get(['noteStreamSettings'], (result) => {
    const settings = result.noteStreamSettings || {
      autoActivateMinutes: 0,
      rememberChannels: true
    };
    
    if (elements.autoActivateSelect) {
      elements.autoActivateSelect.value = settings.autoActivateMinutes.toString();
    }
    if (elements.rememberChannelsCheckbox) {
      elements.rememberChannelsCheckbox.checked = settings.rememberChannels;
    }
    
    console.log('Settings loaded:', settings);
  });
}

function saveSettings() {
  console.log('Saving settings');
  const settings = {
    autoActivateMinutes: parseInt(elements.autoActivateSelect?.value || '0', 10),
    rememberChannels: elements.rememberChannelsCheckbox?.checked || false
  };
  
  chrome.storage.local.set({ noteStreamSettings: settings });
  console.log('Settings saved:', settings);
}

// Continue with existing functions (renderVideos, filterVideos, etc.)
function renderVideos() {
  console.log('Rendering videos grid');
  
  const container = elements.videosContainer;
  if (!container) {
    console.log('Videos container not found');
    return;
  }
  
  container.innerHTML = '';
  
  if (allVideos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="#e5e7eb">
          <path d="M4 8h16v10H4z M10 6H8v2h2z M16 6h-2v2h2z M4 4h16v2H4z"></path>
        </svg>
        <p>No videos found with notes</p>
        <button id="get-started-btn">Get Started</button>
      </div>
    `;
    document.getElementById('get-started-btn')?.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://youtube.com' });
    });
    return;
  }
  
  allVideos.forEach(video => {
    const videoCard = document.createElement('div');
    videoCard.className = 'video-card';
    videoCard.dataset.id = video.id;
    
    const lastUpdated = new Date(video.lastUpdated);
    const formattedDate = lastUpdated.toLocaleDateString();
    
    videoCard.innerHTML = `
      <div class="video-thumbnail">
        <img src="${video.thumbnail}" alt="${video.title}">
        <div class="video-notes-count">${video.noteCount} notes</div>
      </div>
      <div class="video-info">
        <div class="video-title">${video.title}</div>
        <div class="video-channel">${video.channel}</div>
        <div class="video-date">Last updated: ${formattedDate}</div>
      </div>
    `;
    
    videoCard.addEventListener('click', () => {
      switchView('single-video', video.id);
    });
    
    container.appendChild(videoCard);
  });
}

// Keep existing functions for filterVideos, updateTagFilters, loadSingleVideoView, etc.
function filterVideos() {
  if (!elements.videoSearch) return;
  
  const searchTerm = elements.videoSearch.value.toLowerCase().trim();
  
  if (!searchTerm) {
    renderVideos();
    return;
  }
  
  const filteredVideos = allVideos.filter(video => 
    video.title.toLowerCase().includes(searchTerm) || 
    video.channel.toLowerCase().includes(searchTerm)
  );
  
  const container = elements.videosContainer;
  if (!container) return;
  
  container.innerHTML = '';
  
  if (filteredVideos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No videos found matching "${searchTerm}"</p>
      </div>
    `;
    return;
  }
  
  filteredVideos.forEach(video => {
    const videoCard = document.createElement('div');
    videoCard.className = 'video-card';
    videoCard.dataset.id = video.id;
    
    const lastUpdated = new Date(video.lastUpdated);
    const formattedDate = lastUpdated.toLocaleDateString();
    
    videoCard.innerHTML = `
      <div class="video-thumbnail">
        <img src="${video.thumbnail}" alt="${video.title}">
        <div class="video-notes-count">${video.noteCount} notes</div>
      </div>
      <div class="video-info">
        <div class="video-title">${video.title}</div>
        <div class="video-channel">${video.channel}</div>
        <div class="video-date">Last updated: ${formattedDate}</div>
      </div>
    `;
    
    videoCard.addEventListener('click', () => {
      switchView('single-video', video.id);
    });
    
    container.appendChild(videoCard);
  });
}

function updateTagFilters() {
  const tagFilters = [elements.tagFilter, elements.videoTagFilter];
  
  tagFilters.forEach(filter => {
    if (!filter) return;
    
    while (filter.options.length > 1) {
      filter.remove(1);
    }
    
    // Use global tags for consistency
    const allAvailableTags = [...new Set([...globalTags, ...allTags.map(t => t.name)])];
    
    console.log('Updating tag filters with tags:', allAvailableTags);
    
    allAvailableTags.sort().forEach(tag => {
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      filter.appendChild(option);
    });
  });
}

function loadSingleVideoView(videoId) {
  console.log('Loading single video view for:', videoId);
  
  const video = allVideos.find(v => v.id === videoId);
  if (!video) {
    console.log('Video not found');
    return;
  }
  
  const videoNotes = allNotes.filter(note => note.videoId === videoId);
  
  if (elements.videoInfo) {
    elements.videoInfo.innerHTML = `
      <div class="video-thumbnail-large">
        <img src="https://i.ytimg.com/vi/${videoId}/hqdefault.jpg" alt="${video.title}">
      </div>
      <div class="video-info-details">
        <h3>${video.title}</h3>
        <div class="video-info-meta">${video.channel}</div>
        <div class="video-info-stats">
          <div class="video-stat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path>
            </svg>
            ${videoNotes.length} notes
          </div>
        </div>
      </div>
    `;
  }
  
  if (elements.videoTagFilter) {
    elements.videoTagFilter.value = '';
  }
  
  updateVideoTimeline(videoId, videoNotes);
  renderVideoNotes(videoId, videoNotes);
}

function updateVideoTimeline(videoId, notes) {
  if (!elements.videoTimeline) return;
  
  elements.videoTimeline.innerHTML = '';
  
  const sortedNotes = [...notes].sort((a, b) => a.timestamp - b.timestamp);
  
  let videoDuration = 0;
  
  if (sortedNotes.length > 0 && sortedNotes[0].videoInfo) {
    videoDuration = sortedNotes[0].videoInfo.duration || 0;
  }
  
  if (videoDuration === 0 && sortedNotes.length > 0) {
    videoDuration = Math.max(...sortedNotes.map(n => n.timestamp)) * 1.1;
  }
  
  if (videoDuration === 0) {
    videoDuration = 600;
  }
  
  sortedNotes.forEach(note => {
    const position = (note.timestamp / videoDuration) * 100;
    const marker = document.createElement('div');
    marker.className = 'timeline-marker';
    
    if (note.tags && note.tags.length > 0) {
      const tag = note.tags[0];
      const tagClasses = ['tag-action', 'tag-question', 'tag-book', 'tag-quote', 'tag-idea', 'tag-ai'];
      const charCode = tag.charCodeAt(0) || 0;
      const tagClass = tagClasses[charCode % tagClasses.length];
      marker.classList.add(tagClass);
    }
    
    marker.style.left = `${position}%`;
    marker.title = note.text.substring(0, 50) + (note.text.length > 50 ? '...' : '');
    
    marker.addEventListener('click', () => {
      chrome.tabs.create({ 
        url: `https://youtube.com/watch?v=${videoId}&t=${Math.floor(note.timestamp)}s` 
      });
    });
    
    elements.videoTimeline.appendChild(marker);
  });
}

function renderVideoNotes(videoId, notes) {
  const container = elements.videoNotesContainer;
  if (!container) return;
  
  container.innerHTML = '';
  
  if (notes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No notes for this video</p>
        <button id="create-video-note-btn">Create Note</button>
      </div>
    `;
    document.getElementById('create-video-note-btn')?.addEventListener('click', () => {
      chrome.tabs.create({ url: `https://youtube.com/watch?v=${videoId}` });
    });
    return;
  }
  
  let tagFilter = '';
  if (elements.videoTagFilter) {
    tagFilter = elements.videoTagFilter.value;
  }
  
  let filteredVideoNotes = notes;
  if (tagFilter) {
    filteredVideoNotes = notes.filter(note => 
      note.tags && note.tags.includes(tagFilter)
    );
  }
  
  filteredVideoNotes.sort((a, b) => a.timestamp - b.timestamp);
  
  if (filteredVideoNotes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No notes match the selected tag</p>
        <button id="clear-video-filters-btn">Clear Filter</button>
      </div>
    `;
    document.getElementById('clear-video-filters-btn')?.addEventListener('click', () => {
      if (elements.videoTagFilter) elements.videoTagFilter.value = '';
      renderVideoNotes(videoId, notes);
    });
    return;
  }
  
  filteredVideoNotes.forEach(note => {
    const noteItem = document.createElement('div');
    noteItem.className = 'note-item';
    noteItem.dataset.noteId = note.id;
    
    const timestamp = document.createElement('div');
    timestamp.className = 'note-timestamp';
    timestamp.textContent = note.timestampFormatted || '00:00';
    timestamp.addEventListener('click', () => {
      chrome.tabs.create({ 
        url: `https://youtube.com/watch?v=${videoId}&t=${Math.floor(note.timestamp)}s` 
      });
    });
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'note-content';
    contentDiv.textContent = note.text;
    
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'note-tags';
    
    if (note.tags && note.tags.length > 0) {
      note.tags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.className = 'tag';
        
        // Generate colors for the tag
        const { bgColor, textColor } = generateTagColors(tag);
        tagElement.style.backgroundColor = bgColor;
        tagElement.style.color = textColor;
        tagElement.style.border = `1px solid ${textColor}`;
        
        tagElement.textContent = tag;
        
        tagElement.addEventListener('click', () => {
          if (elements.videoTagFilter) elements.videoTagFilter.value = tag;
          filterVideoNotes(tag);
        });
        
        tagsDiv.appendChild(tagElement);
      });
    }
    
    // Add edit/delete buttons for video notes too
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'note-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-note-btn';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Edit note';
    editBtn.addEventListener('click', () => showEditNoteModal(note));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-note-btn';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Delete note';
    deleteBtn.addEventListener('click', () => deleteNoteFromDashboard(note.id));
    
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    
    noteItem.appendChild(timestamp);
    noteItem.appendChild(contentDiv);
    noteItem.appendChild(tagsDiv);
    noteItem.appendChild(actionsDiv);
    
    container.appendChild(noteItem);
  });
}

function filterVideoNotes(tagFilter) {
  console.log('Filtering video notes by tag:', tagFilter);
  
  if (!currentVideoId) return;
  
  const videoNotes = allNotes.filter(note => note.videoId === currentVideoId);
  renderVideoNotes(currentVideoId, videoNotes);
}

function filterAllNotes() {
  console.log('Filtering all notes');
  renderAllNotes();
}

function closeExportModal() {
  const modal = document.getElementById('export-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function downloadFile(content, filename, format) {
  let mimeType = 'text/plain';
  switch (format) {
    case 'markdown':
    case 'study-guide':
    case 'text':
      mimeType = 'text/plain';
      break;
    case 'json':
      mimeType = 'application/json';
      break;
    case 'csv':
      mimeType = 'text/csv';
      break;
  }
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

function confirmClearAllData() {
  if (confirm('Are you sure you want to clear all notes and data? This cannot be undone.')) {
    if (confirm('FINAL WARNING: All your notes and data will be permanently deleted. Continue?')) {
      clearAllData();
    }
  }
}

function clearAllData() {
  chrome.storage.local.remove(['noteStreamData', 'recentVideos', 'globalTags'], () => {
    allNotes = [];
    allVideos = [];
    globalTags = [];
    
    renderVideos();
    renderAllNotes();
    updateTagFilters();
    
    alert('All data has been cleared.');
  });
}

// Initialize dashboard when document is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded, initializing dashboard');
  initDashboard();
});