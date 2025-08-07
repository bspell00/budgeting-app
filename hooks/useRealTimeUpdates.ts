import { useEffect, useCallback } from 'react';
import { mutate } from 'swr';

/**
 * Real-time updates hook using intelligent polling
 * Provides instant feedback for budget and account changes
 */
export function useRealTimeUpdates() {
  const refreshDashboard = useCallback(() => {
    // Refresh all key data sources
    mutate('/api/dashboard');
    mutate('/api/accounts');
    mutate('/api/transactions');
    mutate('/api/budgets');
  }, []);

  const refreshAfterAction = useCallback(() => {
    // Immediate refresh after user action
    setTimeout(() => {
      refreshDashboard();
    }, 100);
  }, [refreshDashboard]);

  useEffect(() => {
    // Intelligent polling - faster when user is active
    let lastActivity = Date.now();
    let interval: NodeJS.Timeout;

    const updateActivity = () => {
      lastActivity = Date.now();
    };

    const startPolling = () => {
      interval = setInterval(() => {
        const timeSinceActivity = Date.now() - lastActivity;
        
        // More frequent updates if user was recently active
        if (timeSinceActivity < 30000) { // 30 seconds
          refreshDashboard();
        }
      }, 2000); // Poll every 2 seconds when active
    };

    // Listen for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    startPolling();

    return () => {
      if (interval) clearInterval(interval);
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
    };
  }, [refreshDashboard]);

  return {
    refreshDashboard,
    refreshAfterAction
  };
}