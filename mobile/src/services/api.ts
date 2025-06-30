import { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// Import the API instance from utils/api.js to ensure we use the same instance
import api from '../utils/api';

// Log that we're using the imported API instance
console.log('Using API instance from utils/api.js');

// Add additional debug logging for API calls
const originalRequestInterceptor = api.interceptors.request.use(
  async (config) => {
    console.log('Debug - API Request:', config.method?.toUpperCase(), config.url);
    console.log('Debug - Request headers:', JSON.stringify(config.headers));
    
    if (config.data) {
      try {
        if (typeof config.data === 'string') {
          console.log('Debug - Request body (string):', config.data);
        } else if (config.data instanceof URLSearchParams) {
          console.log('Debug - Request body (URLSearchParams):', config.data.toString());
        } else {
          console.log('Debug - Request body (object):', JSON.stringify(config.data));
        }
      } catch (e) {
        console.log('Debug - Could not stringify request body:', e);
      }
    }
    return config;
  }
);

// Add additional debug logging for API responses
const originalResponseInterceptor = api.interceptors.response.use(
  (response) => {
    console.log('Debug - API Response:', response.status, response.config.url);
    return response;
  },
  (error: AxiosError) => {
    console.error('Debug - API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);


/**
 * Fetch messages with matched contacts for the logged-in user
 * Returns: Array<{ message_id, message_name, message_type, content, media_url, status, matched_contacts: [...] }>
 */
export const fetchUserMessagesWithMatches = async () => {
  try {
    // Get the token directly for debugging
    const token = await AsyncStorage.getItem('token');
    console.log(`Token available for fetchUserMessagesWithMatches: ${!!token}`);
    if (token) {
      console.log('Token value (first 10 chars):', token.substring(0, 10) + '...');
    } else {
      console.log('No token available - authentication will fail');
      // Return mock data if no token
      return getMockMessages();
    }
    
    console.log('Attempting to fetch user messages');
    
    // Try a direct fetch call as an alternative approach
    try {
      console.log('Attempting direct fetch call with explicit headers');
      
      const response = await fetch(`${api.defaults.baseURL}/api/message-templates/user-messages`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });
      
      if (response.ok) {
        console.log('Direct fetch call succeeded:', response.status);
        const data = await response.json();
        return data;
      } else {
        console.log('Direct fetch call failed:', response.status);
        // Fall back to axios if fetch fails
        throw new Error(`Fetch failed with status ${response.status}`);
      }
    } catch (fetchError) {
      console.log('Fetch approach failed, trying axios:', fetchError);
      
      // Fall back to axios approach
      const response = await api.get('/api/message-templates/user-messages');
      
      console.log('Fetch messages response status:', response.status);
      return response.data;
    }
  } catch (error: any) {
    console.error('Failed to fetch user messages with matches:', error);
    
    // Always return mock data on error to allow testing
    console.log('Error occurred, returning mock data for testing');
    return getMockMessages();
  }
};

// Helper function to get mock messages for testing
const getMockMessages = () => {
  return [
    {
      message_id: 'mock-message-1',
      message_name: 'Mock Message 1',
      message_type: 'text',
      content: 'This is a mock message for testing. The app is in offline mode due to authentication issues.',
      media_url: null,
      status: 'active',
      matched_contacts: [
        {
          id: 'mock-contact-1',
          name: 'Test Contact 1',
          phone: '555-123-4567'
        },
        {
          id: 'mock-contact-2',
          name: 'Test Contact 2',
          phone: '555-987-6543'
        }
      ]
    }
  ];
};

/**
 * Verify the current token with the backend
 * This is a debug function to help diagnose authentication issues
 */
export const verifyToken = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      console.error('[API] No token available to verify');
      return { valid: false, error: 'No token found' };
    }
    
    console.log('[API] Verifying token with backend...');
    console.log('[API] Token first 20 chars:', token.substring(0, 20) + '...');
    
    // Try to decode the token locally to check its structure
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error('[API] Token does not have valid JWT structure (should have 3 parts)');
      } else {
        // Decode the payload (middle part)
        const payload = JSON.parse(atob(parts[1]));
        console.log('[API] Token payload:', payload);
        console.log('[API] Token expiration:', new Date(payload.exp * 1000).toISOString());
        console.log('[API] Token issued at:', new Date(payload.iat * 1000).toISOString());
        console.log('[API] Token audience:', payload.aud);
        console.log('[API] Token issuer:', payload.iss);
        console.log('[API] Token subject:', payload.sub);
        
        // Check if token is expired
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
          console.error('[API] Token is expired!', { expiry: payload.exp, now });
        } else {
          console.log('[API] Token is not expired', { expiry: payload.exp, now });
        }
      }
    } catch (e) {
      console.error('[API] Failed to decode token locally:', e);
    }
    
    // Make a call to the backend to verify the token
    try {
      const response = await api.get('/api/auth/verify-token');
      console.log('[API] Token verification successful:', response.data);
      return { valid: true, data: response.data };
    } catch (error: any) {
      console.error('[API] Token verification failed:', error.response?.data || error.message);
      return { 
        valid: false, 
        error: error.response?.data?.detail || error.message,
        status: error.response?.status
      };
    }
  } catch (error: any) {
    console.error('[API] Error verifying token:', error);
    return { valid: false, error: error.message };
  }
};

