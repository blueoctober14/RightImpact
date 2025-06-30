import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import api from '../services/api';
import { isAxiosError } from 'axios';

type User = {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone_number?: string;
  token: string;
  max_neighbor_messages?: number;
};

type AuthContextData = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStoragedData = async () => {
      try {
        const storagedUser = await AsyncStorage.getItem('user');
        const storagedToken = await AsyncStorage.getItem('token');

        if (storagedUser && storagedToken) {
          setUser(JSON.parse(storagedUser));
          // Here you would typically set the auth token for your API requests
          // api.defaults.headers.Authorization = `Bearer ${storagedToken}`;
        }
      } catch (error) {
        console.error('Failed to load user data', error);
      } finally {
        setLoading(false);
      }
    };

    loadStoragedData();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      // Use raw email (trim only, do not lowercase)
      const trimmedEmail = email.trim();

      // Call the backend login endpoint
      const params = new URLSearchParams();
      params.append('username', trimmedEmail);
      params.append('password', password);
      params.append('grant_type', 'password'); // Required by FastAPI OAuth2PasswordRequestForm

      console.log('LOGIN DEBUG: Sending login request with:');
      console.log('username:', trimmedEmail);
      console.log('password:', password);
      console.log('Payload:', params.toString());
      console.log('Headers:', { 'Content-Type': 'application/x-www-form-urlencoded' });
      
      const response = await api.post('/api/auth/token', params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
      });
      
      const { access_token } = response.data;
      
      // Get user profile
      const userResponse = await api.get('/api/users/me', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });
      
      const userData = {
        ...userResponse.data,
        token: access_token,
      };

      setUser(userData);
      
      await AsyncStorage.multiSet([
        ['user', JSON.stringify(userData)],
        ['token', access_token],
      ]);
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        console.error('Login error:', error.response.status, error.response.data);
        try {
          if (typeof error.response.data === 'object' && error.response.data !== null) {
            Object.entries(error.response.data).forEach(([k, v]) => {
              console.error(`Backend error field: ${k}:`, v);
            });
          }
          console.error('Full error object:', JSON.stringify(error.response.data));
        } catch (e) {
          console.error('Error stringifying error.response.data:', e);
        }
      } else {
        try {
          console.error('Login error:', JSON.stringify(error));
        } catch (e) {
          console.error('Login error (non-serializable):', error);
        }
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };



  const logout = async () => {
    try {
      setLoading(true);
      
      // Here you would typically clear the auth token from your API
      // delete api.defaults.headers.Authorization;
      
      await AsyncStorage.multiRemove(['user', 'token', 'token_type']);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
