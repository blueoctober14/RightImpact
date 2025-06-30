import { MessageTemplate } from '../types/message';
import api, { apiGet, getCachedResponse, cacheResponse } from './api';

// Cache prefix used in api.ts
const CACHE_PREFIX = 'api_cache_';

// Cache TTL constants
const MESSAGE_TEMPLATES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Track in-progress requests to prevent duplicates
const pendingRequests: Record<string, Promise<any>> = {};

// Add response interceptor for message-specific error handling
api.interceptors.response.use(
  (response) => {
    console.log(`[${response.status}]`, response.config.url);
    return response;
  },
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        console.error('Authentication error - token may be invalid or expired');
        // Optionally redirect to login or refresh token here
      }
      console.error(
        `[${error.response.status}]`,
        error.config.url,
        error.response.data
      );
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Maximum number of retries for API calls
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second delay between retries

/**
 * Retry a function with exponential backoff
 */
async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES, delay = RETRY_DELAY): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0 || error?.response?.status === 401 || error?.response?.status === 403) {
      throw error;
    }
    
    console.log(`Retrying after error (${retries} attempts left): ${error.message}`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2); // Exponential backoff
  }
}

export const getMessageTemplates = async (): Promise<MessageTemplate[]> => {
  try {
    // Disable caching for message templates to ensure we always get fresh data
    console.log('[Cache] Bypassing cache for message templates');
    
    // Clear any existing cache for message templates
    localStorage.removeItem(`${CACHE_PREFIX}message_templates`);
    localStorage.removeItem('message_templates_stale_cache');
    
    // Check if this request is already in progress
    const requestKey = '/message-templates/';
    if (pendingRequests[requestKey]) {
      console.log(`Request already in progress for ${requestKey}, reusing promise`);
      return pendingRequests[requestKey];
    }
    
    // Create a new request promise and store it
    const requestPromise = withRetry(() => 
      api.get(requestKey, {
        timeout: 45000, // 45 second timeout
        params: {
          _: Date.now() // Cache buster
        }
      })
    )
    .then(response => {
      // Remove from pending requests
      delete pendingRequests[requestKey];
      
      if (!response.data) {
        throw new Error('Empty response from server');
      }
      
      console.log('Message templates response:', response.data);
      
      // Transform the response to match our frontend type
      const transformedData = response.data.map((template: any) => {
        try {
          // Ensure users are properly formatted
          const users = Array.isArray(template.users)
            ? template.users.map((u: any) => ({
                id: u.id,
                name: u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
                email: u.email
              }))
            : [];
          
          // Ensure lists are properly formatted
          const lists = Array.isArray(template.lists)
            ? template.lists.map((l: any) => ({
                id: l.id,
                name: l.name
              }))
            : [];
          
          // Ensure groups are properly formatted
          const groups = Array.isArray(template.groups)
            ? template.groups.map((g: any) => ({
                id: g.id,
                name: g.name
              }))
            : [];
          
          console.log(`Template ${template.id} lists:`, lists);
          console.log(`Template ${template.id} groups:`, groups);
          
          return {
            ...template,
            sent_count: template.sent_count ?? 0,
            lists: lists,
            users: users,
            groups: groups,
            listIds: lists.map((l: any) => l.id) || [],
            userIds: users.map((u: any) => u.id) || [],
            groupIds: groups.map((g: any) => g.id) || []
          };
        } catch (e) {
          console.error('Error transforming template:', template.id, e);
          return template; // Return untransformed template as fallback
        }
      });
      
      // Don't cache message templates to ensure we always get fresh data
      console.log('[Cache] Skipping cache storage for message templates');
      
      return transformedData;
    })
    .catch(error => {
      // Remove from pending requests on error
      delete pendingRequests[requestKey];
      throw error;
    });
    
    // Store the promise for deduplication
    pendingRequests[requestKey] = requestPromise;
    
    return requestPromise;
  } catch (error: any) {
    console.error('Error fetching message templates:', error);
    
    // Handle different error types
    if (error.code === 'ECONNABORTED') {
      console.error('Request timed out. Returning cached data if available or empty array.');
      
      // Try to get stale cache as fallback
      const staleCache = localStorage.getItem('message_templates_stale_cache');
      if (staleCache) {
        try {
          const { data } = JSON.parse(staleCache);
          if (Array.isArray(data) && data.length > 0) {
            console.log('Using stale cache data after timeout');
            return data;
          }
        } catch (e) {
          console.error('Error parsing stale cache:', e);
        }
      }
      
      return [];
    }
    
    // Network errors - try to get from stale cache
    if (error.message && (error.message.includes('Network Error') || !navigator.onLine)) {
      console.error('Network error. Trying to use stale cache.');
      
      const staleCache = localStorage.getItem('message_templates_stale_cache');
      if (staleCache) {
        try {
          const { data } = JSON.parse(staleCache);
          if (Array.isArray(data)) {
            return data;
          }
        } catch (e) {
          console.error('Error parsing stale cache:', e);
        }
      }
    }
    
    // For all other errors, throw to be handled by the component
    throw error;
  }
};

