import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => removeNotification(id), duration);
    }
    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const notify = {
    success: (msg, dur) => addNotification(msg, 'success', dur),
    error: (msg, dur) => addNotification(msg, 'error', dur),
    info: (msg, dur) => addNotification(msg, 'info', dur),
    warning: (msg, dur) => addNotification(msg, 'warning', dur),
  };

  return (
    <NotificationContext.Provider value={{ notifications, notify, removeNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotification = () => useContext(NotificationContext);
