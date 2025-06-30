import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

type User = {
  id: string;
  name: string;
  email: string;
  token: string;
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
        const storagedUser = await AsyncStorage.getItem('@RightImpact:user');
        const storagedToken = await AsyncStorage.getItem('@RightImpact:token');

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
      
      // Replace with your actual API call
      // const response = await api.post('/auth/login', { email, password });
      // const { user: userData, token } = response.data;
      
      // Mock response for now
      const token = 'mock-token';
      const userData = {
        id: '1',
        name: 'Test User',
        email,
        token, // Include the token in the user object
      };

      setUser(userData);
      
      // Here you would typically set the auth token for your API requests
      // api.defaults.headers.Authorization = `Bearer ${token}`;
      
      await AsyncStorage.multiSet([
        ['@RightImpact:user', JSON.stringify(userData)],
        ['@RightImpact:token', token],
      ]);
    } catch (error) {
      console.error('Login error:', error);
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
      
      await AsyncStorage.multiRemove(['@RightImpact:user', '@RightImpact:token']);
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
