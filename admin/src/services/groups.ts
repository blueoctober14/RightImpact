import api from './api';
import { Group } from '../types';

export const getGroups = async (): Promise<Group[]> => {
  try {
    const response = await api.get('/groups');
    return response.data;
  } catch (error) {
    console.error('Error fetching groups:', error);
    throw new Error('Failed to load groups');
  }
};

export const createGroup = async (name: string): Promise<Group> => {
  try {
    console.log('Creating group with name:', name);
    
    // Log the full URL being called
    const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    const fullUrl = `${baseURL}/api/groups`;
    console.log('API Request URL:', fullUrl);
    
    // Log the request payload
    const payload = { name };
    console.log('Request payload:', JSON.stringify(payload, null, 2));
    
    // Make the request with explicit headers and credentials
    const response = await api.post('/groups', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      withCredentials: true,
      // Ensure credentials are included in the request
      xsrfCookieName: 'csrftoken',
      xsrfHeaderName: 'X-CSRFToken',
    });
    
    console.log('Group created successfully:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Error creating group:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      response: {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
      },
      request: {
        method: error.config?.method,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        data: error.config?.data,
        headers: error.config?.headers,
      },
    });
    
    const errorMessage = error.response?.data?.detail || error.message || 'Failed to create group';
    console.error('Error details:', errorMessage);
    throw new Error(errorMessage);
  }
};

export const deleteGroup = async (id: number): Promise<void> => {
  try {
    await api.delete(`/groups/${id}`);
  } catch (error) {
    console.error('Error deleting group:', error);
    throw new Error('Failed to delete group');
  }
};

export const updateGroup = async (id: number, name: string): Promise<Group> => {
  try {
    if (!name.trim()) {
      throw new Error('Group name cannot be empty');
    }
    const response = await api.put(`/groups/${id}`, { name });
    return response.data;
  } catch (error) {
    console.error('Error updating group:', error);
    throw new Error('Failed to update group');
  }
};

export const addUserToGroup = async (userId: number, groupId: number): Promise<void> => {
  try {
    const response = await api.post(`/users/${userId}/groups/${groupId}`);
    console.log('Add user to group response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Error adding user to group:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: error.config
    });
    throw new Error(error.response?.data?.detail || 'Failed to add user to group');
  }
};

export const removeUserFromGroup = async (userId: number, groupId: number): Promise<void> => {
  try {
    const response = await api.delete(`/users/${userId}/groups/${groupId}`);
    console.log('Remove user from group response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Error removing user from group:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: error.config
    });
    throw new Error(error.response?.data?.detail || 'Failed to remove user from group');
  }
};

// Import the caching functions from api.ts
import { apiGet, getCachedResponse, cacheResponse } from './api';

// Cache TTL constants
const USER_GROUPS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const getUserGroups = async (userId: number): Promise<Group[]> => {
  try {
    // Try to get from cache first
    const cacheKey = `user_groups_${userId}`;
    const cachedData = getCachedResponse(cacheKey);
    if (cachedData) {
      console.log(`[Cache] Using cached groups for user ${userId}`);
      return cachedData;
    }
    
    // If not in cache, fetch from API
    const response = await api.get(`/users/${userId}/groups/`, {
      timeout: 10000 // 10 second timeout
    });
    
    // Cache the response
    cacheResponse(cacheKey, response.data, USER_GROUPS_CACHE_TTL);
    
    return response.data;
  } catch (error: any) {
    console.error('Error fetching user groups:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw new Error(error.response?.data?.detail || 'Failed to get user groups');
  }
};

/**
 * Fetch groups for multiple users at once
 * @param userIds Array of user IDs to fetch groups for
 * @returns Object mapping user IDs to their groups
 */
export const getBatchUserGroups = async (userIds: number[]): Promise<Record<number, Group[]>> => {
  if (!userIds.length) return {};
  
  try {
    // Generate a unique cache key based on the sorted user IDs
    const sortedIds = [...userIds].sort((a, b) => a - b);
    const cacheKey = `batch_user_groups_${sortedIds.join(',')}`;
    
    // Try to get from cache first
    const cachedData = getCachedResponse(cacheKey);
    if (cachedData) {
      console.log(`[Cache] Using cached batch groups for ${userIds.length} users`);
      return cachedData;
    }
    
    // If not in cache, fetch from API
    console.time('batch_groups_api_call');
    const response = await api.get(`/users/batch/groups`, {
      params: {
        user_ids: userIds.join(','),
      },
      timeout: 15000 // 15 second timeout for batch requests
    });
    console.timeEnd('batch_groups_api_call');
    
    // Cache individual user groups as well as the batch result
    const result = response.data;
    
    // Cache the batch result
    cacheResponse(cacheKey, result, USER_GROUPS_CACHE_TTL);
    
    // Also cache individual user results for future single-user requests
    Object.entries(result).forEach(([userId, groups]) => {
      cacheResponse(`user_groups_${userId}`, groups, USER_GROUPS_CACHE_TTL);
    });
    
    return result;
  } catch (error: any) {
    console.error('Error fetching batch user groups:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw new Error(error.response?.data?.detail || 'Failed to get batch user groups');
  }
};

// Get user counts for all groups
export const getGroupUserCounts = async (): Promise<{ group_id: number; user_count: number }[]> => {
  try {
    const response = await api.get('/groups/user_counts');
    return response.data;
  } catch (error) {
    console.error('Error fetching group user counts:', error);
    throw new Error('Failed to load group user counts');
  }
};

// Get all users in a specific group
export const getGroupUsers = async (groupId: number): Promise<any[]> => {
  try {
    // Try with trailing slash first
    try {
      const response = await api.get(`/groups/${groupId}/users/`);
      console.log('Get group users response (with trailing slash):', response.data);
      return response.data;
    } catch (error: any) {
      // If that fails, try without trailing slash
      if (error.response?.status === 404) {
        const response = await api.get(`/groups/${groupId}/users`);
        console.log('Get group users response (without trailing slash):', response.data);
        return response.data;
      }
      throw error; // Re-throw if it's not a 404
    }
  } catch (error: any) {
    console.error('Error fetching group users:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: error.config
    });
    throw new Error(error.response?.data?.detail || 'Failed to fetch group users');
  }
};