export const getMessageTemplate = async (id: number): Promise<MessageTemplate> => {
  try {
    // Try to get from cache first
    const cacheKey = `message_template_${id}`;
    const cachedData = getCachedResponse(cacheKey);
    if (cachedData) {
      console.log(`[Cache] Using cached message template ${id}`);
      return cachedData;
    }
    
    // Check if this request is already in progress
    const requestKey = `/message-templates/${id}`;
    if (pendingRequests[requestKey]) {
      console.log(`Request already in progress for ${requestKey}, reusing promise`);
      return pendingRequests[requestKey];
    }
    
    // Create a new request promise and store it
    pendingRequests[requestKey] = withRetry(() => 
      api.get(requestKey, {
        timeout: 30000 // 30 second timeout
      })
    )
    .then(response => {
      console.log('Get template response:', response.data);
      const template = response.data;
      
      // Ensure users are properly formatted
      const users = Array.isArray(template.users)
        ? template.users.map((u: any) => ({
            id: u.id,
            name: u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
            email: u.email
          }))
        : [];
        
      // Ensure lists are properly formatted
      const lists = Array.isArray(template.lists)
        ? template.lists.map((l: any) => ({
            id: l.id,
            name: l.name
          }))
        : [];
      
      // Ensure groups are properly formatted
      const groups = Array.isArray(template.groups)
        ? template.groups.map((g: any) => ({
            id: g.id,
            name: g.name
          }))
        : [];
      
      const transformedTemplate = {
        ...template,
        sent_count: template.sent_count ?? 0,
        lists: lists,
        users: users,
        groups: groups,
        listIds: lists.map((l: any) => l.id) || [],
        userIds: users.map((u: any) => u.id) || [],
        groupIds: groups.map((g: any) => g.id) || []
      };
      
      // Cache the transformed data
      cacheResponse(cacheKey, transformedTemplate, MESSAGE_TEMPLATES_CACHE_TTL);
      
      // Remove from pending requests
      delete pendingRequests[requestKey];
      
      return transformedTemplate;
    })
    .catch(error => {
      // Remove from pending requests on error
      delete pendingRequests[requestKey];
      throw error;
    });
    
    return pendingRequests[requestKey];
  } catch (error: any) {
    console.error(`Error fetching message template ${id}:`, error);
    throw error;
  }
};

export const createMessageTemplate = async (templateData: any): Promise<MessageTemplate> => {
  try {
    console.log('Creating template:', templateData);
    // Extract only the necessary fields for the API
    const { listIds = [], userIds = [], groupIds = [], ...rest } = templateData;
    
    // Ensure status is uppercase
    const normalizedData = { ...rest };
    if (normalizedData.status) {
      normalizedData.status = normalizedData.status.toUpperCase();
      console.log(`Normalized status to: ${normalizedData.status}`);
    } else {
      normalizedData.status = 'DRAFT';
      console.log('No status provided, defaulting to DRAFT');
    }
    
    const payload = {
      ...normalizedData,
      list_ids: Array.isArray(listIds) ? listIds : [],
      user_ids: Array.isArray(userIds) ? userIds : [],
      group_ids: Array.isArray(groupIds) ? groupIds : []
    };
    
    console.log('Sending payload:', payload);
    
    const response = await api.post('/message-templates', payload);
    console.log('Create template response:', response.data);
    
    // Clear all message template caches to ensure fresh data on next fetch
    console.log('[Cache] Clearing all message template caches');
    localStorage.removeItem(`${CACHE_PREFIX}message_templates`);
    localStorage.removeItem('message_templates_stale_cache');
    
    // Clear any other cache keys that might contain message templates
    Object.keys(localStorage).forEach(key => {
      if (key.includes('message') && key.includes('template')) {
        console.log(`[Cache] Removing key: ${key}`);
        localStorage.removeItem(key);
      }
    });
    
    // If the response doesn't include lists/users/groups, fetch the complete template
    if (!response.data.lists || !response.data.users || !response.data.groups) {
      console.log('Response missing relationships, fetching complete template...');
      return getMessageTemplate(response.data.id);
    }
    
    // Transform the response to match our frontend type
    const data = response.data;
    
    // Ensure users, lists, and groups are properly formatted
    const users = Array.isArray(data.users) 
      ? data.users.map((u: any) => ({
          id: u.id,
          name: u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
          email: u.email
        }))
      : [];
      
    const lists = Array.isArray(data.lists)
      ? data.lists.map((l: any) => ({
          id: l.id,
          name: l.name
        }))
      : [];
      
    const groups = Array.isArray(data.groups)
      ? data.groups.map((g: any) => ({
          id: g.id,
          name: g.name
        }))
      : [];
    
    const result = {
      ...data,
      lists: lists,
      users: users,
      groups: groups,
      listIds: lists.map((l: any) => l.id) || [],
      userIds: users.map((u: any) => u.id) || [],
      groupIds: groups.map((g: any) => g.id) || []
    };
    
    console.log('Formatted template:', result);
    return result;
  } catch (error) {
    console.error('Error creating message template:', error);
    throw error;
  }
};

