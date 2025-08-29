// Enhanced Sidebar.js - Flow-Focused Note-Taking Experience

// Global variables
let currentVideoId = null;
let currentVideoInfo = null;
let notesList = [];
let globalTags = [];
let recentTags = [];
let activeTagFilter = null;
let timeUpdateInterval = null;
let editingNote = null;
let selectedTags = [];
let captureTimestamp = 0;
let startTypingTime = null;
let richEditor = null;
let editRichEditor = null;

// DOM elements
const elements = {
  videoTitle: document.getElementById('video-title'),
  videoMeta: document.getElementById('video-meta'),
  captureTime: document.getElementById('capture-time'),
  useCurrentTimeBtn: document.getElementById('use-current-time'),
  noteTimestamp: document.getElementById('note-timestamp'),
  saveNoteBtn: document.getElementById('save-note'),
  notesCount: document.getElementById('notes-count'),
  notesList: document.getElementById('notes-list'),
  timeline: document.getElementById('timeline'),
  timelineCount: document.getElementById('timeline-count'),
  closeButton: document.getElementById('close-button'),
  filterButton: document.getElementById('filter-button'),
  exportNotesBtn: document.getElementById('export-notes'),
  tagsDropdown: document.getElementById('tags-dropdown'),
  allTagsList: document.getElementById('all-tags-list'),
  newTagInput: document.getElementById('new-tag-input'),
  addNewTagBtn: document.getElementById('add-new-tag'),
  recentTags: document.getElementById('recent-tags'),
  moreTagsBtn: document.getElementById('more-tags'),
  selectedTagsContainer: document.getElementById('selected-tags'),
  
  // Video controls
  rewind5sBtn: document.getElementById('rewind-5s'),
  playPauseBtn: document.getElementById('play-pause'),
  playPauseIcon: document.getElementById('play-pause-icon'),
  forward5sBtn: document.getElementById('forward-5s'),
  
  // Quick video controls (near note-taking area)
  quickRewind5sBtn: document.getElementById('quick-rewind-5s'),
  quickPlayPauseBtn: document.getElementById('quick-play-pause'),
  quickPlayPauseIcon: document.getElementById('quick-play-pause-icon'),
  quickForward5sBtn: document.getElementById('quick-forward-5s'),
  
  // Modals
  editModal: document.getElementById('edit-modal'),
  exportModal: document.getElementById('export-modal'),
  
  // Templates
  noteTemplate: document.getElementById('note-template'),
};

// Native Rich Text Editor Configuration
class NativeRichEditor {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.toolbar = this.container.previousElementSibling;
    this.options = {
      placeholder: 'Type your note here...',
      ...options
    };
    
    this.init();
  }
  
  init() {
    // Set placeholder
    this.container.setAttribute('data-placeholder', this.options.placeholder);
    
    // Handle placeholder visibility
    this.updatePlaceholder();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initialize toolbar
    this.setupToolbar();
  }
  
  setupEventListeners() {
    // Handle placeholder
    this.container.addEventListener('input', () => this.updatePlaceholder());
    this.container.addEventListener('focus', () => this.updatePlaceholder());
    this.container.addEventListener('blur', () => this.updatePlaceholder());
    
    // Handle keyboard shortcuts
    this.container.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    
    // Prevent default behavior for some commands
    this.container.addEventListener('paste', (e) => this.handlePaste(e));
  }
  
  setupToolbar() {
    if (!this.toolbar) return;
    
    this.toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('.toolbar-btn');
      if (!btn) return;
      
      e.preventDefault();
      const command = btn.getAttribute('data-command');
      this.executeCommand(command);
    });
  }
  
  updatePlaceholder() {
    const isEmpty = this.container.textContent.trim() === '' || 
                   (this.container.innerHTML === '<p><br></p>' || this.container.innerHTML === '<br>');
    this.container.classList.toggle('empty', isEmpty);
    
    // Ensure we have at least one paragraph for consistent behavior
    if (isEmpty && this.container.innerHTML === '') {
      this.container.innerHTML = '<p><br></p>';
    }
  }
  
  executeCommand(command) {
    this.container.focus();
    
    try {
      if (command === 'createLink') {
        const url = prompt('Enter link URL:', 'https://');
        if (url && url !== 'https://') {
          document.execCommand(command, false, url);
        }
      } else {
        document.execCommand(command, false, null);
      }
    } catch (error) {
      console.warn('Command not supported:', command);
    }
    
    this.updateToolbarState();
  }
  
  updateToolbarState() {
    if (!this.toolbar) return;
    
    const buttons = this.toolbar.querySelectorAll('.toolbar-btn');
    buttons.forEach(btn => {
      const command = btn.getAttribute('data-command');
      try {
        const isActive = document.queryCommandState(command);
        btn.classList.toggle('active', isActive);
      } catch (error) {
        // Command not supported
      }
    });
  }
  
  handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          this.executeCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          this.executeCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          this.executeCommand('underline');
          break;
      }
    }
  }
  
  handlePaste(e) {
    // Allow paste but clean up formatting if needed
    setTimeout(() => {
      this.updatePlaceholder();
      this.updateToolbarState();
    }, 0);
  }
  
  // API methods - simplified and clean
  getText() {
    return this.container.textContent || '';
  }

  setContents(content) {
    if (typeof content === 'string') {
      // Handle both HTML content and plain text
      if (content.includes('<') && content.includes('>')) {
        this.container.innerHTML = content;
      } else {
        this.container.textContent = content;
      }
    } else {
      // Fallback - convert to string
      this.container.textContent = String(content || '');
    }
    this.updatePlaceholder();
  }

  setText(text) {
    this.container.textContent = text || '';
    this.updatePlaceholder();
  }

  get root() {
    return {
      innerHTML: this.container.innerHTML
    };
  }

  focus() {
    this.container.focus();
  }

  blur() {
    this.container.blur();
  }
}

// Initialize Native Rich Text Editors
function initializeRichEditors() {
  try {
    // Main editor
    const mainEditorElement = document.getElementById('rich-editor');
    if (mainEditorElement) {
      richEditor = new NativeRichEditor('#rich-editor', {
        placeholder: 'Type your note here...'
      });
    }
    
    // Edit modal editor
    const editEditorElement = document.getElementById('edit-rich-editor');
    if (editEditorElement) {
      editRichEditor = new NativeRichEditor('#edit-rich-editor', {
        placeholder: 'Edit your note...'
      });
    }
    
    console.log('Native rich text editors initialized');
  } catch (error) {
    console.warn('Error initializing rich text editors:', error);
    // Fallback to plain text if needed
  }
}

