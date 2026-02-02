export const popupStyles = `
  .popup-container {
    width: 350px;
    max-height: 500px;
    padding: var(--spacing-sm);
    background: var(--background-primary);
    color: var(--text-primary);
    font-family: var(--font-family);
    display: flex;
    flex-direction: column;
    outline: none;
  }

  .search-container {
    margin-bottom: var(--spacing-md);
  }

  .search-input {
    width: 100%;
    padding: var(--spacing-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    background: var(--background-primary);
    color: var(--text-primary);
    font-size: var(--font-size-md);
  }

  .search-input:focus {
    border-color: var(--primary-color);
    outline: none;
  }

  .spaces-list {
    flex: 1;
    overflow-y: auto;
    max-height: 400px;
  }

  .space-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm);
    margin-bottom: var(--spacing-xs);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    border: 1px solid transparent;
  }

  .space-item:hover {
    background: var(--background-secondary);
  }

  .space-item.selected {
    background: var(--primary-color);
    color: white;
  }

  .space-item.current {
    border-color: var(--primary-color);
    background: rgba(var(--primary-color-rgb), 0.1);
  }

  .space-item.closed {
    opacity: 0.7;
  }

  .space-info {
    flex: 1;
    min-width: 0;
  }

  .space-name {
    font-weight: var(--font-weight-medium);
    margin-bottom: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .space-details {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .space-item.selected .space-details {
    color: rgba(255, 255, 255, 0.8);
  }

  .space-actions {
    display: flex;
    gap: var(--spacing-xs);
    margin-left: var(--spacing-sm);
  }

  .edit-btn, .delete-btn, .move-tab-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--spacing-xs);
    border-radius: var(--border-radius-sm);
    font-size: 14px;
    opacity: 0.7;
    transition: opacity var(--transition-fast);
  }

  .edit-btn:hover, .delete-btn:hover, .move-tab-btn:hover {
    opacity: 1;
  }

  .move-tab-btn {
    font-size: 16px;
  }

  .move-tab-btn:hover {
    color: var(--primary-color);
  }

  .edit-input {
    width: 100%;
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1px solid var(--primary-color);
    border-radius: var(--border-radius-sm);
    background: var(--background-primary);
    color: var(--text-primary);
    font-size: var(--font-size-md);
  }

  .edit-input:focus {
    outline: none;
  }

  .section-header {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-secondary);
    margin: var(--spacing-md) 0 var(--spacing-sm) 0;
    padding-left: var(--spacing-sm);
  }

  .no-results {
    text-align: center;
    color: var(--text-secondary);
    padding: var(--spacing-lg);
  }

  .loading {
    text-align: center;
    padding: var(--spacing-lg);
    color: var(--text-secondary);
  }

  .error {
    text-align: center;
    padding: var(--spacing-lg);
    color: var(--error-color);
  }

  .error button {
    margin-top: var(--spacing-sm);
    background: var(--primary-color);
    color: white;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
  }

  .error button:hover {
    background: var(--primary-color-dark);
  }

  .confirm-dialog {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .confirm-content {
    background: var(--background-primary);
    padding: var(--spacing-lg);
    border-radius: var(--border-radius-md);
    text-align: center;
    min-width: 200px;
  }

  .confirm-actions {
    display: flex;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-md);
    justify-content: center;
  }

  .confirm-delete {
    background: var(--error-color);
    color: white;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
  }

  .confirm-delete:hover {
    background: var(--error-color-dark, #d32f2f);
  }

  .confirm-cancel {
    background: var(--background-secondary);
    color: var(--text-primary);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
  }

  .confirm-cancel:hover {
    background: var(--border-color);
  }

  .help-text {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    text-align: center;
    margin-top: var(--spacing-sm);
    padding-top: var(--spacing-sm);
    border-top: 1px solid var(--border-color);
  }

  /* MoveTabDropdown styles */
  .move-tab-dropdown-container {
    position: relative;
    display: inline-block;
  }

  .move-tab-dropdown-trigger {
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--spacing-xs);
    border-radius: var(--border-radius-sm);
    font-size: 14px;
    color: var(--text-secondary);
    transition: all var(--transition-fast);
  }

  .move-tab-dropdown-trigger:hover {
    color: var(--text-primary);
    background: var(--background-secondary);
  }

  .move-tab-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    width: 200px;
    max-height: 300px;
    background: var(--background-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .move-tab-dropdown-search {
    padding: var(--spacing-xs);
    border-bottom: 1px solid var(--border-color);
  }

  .move-tab-dropdown-search-input {
    width: 100%;
    padding: var(--spacing-xs);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    background: var(--background-primary);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
  }

  .move-tab-dropdown-search-input:focus {
    border-color: var(--primary-color);
    outline: none;
  }

  .move-tab-dropdown-options {
    overflow-y: auto;
    max-height: 250px;
  }

  .move-tab-dropdown-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm);
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .move-tab-dropdown-option:hover,
  .move-tab-dropdown-option.selected {
    background: var(--background-secondary);
  }

  .move-tab-dropdown-option.new-space {
    color: var(--primary-color);
    font-weight: var(--font-weight-medium);
  }

  .move-tab-dropdown-separator {
    height: 1px;
    background: var(--border-color);
    margin: var(--spacing-xs) 0;
  }

  .move-tab-dropdown-option-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: var(--spacing-xs);
  }

  .move-tab-dropdown-option-tabs {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .move-tab-dropdown-empty {
    padding: var(--spacing-sm);
    text-align: center;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  /* Error notification */
  .error-notification {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm);
    margin: var(--spacing-sm);
    background: var(--error-color, #dc3545);
    color: white;
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-sm);
  }

  .error-notification button {
    background: none;
    border: none;
    color: white;
    font-size: 16px;
    cursor: pointer;
    padding: 0 var(--spacing-xs);
    opacity: 0.8;
  }

  .error-notification button:hover {
    opacity: 1;
  }
`;