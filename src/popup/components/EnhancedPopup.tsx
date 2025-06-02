import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Space {
  id: string;
  name: string;
  customName?: string;
  urls: string[];
  windowId?: number;
  isActive: boolean;
  createdAt: number;
  lastUsed: number;
  permanentId: string; // Unique permanent identifier
}

interface ClosedSpace {
  id: string;
  name: string;
  customName?: string;
  urls: string[];
  closedAt: number;
  originalWindowId: number;
  permanentId: string; // Unique permanent identifier
}

interface SpaceNameStorage {
  [permanentId: string]: {
    customName: string;
    lastModified: number;
    originalName: string;
  };
}

const MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_NAME_LENGTH = 100;

// Generate permanent ID for spaces
const generatePermanentId = (): string => {
  return `space_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Auto-generate space names based on tabs
const generateSpaceName = (urls: string[]): string => {
  if (urls.length === 0) return 'Empty Space';
  
  // Get domains and find most common
  const domains = urls
    .map(url => {
      try {
        const hostname = new URL(url).hostname;
        return hostname.replace('www.', '');
      } catch {
        return 'unknown';
      }
    })
    .filter(domain => domain !== 'unknown');
  
  if (domains.length === 0) return 'New Space';
  
  // Count domain frequency
  const domainCounts = domains.reduce((acc, domain) => {
    acc[domain] = (acc[domain] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const mostCommon = Object.entries(domainCounts)
    .sort(([, a], [, b]) => b - a)[0][0];
  
  // Create friendly names for common domains
  const friendlyNames: Record<string, string> = {
    'github.com': 'GitHub',
    'gmail.com': 'Gmail',
    'docs.google.com': 'Google Docs',
    'stackoverflow.com': 'Stack Overflow',
    'youtube.com': 'YouTube',
    'twitter.com': 'Twitter',
    'facebook.com': 'Facebook',
    'linkedin.com': 'LinkedIn',
    'slack.com': 'Slack',
    'discord.com': 'Discord',
  };
  
  const baseName = friendlyNames[mostCommon] || 
    mostCommon.split('.')[0].charAt(0).toUpperCase() + mostCommon.split('.')[0].slice(1);
  
  if (urls.length === 1) return baseName;
  return `${baseName} + ${urls.length - 1} more`;
};

const EnhancedPopup: React.FC = () => {
  // All hooks at the top level
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [closedSpaces, setClosedSpaces] = useState<ClosedSpace[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [customNames, setCustomNames] = useState<SpaceNameStorage>({});
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Custom names storage functions
  const loadCustomNames = useCallback(async (): Promise<SpaceNameStorage> => {
    try {
      const result = await chrome.storage.local.get(['spaceCustomNames']);
      return result.spaceCustomNames || {};
    } catch (err) {
      console.error('Failed to load custom names:', err);
      return {};
    }
  }, []);

  const saveCustomName = useCallback(async (permanentId: string, customName: string, originalName: string) => {
    try {
      const currentNames = await loadCustomNames();
      const updatedNames = {
        ...currentNames,
        [permanentId]: {
          customName: customName.trim(),
          lastModified: Date.now(),
          originalName
        }
      };
      
      await chrome.storage.local.set({ spaceCustomNames: updatedNames });
      setCustomNames(updatedNames);
      
      // Update existing names set for duplicate checking
      const allNames = new Set<string>();
      Object.values(updatedNames).forEach(entry => allNames.add(entry.customName.toLowerCase()));
      setExistingNames(allNames);
      
      return true;
    } catch (err) {
      console.error('Failed to save custom name:', err);
      return false;
    }
  }, [loadCustomNames]);

  const deleteCustomName = useCallback(async (permanentId: string) => {
    try {
      const currentNames = await loadCustomNames();
      const updatedNames = { ...currentNames };
      delete updatedNames[permanentId];
      
      await chrome.storage.local.set({ spaceCustomNames: updatedNames });
      setCustomNames(updatedNames);
      
      // Update existing names set
      const allNames = new Set<string>();
      Object.values(updatedNames).forEach(entry => allNames.add(entry.customName.toLowerCase()));
      setExistingNames(allNames);
      
      return true;
    } catch (err) {
      console.error('Failed to delete custom name:', err);
      return false;
    }
  }, [loadCustomNames]);

  const validateSpaceName = useCallback((name: string, currentPermanentId?: string): { valid: boolean; error?: string } => {
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      return { valid: false, error: 'Name cannot be empty' };
    }
    
    if (trimmedName.length > MAX_NAME_LENGTH) {
      return { valid: false, error: `Name cannot exceed ${MAX_NAME_LENGTH} characters` };
    }
    
    // Check for duplicate names (case-insensitive)
    const lowerName = trimmedName.toLowerCase();
    if (existingNames.has(lowerName)) {
      // Allow if it's the same space being edited
      const currentCustomName = currentPermanentId ? customNames[currentPermanentId]?.customName : null;
      if (!currentCustomName || currentCustomName.toLowerCase() !== lowerName) {
        return { valid: false, error: 'This name is already used by another space' };
      }
    }
    
    return { valid: true };
  }, [existingNames, customNames]);

  // Load closed spaces from storage
  const loadClosedSpaces = useCallback(async () => {
    try {
      const result = await chrome.storage.local.get(['closedSpaces']);
      const stored = result.closedSpaces || [];
      
      // Filter out spaces older than 1 month
      const oneMonthAgo = Date.now() - MONTH_IN_MS;
      const validSpaces = stored.filter((space: ClosedSpace) => space.closedAt > oneMonthAgo);
      
      // Save back filtered list if we removed any
      if (validSpaces.length !== stored.length) {
        await chrome.storage.local.set({ closedSpaces: validSpaces });
      }
      
      setClosedSpaces(validSpaces);
    } catch (err) {
      console.error('Failed to load closed spaces:', err);
    }
  }, []);

  // Save closed spaces to storage
  const saveClosedSpaces = useCallback(async (spaces: ClosedSpace[]) => {
    try {
      await chrome.storage.local.set({ closedSpaces: spaces });
      setClosedSpaces(spaces);
    } catch (err) {
      console.error('Failed to save closed spaces:', err);
    }
  }, []);

  // Initialize data
  useEffect(() => {
    const initializePopup = async () => {
      try {
        setIsLoading(true);
        
        // Load custom names first
        const storedCustomNames = await loadCustomNames();
        setCustomNames(storedCustomNames);
        
        // Build existing names set for duplicate checking
        const allNames = new Set<string>();
        Object.values(storedCustomNames).forEach(entry => allNames.add(entry.customName.toLowerCase()));
        setExistingNames(allNames);
        
        // Get current window
        const currentWindow = await chrome.windows.getCurrent();
        setCurrentWindowId(currentWindow.id || null);
        
        // Get all windows to create spaces
        const windows = await chrome.windows.getAll({ populate: true });
        const spacesList: Space[] = [];
        
        // Load permanent ID mappings (windowId -> permanentId)
        const permanentIdMappings = await chrome.storage.local.get(['spacePermanentIds']);
        const idMappings = permanentIdMappings.spacePermanentIds || {};
        
        for (const window of windows) {
          if (window.tabs && window.tabs.length > 0) {
            const urls = window.tabs
              .filter(tab => tab.url && !tab.url.startsWith('chrome://'))
              .map(tab => tab.url!)
              .filter(Boolean);
            
            if (urls.length > 0) {
              const windowIdStr = window.id!.toString();
              
              // Get or create permanent ID for this window
              let permanentId = idMappings[windowIdStr];
              if (!permanentId) {
                permanentId = generatePermanentId();
                idMappings[windowIdStr] = permanentId;
              }
              
              const autoGeneratedName = generateSpaceName(urls);
              const customNameEntry = storedCustomNames[permanentId];
              
              const space: Space = {
                id: windowIdStr,
                name: autoGeneratedName,
                customName: customNameEntry?.customName,
                urls: urls,
                windowId: window.id,
                isActive: true,
                createdAt: Date.now(),
                lastUsed: Date.now(),
                permanentId
              };
              spacesList.push(space);
            }
          }
        }
        
        // Save updated permanent ID mappings
        await chrome.storage.local.set({ spacePermanentIds: idMappings });
        
        setSpaces(spacesList);
        await loadClosedSpaces();
        setError(null);
      } catch (err) {
        console.error('Failed to initialize popup:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    initializePopup();
  }, [loadCustomNames, loadClosedSpaces]);

  // Auto-focus search input
  useEffect(() => {
    if (!isLoading && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isLoading]);

  // Focus edit input when editing
  useEffect(() => {
    if (editingSpaceId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSpaceId]);

  // Filter spaces based on search
  const filteredSpaces = spaces.filter(space => {
    if (!searchTerm) return true;
    const displayName = space.customName || space.name;
    return displayName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredClosedSpaces = closedSpaces.filter(space => {
    if (!searchTerm) return true;
    const displayName = space.customName || space.name;
    return displayName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const allFilteredSpaces = [...filteredSpaces, ...filteredClosedSpaces];

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (editingSpaceId) return; // Don't handle if editing
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, allFilteredSpaces.length - 1));
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
        
      case 'Enter':
        e.preventDefault();
        if (allFilteredSpaces.length > 0) {
          const selectedSpace = allFilteredSpaces[selectedIndex];
          if ('windowId' in selectedSpace) {
            handleSwitchToSpace(selectedSpace.windowId!);
          } else {
            handleRestoreSpace(selectedSpace as ClosedSpace);
          }
        }
        break;
        
      case 'Delete':
      case 'Backspace':
        if (e.target === searchInputRef.current && searchTerm === '') {
          e.preventDefault();
          if (allFilteredSpaces.length > 0) {
            const selectedSpace = allFilteredSpaces[selectedIndex];
            setShowConfirmDelete(selectedSpace.id);
          }
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        if (searchTerm) {
          setSearchTerm('');
          setSelectedIndex(0);
        } else {
          window.close();
        }
        break;
        
      case 'F2':
        e.preventDefault();
        if (allFilteredSpaces.length > 0) {
          const selectedSpace = allFilteredSpaces[selectedIndex];
          startEditing(selectedSpace as Space & ClosedSpace);
        }
        break;
    }
  }, [editingSpaceId, allFilteredSpaces, selectedIndex, searchTerm]);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  const handleSwitchToSpace = async (windowId: number) => {
    try {
      await chrome.windows.update(windowId, { focused: true });
      window.close();
    } catch (err) {
      console.error('Failed to switch to space:', err);
      setError('Failed to switch to space');
    }
  };

  const handleRestoreSpace = async (closedSpace: ClosedSpace) => {
    try {
      // Create new window with all tabs
      const newWindow = await chrome.windows.create({
        url: closedSpace.urls[0] || 'chrome://newtab',
        focused: true
      });

      // Add remaining tabs
      if (closedSpace.urls.length > 1) {
        for (let i = 1; i < closedSpace.urls.length; i++) {
          await chrome.tabs.create({
            windowId: newWindow.id,
            url: closedSpace.urls[i]
          });
        }
      }

      // Remove from closed spaces
      const updatedClosed = closedSpaces.filter(s => s.id !== closedSpace.id);
      await saveClosedSpaces(updatedClosed);
      
      window.close();
    } catch (err) {
      console.error('Failed to restore space:', err);
      setError('Failed to restore space');
    }
  };

  const handleRemoveSpace = async (spaceId: string) => {
    try {
      const space = spaces.find(s => s.id === spaceId);
      const closedSpace = closedSpaces.find(s => s.id === spaceId);
      
      if (space && space.windowId) {
        // Save to closed spaces before removing
        const newClosedSpace: ClosedSpace = {
          id: `closed_${Date.now()}`,
          name: space.name,
          customName: space.customName,
          urls: space.urls,
          closedAt: Date.now(),
          originalWindowId: space.windowId
        };
        
        const updatedClosed = [...closedSpaces, newClosedSpace];
        await saveClosedSpaces(updatedClosed);
        
        // Close the window
        await chrome.windows.remove(space.windowId);
      } else if (closedSpace) {
        // Permanently remove closed space
        const updatedClosed = closedSpaces.filter(s => s.id !== spaceId);
        await saveClosedSpaces(updatedClosed);
      }
      
      setShowConfirmDelete(null);
      // Refresh spaces list
      window.location.reload();
    } catch (err) {
      console.error('Failed to remove space:', err);
      setError('Failed to remove space');
    }
  };

  const startEditing = (space: Space | ClosedSpace) => {
    setEditingSpaceId(space.id);
    setEditingName(space.customName || space.name);
  };

  const handleSaveEdit = async () => {
    if (!editingSpaceId || !editingName.trim()) return;
    
    // Find the space being edited
    const space = [...spaces, ...closedSpaces].find(s => s.id === editingSpaceId);
    if (!space) return;
    
    // Validate the new name
    const validation = validateSpaceName(editingName, space.permanentId);
    if (!validation.valid) {
      setError(validation.error || 'Invalid name');
      return;
    }
    
    // Save the custom name
    const success = await saveCustomName(space.permanentId, editingName, space.name);
    if (success) {
      // Update local state
      if (space.isActive) {
        setSpaces(prev => prev.map(s => 
          s.id === editingSpaceId 
            ? { ...s, customName: editingName.trim() }
            : s
        ));
      } else {
        setClosedSpaces(prev => prev.map(s => 
          s.id === editingSpaceId 
            ? { ...s, customName: editingName.trim() }
            : s
        ));
      }
      
      setEditingSpaceId(null);
      setEditingName('');
      setError(null);
    } else {
      setError('Failed to save space name');
    }
  };

  const handleCancelEdit = () => {
    setEditingSpaceId(null);
    setEditingName('');
  };

  // Handle keyboard shortcuts for editing
  const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        handleSaveEdit();
        break;
      case 'Escape':
        e.preventDefault();
        handleCancelEdit();
        break;
        case 'z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          // Reset to auto-generated name (Ctrl+Z)
          const space = [...spaces, ...closedSpaces].find(s => s.id === editingSpaceId);
          if (space) {
            setEditingName(space.name);
          }
        }
        break;
    }
  }, [editingSpaceId, spaces, closedSpaces]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="popup-container">
        <div className="popup-header">
          <h1>Chrome Spaces</h1>
        </div>
        <div className="loading">
          <p>Loading spaces...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="popup-container">
        <div className="popup-header">
          <h1>Chrome Spaces</h1>
        </div>
        <div className="error">
          <p>Error: {error}</p>
          <button onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h1>Chrome Spaces</h1>
        <div className="search-container">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search spaces..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>
      
      <div className="spaces-list">
        {allFilteredSpaces.length === 0 ? (
          <div className="empty-state">
            <p>No spaces found</p>
            {!searchTerm && (
              <button onClick={() => chrome.windows.create({ url: 'chrome://newtab' })}>
                Create your first space
              </button>
            )}
          </div>
        ) : (
          allFilteredSpaces.map((space, index) => {
            const isActive = 'windowId' in space;
            const isCurrent = isActive && space.windowId === currentWindowId;
            const isSelected = index === selectedIndex;
            const displayName = space.customName || space.name;
            
            return (
              <div 
                key={space.id} 
                className={`space-item ${isCurrent ? 'current' : ''} ${isSelected ? 'selected' : ''} ${!isActive ? 'closed' : ''}`}
                onClick={() => {
                  if (isActive) {
                    handleSwitchToSpace((space as Space).windowId!);
                  } else {
                    handleRestoreSpace(space as ClosedSpace);
                  }
                }}
              >
                <div className="space-info">
                  {editingSpaceId === space.id ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onBlur={handleSaveEdit}
                      className="edit-input"
                      maxLength={MAX_NAME_LENGTH}
                      placeholder="Enter space name..."
                    />
                  ) : (
                    <h3 
                      onDoubleClick={() => startEditing(space as Space & ClosedSpace)}
                      className={space.customName ? 'custom-name' : 'auto-name'}
                      title={space.customName ? 'Custom name - double click to edit' : 'Auto-generated name - double click to edit'}
                    >
                      {space.customName && <span className="custom-indicator">✏️ </span>}
                      {displayName}
                    </h3>
                  )}
                  
                  <p>
                    {space.urls.length} tab{space.urls.length !== 1 ? 's' : ''}
                    {!isActive && ' • Closed'}
                  </p>
                  
                  <div className="space-urls">
                    {space.urls.slice(0, 3).map((url, urlIndex) => (
                      <div key={urlIndex} className="url-preview">
                        {new URL(url).hostname.replace('www.', '')}
                      </div>
                    ))}
                    {space.urls.length > 3 && (
                      <div className="url-preview">+{space.urls.length - 3} more</div>
                    )}
                  </div>
                </div>
                
                <div className="space-actions">
                  {isActive ? (
                    <>
                      {!isCurrent && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSwitchToSpace((space as Space).windowId!);
                          }}
                          className="switch-btn"
                        >
                          Switch
                        </button>
                      )}
                      {isCurrent && <span className="current-label">Current</span>}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowConfirmDelete(space.id);
                        }}
                        className="remove-btn"
                        title="Close space"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestoreSpace(space as ClosedSpace);
                        }}
                        className="restore-btn"
                      >
                        Restore
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowConfirmDelete(space.id);
                        }}
                        className="remove-btn"
                        title="Delete permanently"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDelete && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <p>Are you sure you want to remove this space?</p>
            <div className="confirm-actions">
              <button 
                onClick={() => handleRemoveSpace(showConfirmDelete)}
                className="confirm-btn"
              >
                Yes, Remove
              </button>
              <button 
                onClick={() => setShowConfirmDelete(null)}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="help-text">
        <small>
          ↑↓ navigate • Enter switch • F2/double-click edit • Ctrl+Z reset • Del remove
        </small>
      </div>
    </div>
  );
};

export default EnhancedPopup;