import React, { useState, useCallback, useRef } from 'react';
import { useTransition } from './useTransition';

interface NotificationOptions {
  duration?: number;
  type?: 'success' | 'error' | 'info';
}

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface NotificationStyles {
  success: {
    background: string;
    color: string;
  };
  error: {
    background: string;
    color: string;
  };
  info: {
    background: string;
    color: string;
  };
}

const NOTIFICATION_STYLES: NotificationStyles = {
  success: {
    background: 'var(--success-color)',
    color: '#fff'
  },
  error: {
    background: 'var(--error-color)',
    color: '#fff'
  },
  info: {
    background: 'var(--primary-color)',
    color: '#fff'
  }
};

export function useNotification(defaultOptions: NotificationOptions = {}) {
  const {
    duration = 3000,
    type: defaultType = 'info'
  } = defaultOptions;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const idCounter = useRef(0);

  const transition = useTransition({
    duration: 200,
    timingFunction: 'ease-in-out'
  });

  const show = useCallback((
    message: string,
    options: NotificationOptions = {}
  ) => {
    const id = String(idCounter.current++);
    const type = options.type || defaultType;
    const notificationDuration = options.duration || duration;

    const notification: Notification = {
      id,
      message,
      type
    };

    setNotifications(prev => [...prev, notification]);
    transition.enter();

    // Auto remove after duration
    setTimeout(() => {
      remove(id);
    }, notificationDuration);

    return id;
  }, [defaultType, duration, transition]);

  const remove = useCallback((id: string) => {
    transition.exit();
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 200); // Match transition duration
  }, [transition]);

  const clearAll = useCallback(() => {
    transition.exit();
    setTimeout(() => {
      setNotifications([]);
    }, 200);
  }, [transition]);

  // Convenience methods
  const success = useCallback((
    message: string,
    options: Omit<NotificationOptions, 'type'> = {}
  ) => {
    return show(message, { ...options, type: 'success' });
  }, [show]);

  const error = useCallback((
    message: string,
    options: Omit<NotificationOptions, 'type'> = {}
  ) => {
    return show(message, { ...options, type: 'error' });
  }, [show]);

  const info = useCallback((
    message: string,
    options: Omit<NotificationOptions, 'type'> = {}
  ) => {
    return show(message, { ...options, type: 'info' });
  }, [show]);

  // Render notification component
  const NotificationContainer = useCallback(() => {
    if (!transition.isVisible || notifications.length === 0) return null;

    return React.createElement(
      'div',
      {
        className: 'notification-container',
        style: transition.styles
      },
      notifications.map(notification => 
        React.createElement(
          'div',
          {
            key: notification.id,
            className: `notification notification-${notification.type}`,
            style: {
              ...NOTIFICATION_STYLES[notification.type],
              animation: 'slideIn 0.2s ease-out'
            }
          },
          React.createElement(
            'span',
            { className: 'notification-message' },
            notification.message
          ),
          React.createElement(
            'button',
            {
              className: 'notification-close',
              onClick: () => remove(notification.id),
              'aria-label': 'Close notification'
            },
            '×'
          )
        )
      )
    );
  }, [notifications, transition, remove]);

  return {
    show,
    success,
    error,
    info,
    remove,
    clearAll,
    notifications,
    NotificationContainer
  };
}

// Inject styles
const styles = `
  .notification-container {
    position: fixed;
    top: var(--spacing-md);
    right: var(--spacing-md);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    max-width: 300px;
  }

  .notification {
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius-sm);
    box-shadow: var(--shadow-md);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
  }

  .notification-message {
    flex: 1;
    font-size: var(--font-size-sm);
    line-height: 1.4;
  }

  .notification-close {
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-lg);
    opacity: 0.7;
    transition: opacity var(--transition-fast);
  }

  .notification-close:hover {
    opacity: 1;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;

const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);
