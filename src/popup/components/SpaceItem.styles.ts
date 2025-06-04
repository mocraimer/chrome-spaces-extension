// SpaceItem component styles
let stylesInjected = false;

export const injectSpaceItemStyles = () => {
  if (stylesInjected) return;
  
  const styles = `
    .loading {
      opacity: 0.7;
      pointer-events: none;
    }

    .skeleton {
      background: linear-gradient(90deg, var(--background-secondary) 25%, var(--background-tertiary) 50%, var(--background-secondary) 75%);
      background-size: 200% 100%;
      animation: loading 1.5s infinite;
      border-radius: var(--border-radius-xs);
    }

    .icon-skeleton {
      width: 24px;
      height: 24px;
      margin-right: var(--spacing-xs);
    }

    .name-skeleton {
      width: 120px;
      height: 20px;
      margin-right: var(--spacing-sm);
    }

    .tabs-skeleton {
      width: 60px;
      height: 16px;
    }

    @keyframes loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .space-info {
      display: flex;
      flex-direction: column;
      padding: var(--spacing-xs) var(--spacing-sm);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
      margin-bottom: var(--spacing-sm);
      background: var(--background-secondary);
    }

    .space-header {
      margin-bottom: var(--spacing-xs);
      background: var(--background-primary);
      padding: var(--spacing-xs);
      border-radius: var(--border-radius-xs);
      border: 1px solid var(--border-color);
    }

    .space-name-container {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
    }

    .space-name-edit-container {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }

    .edit-actions {
      display: flex;
      gap: var(--spacing-xs);
    }

    .edit-name-btn {
      background: transparent;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-xs);
      padding: 2px 6px;
      cursor: pointer;
      font-size: 12px;
      transition: all var(--transition-fast);
    }

    .edit-name-btn:hover {
      background: var(--background-tertiary);
      border-color: var(--primary-color);
    }

    .space-content {
      display: flex;
      align-items: center;
      cursor: pointer;
      padding: var(--spacing-xs);
      border-radius: var(--border-radius-xs);
      transition: background-color var(--transition-fast);
    }

    .space-content:hover {
      background: var(--background-tertiary);
    }

    .space-icon {
      margin-right: var(--spacing-xs);
    }

    .space-name, .space-name-input {
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-bold);
      color: var(--text-primary);
      margin-right: var(--spacing-sm);
    }

    .space-name-input {
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-xs);
      padding: var(--spacing-xs);
      background: var(--background-primary);
    }

    .space-tabs-count {
      font-size: var(--font-size-xs);
      color: var(--text-secondary);
      margin-right: auto;
    }

    .space-actions {
      display: flex;
      gap: var(--spacing-xs);
      margin-left: auto;
    }

    .action-btn {
      padding: var(--spacing-xs) var(--spacing-sm);
      border: 1px solid var(--primary-color);
      border-radius: var(--border-radius-sm);
      background: transparent;
      color: var(--primary-color);
      font-size: var(--font-size-sm);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .action-btn:hover {
      background: var(--primary-color);
      color: white;
    }

    .save-btn {
      border-color: var(--success-color);
      color: var(--success-color);
    }

    .save-btn:hover {
      background: var(--success-color);
    }

    .cancel-btn {
      border-color: var(--error-color);
      color: var(--error-color);
    }

    .cancel-btn:hover {
      background: var(--error-color);
    }
  `;

  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
  
  stylesInjected = true;
};