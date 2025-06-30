import React, { useState, useEffect } from 'react';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

// Track active API requests globally
let activeRequests = 0;
const requestListeners: Array<(count: number) => void> = [];

// Function to notify all listeners of request count changes
const notifyListeners = () => {
  requestListeners.forEach(listener => listener(activeRequests));
};

// API for other components to use
export const apiLoadingState = {
  incrementRequests: () => {
    activeRequests++;
    notifyListeners();
    return activeRequests;
  },
  decrementRequests: () => {
    activeRequests = Math.max(0, activeRequests - 1);
    notifyListeners();
    return activeRequests;
  },
  getActiveRequests: () => activeRequests,
  subscribe: (listener: (count: number) => void) => {
    requestListeners.push(listener);
    return () => {
      const index = requestListeners.indexOf(listener);
      if (index !== -1) {
        requestListeners.splice(index, 1);
      }
    };
  }
};

interface LoadingBarProps {
  position?: 'fixed' | 'absolute' | 'relative';
  height?: number;
  showDelay?: number; // ms to wait before showing the bar
  hideDelay?: number; // ms to wait before hiding the bar
}

const LoadingBar: React.FC<LoadingBarProps> = ({
  position = 'fixed',
  height = 4,
  showDelay = 300,
  hideDelay = 500
}) => {
  const [loading, setLoading] = useState(activeRequests > 0);
  const [visible, setVisible] = useState(activeRequests > 0);
  const theme = useTheme();

  useEffect(() => {
    // Subscribe to request count changes
    let showTimer: NodeJS.Timeout | null = null;
    let hideTimer: NodeJS.Timeout | null = null;

    const handleRequestChange = (count: number) => {
      if (count > 0) {
        // Clear any hide timer
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }

        // Set loading immediately but delay visibility for better UX
        setLoading(true);
        
        if (!visible && !showTimer) {
          showTimer = setTimeout(() => {
            setVisible(true);
            showTimer = null;
          }, showDelay);
        }
      } else {
        // Clear any show timer
        if (showTimer) {
          clearTimeout(showTimer);
          showTimer = null;
        }

        // Delay hiding for better UX
        if (visible && !hideTimer) {
          hideTimer = setTimeout(() => {
            setVisible(false);
            setLoading(false);
            hideTimer = null;
          }, hideDelay);
        }
      }
    };

    // Initial state
    handleRequestChange(activeRequests);

    // Subscribe to changes
    const unsubscribe = apiLoadingState.subscribe(handleRequestChange);

    return () => {
      unsubscribe();
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [visible, showDelay, hideDelay]);

  if (!loading) return null;

  return (
    <Box
      sx={{
        position,
        top: 0,
        left: 0,
        right: 0,
        zIndex: theme.zIndex.appBar + 1,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease-in-out',
        pointerEvents: 'none'
      }}
    >
      <LinearProgress
        color="primary"
        sx={{
          height,
          borderRadius: 0
        }}
      />
    </Box>
  );
};

export default LoadingBar;
