"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  connect,
  disconnect,
  getConnectionState,
  onConnectionStateChange,
} from "@/lib/socket/client";
import type { ConnectionState } from "@/lib/socket/types";

const SERVER_STATE: ConnectionState = "disconnected";
function subscribe(notify: () => void) {
  return onConnectionStateChange(notify);
}
function getSnapshot(): ConnectionState {
  return getConnectionState();
}
function getServerSnapshot(): ConnectionState {
  return SERVER_STATE;
}

export function useSocketConnection(userId: string, userName: string) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    connect(userId, userName);
    return () => {
      disconnect();
    };
  }, [userId, userName]);

  const reconnect = useCallback(() => {
    connect(userId, userName);
  }, [userId, userName]);

  return { connectionState: state, reconnect };
}
