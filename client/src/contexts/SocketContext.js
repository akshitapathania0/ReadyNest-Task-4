import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ token, children }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token) return;

    const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;
    setReady(true);

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      setConnected(true);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (e) => console.error('Socket error:', e.message));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setReady(false);
      setConnected(false);
    };
  }, [token]);

  const emit = (event, data) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('Socket not initialized, cannot emit:', event);
    }
  };

  return (
    <SocketContext.Provider value={{ socketRef, connected, ready, emit }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  return useContext(SocketContext);
}