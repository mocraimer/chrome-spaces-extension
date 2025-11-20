import React, { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export interface SearchInputRef {
  focus: () => void;
  blur: () => void;
  select: () => void;
}

const SearchInput = forwardRef<SearchInputRef, SearchInputProps>(({
  value,
  onChange,
  placeholder = "Search spaces...",
  autoFocus = false,
  className = '',
  onKeyDown
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
    select: () => inputRef.current?.select()
  }));

  // Handle auto-focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow parent to handle key events (like arrow keys for navigation)
    if (onKeyDown) {
      onKeyDown(e);
      // If the parent handled the event (prevented default), stop propagation
      // to prevent the event from bubbling up to the container which might also handle it
      if (e.defaultPrevented) {
        e.stopPropagation();
      }
    }
  };

  const searchInputClasses = [
    'search-input',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className="search-container">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={searchInputClasses}
        data-testid="search-input"
      />
    </div>
  );
});

SearchInput.displayName = 'SearchInput';

export default SearchInput;