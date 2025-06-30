import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';

export const login = async (email, password) => {
    try {
        // Use application/x-www-form-urlencoded
        const params = new URLSearchParams();
        params.append('username', email);
        params.append('password', password);
        params.append('grant_type', 'password');

        console.log('[AUTH] Attempting login for:', email);
        
        const response = await api.post('/api/auth/token', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        
        console.log('[AUTH] Login successful, token received');
        console.log('[AUTH] Token type:', response.data.token_type);
        console.log('[AUTH] Token first 20 chars:', response.data.access_token.substring(0, 20) + '...');
        
        // Check if the token is properly formatted
        if (!response.data.access_token.startsWith('eyJ')) {
            console.warn('[AUTH] WARNING: Token does not start with expected JWT format');
        }
        
        // Store token securely
        await AsyncStorage.setItem('token', response.data.access_token);
        await AsyncStorage.setItem('token_type', response.data.token_type);
        
        // Verify token was stored correctly
        const storedToken = await AsyncStorage.getItem('token');
        console.log('[AUTH] Verified token stored correctly:', 
            storedToken === response.data.access_token ? 'Yes' : 'No');
        
        return response.data;
    } catch (error) {
        if (error.response) {
            console.error('[AUTH] Login API error:', error.response.status, error.response.data);
            
            // Log detailed error information
            if (error.response.data) {
                try {
                    console.error('[AUTH] Error details:', JSON.stringify(error.response.data));
                } catch (e) {
                    console.error('[AUTH] Error details (non-serializable):', error.response.data);
                }
            }
        } else {
            console.error('[AUTH] Login unknown error:', error);
        }
        throw error;
    }
};

export const register = async (userData) => {
    try {
        const response = await api.post('/api/auth/register', {
            email: userData.email,
            password: userData.password,
            first_name: userData.firstName,
            last_name: userData.lastName,
            city: userData.city,
            state: userData.state,
            zip_code: userData.zipCode,
        });
        
        // Store token securely
        await AsyncStorage.setItem('token', response.data.access_token);
        await AsyncStorage.setItem('token_type', response.data.token_type);
        
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const logout = async () => {
    try {
        // Clear token
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('token_type');
        
        // Clear any other user data if needed
        await AsyncStorage.clear();
        
        return true;
    } catch (error) {
        throw error;
    }
};

export const isAuthenticated = async () => {
    try {
        const token = await AsyncStorage.getItem('token');
        return !!token;
    } catch (error) {
        return false;
    }
};

export const getCurrentUser = async () => {
    try {
        const response = await api.get('/api/auth/me');
        console.log('[AUTH] Current user response:', response.data);
        return response.data;
    } catch (error) {
        console.error('[AUTH] Error getting current user:', error);
        throw error;
    }
};
