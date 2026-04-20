"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  connect,
  disconnect,
  getConnectionState,
  onConnectionStateChange,
} from "@/lib/socket/client";
import type { ConnectionState } from "@/lib/socket/types";

export function useSocketConnection(userId: string, userName: string) {
  const [state, setState] = useState<ConnectionState>("disconnected");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setState(getConnectionState());

    const unsubscribe = onConnectionStateChange(() => {
      if (mountedRef.current) {
        setState(getConnectionState());
      }
    });

    connect(userId, userName);

    return () => {
      mountedRef.current = false;
      unsubscribe();
      disconnect();
    };
  }, [userId, userName]);

  const reconnect = useCallback(() => {
    connect(userId, userName);
  }, [userId, userName]);

  return { connectionState: state, reconnect };
}
