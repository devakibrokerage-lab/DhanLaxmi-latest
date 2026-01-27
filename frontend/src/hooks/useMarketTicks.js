import { io } from "socket.io-client";
import { useRef, useState, useEffect, useCallback } from "react";

export function useMarketTicks(url, opts = {}) {
  const socket = useRef(null);
  // RAW DATA STORE (0ms latency): Mutable Map to store latest ticks
  const ticksRef = useRef(new Map());
  const [isConnected, setIsConnected] = useState(false);

  // Track last subscribed instruments for instant refresh on tab return
  const lastSubscribedRef = useRef([]);
  const lastSubscriptionTypeRef = useRef('full');

  // Store opts in ref to avoid recreating socket on every render
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  // Stable subscribe function (wrapped in useCallback)
  const subscribe = useCallback(async (list, subscriptionType = 'full') => {
    // Store for instant refresh on tab visibility change
    if (list && list.length > 0) {
      lastSubscribedRef.current = list;
      lastSubscriptionTypeRef.current = subscriptionType;
    }

    if (socket.current?.connected) {
      socket.current.emit("subscribe", list, subscriptionType);
    } else {
      console.warn("[useMarketTicks] Subscribe called while socket is not connected.");
    }
  }, []);

  // Stable unsubscribe function (wrapped in useCallback)
  const unsubscribe = useCallback(async (list, subscriptionType = 'full') => {
    if (socket.current?.connected) {
      socket.current.emit("unsubscribe", list, subscriptionType);
    }
  }, []);

  // INSTANT refresh - called immediately when user returns to tab
  const refreshSubscriptions = useCallback(() => {
    if (socket.current?.connected && lastSubscribedRef.current.length > 0) {
      console.log("[useMarketTicks] INSTANT refresh on tab return");
      socket.current.emit("subscribe", lastSubscribedRef.current, lastSubscriptionTypeRef.current);
    }
  }, []);

  // Handle visibility change - INSTANT refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab is now visible - INSTANT refresh
        console.log("[useMarketTicks] Tab visible - instant refresh");

        if (!socket.current?.connected) {
          // Socket disconnected - reconnect immediately
          socket.current?.connect();
        } else {
          // Socket connected - refresh subscriptions immediately
          refreshSubscriptions();
        }
      }
    };

    // Also handle window focus for faster response
    const handleFocus = () => {
      console.log("[useMarketTicks] Window focused - instant refresh");
      if (socket.current?.connected) {
        refreshSubscriptions();
      } else {
        socket.current?.connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshSubscriptions]);

  // Effect for socket setup and cleanup
  useEffect(() => {
    console.log("[useMarketTicks] Creating socket connection...");

    const newSocket = io(url, {
      ...optsRef.current,
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      timeout: 5000,
    });
    socket.current = newSocket;

    const onConnect = () => {
      console.log("✅ market connected:", newSocket.id);
      setIsConnected(true);

      // Instant re-subscribe on reconnect
      if (lastSubscribedRef.current.length > 0) {
        console.log("[useMarketTicks] Re-subscribing after reconnect");
        newSocket.emit("subscribe", lastSubscribedRef.current, lastSubscriptionTypeRef.current);
      }
    };

    const onDisconnect = (reason) => {
      console.log("❌ market disconnected:", reason);
      setIsConnected(false);
    };

    const onMarketUpdate = (update) => {
      // Kite format: use instrument_token as key
      if (update?.instrument_token !== undefined) {
        // DIRECT MUTATION (0ms latency): Update the Ref instantly
        // No React State update = No Re-render per tick
        const key = String(update.instrument_token);
        const existing = ticksRef.current.get(key) || {};
        ticksRef.current.set(key, { ...existing, ...update });
      }
    };

    newSocket.on("connect", onConnect);
    newSocket.on("market_update", onMarketUpdate);
    newSocket.on("index_update", onMarketUpdate);
    newSocket.on("ticker_update", onMarketUpdate);
    newSocket.on("quote_update", onMarketUpdate);
    newSocket.on("oi_update", onMarketUpdate);
    newSocket.on("prev_close_update", onMarketUpdate);
    newSocket.on("market_status_update", onMarketUpdate);
    newSocket.on("disconnect", onDisconnect);

    return () => {
      console.log("[useMarketTicks] Disconnecting socket");
      newSocket.off("connect", onConnect);
      newSocket.off("market_update", onMarketUpdate);
      newSocket.off("index_update", onMarketUpdate);
      newSocket.off("ticker_update", onMarketUpdate);
      newSocket.off("quote_update", onMarketUpdate);
      newSocket.off("oi_update", onMarketUpdate);
      newSocket.off("prev_close_update", onMarketUpdate);
      newSocket.off("market_status_update", onMarketUpdate);
      newSocket.off("disconnect", onDisconnect);
      newSocket.disconnect();
      socket.current = null;
    };
  }, [url]);

  return {
    ticksRef, // Expose the Ref directly for consumers to poll
    subscribe,
    unsubscribe,
    isConnected,
    refreshSubscriptions
  };
}