export const updateMessageTemplate = async (id: number, templateData: Partial<MessageTemplate>): Promise<MessageTemplate> => {
  try {
    console.log(`[MessageService] Updating template ${id}:`, templateData);
    
    // Ensure status is uppercase if provided
    const normalizedData = { ...templateData };
    if (normalizedData.status) {
      normalizedData.status = normalizedData.status.toUpperCase() as 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'ARCHIVED';
      console.log(`[MessageService] Normalized status to: ${normalizedData.status}`);
    }
    
    // Extract only the necessary fields for the API
    const { listIds = [], userIds = [], groupIds = [], ...rest } = normalizedData;
    const payload = {
      ...rest,
      list_ids: Array.isArray(listIds) ? listIds : [],
      user_ids: Array.isArray(userIds) ? userIds : [],
      group_ids: Array.isArray(groupIds) ? groupIds : []
    };
    
    console.log('[MessageService] Sending update payload:', payload);
    
    const response = await api.put(`/message-templates/${id}`, payload);
    console.log('[MessageService] Update template response:', response.data);
    
    // Clear all message template caches to ensure fresh data on next fetch
    console.log('[Cache] Clearing all message template caches');
    localStorage.removeItem(`${CACHE_PREFIX}message_templates`);
    localStorage.removeItem('message_templates_stale_cache');
    
    // Clear any other cache keys that might contain message templates
    Object.keys(localStorage).forEach(key => {
      if (key.includes('message') && key.includes('template')) {
        console.log(`[Cache] Removing key: ${key}`);
        localStorage.removeItem(key);
      }
    });
    
    // If the response doesn't include lists/users/groups, fetch the complete template
    if (!response.data.lists || !response.data.users || !response.data.groups) {
      console.log('[MessageService] Response missing relationships, fetching complete template...');
      return getMessageTemplate(id);
    }
    
    // Transform the response to match our frontend type
    const data = response.data;
    
    // Ensure status is properly set from response
    if (data.status) {
      data.status = data.status.toUpperCase();
    }
    
    // Ensure users, lists, and groups are properly formatted
    const users = Array.isArray(data.users) 
      ? data.users.map((u: any) => ({
          id: u.id,
          name: u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
          email: u.email
        }))
      : [];
      
    const lists = Array.isArray(data.lists)
      ? data.lists.map((l: any) => ({
          id: l.id,
          name: l.name
        }))
      : [];
      
    const groups = Array.isArray(data.groups)
      ? data.groups.map((g: any) => ({
          id: g.id,
          name: g.name
        }))
      : [];
    
    const result = {
      ...data,
      lists: lists,
      users: users,
      groups: groups,
      listIds: lists.map((l: any) => l.id) || [],
      userIds: users.map((u: any) => u.id) || [],
      groupIds: groups.map((g: any) => g.id) || []
    };
    
    console.log('[MessageService] Successfully updated template:', {
      id: result.id,
      name: result.name,
      status: result.status,
      updated_at: result.updated_at
    });
    
    // Clear the cache for this template and the templates list
    try {
      console.log('[MessageService] Invalidating cache for message templates...');
      localStorage.removeItem('api_cache_message_templates');
      localStorage.removeItem(`api_cache_message_template_${id}`);
    } catch (cacheError) {
      console.warn('[MessageService] Failed to clear cache:', cacheError);
    }
    
    return result;
  } catch (error) {
    console.error(`[MessageService] Error updating message template ${id}:`, error);
    throw error;
  }
};

export const deleteMessageTemplate = async (id: number): Promise<void> => {
  try {
    console.log(`Deleting template ${id}`);
    await api.delete(`/message-templates/${id}`);
  } catch (error) {
    console.error(`Error deleting message template ${id}:`, error);
    throw error;
  }
};
