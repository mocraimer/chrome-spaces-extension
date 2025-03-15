import React, { useState, useCallback, useEffect, RefObject } from 'react';

interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  onClick: () => void;
}

interface Position {
  x: number;
  y: number;
}

interface UseContextMenuOptions {
  items: ContextMenuItem[];
  containerRef?: RefObject<HTMLElement>;
}

export function useContextMenu({ items, containerRef }: UseContextMenuOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const menuElement = document.getElementById('context-menu');
      if (menuElement && !menuElement.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Handle arrow key navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
        case 'j':
          event.preventDefault();
          setSelectedItemId(current => {
            const currentIndex = items.findIndex(item => item.id === current);
            const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % items.length;
            return items[nextIndex].id;
          });
          break;

        case 'ArrowUp':
        case 'k':
          event.preventDefault();
          setSelectedItemId(current => {
            const currentIndex = items.findIndex(item => item.id === current);
            const prevIndex = currentIndex === -1 
              ? items.length - 1 
              : (currentIndex - 1 + items.length) % items.length;
            return items[prevIndex].id;
          });
          break;

        case 'Enter':
          event.preventDefault();
          if (selectedItemId) {
            const selectedItem = items.find(item => item.id === selectedItemId);
            if (selectedItem && !selectedItem.disabled) {
              selectedItem.onClick();
              setIsOpen(false);
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, selectedItemId]);

  // Show menu
  const show = useCallback((event: React.MouseEvent) => {
    event.preventDefault();

    // Calculate position
    let x = event.clientX;
    let y = event.clientY;

    // Adjust position if near viewport edges
    const menuWidth = 200; // Approximate width
    const menuHeight = items.length * 36; // Approximate height per item
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adjust horizontal position
    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth;
    }

    // Adjust vertical position
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight;
    }

    setPosition({ x, y });
    setIsOpen(true);
    setSelectedItemId(items[0]?.id || null);
  }, [items]);

  // Render menu
  const ContextMenu = useCallback(() => {
    if (!isOpen) return null;

    return React.createElement(
      'div',
      {
        id: 'context-menu',
        className: 'context-menu',
        style: {
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 1000
        }
      },
      items.map(item => 
        React.createElement(
          'button',
          {
            key: item.id,
            className: `context-menu-item ${
              item.disabled ? 'disabled' : ''
            } ${selectedItemId === item.id ? 'selected' : ''}`,
            onClick: () => {
              if (!item.disabled) {
                item.onClick();
                setIsOpen(false);
              }
            },
            disabled: item.disabled
          },
          item.icon && React.createElement(
            'span',
            { className: 'context-menu-icon' },
            item.icon
          ),
          React.createElement(
            'span',
            { className: 'context-menu-label' },
            item.label
          )
        )
      )
    );
  }, [isOpen, position.x, position.y, items, selectedItemId]);

  return {
    show,
    isOpen,
    close: () => setIsOpen(false),
    ContextMenu
  };
}

// Inject styles
const styles = `
  .context-menu {
    min-width: 200px;
    background: var(--background-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    box-shadow: var(--shadow-md);
    padding: var(--spacing-xs);
    animation: menuFadeIn 0.1s ease-out;
  }

  .context-menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    color: var(--text-primary);
    background: none;
    border: none;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: left;
  }

  .context-menu-item:hover:not(.disabled),
  .context-menu-item.selected:not(.disabled) {
    background: var(--background-secondary);
  }

  .context-menu-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .context-menu-icon {
    margin-right: var(--spacing-sm);
    font-size: var(--font-size-md);
  }

  .context-menu-label {
    flex: 1;
    font-size: var(--font-size-sm);
  }

  @keyframes menuFadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);