// Smart Tag Management
function loadGlobalTags() {
  chrome.storage.local.get(['globalTags', 'recentTags'], (result) => {
    globalTags = result.globalTags || [];
    recentTags = result.recentTags || [];
    console.log('Loaded global tags:', globalTags);
    console.log('Loaded recent tags:', recentTags);
    updateRecentTagsDisplay();
    updateAllTagsList();
  });
}

function saveGlobalTags() {
  chrome.storage.local.set({ 
    globalTags: globalTags,
    recentTags: recentTags
  }, () => {
    console.log('Tags saved:', { globalTags, recentTags });
  });
}

function addToGlobalTags(tagName) {
  if (!globalTags.includes(tagName)) {
    globalTags.push(tagName);
  }
  
  // Add to recent tags (max 8)
  recentTags = recentTags.filter(tag => tag !== tagName);
  recentTags.unshift(tagName);
  recentTags = recentTags.slice(0, 8);
  
  saveGlobalTags();
  updateRecentTagsDisplay();
  updateAllTagsList();
}

function updateRecentTagsDisplay() {
  if (!elements.recentTags) return;
  
  elements.recentTags.innerHTML = '';
  
  recentTags.forEach(tag => {
    const tagElement = document.createElement('span');
    tagElement.className = 'quick-tag';
    tagElement.textContent = tag;
    
    const { bgColor, textColor } = generateTagColors(tag);
    tagElement.style.backgroundColor = bgColor;
    tagElement.style.color = textColor;
    tagElement.style.borderColor = textColor;
    
    tagElement.addEventListener('click', () => {
      if (!selectedTags.includes(tag)) {
        selectedTags.push(tag);
        updateSelectedTagsDisplay();
      }
    });
    
    elements.recentTags.appendChild(tagElement);
  });
}

function updateAllTagsList() {
  if (!elements.allTagsList) return;
  
  elements.allTagsList.innerHTML = '';
  
  const allUniqueTags = [...new Set([...globalTags, ...getUniqueTagsFromCurrentVideo()])];
  
  allUniqueTags.forEach(tag => {
    const tagElement = document.createElement('span');
    tagElement.className = 'tag';
    tagElement.textContent = tag;
    
    const { bgColor, textColor } = generateTagColors(tag);
    tagElement.style.backgroundColor = bgColor;
    tagElement.style.color = textColor;
    tagElement.style.borderColor = textColor;
    
    tagElement.addEventListener('click', () => {
      if (!selectedTags.includes(tag)) {
        selectedTags.push(tag);
        updateSelectedTagsDisplay();
      }
      toggleTagsDropdown();
    });
    
    elements.allTagsList.appendChild(tagElement);
  });
}

// Video Controls Integration
function setupVideoControls() {
  // Header controls
  if (elements.rewind5sBtn) {
    elements.rewind5sBtn.addEventListener('click', () => {
      requestCurrentTime();
      setTimeout(() => {
        const currentTime = parseTimestamp(elements.noteTimestamp.textContent);
        jumpToTimestamp(Math.max(0, currentTime - 5));
      }, 100);
    });
  }
  
  if (elements.playPauseBtn) {
    elements.playPauseBtn.addEventListener('click', () => {
      togglePlayPause();
    });
  }
  
  if (elements.forward5sBtn) {
    elements.forward5sBtn.addEventListener('click', () => {
      requestCurrentTime();
      setTimeout(() => {
        const currentTime = parseTimestamp(elements.noteTimestamp.textContent);
        jumpToTimestamp(currentTime + 5);
      }, 100);
    });
  }
  
  // Quick controls (near note-taking area)
  if (elements.quickRewind5sBtn) {
    elements.quickRewind5sBtn.addEventListener('click', () => {
      requestCurrentTime();
      setTimeout(() => {
        const currentTime = parseTimestamp(elements.noteTimestamp.textContent);
        jumpToTimestamp(Math.max(0, currentTime - 5));
      }, 100);
    });
  }
  
  if (elements.quickPlayPauseBtn) {
    elements.quickPlayPauseBtn.addEventListener('click', () => {
      togglePlayPause();
    });
  }
  
  if (elements.quickForward5sBtn) {
    elements.quickForward5sBtn.addEventListener('click', () => {
      requestCurrentTime();
      setTimeout(() => {
        const currentTime = parseTimestamp(elements.noteTimestamp.textContent);
        jumpToTimestamp(currentTime + 5);
      }, 100);
    });
  }
}

// Play/Pause functionality
function togglePlayPause() {
  window.parent.postMessage({ action: 'togglePlayPause' }, '*');
}

function updatePlayPauseIcon(isPlaying) {
  const playIcon = '<path d="M8 5v14l11-7z"/>';
  const pauseIcon = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
  
  const iconToShow = isPlaying ? pauseIcon : playIcon;
  const titleText = isPlaying ? 'Pause video' : 'Play video';
  
  // Update header play/pause button
  if (elements.playPauseIcon) {
    elements.playPauseIcon.innerHTML = iconToShow;
    elements.playPauseBtn.title = titleText;
  }
  
  // Update quick play/pause button
  if (elements.quickPlayPauseIcon) {
    elements.quickPlayPauseIcon.innerHTML = iconToShow;
    elements.quickPlayPauseBtn.title = titleText;
  }
}

// Enhanced Smart Timestamping
function setupSmartTimestamping() {
  if (elements.useCurrentTimeBtn) {
    elements.useCurrentTimeBtn.addEventListener('click', () => {
      captureCurrentTimestamp();
    });
  }
  
  // Auto-sync timestamp when user starts typing
  if (richEditor && richEditor.container) {
    richEditor.container.addEventListener('input', () => {
      if (!startTypingTime) {
        startTypingTime = Date.now();
        // Auto-capture timestamp when user starts typing
        setTimeout(() => {
          if (!captureTimestamp) {
            captureCurrentTimestamp(true); // Auto-capture mode
          }
        }, 100);
      }
      
      // Show tag suggestions after user types
      setTimeout(showTagSuggestions, 500); // Debounce suggestions
    });
  }
  
  // Keyboard shortcut for manual timestamp capture (Ctrl/Cmd + T)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
      e.preventDefault();
      captureCurrentTimestamp();
    }
  });
}

