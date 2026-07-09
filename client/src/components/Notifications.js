import React from 'react';
import { useNotification } from '../contexts/NotificationContext';

export default function Notifications() {
  const { notifications, removeNotification } = useNotification();

  return (
    <div className="notifications-container">
      {notifications.map(n => (
        <div key={n.id} className={`toast toast-${n.type}`}>
          <span className="toast-icon">
            {n.type === 'success' ? '✓' : n.type === 'error' ? '✕' : n.type === 'warning' ? '⚠' : 'ℹ'}
          </span>
          <span className="toast-message">{n.message}</span>
          <button className="toast-close" onClick={() => removeNotification(n.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
