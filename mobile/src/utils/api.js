import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_URL = 'http://192.168.86.37:8000'; // Update this with your backend URL
//const API_URL = 'https://9a1f-24-32-92-98.ngrok-free.app';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true', // For ngrok compatibility
    },
    // Disable withCredentials for ngrok compatibility
    withCredentials: false,
});

// Add a request interceptor to add the auth token
api.interceptors.request.use(
    async (config) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (token) {
                // Remove any existing Bearer prefix and add a clean one
                const cleanToken = token.replace(/^Bearer\s+/i, '');
                config.headers.Authorization = `Bearer ${cleanToken}`;
                console.log('[API] Attaching Authorization header:', config.headers.Authorization.substring(0, 20) + '...');
                
                console.log(`[API] ${config.method?.toUpperCase()} ${config.url} with headers:`, JSON.stringify(config.headers));
                
                if (config.data) {
                    console.log('[API] Request data:', JSON.stringify(config.data));
                }
            }
            return config;
        } catch (error) {
            console.error('[API] Error in request interceptor:', error);
            return config;
        }
    },
    (error) => {
        console.error('[API] Request error:', error);
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
    (response) => {
        console.log(`[API] Response ${response.status} from ${response.config.url}`);
        return response;
    },
    (error) => {
        if (error.response) {
            // Log detailed error information
            console.error(`[API] Error ${error.response.status} from ${error.config?.url}:`, 
                error.response.data);
                
            // Handle different error codes
            if (error.response.status === 401) {
                // Handle unauthorized access
                console.error('[API] Authentication failed - token may be invalid or expired');
                // You might want to redirect to login here
            }
            return Promise.reject(error.response.data);
        }
        console.error('[API] Network or other error:', error.message);
        return Promise.reject(error);
    }
);

export default api;
