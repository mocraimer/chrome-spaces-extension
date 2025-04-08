import styled from 'styled-components';

export type FeedbackType = 'success' | 'error';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: 8px;
  background-color: var(--bg-secondary);
`;

export const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
`;

export const Button = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 4px;
  background-color: var(--primary);
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--primary-hover);
  }

  &:disabled {
    background-color: var(--disabled);
    cursor: not-allowed;
  }
`;

interface FeedbackMessageProps {
  type: FeedbackType;
}

export const FeedbackMessage = styled.div<FeedbackMessageProps>`
  padding: 0.75rem;
  border-radius: 4px;
  background-color: ${({ type }) =>
    type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)'};
  color: ${({ type }) =>
    type === 'success' ? 'var(--success-text)' : 'var(--error-text)'};
`;

export const LoadingIndicator = styled.div`
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--text-primary);
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;