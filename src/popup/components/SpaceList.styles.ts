const listStyles = `
.space-list-container {
  height: 400px;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  overflow: hidden;
}

.space-list {
  height: 100%;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}

.space-list::-webkit-scrollbar {
  width: 8px;
}

.space-list::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
}

.space-list::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 4px;
}

.space-list-header {
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--border-color);
}

.space-list-header h2 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
}

.infinite-scroll-trigger {
  height: 10px;
  margin: var(--spacing-sm) 0;
  visibility: hidden;
}
`;

export const injectListStyles = () => {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = listStyles;
  document.head.appendChild(styleSheet);
};