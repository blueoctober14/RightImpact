import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/router';
import axios, { AxiosError } from 'axios';

// Base API URL from environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
// Check if we're using ngrok to adjust CORS settings
const isNgrok = API_BASE_URL.includes('ngrok');

// For ngrok, we need to ensure we're handling CORS correctly
// We'll use Authorization header for all requests

// User interface representing authenticated user data
interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

// Authentication context interface
interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

// Create the context with undefined default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Helper to parse JWT token
  const parseJwt = useCallback((token: string) => {
    try {
      if (!token) {
        console.warn('No token provided to parseJwt');
        return null;
      }
      
      // For JWT format: header.payload.signature
      const base64Url = token.split('.')[1];
      if (!base64Url) {
        console.warn('Invalid JWT format');
        return null;
      }
      
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error parsing JWT:', error);
      return null;
    }
  }, []);

  // Initialize authentication state from token
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check for token in localStorage
        const token = localStorage.getItem('token');
        if (!token) {
          console.log('No token found, clearing auth state');
          setUser(null);
          setLoading(false);
          return;
        }
        
        // Decode token to get basic user info
        const decodedToken = parseJwt(token);
        console.log('Token to verify - first 10 chars:', token.substring(0, 10) + '...');
        console.log('Decoded token payload:', decodedToken);
        
        if (!decodedToken) {
          console.log('Invalid token format, clearing auth state');
          localStorage.removeItem('token');
          setUser(null);
          setLoading(false);
          return;
        }
        
        // Check if token is expired
        if (decodedToken.exp && decodedToken.exp * 1000 < Date.now()) {
          console.log('Token expired, clearing auth state');
          localStorage.removeItem('token');
          setUser(null);
          setLoading(false);
          return;
        }
        
        console.log('Verifying token with backend');
        
        try {
          // Make the verification request to the custom endpoint
          console.log('Making verification request to:', `${API_BASE_URL}/auth/verify-token-custom`);
          const response = await axios.get(`${API_BASE_URL}/auth/verify-token-custom`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'ngrok-skip-browser-warning': 'true'
            },
            withCredentials: false
          });
          
          console.log('Verification response:', response.status, response.statusText);
          console.log('Response data:', response.data);
          
          if (response.data && response.data.valid && response.data.user) {
            console.log('Token verified successfully:', response.data.user);
            setUser(response.data.user);
            
            // Redirect from login page if already authenticated
            if (router.pathname === '/login') {
              const redirectTo = router.query.redirect || '/';
              router.push(Array.isArray(redirectTo) ? redirectTo[0] : redirectTo);
            }
          } else {
            // Token is invalid
            console.log('Token invalid, clearing auth state');
            localStorage.removeItem('token');
            setUser(null);
            
            // Redirect to login if on a protected page
            if (router.pathname !== '/login' && router.pathname !== '/unauthorized') {
              console.log(`Redirecting from ${router.pathname} to login (invalid token)`);
              router.push(`/login?redirect=${encodeURIComponent(router.asPath)}`);
            }
          }
        } catch (error) {
          console.error('Token verification error:', error);
          
          // If we get a 401, the token is invalid/expired
          if (axios.isAxiosError(error) && error.response?.status === 401) {
            console.log('Token unauthorized (401), clearing auth state');
            localStorage.removeItem('token');
            setUser(null);
            
            // Redirect to login if on a protected page
            if (router.pathname !== '/login' && router.pathname !== '/unauthorized') {
              console.log(`Redirecting from ${router.pathname} to login (unauthorized token)`);
              router.push(`/login?redirect=${encodeURIComponent(router.asPath)}`);
            }
          } else {
            // For other errors, we might have connectivity issues - don't log out the user yet
            console.warn('Network error during token verification - will retry on next page load');
            
            // Try to use the decoded token data to set the user temporarily
            if (decodedToken && decodedToken.sub) {
              const tempUser = {
                id: parseInt(decodedToken.sub) || 0,
                email: decodedToken.email || '',
                first_name: decodedToken.first_name || '',
                last_name: decodedToken.last_name || '',
                role: decodedToken.role || 'user',
                isAdmin: decodedToken.role === 'admin'
              };
              setUser(tempUser);
            }
          }
        }
      } catch (error) {
        console.error('Authentication error:', error);
        localStorage.removeItem('token');
        setUser(null);
        setError('Authentication failed');
        
        // Redirect to login if on a protected page
        if (router.pathname !== '/login' && router.pathname !== '/unauthorized') {
          console.log(`Redirecting from ${router.pathname} to login (auth error)`);
          router.push(`/login?redirect=${encodeURIComponent(router.asPath)}`);
        }
      } finally {
        setLoading(false);
      }
    };
    
    initializeAuth();
  }, [parseJwt, router]);

  // Handle login
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      
      console.time('login');

      // Create form data for login
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      console.log(`Sending login request to: ${API_BASE_URL}/auth/token`);
      
      // Set timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
      
      const response = await axios.post(
        `${API_BASE_URL}/auth/token`,
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'ngrok-skip-browser-warning': 'true'
          },
          // Don't use withCredentials for ngrok to avoid CORS issues
          withCredentials: false,
          signal: controller.signal,
          timeout: 20000 // 20 second timeout
        }
      );
      
      clearTimeout(timeoutId);

      console.log('Login response received');
      console.timeEnd('login');
      
      if (response.data && response.data.access_token) {
        const token = response.data.access_token;
        console.log(`Storing token in localStorage, first 10 chars: ${token.substring(0, 10)}...`);
        localStorage.setItem('token', token);

        // Get user data from token
        const userData = response.data.user;
        console.log('User data from login:', userData);
        setUser(userData);
        
        // Skip immediate verification and trust the token from login
        // This speeds up the login process significantly
        
        // Redirect to home or requested page
        const redirectTo = router.query.redirect || '/';
        router.push(Array.isArray(redirectTo) ? redirectTo[0] : redirectTo);
        
        // Verify the token in the background without blocking the UI
        setTimeout(() => {
          axios.get(`${API_BASE_URL}/auth/verify-token-custom`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'ngrok-skip-browser-warning': 'true'
            },
            withCredentials: false,
            timeout: 10000 // 10 second timeout
          }).then(verifyResponse => {
            console.log('Background token verification:', verifyResponse.data);
            if (!verifyResponse.data?.valid) {
              console.warn('Token verification failed in background');
            }
          }).catch(err => {
            console.warn('Background token verification error:', err);
          });
        }, 100);
        
        return true;
      } else {
        console.error('No token in response:', response.data);
        setError('Invalid login response');
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      localStorage.removeItem('token');
      setUser(null);
      
      if (axios.isAxiosError(error)) {
        const axiosError = error;
        if (axiosError.name === 'AbortError' || axiosError.code === 'ECONNABORTED') {
          setError('Login request timed out. Please try again.');
        } else if (axiosError.response?.status === 401) {
          setError('Invalid email or password');
        } else if (axiosError.response?.data) {
          setError(JSON.stringify(axiosError.response.data) || 'Login failed');
        } else {
          setError('Login failed: ' + axiosError.message);
        }
      } else {
        setError('Login failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Handle logout
  const logout = useCallback(async () => {
    try {
      console.log('Logging out user');
      setLoading(true);
      
      // Clear authentication state
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      
      // Reset auth context state
      setUser(null);
      setError(null);
      
      // Force reload to clear any cached state
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      setError('Logout failed');
      
      // Even if there's an error, try to clear state and redirect
      localStorage.removeItem('token');
      setUser(null);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Computed properties
  const isAuthenticated = !!user;
  const isAdmin = isAuthenticated && user?.role === 'admin';

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        loading, 
        error,
        login, 
        logout, 
        isAuthenticated, 
        isAdmin 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
