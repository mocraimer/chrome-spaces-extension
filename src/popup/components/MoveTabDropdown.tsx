import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Space } from '@/shared/types/Space';

export interface MoveTabDropdownProps {
  spaces: Space[];
  currentWindowId: number;
  onMoveToNewSpace: () => void;
  onMoveToExistingSpace: (windowId: number) => void;
}

const SEARCH_THRESHOLD = 10;

const MoveTabDropdown: React.FC<MoveTabDropdownProps> = memo(({
  spaces,
  currentWindowId,
  onMoveToNewSpace,
  onMoveToExistingSpace
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Filter out current space
  const otherSpaces = spaces.filter(space => space.windowId !== currentWindowId);

  // Filter by search query
  const filteredSpaces = searchQuery
    ? otherSpaces.filter(space =>
        space.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : otherSpaces;

  // Show search input when 10+ spaces
  const showSearch = otherSpaces.length >= SEARCH_THRESHOLD;

  // Total items: "New Space" + filtered existing spaces
  const totalItems = 1 + filteredSpaces.length;

  // Reset selection when dropdown opens or filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [isOpen, searchQuery]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, showSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(prev => !prev);
    if (isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleSelect = useCallback((index: number) => {
    if (index === 0) {
      // "New Space" selected
      onMoveToNewSpace();
    } else {
      // Existing space selected
      const space = filteredSpaces[index - 1];
      if (space.windowId) {
        onMoveToExistingSpace(space.windowId);
      }
    }
    setIsOpen(false);
    setSearchQuery('');
  }, [filteredSpaces, onMoveToNewSpace, onMoveToExistingSpace]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        e.preventDefault();
        handleSelect(selectedIndex);
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
        triggerRef.current?.focus();
        break;
    }
  }, [totalItems, selectedIndex, handleSelect]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  return (
    <div className="move-tab-dropdown-container">
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="move-tab-dropdown-trigger"
        title="Move tab to space"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        data-testid="move-tab-dropdown-trigger"
      >
        ↪
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="move-tab-dropdown"
          role="listbox"
          onKeyDown={handleKeyDown}
          data-testid="move-tab-dropdown"
        >
          {showSearch && (
            <div className="move-tab-dropdown-search">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search spaces..."
                className="move-tab-dropdown-search-input"
                onKeyDown={handleKeyDown}
                data-testid="move-tab-dropdown-search"
              />
            </div>
          )}

          <div className="move-tab-dropdown-options">
            {/* New Space option */}
            <div
              className={`move-tab-dropdown-option new-space ${selectedIndex === 0 ? 'selected' : ''}`}
              onClick={() => handleSelect(0)}
              role="option"
              aria-selected={selectedIndex === 0}
              data-testid="move-tab-new-space-option"
            >
              + New Space
            </div>

            {/* Separator */}
            <div className="move-tab-dropdown-separator" />

            {/* Existing spaces */}
            {filteredSpaces.length > 0 ? (
              filteredSpaces.map((space, index) => (
                <div
                  key={space.id}
                  className={`move-tab-dropdown-option ${selectedIndex === index + 1 ? 'selected' : ''}`}
                  onClick={() => handleSelect(index + 1)}
                  role="option"
                  aria-selected={selectedIndex === index + 1}
                  title={space.name}
                  data-testid={`move-tab-space-option-${space.id}`}
                >
                  <span className="move-tab-dropdown-option-name">{space.name}</span>
                  <span className="move-tab-dropdown-option-tabs">{space.urls.length} tabs</span>
                </div>
              ))
            ) : (
              <div className="move-tab-dropdown-empty">
                {searchQuery ? 'No matching spaces' : 'No other spaces'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

MoveTabDropdown.displayName = 'MoveTabDropdown';

export default MoveTabDropdown;
