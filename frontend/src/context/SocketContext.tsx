import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL && !import.meta.env.VITE_SOCKET_URL.includes('localhost')) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${host}:5000`;
};

const SOCKET_URL = getSocketUrl();

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  reconnectEpoch: number;
  activeProjectId: string | null;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectEpoch, setReconnectEpoch] = useState(0);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const activeProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);

  useEffect(() => {
    if (isAuthenticated && token) {
      const newSocket = io(SOCKET_URL, {
        auth: { token },
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        transports: ['websocket', 'polling'],
      });

      let hasConnectedOnce = false;

      newSocket.on('connect', () => {
        setIsConnected(true);
        if (hasConnectedOnce) {
          setReconnectEpoch(prev => prev + 1);
        } else {
          hasConnectedOnce = true;
        }

        // Re-join active project room upon reconnection
        if (activeProjectIdRef.current) {
          newSocket.emit('join:project', activeProjectIdRef.current);
        }
      });

      newSocket.on('disconnect', () => {
        setIsConnected(false);
      });

      newSocket.on('connect_error', (err) => {
        console.warn('Socket connection error:', err.message);
        setIsConnected(false);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
        setSocket(null);
        setIsConnected(false);
      };
    } else {
      setSocket((prev) => {
        if (prev) prev.disconnect();
        return null;
      });
      setIsConnected(false);
      setActiveProjectId(null);
    }
  }, [isAuthenticated, token]);

  const socketRef = useRef<Socket | null>(null);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  const joinProject = React.useCallback((projectId: string) => {
    if (!projectId) return;
    setActiveProjectId(projectId);
    activeProjectIdRef.current = projectId;
    socketRef.current?.emit('join:project', projectId);
  }, []);

  const leaveProject = React.useCallback((projectId: string) => {
    setActiveProjectId((prev) => {
      if (prev === projectId) {
        activeProjectIdRef.current = null;
        return null;
      }
      return prev;
    });
    socketRef.current?.emit('leave:project', projectId);
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        reconnectEpoch,
        activeProjectId,
        joinProject,
        leaveProject,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};
