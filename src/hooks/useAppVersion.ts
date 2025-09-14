import { useEffect, useRef } from "react";

export function useAppVersion(onNew: (v: string) => void, intervalMs = 60000) {
  const current = useRef<string | null>(null);
  
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const checkVersion = async () => {
      try {
        const response = await fetch('/version.json', { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) return;
        
        const { version } = await response.json();
        
        if (current.current === null) {
          current.current = version;
        } else if (version && version !== current.current) {
          onNew(version);
        }
      } catch (error) {
        // Silently handle fetch errors
      }
      
      timeout = setTimeout(checkVersion, intervalMs);
    };
    
    checkVersion();
    
    return () => clearTimeout(timeout);
  }, [onNew, intervalMs]);
}