// Show intelligent tag suggestions based on note content
function showTagSuggestions() {
  if (!richEditor) return;
  
  const noteText = richEditor.getText().trim();
  if (noteText.length < 10) {
    hideTagSuggestions();
    return;
  }
  
  const suggestions = suggestTagsForNote(noteText, currentVideoInfo);
  if (suggestions.length === 0) {
    hideTagSuggestions();
    return;
  }
  
  // Filter out already selected tags
  const filteredSuggestions = suggestions.filter(tag => !selectedTags.includes(tag));
  if (filteredSuggestions.length === 0) {
    hideTagSuggestions();
    return;
  }
  
  const suggestionsContainer = document.getElementById('tag-suggestions');
  const suggestionsList = document.getElementById('suggested-tags-list');
  
  if (suggestionsContainer && suggestionsList) {
    suggestionsList.innerHTML = '';
    
    filteredSuggestions.forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'suggested-tag';
      tagElement.textContent = tag;
      
      tagElement.addEventListener('click', () => {
        if (!selectedTags.includes(tag)) {
          selectedTags.push(tag);
          addToGlobalTags(tag);
          updateSelectedTagsDisplay();
          showNotification(`Added tag: "${tag}"`, 'success');
          showTagSuggestions(); // Refresh suggestions
        }
      });
      
      suggestionsList.appendChild(tagElement);
    });
    
    suggestionsContainer.style.display = 'block';
  }
}

function hideTagSuggestions() {
  const suggestionsContainer = document.getElementById('tag-suggestions');
  if (suggestionsContainer) {
    suggestionsContainer.style.display = 'none';
  }
}

// Enhanced timestamp capture with visual feedback
function captureCurrentTimestamp(autoMode = false) {
  requestCurrentTime();
  setTimeout(() => {
    captureTimestamp = parseTimestamp(elements.noteTimestamp.textContent);
    elements.captureTime.textContent = `Capture: ${formatTime(captureTimestamp)}`;
    
    // Visual feedback
    elements.captureTime.style.backgroundColor = '#10b981';
    elements.captureTime.style.color = 'white';
    elements.captureTime.style.transform = 'scale(1.05)';
    
    // Reset visual feedback
    setTimeout(() => {
      elements.captureTime.style.backgroundColor = '';
      elements.captureTime.style.color = '';
      elements.captureTime.style.transform = '';
    }, 1000);
    
    const message = autoMode ? 'Timestamp auto-captured!' : 'Timestamp captured!';
    showNotification(message, 'success');
  }, 100);
}

// Enhanced Note Saving with Rich Text
function saveNote() {
  let noteText = '';
  let richContent = '';
  
  if (richEditor) {
    // Get text and rich content
    noteText = richEditor.getText().trim();
    richContent = richEditor.root.innerHTML;
  } else {
    noteText = document.getElementById('rich-editor')?.textContent?.trim() || '';
  }
  
  if (!noteText || !currentVideoId) {
    console.log('Cannot save note: empty text or missing videoId');
    showNotification('Please enter some text for your note', 'error');
    return;
  }
  
  // Use capture time if set, otherwise current time
  const useTimestamp = captureTimestamp || parseTimestamp(elements.noteTimestamp.textContent);
  
  // Auto-suggest tags if none selected
  let finalTags = [...selectedTags];
  if (finalTags.length === 0) {
    const suggestions = suggestTagsForNote(noteText, currentVideoInfo);
    if (suggestions.length > 0) {
      finalTags.push(suggestions[0]); // Auto-apply top suggestion
      showNotification(`Auto-applied tag: "${suggestions[0]}"`, 'info');
    }
  }
  
  const newNote = {
    id: Date.now().toString(),
    videoId: currentVideoId,
    text: noteText,
    richContent: richContent || noteText,
    timestamp: useTimestamp,
    timestampFormatted: formatTime(useTimestamp),
    tags: finalTags,
    createdAt: new Date().toISOString(),
    videoInfo: currentVideoInfo ? JSON.parse(JSON.stringify(currentVideoInfo)) : null
  };
  
  // Add all tags to global tags
  finalTags.forEach(tag => addToGlobalTags(tag));
  
  console.log('New note created:', newNote);
  
  addNoteToList(newNote);
  saveNoteToStorage(newNote);
  
  // Clear the editor
  if (richEditor) {
    richEditor.setText('');
  }
  
  // Reset state
  selectedTags = [];
  captureTimestamp = 0;
  startTypingTime = null;
  elements.captureTime.textContent = 'Capture: --:--';
  
  updateSelectedTagsDisplay();
  updateNotesCount();
  updateTimeline();
  
  showNotification('Note saved successfully!', 'success');
}

// Enhanced Export Functionality
function showExportModal() {
  if (!elements.exportModal) {
    console.error('Export modal not found');
    return;
  }
  
  elements.exportModal.classList.remove('hidden');
  populateExportModal();
  
  // Setup export event listeners
  setupExportModalEvents();
}

