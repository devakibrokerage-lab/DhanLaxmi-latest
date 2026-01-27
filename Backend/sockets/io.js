// sockets/io.js
import { Server } from "socket.io";
import { config } from "../config.js";
import { getFeedInstance } from "../services/feedState.js";

let ioInstance = null;
let feedSubscriber = null;
let feedUnsubscriber = null;

// Track which tokens each socket has subscribed to
const socketSubscriptions = new Map(); // socketId -> Set<token>

export function setFeedSubscriber(fn) { feedSubscriber = fn; }
export function setFeedUnsubscriber(fn) { feedUnsubscriber = fn; }

export function getIO() {
  if (!ioInstance) {
    throw new Error("Socket.IO has not been initialized!");
  }
  return ioInstance;
}

export function createIO(server) {
  // --- CORS SETUP (UPDATED) ---
  const defaultOrigins = [
    "http://localhost:5173",       // Local Vite frontend
    "http://127.0.0.1:5173",       // Local IP
    "https://devakibrokerage.in"  // Render frontend
  ];

  const configOrigins = (config.origin || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  // Merge default and config origins
  const allOrigins = [...defaultOrigins, ...configOrigins];

  const io = new Server(server, {
    path: "/socket.io",
    cors: {
      origin: allOrigins,
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"]
    },
    transports: ["websocket", "polling"],
  });
  // ---------------------------

  ioInstance = io;

  const market = io.of("/market");

  market.on("connection", (socket) => {
    console.log("📡 Market client connected:", socket.id);

    // Initialize subscription tracking for this socket
    socketSubscriptions.set(socket.id, new Set());

    socket.on("subscribe", (list, subscriptionType = 'full') => {
      if (feedSubscriber) feedSubscriber(list, subscriptionType);

      // Get feed instance to send cached data to new socket
      const feed = getFeedInstance();

      for (const it of list || []) {
        // Use instrument_token for room names (Kite format)
        const token = String(it.instrument_token);
        const room = `sec:${token}`;

        // Track this socket's subscription
        socketSubscriptions.get(socket.id)?.add(token);

        // Join the room
        socket.join(room);

        // INSTANT DATA: Send cached data to this socket immediately
        // This ensures new/refreshed sockets get data without waiting for next tick
        if (feed?.last?.has(token)) {
          const cachedData = feed.last.get(token);
          if (cachedData && cachedData.ltp != null) {
            socket.emit("market_update", cachedData);
          }
        }
      }
    });

    socket.on("unsubscribe", (list) => {
      for (const it of list || []) {
        // Use instrument_token for room names (Kite format)
        const token = String(it.instrument_token);
        const room = `sec:${token}`;

        // Remove from socket's subscription tracking
        socketSubscriptions.get(socket.id)?.delete(token);

        // Leave the room
        socket.leave(room);

        // Check if room is now empty - if so, unsubscribe from Kite
        // Use setImmediate to ensure socket.leave() has completed
        setImmediate(() => {
          const roomSockets = market.adapter.rooms.get(room);
          if (!roomSockets || roomSockets.size === 0) {
            console.log(`[io.js] Room ${room} is empty, unsubscribing from Kite`);
            if (feedUnsubscriber) {
              feedUnsubscriber([{ instrument_token: token }]);
            }
          }
        });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ socket disconnected:", socket.id, reason);

      // Get tokens this socket was subscribed to
      const tokens = socketSubscriptions.get(socket.id) || new Set();
      socketSubscriptions.delete(socket.id);

      if (tokens.size === 0) return;

      // Check each room - if empty after this disconnect, unsubscribe from Kite
      // Use setImmediate to ensure socket has fully left all rooms
      setImmediate(() => {
        for (const token of tokens) {
          const room = `sec:${token}`;
          const roomSockets = market.adapter.rooms.get(room);

          if (!roomSockets || roomSockets.size === 0) {
            console.log(`[io.js] Room ${room} is empty after disconnect, unsubscribing from Kite`);
            if (feedUnsubscriber) {
              feedUnsubscriber([{ instrument_token: token }]);
            }
          }
        }
      });
    });
  });

  return { io, market };
}