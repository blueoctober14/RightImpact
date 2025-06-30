import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';

export const login = async (email, password) => {
    try {
        const response = await api.post('/auth/token', {
            username: email,
            password,
        });
        
        // Store token securely
        await AsyncStorage.setItem('token', response.data.access_token);
        await AsyncStorage.setItem('token_type', response.data.token_type);
        
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const register = async (userData) => {
    try {
        const response = await api.post('/auth/register', {
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
        const response = await api.get('/auth/me');
        return response.data;
    } catch (error) {
        throw error;
    }
};