function populateExportModal() {
  const exportNotesList = document.getElementById('export-notes-list');
  if (!exportNotesList) return;
  
  exportNotesList.innerHTML = '';
  
  // Group notes by video
  const notesByVideo = {};
  notesList.forEach(note => {
    if (!notesByVideo[note.videoId]) {
      notesByVideo[note.videoId] = {
        video: {
          title: note.videoInfo?.title || 'Unknown Video',
          channel: note.videoInfo?.channel || 'Unknown Channel'
        },
        notes: []
      };
    }
    notesByVideo[note.videoId].notes.push(note);
  });
  
  // Render grouped notes
  Object.entries(notesByVideo).forEach(([videoId, {video, notes}]) => {
    const videoGroup = document.createElement('div');
    videoGroup.className = 'video-group';
    
    videoGroup.innerHTML = `
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
              ${note.tags ? `<div class="note-tags-preview">${note.tags.map(tag => `<span class="tag-mini">${tag}</span>`).join('')}</div>` : ''}
            </div>
          </label>
        `).join('')}
      </div>
    `;
    
    exportNotesList.appendChild(videoGroup);
  });
}

function setupExportModalEvents() {
  const modal = elements.exportModal;
  let selectedNotesForExport = new Set();
  
  // Tab functionality
  const tabButtons = modal.querySelectorAll('.tab-btn');
  const tabPanes = modal.querySelectorAll('.tab-pane');
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      
      // Update active tab button
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update active tab pane
      tabPanes.forEach(pane => pane.classList.remove('active'));
      const targetPane = modal.querySelector(`#${targetTab}-tab`);
      if (targetPane) {
        targetPane.classList.add('active');
      }
      
      // Update preview if preview tab is selected
      if (targetTab === 'preview') {
        updateExportPreview(selectedNotesForExport);
      }
    });
  });
  
  // Function to update export preview
  function updateExportPreview(selectedNotes) {
    const previewElement = document.getElementById('export-preview-content');
    if (!previewElement) return;
    
    const format = document.getElementById('export-format')?.value || 'markdown';
    const includeTimestamps = document.getElementById('include-timestamps')?.checked ?? true;
    const includeTags = document.getElementById('include-tags')?.checked ?? true;
    const groupByVideo = document.getElementById('group-by-video')?.checked ?? true;
    
    const selectedNotesList = notesList.filter(note => selectedNotes.has(note.id));
    
    if (selectedNotesList.length === 0) {
      previewElement.textContent = 'No notes selected. Please select notes from the "Select Notes" tab to see a preview.';
      return;
    }
    
    let previewContent = '';
    
    try {
      switch (format) {
        case 'markdown':
          previewContent = generateLessonPlanExport(selectedNotesList, includeTimestamps, includeTags, groupByVideo);
          break;
        case 'study-guide':
          previewContent = generateStudyGuideExport(selectedNotesList, includeTimestamps, includeTags, groupByVideo);
          break;
        case 'text':
          previewContent = generateTextExport(selectedNotesList, includeTimestamps, includeTags, groupByVideo);
          break;
        case 'json':
          previewContent = JSON.stringify(selectedNotesList, null, 2);
          break;
        case 'csv':
          previewContent = generateCsvExport(selectedNotesList, includeTimestamps, includeTags);
          break;
        default:
          previewContent = 'Preview not available for this format.';
      }
      
      // Limit preview to first 1000 characters for performance
      if (previewContent.length > 1000) {
        previewContent = previewContent.substring(0, 1000) + '\n\n... (preview truncated - full content will be exported)';
      }
      
      previewElement.textContent = previewContent;
    } catch (error) {
      previewElement.textContent = 'Error generating preview: ' + error.message;
    }
  }
  
  // Note selection handling
  modal.addEventListener('change', (e) => {
    if (e.target.classList.contains('note-select')) {
      const noteId = e.target.dataset.noteId;
      if (e.target.checked) {
        selectedNotesForExport.add(noteId);
      } else {
        selectedNotesForExport.delete(noteId);
      }
      updateExportSelectionCount(selectedNotesForExport.size);
      // Update preview if preview tab is active
      if (modal.querySelector('#preview-tab').classList.contains('active')) {
        updateExportPreview(selectedNotesForExport);
      }
    }
    
    if (e.target.classList.contains('video-select')) {
      const videoId = e.target.dataset.videoId;
      const videoNoteCheckboxes = modal.querySelectorAll(`.note-select[data-video-id="${videoId}"]`);
      
      videoNoteCheckboxes.forEach(checkbox => {
        checkbox.checked = e.target.checked;
        const noteId = checkbox.dataset.noteId;
        if (e.target.checked) {
          selectedNotesForExport.add(noteId);
        } else {
          selectedNotesForExport.delete(noteId);
        }
      });
      updateExportSelectionCount(selectedNotesForExport.size);
      // Update preview if preview tab is active
      if (modal.querySelector('#preview-tab').classList.contains('active')) {
        updateExportPreview(selectedNotesForExport);
      }
    }
  });
  
  // Update preview when export settings change
  ['export-format', 'include-timestamps', 'include-tags', 'group-by-video'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', () => {
        if (modal.querySelector('#preview-tab').classList.contains('active')) {
          updateExportPreview(selectedNotesForExport);
        }
      });
    }
  });
  
  // Select all / deselect all
  const selectAllBtn = document.getElementById('select-all-notes');
  const deselectAllBtn = document.getElementById('deselect-all-notes');
  
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      modal.querySelectorAll('.note-select').forEach(checkbox => {
        checkbox.checked = true;
        selectedNotesForExport.add(checkbox.dataset.noteId);
      });
      modal.querySelectorAll('.video-select').forEach(checkbox => {
        checkbox.checked = true;
      });
      updateExportSelectionCount(selectedNotesForExport.size);
      // Update preview if preview tab is active
      if (modal.querySelector('#preview-tab').classList.contains('active')) {
        updateExportPreview(selectedNotesForExport);
      }
    });
  }
  
  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', () => {
      modal.querySelectorAll('.note-select, .video-select').forEach(checkbox => {
        checkbox.checked = false;
      });
      selectedNotesForExport.clear();
      updateExportSelectionCount(0);
      // Update preview if preview tab is active
      if (modal.querySelector('#preview-tab').classList.contains('active')) {
        updateExportPreview(selectedNotesForExport);
      }
    });
  }
  
  // Export confirmation
  const confirmExportBtn = document.getElementById('confirm-export');
  if (confirmExportBtn) {
    confirmExportBtn.addEventListener('click', () => {
      handleExport(selectedNotesForExport);
      elements.exportModal.classList.add('hidden');
    });
  }
  
  // Cancel export
  const cancelExportBtn = document.getElementById('cancel-export');
  if (cancelExportBtn) {
    cancelExportBtn.addEventListener('click', () => {
      elements.exportModal.classList.add('hidden');
    });
  }
  
  // Close modal
  const closeModalBtn = modal.querySelector('.close-modal');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      elements.exportModal.classList.add('hidden');
    });
  }
}

function updateExportSelectionCount(count) {
  const selectionCount = document.getElementById('selection-count');
  const confirmBtn = document.getElementById('confirm-export');
  
  if (selectionCount) {
    selectionCount.textContent = `${count} notes selected`;
  }
  
  if (confirmBtn) {
    confirmBtn.disabled = count === 0;
  }
}

function handleExport(selectedNotesForExport) {
  const format = document.getElementById('export-format')?.value || 'markdown';
  const includeTimestamps = document.getElementById('include-timestamps')?.checked ?? true;
  const includeTags = document.getElementById('include-tags')?.checked ?? true;
  const groupByVideo = document.getElementById('group-by-video')?.checked ?? true;
  
  const selectedNotes = notesList.filter(note => selectedNotesForExport.has(note.id));
  
  if (selectedNotes.length === 0) {
    showNotification('No notes selected for export', 'error');
    return;
  }
  
  let content = '';
  let filename = `NoteStream-Export-${new Date().toISOString().slice(0, 10)}.${getFileExtension(format)}`;
  
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
  
  downloadFile(content, filename, format);
  showNotification(`Exported ${selectedNotes.length} notes successfully!`, 'success');
}

