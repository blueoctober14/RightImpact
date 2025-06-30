import createCache from '@emotion/cache';

export default function createEmotionCache() {
  // Create a consistent cache key for both server and client
  const key = 'css';
  
  // Only try to find the insertion point on the client side
  if (typeof document !== 'undefined') {
    // Find the insertion point for MUI styles
    const emotionInsertionPoint = document.querySelector<HTMLMetaElement>(
      'meta[name="emotion-insertion-point"]'
    );
    
    // Return cache with insertion point if found
    return createCache({
      key,
      insertionPoint: emotionInsertionPoint ?? undefined,
      // Enable speedy mode in production for better performance
      speedy: process.env.NODE_ENV === 'production',
    });
  }
  
  // For server-side rendering, just return the cache without insertion point
  return createCache({ key });
}
