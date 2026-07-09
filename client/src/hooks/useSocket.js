import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || '';

export function useSocket(token) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [tick, setTick] = useState(0); // forces re-render when socket ready

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;
    setTick(t => t + 1); // notify consumers socket is ready

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setConnected(true);
    });
    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnected(false);
    });
    socket.on('connect_error', (err) => {
      console.error('Socket error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
  }, [tick]); // eslint-disable-line

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  // Return the ref's current value directly — always up to date
  return { socket: socketRef.current, connected, emit, on, off };
}