import React, { useEffect, useRef } from 'react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean; // For delete actions, makes confirm button red
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isDangerous = false
}) => {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the confirm button when dialog opens
  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onConfirm, onCancel]);

  // Prevent background scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const confirmButtonClass = isDangerous ? 'confirm-delete' : 'confirm-action';

  return (
    <div
      className="confirm-dialog"
      onClick={handleBackdropClick}
      data-testid="confirm-dialog"
    >
      <div className="confirm-content" role="dialog" aria-modal="true">
        <div className="confirm-header">
          <h3>{title}</h3>
        </div>
        <div className="confirm-message">
          {message}
        </div>
        <div className="confirm-actions">
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className={confirmButtonClass}
            data-testid="confirm-button"
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            className="confirm-cancel"
            data-testid="cancel-button"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;