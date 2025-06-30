import React from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Paper from '@mui/material/Paper';

interface ContentLoaderProps {
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  loadingText?: string;
  skeletonType?: 'table' | 'card' | 'text' | 'none';
  skeletonCount?: number;
  children: React.ReactNode;
}

const ContentLoader: React.FC<ContentLoaderProps> = ({
  loading,
  error,
  onRetry,
  loadingText = 'Loading content...',
  skeletonType = 'none',
  skeletonCount = 3,
  children
}) => {
  // If there's an error, show error message with retry option
  if (error) {
    return (
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          textAlign: 'center', 
          bgcolor: 'error.light', 
          color: 'error.contrastText',
          borderRadius: 1
        }}
      >
        <Typography variant="body1" gutterBottom>
          {error}
        </Typography>
        {onRetry && (
          <Box sx={{ mt: 2 }}>
            <Typography 
              variant="button" 
              component="button"
              onClick={onRetry}
              sx={{ 
                cursor: 'pointer', 
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                color: 'inherit',
                fontWeight: 'bold'
              }}
            >
              Retry
            </Typography>
          </Box>
        )}
      </Paper>
    );
  }

  // If loading, show loading indicator with optional skeleton
  if (loading) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
          <CircularProgress size={24} />
          <Typography variant="body1" sx={{ ml: 2 }}>
            {loadingText}
          </Typography>
        </Box>
        
        {skeletonType === 'table' && (
          <Box sx={{ mt: 2 }}>
            {[...Array(skeletonCount)].map((_, index) => (
              <Box key={index} sx={{ display: 'flex', mb: 1 }}>
                <Skeleton variant="rectangular" width="100%" height={40} />
              </Box>
            ))}
          </Box>
        )}
        
        {skeletonType === 'card' && (
          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {[...Array(skeletonCount)].map((_, index) => (
              <Skeleton key={index} variant="rectangular" width={280} height={180} />
            ))}
          </Box>
        )}
        
        {skeletonType === 'text' && (
          <Box sx={{ mt: 2 }}>
            {[...Array(skeletonCount)].map((_, index) => (
              <Skeleton key={index} variant="text" width="100%" height={24} sx={{ mb: 1 }} />
            ))}
          </Box>
        )}
      </Box>
    );
  }

  // If not loading and no error, show children
  return <>{children}</>;
};

export default ContentLoader;
