import { io, Socket } from 'socket.io-client';

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';

let socketInstance: Socket | null = null;

/**
 * Returns a singleton Socket.io client for the deployments namespace.
 */
export function getSocket(token: string): Socket {
  if (!socketInstance) {
    socketInstance = io(`${WS_BASE_URL}/deployments`, {
      auth: { token },
      autoConnect: false,
    });
  } else {
    socketInstance.auth = { token };
  }

  return socketInstance;
}

/**
 * Disconnects and clears the singleton socket instance.
 */
export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
