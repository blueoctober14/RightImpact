import api from './api';
import { Group, User } from '../types';

// Re-export the Group interface for use in other files
export * from './groups';

export type UserRole = 'admin' | 'user';

export interface CreateUserData {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  role?: UserRole;
  is_active?: boolean;
  city?: string;
  state?: string;
  zip_code?: string;
  max_neighbor_messages?: number | null;
}

export interface UpdateUserData extends Partial<Omit<CreateUserData, 'email' | 'password'>> {
  email?: string;
  password?: string;
  role?: UserRole;
  is_active?: boolean;
}

export const getUsers = async (): Promise<User[]> => {
  try {
    const response = await api.get('/users/', { params: {} });
    return response.data.map((user: any) => ({
      ...user,
      role: user.role || 'user',
      is_active: user.is_active !== undefined ? user.is_active : true,
      has_shared_contacts: user.has_shared_contacts ?? false,
      max_neighbor_messages: user.max_neighbor_messages ?? null,
      groups: user.groups || []
    }));
  } catch (error) {
    console.error('Error fetching users:', error);
    throw new Error('Failed to load users');
  }
};

export const getUser = async (id: number): Promise<User | null> => {
  try {
    const response = await api.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching user ${id}:`, error);
    throw error;
  }
};

export const createUser = async (userData: any): Promise<User> => {
  try {
    // Map fields from form to backend API
    const payload = {
      email: userData.email,
      first_name: userData.first_name || (userData.name ? userData.name.split(' ')[0] : ''),
      last_name: userData.last_name || (userData.name ? userData.name.split(' ').slice(1).join(' ') : ''),
      password: userData.password,
      role: userData.role || 'user',
      is_active: userData.is_active ?? userData.isActive ?? true,
      city: userData.city,
      state: userData.state,
      zip_code: userData.zip_code
    };
    const response = await api.post('/users/', payload);
    return response.data;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const updateUser = async (id: number, userData: UpdateUserData): Promise<User> => {
  try {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  } catch (error) {
    console.error(`Error updating user ${id}:`, error);
    throw error;
  }
};

export const deleteUser = async (id: number): Promise<void> => {
  try {
    await api.delete(`/users/${id}`);
  } catch (error) {
    console.error(`Error deleting user ${id}:`, error);
    throw error;
  }
};
