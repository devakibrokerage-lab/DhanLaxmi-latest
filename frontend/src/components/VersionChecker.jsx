// VersionChecker.jsx
// This component checks for new app versions and forces reload when needed
import { useEffect, useRef, useState } from 'react';

const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const CURRENT_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null;

export function VersionChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const checkIntervalRef = useRef(null);

  const checkForUpdates = async () => {
    try {
      const apiUrl = import.meta.env.VITE_REACT_APP_API_URL || '';
      const response = await fetch(`${apiUrl}/api/version?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (response.ok) {
        const data = await response.json();
        const serverVersion = data.version;
        
        console.log(`[VersionChecker] Current: ${CURRENT_VERSION}, Server: ${serverVersion}`);
        
        if (serverVersion && serverVersion !== CURRENT_VERSION) {
          console.log('[VersionChecker] New version available!');
          setUpdateAvailable(true);
        }
      }
    } catch (err) {
      // Silent fail - don't disrupt user experience
      console.log('[VersionChecker] Check failed:', err.message);
    }
  };

  const forceUpdate = () => {
    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    
    // Clear localStorage version flag
    localStorage.setItem('app_version', '');
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Force hard reload (bypass cache)
    window.location.reload(true);
  };

  useEffect(() => {
    // Store current version
    const storedVersion = localStorage.getItem('app_version');
    
    // If version changed since last visit, clear caches
    if (storedVersion && storedVersion !== CURRENT_VERSION) {
      console.log(`[VersionChecker] Version changed from ${storedVersion} to ${CURRENT_VERSION}`);
      // Clear sessionStorage caches
      sessionStorage.removeItem('watchlist_cache');
      sessionStorage.removeItem('watchlist_cache_time');
      sessionStorage.removeItem('indexes_cache');
      // Clear any search caches
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('search_')) {
          sessionStorage.removeItem(key);
        }
      });
    }
    
    // Update stored version
    localStorage.setItem('app_version', CURRENT_VERSION);
    
    // Check for updates on mount
    checkForUpdates();
    
    // Set up periodic checks
    checkIntervalRef.current = setInterval(checkForUpdates, CHECK_INTERVAL);
    
    // Also check when tab becomes visible
    const handleVisibility = () => {
      if (!document.hidden) {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div 
      className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[9999] 
        bg-gradient-to-r from-indigo-600 to-purple-600 text-white 
        px-6 py-3 rounded-full shadow-2xl flex items-center gap-4
        animate-bounce"
      style={{ animation: 'bounce 2s ease-in-out infinite' }}
    >
      <span className="text-sm font-medium">🚀 New version available!</span>
      <button 
        onClick={forceUpdate}
        className="bg-white text-indigo-600 px-4 py-1 rounded-full text-sm font-bold
          hover:bg-indigo-100 transition-colors"
      >
        Update Now
      </button>
    </div>
  );
}

// Export version info for debugging
export const getVersionInfo = () => ({
  version: CURRENT_VERSION,
  buildTime: BUILD_TIME,
});

export default VersionChecker;