// Enhanced Edit Note Modal
function showEditNoteModal(note) {
  editingNote = note;
  
  if (!elements.editModal) {
    console.error('Edit modal not found');
    return;
  }
  
  elements.editModal.classList.remove('hidden');
  
  // Populate edit form
  const editTimestamp = document.getElementById('edit-timestamp');
  if (editTimestamp) {
    editTimestamp.value = note.timestampFormatted;
  }
  
  // Set rich text content
  if (editRichEditor) {
    if (note.richContent) {
      editRichEditor.setContents(note.richContent);
    } else {
      editRichEditor.setText(note.text);
    }
  }
  
  // Setup tags for editing
  setupEditTags(note);
  
  // Setup modal event listeners
  setupEditModalEvents(note);
}

function setupEditTags(note) {
  const editTagsContainer = document.getElementById('edit-tags');
  const availableEditTags = document.getElementById('available-edit-tags');
  
  if (!editTagsContainer || !availableEditTags) return;
  
  let currentEditTags = [...(note.tags || [])];
  
  function updateEditTagsDisplay() {
    editTagsContainer.innerHTML = '';
    
    currentEditTags.forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'selected-tag';
      
      const { bgColor, textColor } = generateTagColors(tag);
      tagElement.style.backgroundColor = bgColor;
      tagElement.style.color = textColor;
      tagElement.style.borderColor = textColor;
      
      tagElement.innerHTML = `
        ${tag}
        <span class="remove-tag">×</span>
      `;
      
      tagElement.querySelector('.remove-tag').addEventListener('click', () => {
        currentEditTags = currentEditTags.filter(t => t !== tag);
        updateEditTagsDisplay();
        updateAvailableEditTags();
      });
      
      editTagsContainer.appendChild(tagElement);
    });
  }
  
  function updateAvailableEditTags() {
    availableEditTags.innerHTML = '';
    
    const availableTags = globalTags.filter(tag => !currentEditTags.includes(tag));
    
    availableTags.forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'tag';
      tagElement.textContent = tag;
      
      const { bgColor, textColor } = generateTagColors(tag);
      tagElement.style.backgroundColor = bgColor;
      tagElement.style.color = textColor;
      tagElement.style.borderColor = textColor;
      
      tagElement.addEventListener('click', () => {
        if (!currentEditTags.includes(tag)) {
          currentEditTags.push(tag);
          updateEditTagsDisplay();
          updateAvailableEditTags();
        }
      });
      
      availableEditTags.appendChild(tagElement);
    });
  }
  
  // Initialize displays
  updateEditTagsDisplay();
  updateAvailableEditTags();
  
  // Store reference for saving
  elements.editModal.getCurrentEditTags = () => currentEditTags;
}

function setupEditModalEvents(note) {
  const modal = elements.editModal;
  
  // Sync timestamp button
  const syncTimestampBtn = document.getElementById('sync-timestamp');
  if (syncTimestampBtn) {
    syncTimestampBtn.addEventListener('click', () => {
      requestCurrentTime();
      setTimeout(() => {
        const editTimestamp = document.getElementById('edit-timestamp');
        if (editTimestamp && elements.noteTimestamp) {
          editTimestamp.value = elements.noteTimestamp.textContent;
        }
      }, 100);
    });
  }
  
  // Save changes
  const saveEditBtn = document.getElementById('save-edit');
  if (saveEditBtn) {
    saveEditBtn.addEventListener('click', () => {
      const newTimestamp = document.getElementById('edit-timestamp')?.value || note.timestampFormatted;
      
      let newText = '';
      let newRichContent = '';
      
      if (editRichEditor) {
        newText = editRichEditor.getText().trim();
        newRichContent = editRichEditor.root.innerHTML;
      }
      
      const newTags = modal.getCurrentEditTags ? modal.getCurrentEditTags() : note.tags || [];
      
      if (newText) {
        updateNote(note.id, newText, newRichContent, newTags, newTimestamp);
        modal.classList.add('hidden');
      } else {
        showNotification('Please enter some text for your note', 'error');
      }
    });
  }
  
  // Delete note
  const deleteBtn = document.getElementById('delete-note');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to delete this note?')) {
        deleteNote(note.id);
        modal.classList.add('hidden');
      }
    });
  }
  
  // Cancel edit
  const cancelBtn = document.getElementById('cancel-edit');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }
  
  // Close modal
  const closeBtn = modal.querySelector('.close-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }
}

// Core Note Management Functions
function updateNote(noteId, newText, newRichContent, newTags, newTimestamp) {
  const noteIndex = notesList.findIndex(note => note.id === noteId);
  if (noteIndex === -1) return;
  
  const timestampSeconds = parseTimestamp(newTimestamp);
  
  notesList[noteIndex].text = newText;
  notesList[noteIndex].richContent = newRichContent || newText;
  notesList[noteIndex].tags = newTags;
  notesList[noteIndex].timestamp = timestampSeconds;
  notesList[noteIndex].timestampFormatted = formatTime(timestampSeconds);
  notesList[noteIndex].updatedAt = new Date().toISOString();
  
  // Add new tags to global tags
  newTags.forEach(tag => addToGlobalTags(tag));
  
  console.log('Updated note:', notesList[noteIndex]);
  
  saveNotesToStorage();
  renderNotesList();
  updateTimeline();
  
  showNotification('Note updated successfully!', 'success');
}

function deleteNote(noteId) {
  notesList = notesList.filter(note => note.id !== noteId);
  saveNotesToStorage();
  renderNotesList();
  updateTimeline();
  showNotification('Note deleted', 'info');
}

// Enhanced UI Functions
function generateTagColors(tagName) {
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = ((hash % 360) + 360) % 360;
  const bgColor = `hsl(${hue}, 70%, 90%)`;
  const textColor = `hsl(${hue}, 70%, 30%)`;
  
  return { bgColor, textColor };
}

