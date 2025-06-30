import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig as InternalAxiosRequestConfigBase,
  AxiosHeaders
} from 'axios';

// Extend the InternalAxiosRequestConfig to include metadata
interface InternalAxiosRequestConfig<D = any> extends InternalAxiosRequestConfigBase<D> {
  metadata?: {
    startTime?: number;
    cacheKey?: string;
    cacheTTL?: number;
  };
}
import { apiLoadingState } from '../components/LoadingBar';

// Check if we're using ngrok
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const isNgrok = apiBaseUrl.includes('ngrok');

// Performance optimization settings
const TIMEOUT_MS = 30000; // 30 seconds timeout
const CACHE_PREFIX = 'api_cache_';
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes default cache

// Endpoints that should have longer timeouts
const LONG_TIMEOUT_ENDPOINTS = [
  '/message-templates/',
  '/users/',
  '/groups'
];

// Get appropriate timeout for an endpoint
const getTimeoutForEndpoint = (url: string): number => {
  for (const endpoint of LONG_TIMEOUT_ENDPOINTS) {
    if (url.includes(endpoint)) {
      return 45000; // 45 seconds for slow endpoints
    }
  }
  return TIMEOUT_MS;
}

// Simple in-memory request deduplication cache
const pendingRequests: Record<string, Promise<any>> = {};

// Create API instance with optimized settings
const api: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  },
  withCredentials: true,
  timeout: TIMEOUT_MS,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
});

// Configure request interceptor to set dynamic timeouts based on endpoint
api.interceptors.request.use((config) => {
  if (config.url) {
    config.timeout = getTimeoutForEndpoint(config.url);
    // Track loading state
    apiLoadingState.incrementRequests();
  }
  return config;
});

// Configure response interceptor to track completed requests
api.interceptors.response.use(
  (response) => {
    // Successful response
    apiLoadingState.decrementRequests();
    return response;
  },
  (error) => {
    // Error response
    apiLoadingState.decrementRequests();
    return Promise.reject(error);
  }
);

// Add response interceptor to handle CORS
api.interceptors.response.use(
  response => response,
  error => {
    if (error.code === 'ERR_NETWORK' && error.message.includes('CORS')) {
      return axios({
        ...error.config,
        headers: {
          ...error.config.headers,
          'Access-Control-Allow-Origin': window.location.origin,
          'Access-Control-Allow-Credentials': 'true'
        }
      });
    }
    return Promise.reject(error);
  }
);

// Cache helper functions
export const clearApiCache = (key?: string) => {
  if (typeof window === 'undefined') return;
  
  if (key) {
    localStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } else {
    // Clear all API cache entries
    Object.keys(localStorage).forEach(storageKey => {
      if (storageKey.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(storageKey);
      }
    });
  }
};

// Cache response data with TTL
export const cacheResponse = (cacheKey: string, data: any, ttl = DEFAULT_CACHE_TTL) => {
  if (typeof window === 'undefined') return;
  
  try {
    const cacheItem = {
      data,
      expiry: Date.now() + ttl
    };
    localStorage.setItem(`${CACHE_PREFIX}${cacheKey}`, JSON.stringify(cacheItem));
  } catch (error) {
    console.warn('Failed to cache API response:', error);
  }
};

// Get cached response if valid
export const getCachedResponse = (cacheKey: string) => {
  if (typeof window === 'undefined') return null;
  
  try {
    const cachedItem = localStorage.getItem(`${CACHE_PREFIX}${cacheKey}`);
    if (!cachedItem) return null;
    
    const { data, expiry } = JSON.parse(cachedItem);
    if (Date.now() > expiry) {
      // Cache expired
      localStorage.removeItem(`${CACHE_PREFIX}${cacheKey}`);
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn('Failed to retrieve cached API response:', error);
    return null;
  }
};

// Enhanced API methods with caching
export const apiGet = async <T>(url: string, config?: AxiosRequestConfig, cacheTTL?: number): Promise<T> => {
  // Generate cache key from URL and query params
  const cacheKey = `${url}${config?.params ? JSON.stringify(config.params) : ''}`;
  
  // Check if we have a cached response
  const cachedData = getCachedResponse(cacheKey);
  if (cachedData) {
    console.log(`[API Cache] Using cached data for: ${url}`);
    return cachedData;
  }
  
  // Check if there's already a pending request for this URL
  if (pendingRequests[cacheKey]) {
    console.log(`[API] Reusing pending request for: ${url}`);
    const response = await pendingRequests[cacheKey];
    return response;
  }
  
  // Start timing the request
  console.time(`api:${url}`);
  
  // Create a new request and store it in pending requests
  const requestPromise = api.get<T>(url, config)
    .then(response => {
      // Cache the response if successful
      if (response.status >= 200 && response.status < 300) {
        cacheResponse(cacheKey, response.data, cacheTTL);
      }
      console.timeEnd(`api:${url}`);
      return response.data;
    })
    .finally(() => {
      // Remove from pending requests when done
      delete pendingRequests[cacheKey];
    });
  
  // Store the promise to deduplicate concurrent requests
  pendingRequests[cacheKey] = requestPromise;
  
  return requestPromise;
};

// Request interceptor for API calls
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add request start time for performance tracking
    config.metadata = { startTime: new Date().getTime() };
    
    // Only try to get token on client side
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        if (!config.headers) {
          config.headers = new AxiosHeaders();
        }
        config.headers.set('Authorization', `Bearer ${token}`);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for API calls
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Calculate and log request duration for performance tracking
    const config = response.config as InternalAxiosRequestConfig;
    if (config.metadata?.startTime) {
      const endTime = new Date().getTime();
      const duration = endTime - config.metadata.startTime;
      
      // Log slow requests (over 1 second)
      if (duration > 1000) {
        console.warn(`[API] Slow request: ${config.method?.toUpperCase()} ${config.url} took ${duration}ms`);
      }
    }
    
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig;
    
    // Log request failures with timing information
    if (originalRequest.metadata?.startTime) {
      const endTime = new Date().getTime();
      const duration = endTime - originalRequest.metadata.startTime;
      
      console.error(
        `[API] Failed request: ${originalRequest.method?.toUpperCase()} ${originalRequest.url} took ${duration}ms - ${error.message}`
      );
    }
    
    // Handle 401 unauthorized errors
    if (error.response?.status === 401) {
      // Handle token refresh logic here if needed
    }
    
    // Return a more detailed error object
    return Promise.reject({
      ...error,
      message: (error.response?.data as any)?.detail || error.message,
      status: error.response?.status
    });
  }
);

export default api;