/**
 * Make a direct API call bypassing all interceptors
 * This is a debug function to help diagnose authentication issues
 */
export const makeDirectApiCall = async (endpoint: string, method: 'GET' | 'POST', data?: any, token?: string) => {
  try {
    // Get token if not provided
    const authToken = token || await AsyncStorage.getItem('token');
    if (!authToken) {
      console.error('[DIRECT API] No token available');
      return { success: false, error: 'No token found' };
    }
    
    // Clean the token by removing any existing Bearer prefix
    const cleanToken = authToken.replace(/^Bearer\s+/i, '');
    const formattedToken = `Bearer ${cleanToken}`;
    
    console.log('[DIRECT API] Making direct API call to:', endpoint);
    console.log('[DIRECT API] Method:', method);
    console.log('[DIRECT API] Token first 20 chars:', formattedToken.substring(0, 20) + '...');
    
    const baseURL = api.defaults.baseURL || 'https://api.RightImpact.com';
    const url = `${baseURL}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': formattedToken,
        'ngrok-skip-browser-warning': 'true'
      },
      body: method === 'POST' ? JSON.stringify(data) : undefined
    };
    
    console.log('[DIRECT API] Request URL:', url);
    console.log('[DIRECT API] Request options:', JSON.stringify(options, null, 2));
    
    const response = await fetch(url, options);
    
    console.log('[DIRECT API] Response status:', response.status);
    
    let responseData;
    const responseText = await response.text();
    
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      responseData = { raw: responseText };
    }
    
    if (response.ok) {
      console.log('[DIRECT API] Success response:', responseData);
      return { success: true, data: responseData };
    } else {
      console.error('[DIRECT API] Error response:', responseData);
      return { 
        success: false, 
        error: responseData?.detail || 'API call failed', 
        status: response.status,
        data: responseData
      };
    }
  } catch (error: any) {
    console.error('[DIRECT API] Exception:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Mark a message as sent to a specific contact
 * @param messageId - The ID of the message template
 * @param contactId - The ID of the shared contact
 * @returns Promise with the response data
 */
export const markMessageAsSent = async (messageId: string, contactId: string, token?: string) => {
  if (!messageId || !contactId) {
    console.error('markMessageAsSent: messageId and contactId are required');
    return { success: false, error: 'Message ID and Contact ID are required' };
  }

  try {
    // Get token if not provided
    const authToken = token || await AsyncStorage.getItem('token');
    if (!authToken) {
      return { success: false, error: 'No authentication token found' };
    }

    // Ensure proper Bearer format
    const formattedToken = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;

    console.log('Marking message as sent with token:', formattedToken.substring(0, 20) + '...');
    
    const response = await api.post(
      '/api/sent_messages',
      { message_template_id: messageId, shared_contact_id: contactId },
      {
        headers: {
          Authorization: formattedToken
        }
      }
    );

    return { 
      success: true, 
      data: response.data,
      messageId,
      contactId
    };
  } catch (error: any) {
    console.error('Error in markMessageAsSent:', error);
    return {
      success: false,
      error: error.response?.data?.detail || error.message || 'Failed to mark message as sent'
    };
  }
};

export default api;
