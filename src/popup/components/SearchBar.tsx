import React, { useCallback, useRef, useEffect } from 'react';
import { useAppSelector } from '../../shared/hooks/storeHooks';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onKeyDown
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isLoading = useAppSelector(state => state.spaces.isLoading);

  // Auto-focus on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [onChange]);

  return (
    <div className="search-container">
      <input
        ref={inputRef}
        type="text"
        id="search-input"
        className="search-input"
        placeholder="Search spaces..."
        value={value}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        disabled={isLoading}
        aria-label="Search spaces"
      />
      {value && (
        <button
          className="clear-search"
          onClick={handleClear}
          title="Clear search"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
      {isLoading && (
        <div className="loading-indicator" aria-label="Loading">
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
};

// Loading indicator styles
const styles = `
.search-container {
  position: relative;
  margin-bottom: 8px;
}

.search-input {
  width: 100%;
  padding: 8px 32px 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: var(--primary-color);
}

.clear-search {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  font-size: 16px;
  line-height: 1;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.clear-search:hover {
  opacity: 1;
}

.loading-indicator {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.search-input:disabled {
  background-color: var(--background-secondary);
  cursor: not-allowed;
}
`;

// Create and inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);
