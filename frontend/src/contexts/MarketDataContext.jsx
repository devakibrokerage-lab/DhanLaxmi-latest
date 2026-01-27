// contexts/MarketDataContext.jsx
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from 'react';
import { useMarketTicks } from '../hooks/useMarketTicks';

const MarketDataContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const MarketDataProvider = ({ children }) => {
  const [token] = React.useState(() => 
    (typeof window !== "undefined" && localStorage.getItem("token")) || null
  );
  
  const socketOpts = React.useMemo(() => ({
    auth: token ? { token } : undefined,
    withCredentials: true,
  }), [token]);

  // Get the API URL from environment variables
  const socketUrl = React.useMemo(() => {
    const apiUrl = import.meta.env.VITE_REACT_APP_API_URL || 'http://localhost:8080';
    return `${apiUrl}/market`;
  }, []);

  // Single shared socket connection for the entire app
  const marketData = useMarketTicks(socketUrl, socketOpts);

  return (
    <MarketDataContext.Provider value={marketData}>
      {children}
    </MarketDataContext.Provider>
  );
};

export const useMarketData = () => {
  const context = useContext(MarketDataContext);
  if (!context) {
    throw new Error('useMarketData must be used within MarketDataProvider');
  }
  return context;
};