function updateSelectedTagsDisplay() {
  if (!elements.selectedTagsContainer) return;
  
  elements.selectedTagsContainer.innerHTML = '';
  
  selectedTags.forEach(tag => {
    const tagElement = document.createElement('span');
    tagElement.className = 'selected-tag';
    
    const { bgColor, textColor } = generateTagColors(tag);
    tagElement.style.backgroundColor = bgColor;
    tagElement.style.color = textColor;
    tagElement.style.borderColor = textColor;
    
    tagElement.innerHTML = `
      ${tag}
      <span class="remove-tag">×</span>
    `;
    
    tagElement.querySelector('.remove-tag').addEventListener('click', () => {
      selectedTags = selectedTags.filter(t => t !== tag);
      updateSelectedTagsDisplay();
    });
    
    elements.selectedTagsContainer.appendChild(tagElement);
  });
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#3b82f6',
    warning: '#f59e0b'
  };
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${colors[type] || colors.info};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease-out;
    max-width: 300px;
  `;
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Export Generation Functions
function generateLessonPlanExport(notes, includeTimestamps, includeTags, groupByVideo) {
  let markdown = '# 📚 Lesson Plan\n\n';
  markdown += `*Generated on ${new Date().toLocaleDateString()}*\n\n`;
  
  if (groupByVideo) {
    const notesByVideo = groupNotesByVideo(notes);
    
    Object.entries(notesByVideo).forEach(([videoId, videoNotes]) => {
      const video = videoNotes[0].videoInfo || { title: 'Unknown Video', channel: 'Unknown Channel' };
      
      markdown += `## 📺 ${video.title}\n`;
      markdown += `*${video.channel}*\n\n`;
      
      videoNotes.forEach((note, index) => {
        markdown += `### Section ${index + 1}`;
        if (includeTimestamps) {
          markdown += ` - [${note.timestampFormatted}](https://youtube.com/watch?v=${videoId}&t=${Math.floor(note.timestamp)}s)`;
        }
        markdown += '\n\n';
        
        markdown += `${note.text}\n\n`;
        
        if (includeTags && note.tags && note.tags.length > 0) {
          markdown += `**Tags**: ${note.tags.join(', ')}\n\n`;
        }
        
        markdown += '---\n\n';
      });
    });
  } else {
    notes.forEach((note, index) => {
      markdown += `## Note ${index + 1}`;
      if (includeTimestamps) {
        markdown += ` - [${note.timestampFormatted}](https://youtube.com/watch?v=${note.videoId}&t=${Math.floor(note.timestamp)}s)`;
      }
      markdown += '\n\n';
      
      if (note.videoInfo) {
        markdown += `*From: ${note.videoInfo.title}*\n\n`;
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

function generateStudyGuideExport(notes, includeTimestamps, includeTags, groupByVideo) {
  let content = '# 📖 Study Guide\n\n';
  
  // Quick reference section
  const allTags = [...new Set(notes.flatMap(note => note.tags || []))];
  if (allTags.length > 0) {
    content += '## 🔑 Key Topics\n';
    allTags.forEach(tag => {
      const tagNotes = notes.filter(note => note.tags && note.tags.includes(tag));
      content += `- **${tag}** (${tagNotes.length} notes)\n`;
    });
    content += '\n';
  }
  
  // Notes organized by topic or video
  if (groupByVideo) {
    const notesByVideo = groupNotesByVideo(notes);
    
    Object.entries(notesByVideo).forEach(([videoId, videoNotes]) => {
      const video = videoNotes[0].videoInfo || { title: 'Unknown Video' };
      content += `## 📺 ${video.title}\n\n`;
      
      videoNotes.forEach(note => {
        content += `### `;
        if (includeTimestamps) {
          content += `[${note.timestampFormatted}] `;
        }
        content += `${note.text.substring(0, 50)}...\n\n`;
        content += `${note.text}\n\n`;
        
        if (includeTags && note.tags && note.tags.length > 0) {
          content += `*Topics: ${note.tags.join(', ')}*\n\n`;
        }
      });
    });
  }
  
  return content;
}

function generateTextExport(notes, includeTimestamps, includeTags, groupByVideo) {
  let text = 'NOTESTREAM EXPORT\n';
  text += '=================\n\n';
  text += `Generated: ${new Date().toLocaleString()}\n`;
  text += `Total Notes: ${notes.length}\n\n`;
  
  if (groupByVideo) {
    const notesByVideo = groupNotesByVideo(notes);
    
    Object.entries(notesByVideo).forEach(([videoId, videoNotes]) => {
      const video = videoNotes[0].videoInfo || { title: 'Unknown Video', channel: 'Unknown Channel' };
      
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
  }
  
  return text;
}

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
    const video = note.videoInfo || { title: 'Unknown Video', channel: 'Unknown Channel' };
    
    const escapeCsv = (field) => {
      if (typeof field !== 'string') field = String(field);
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

// Utility Functions
function groupNotesByVideo(notes) {
  const notesByVideo = {};
  notes.forEach(note => {
    if (!notesByVideo[note.videoId]) {
      notesByVideo[note.videoId] = [];
    }
    notesByVideo[note.videoId].push(note);
  });
  return notesByVideo;
}

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

function downloadFile(content, filename, format) {
  const mimeTypes = {
    'markdown': 'text/markdown',
    'study-guide': 'text/markdown',
    'text': 'text/plain',
    'json': 'application/json',
    'csv': 'text/csv'
  };
  
  const blob = new Blob([content], { type: mimeTypes[format] || 'text/plain' });
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

function toggleTagsDropdown() {
  if (!elements.tagsDropdown) return;
  elements.tagsDropdown.classList.toggle('hidden');
}

function showFilterDropdown() {
  // Get unique tags from current video notes
  const uniqueTags = getUniqueTagsFromCurrentVideo();
  
  if (uniqueTags.length === 0) {
    showNotification('No tags found in current video notes', 'info');
    return;
  }
  
  // Create and show filter dropdown
  const filterDropdown = document.createElement('div');
  filterDropdown.className = 'filter-dropdown';
  filterDropdown.innerHTML = `
    <div class="filter-dropdown-content">
      <h4>Filter by Tag</h4>
      <div class="filter-options">
        <button class="filter-option ${!activeTagFilter ? 'active' : ''}" data-tag="">
          All Notes
        </button>
        ${uniqueTags.map(tag => `
          <button class="filter-option ${activeTagFilter === tag ? 'active' : ''}" data-tag="${tag}">
            ${tag}
          </button>
        `).join('')}
      </div>
    </div>
  `;
  
  // Position near filter button
  const rect = elements.filterButton.getBoundingClientRect();
  filterDropdown.style.position = 'absolute';
  filterDropdown.style.top = (rect.bottom + 5) + 'px';
  filterDropdown.style.right = '20px';
  filterDropdown.style.zIndex = '1000';
  
  document.body.appendChild(filterDropdown);
  
  // Add event listeners
  filterDropdown.querySelectorAll('.filter-option').forEach(option => {
    option.addEventListener('click', () => {
      const tag = option.dataset.tag;
      if (tag) {
        setTagFilter(tag);
      } else {
        clearTagFilter();
      }
      document.body.removeChild(filterDropdown);
    });
  });
  
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closeFilter(e) {
      if (!filterDropdown.contains(e.target) && e.target !== elements.filterButton) {
        document.body.removeChild(filterDropdown);
        document.removeEventListener('click', closeFilter);
      }
    });
  }, 0);
}

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
  if (text.includes('quote') || text.includes('"') || text.includes("'")) {
    suggestions.push('quote');
  }
  
  // Technical topic suggestions
  const techTopics = {
    'react': ['react', 'frontend'],
    'javascript': ['javascript', 'programming'],
    'python': ['python', 'programming'],
    'css': ['css', 'styling'],
    'html': ['html', 'frontend'],
    'api': ['api', 'backend'],
    'database': ['database', 'data'],
    'machine learning': ['ml', 'ai'],
    'docker': ['docker', 'devops'],
    'kubernetes': ['k8s', 'devops']
  };
  
  Object.entries(techTopics).forEach(([keyword, tags]) => {
    if (text.includes(keyword) || title.includes(keyword)) {
      suggestions.push(...tags);
    }
  });
  
  // Remove duplicates and limit suggestions
  return [...new Set(suggestions)].slice(0, 4);
}

// Core Functions (existing ones updated)
function jumpToTimestamp(timeInSeconds) {
  window.parent.postMessage({ 
    action: 'jumpToTime',
    time: timeInSeconds 
  }, '*');
}

function requestCurrentTime() {
  window.parent.postMessage({ action: 'getCurrentTime' }, '*');
}

function updateNotesCount() {
  const count = activeTagFilter
    ? notesList.filter(note => note.tags && note.tags.includes(activeTagFilter)).length
    : notesList.length;
    
  if (elements.notesCount) {
    elements.notesCount.textContent = `(${count})`;
  }
  
  if (elements.timelineCount) {
    elements.timelineCount.textContent = `${count} notes`;
  }
}

function getUniqueTagsFromCurrentVideo() {
  const uniqueTags = new Set();
  
  notesList.forEach(note => {
    if (note.tags && Array.isArray(note.tags)) {
      note.tags.forEach(tag => uniqueTags.add(tag));
    }
  });
  
  return Array.from(uniqueTags);
}

function createNoteElement(note) {
  const noteElement = elements.noteTemplate.content.cloneNode(true).querySelector('.note-item');
  
  noteElement.dataset.id = note.id;
  
  const timestampElement = noteElement.querySelector('.note-timestamp');
  timestampElement.textContent = note.timestampFormatted;
  
  timestampElement.addEventListener('click', () => {
    jumpToTimestamp(note.timestamp);
  });
  
  const contentElement = noteElement.querySelector('.note-content');
  if (note.richContent) {
    contentElement.innerHTML = note.richContent;
  } else {
    contentElement.textContent = note.text;
  }
  
  const tagsContainer = noteElement.querySelector('.note-tags');
  if (note.tags && note.tags.length > 0) {
    note.tags.forEach(tagName => {
      const tagElement = document.createElement('span');
      tagElement.className = 'tag';
      tagElement.textContent = tagName;
      
      const { bgColor, textColor } = generateTagColors(tagName);
      tagElement.style.backgroundColor = bgColor;
      tagElement.style.color = textColor;
      tagElement.style.borderColor = textColor;
      
      tagElement.addEventListener('click', () => {
        setTagFilter(tagName);
      });
      
      tagsContainer.appendChild(tagElement);
    });
  }
  
  const editButton = noteElement.querySelector('.edit-note-btn');
  editButton.addEventListener('click', () => {
    showEditNoteModal(note);
  });
  
  return noteElement;
}

function updateTimeline() {
  if (!elements.timeline) return;
  
  elements.timeline.innerHTML = '';
  
  if (notesList.length === 0 || !currentVideoInfo || !currentVideoInfo.duration) return;
  
  notesList.forEach(note => {
    const marker = document.createElement('div');
    marker.className = 'timeline-marker';
    
    if (note.tags && note.tags.length > 0) {
      const { textColor } = generateTagColors(note.tags[0]);
      marker.style.backgroundColor = textColor;
    }
    
    const position = (note.timestamp / currentVideoInfo.duration) * 100;
    marker.style.left = `${position}%`;
    
    marker.addEventListener('click', () => {
      jumpToTimestamp(note.timestamp);
    });
    
    marker.title = note.text.substring(0, 50) + (note.text.length > 50 ? '...' : '');
    
    elements.timeline.appendChild(marker);
  });
}

function setTagFilter(tagName) {
  if (activeTagFilter === tagName) {
    clearTagFilter();
    return;
  }
  
  activeTagFilter = tagName;
  elements.filterButton.textContent = tagName;
  elements.filterButton.classList.add('active');
  
  renderNotesList();
}

function clearTagFilter() {
  activeTagFilter = null;
  elements.filterButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
    </svg>
  `;
  elements.filterButton.classList.remove('active');
  
  renderNotesList();
}

function closeSidebar() {
  window.parent.postMessage({ action: 'closeSidebar' }, '*');
}

function saveNoteToStorage(note) {
  chrome.storage.local.get(['noteStreamData', 'recentVideos'], (result) => {
    const noteStreamData = result.noteStreamData || {};
    const videoNotes = noteStreamData[currentVideoId] || [];
    
    if (!note.videoInfo && currentVideoInfo) {
      note.videoInfo = JSON.parse(JSON.stringify(currentVideoInfo));
    }
    
    videoNotes.push(note);
    
    noteStreamData[currentVideoId] = videoNotes;
    chrome.storage.local.set({ 
      noteStreamData: noteStreamData,
      recentVideos: [currentVideoId, ...(result.recentVideos || []).filter(id => id !== currentVideoId)].slice(0, 10)
    });
  });
}

function saveNotesToStorage() {
  chrome.storage.local.get(['noteStreamData'], (result) => {
    const noteStreamData = result.noteStreamData || {};
    
    noteStreamData[currentVideoId] = notesList;
    
    chrome.storage.local.set({ noteStreamData }, () => {
      console.log('Notes saved to storage:', notesList.length);
    });
  });
}

function loadNotesForVideo(videoId) {
  chrome.storage.local.get(['noteStreamData'], (result) => {
    const noteStreamData = result.noteStreamData || {};
    notesList = noteStreamData[videoId] || [];
    console.log(`Loaded ${notesList.length} notes for video ${videoId}`);
    
    renderNotesList();
    updateTimeline();
    updateAllTagsList();
  });
}

function addNoteToList(note) {
  notesList.push(note);
  
  notesList.sort((a, b) => a.timestamp - b.timestamp);
  
  renderNotesList();
}

function renderNotesList() {
  if (!elements.notesList) return;
  
  elements.notesList.innerHTML = '';
  
  const notesToRender = activeTagFilter 
    ? notesList.filter(note => note.tags && note.tags.includes(activeTagFilter))
    : notesList;
  
  if (notesToRender.length === 0) {
    elements.notesList.innerHTML = `
      <div class="empty-notes">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path>
        </svg>
        <p>No notes yet</p>
        <p class="subtitle">Start taking notes while watching!</p>
      </div>
    `;
    updateNotesCount();
    return;
  }
  
  notesToRender.forEach(note => {
    const noteElement = createNoteElement(note);
    elements.notesList.appendChild(noteElement);
  });
  
  updateNotesCount();
}

function parseTimestamp(timestamp) {
  const parts = timestamp.split(':').map(Number);
  
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  
  return 0;
}

function formatTime(timeInSeconds) {
  if (isNaN(timeInSeconds)) return '--:--';
  
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

function updateVideoInfo(videoInfo) {
  console.log('Updating video info:', videoInfo);
  currentVideoInfo = videoInfo;
  currentVideoId = videoInfo.videoId;
  
  if (elements.videoTitle) {
    elements.videoTitle.textContent = videoInfo.title || 'Unknown Title';
  }
  
  const duration = formatTime(videoInfo.duration);
  if (elements.videoMeta) {
    elements.videoMeta.textContent = `${videoInfo.channel || 'Unknown Channel'} • ${duration}`;
  }
}

function updateCurrentTime(timeInSeconds) {
  if (elements.noteTimestamp) {
    elements.noteTimestamp.textContent = formatTime(timeInSeconds);
  }
  
  // Update capture time if not set
  if (captureTimestamp === 0 && elements.captureTime) {
    elements.captureTime.textContent = `Capture: ${formatTime(timeInSeconds)}`;
  }
}

function startTimeUpdates() {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }
  
  timeUpdateInterval = setInterval(() => {
    requestCurrentTime();
  }, 1000);
}

function handleParentMessages(event) {
  const message = event.data;
  console.log('Sidebar received message:', message);
  
  switch (message.action) {
    case 'videoLoaded':
      if (message.videoInfo) {
        updateVideoInfo(message.videoInfo);
        loadNotesForVideo(message.videoInfo.videoId);
        updateRecentTagsDisplay();
      } else {
        console.error('No video info provided in videoLoaded message');
      }
      break;
      
    case 'sidebarOpened':
      if (message.videoInfo) {
        updateVideoInfo(message.videoInfo);
        updateCurrentTime(message.currentTime);
        loadNotesForVideo(message.videoInfo.videoId);
        updateRecentTagsDisplay();
      } else {
        console.error('No video info provided in sidebarOpened message');
      }
      break;
      
    case 'timeUpdate':
      updateCurrentTime(message.currentTime);
      break;
  }
}

// Enhanced Initialization
function initSidebar() {
  console.log('Initializing enhanced sidebar with flow features');
  
  // Load global tags and recent tags first
  loadGlobalTags();
  
  // Initialize rich text editors
  setTimeout(() => {
    initializeRichEditors();
    // Set up smart timestamping after editors are ready
    setTimeout(setupSmartTimestamping, 100);
  }, 100); // Small delay to ensure DOM is ready
  
  // Set up all event listeners
  setupEventListeners();
  
  // Setup video controls
  setupVideoControls();
  
  // Setup communication with parent
  window.addEventListener('message', handleParentMessages);
  
  // Start time updates
  startTimeUpdates();
  
  // Initialize empty selected tags
  selectedTags = [];
  
  // Signal readiness when fully loaded
  window.addEventListener('load', () => {
    console.log('Enhanced sidebar fully loaded, signaling readiness');
    window.parent.postMessage({ action: 'sidebarReady' }, '*');
  });
  
  console.log('Enhanced sidebar initialization complete');
}

function setupEventListeners() {
  console.log('Setting up enhanced event listeners');
  
  // Core functionality
  if (elements.saveNoteBtn) {
    elements.saveNoteBtn.addEventListener('click', saveNote);
  }
  
  if (elements.closeButton) {
    elements.closeButton.addEventListener('click', closeSidebar);
  }
  
  if (elements.filterButton) {
    elements.filterButton.addEventListener('click', showFilterDropdown);
  }
  
  if (elements.exportNotesBtn) {
    elements.exportNotesBtn.addEventListener('click', showExportModal);
  }
  
  // Tag management
  if (elements.moreTagsBtn) {
    elements.moreTagsBtn.addEventListener('click', toggleTagsDropdown);
  }
  
  if (elements.addNewTagBtn) {
    elements.addNewTagBtn.addEventListener('click', () => {
      const newTag = elements.newTagInput.value.trim();
      if (newTag && !selectedTags.includes(newTag)) {
        selectedTags.push(newTag);
        addToGlobalTags(newTag);
        updateSelectedTagsDisplay();
        elements.newTagInput.value = '';
        toggleTagsDropdown();
      }
    });
  }
  
  if (elements.newTagInput) {
    elements.newTagInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        elements.addNewTagBtn.click();
      }
    });
  }
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!elements.moreTagsBtn?.contains(e.target) && 
        !elements.tagsDropdown?.contains(e.target)) {
      elements.tagsDropdown?.classList.add('hidden');
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S to save note
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveNote();
    }
    
    // Ctrl/Cmd + E to export
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault();
      showExportModal();
    }
    
    // Alt + T to focus on tags
    if (e.altKey && e.key === 't') {
      e.preventDefault();
      elements.moreTagsBtn?.click();
    }
  });
  
  console.log('Enhanced event listeners set up complete');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initSidebar);