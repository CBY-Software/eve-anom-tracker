import { useEffect } from 'react';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';

/**
 * Custom hook to register a global hotkey for the application.
 * In Tauri v2, global shortcuts are handled via the global-shortcut plugin.
 * 
 * @param callback The function to execute when the hotkey is triggered.
 */
export const useGlobalHotkeys = (callback: () => void, shortcut: string) => {
  useEffect(() => {
    let isMounted = true;

    const setupShortcut = async () => {
      try {
        // Ensure everything is clean before registering
        await unregisterAll();
        
        // Register the global shortcut
        await register(shortcut, (event) => {
          if (event.state === 'Pressed') {
            callback();
          }
        });
        
        console.log('Global shortcut CommandOrControl+Shift+L registered');
      } catch (error) {
        console.error('Failed to register global shortcut:', error);
      }
    };

    setupShortcut();

    return () => {
      isMounted = false;
      const cleanup = async () => {
        try {
          await unregisterAll();
          console.log('Global shortcuts unregistered');
        } catch (error) {
          console.error('Failed to unregister global shortcuts:', error);
        }
      };
      
      cleanup();
    };
  }, [callback, shortcut]);
};
