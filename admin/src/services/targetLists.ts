import axios, { AxiosError } from 'axios';

interface TargetList {
  id: number;
  name: string;
  description?: string;
  total_contacts: number;
  imported_contacts: number;
  failed_contacts: number;
  status: string;
  updated_at: string;
  created_at: string;
}

// Get API base URL from environment variables or use default
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
// All endpoints are relative to the baseURL which already includes /api
const TARGETS_ENDPOINT = '/targets/lists';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,  // Removed duplicate /api prefix
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // For sending cookies
});

// Add request interceptor to include auth token if available
api.interceptors.request.use(
  (config) => {
    // Get token from your auth service or storage
    // const token = getAuthToken();
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Track if we've shown a toast to prevent duplicates
let hasShownNetworkError = false;
const NETWORK_ERROR_RESET_DELAY = 5000; // 5 seconds

// Helper function to handle API errors
const handleApiError = (error: unknown, context: string, showToast = true) => {
  console.error(`Error ${context}:`, error);
  
  let errorMessage = 'An unknown error occurred';
  let isNetworkError = false;
  
  if (axios.isAxiosError(error)) {
    // Handle Axios errors
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const { data, status } = error.response;
      
      console.error('Error response data:', data);
      console.error('Error status:', status);
      
      if (data && typeof data === 'object' && 'message' in data) {
        errorMessage = data.message as string;
      } else if (status === 401) {
        errorMessage = 'You are not authorized to perform this action';
      } else if (status === 404) {
        errorMessage = 'The requested resource was not found';
      } else if (status >= 500) {
        errorMessage = 'A server error occurred. Please try again later.';
      } else {
        errorMessage = `Request failed with status code ${status}`;
      }
    } else if (error.request) {
      // The request was made but no response was received
      isNetworkError = true;
      errorMessage = 'Unable to connect to the server. Please check your internet connection.';
    } else {
      // Something happened in setting up the request that triggered an Error
      errorMessage = error.message || 'An error occurred while setting up the request';
    }
  } else if (error instanceof Error) {
    // Handle standard Error objects
    errorMessage = error.message;
  }
  
  // Show error toast if needed
  if (showToast && typeof window !== 'undefined') {
    // For network errors, only show one toast at a time
    if (isNetworkError) {
      if (!hasShownNetworkError) {
        hasShownNetworkError = true;
        // Reset the flag after delay
        setTimeout(() => {
          hasShownNetworkError = false;
        }, NETWORK_ERROR_RESET_DELAY);
        
        // Import toast dynamically to avoid SSR issues
        import('react-toastify').then(({ toast }) => {
          toast.error(errorMessage);
        }).catch(console.error);
      }
    } else {
      // For non-network errors, always show the toast
      import('react-toastify').then(({ toast }) => {
        toast.error(errorMessage);
      }).catch(console.error);
    }
  }
  
  // Create a custom error object with the message
  const customError = new Error(errorMessage) as Error & {
    isAxiosError: boolean;
    response?: any;
    request?: any;
    isNetworkError?: boolean;
  };
  
  customError.isAxiosError = axios.isAxiosError(error);
  customError.isNetworkError = isNetworkError;
  
  if (axios.isAxiosError(error)) {
    customError.response = error.response;
    customError.request = error.request;
  }
  
  return customError;
};

// Get all target lists
const getTargetLists = async (): Promise<TargetList[]> => {
  try {
    console.log('Making request to:', TARGETS_ENDPOINT);
    const response = await api.get<{ lists: TargetList[] }>(TARGETS_ENDPOINT);
    console.log('API Response:', response);
    
    // Log the raw data to debug date parsing
    if (response.data?.lists) {
      console.log('Raw lists data:', JSON.stringify(response.data.lists, null, 2));
      
      // Log the first list's updated_at value and type
      if (response.data.lists.length > 0) {
        const firstList = response.data.lists[0];
        console.log('First list updated_at:', {
          value: firstList.updated_at,
          type: typeof firstList.updated_at,
          parsed: new Date(firstList.updated_at),
          isValid: !isNaN(new Date(firstList.updated_at).getTime())
        });
      }
    }
    
    return response.data?.lists || [];
  } catch (error) {
    const axiosError = error as any;
    
    // If the backend is not available, return an empty array without showing an error
    if (axiosError.code === 'ERR_NETWORK' || axiosError.message?.includes('Network Error')) {
      console.log('Backend not available, returning empty list');
      return [];
    }
    
    // Return empty array for 404 errors (no lists exist yet)
    if (axiosError.response?.status === 404) {
      console.log('No target lists found (404)');
      return [];
    }
    
    console.error('Error in getTargetLists:', error);
    // For other errors, use the normal error handling but don't show toast here
    // as it will be handled by the component
    throw handleApiError(error, 'fetching target lists', false);
  }
};

// Get a single target list by ID
const getTargetList = async (id: string): Promise<TargetList> => {
  try {
    const response = await api.get<TargetList>(`${TARGETS_ENDPOINT}/${id}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error, `fetching target list ${id}`);
  }
};

// Create a new target list
const createTargetList = async (
  data: Omit<TargetList, 'id' | 'contactCount' | 'status' | 'updatedAt' | 'createdAt'> & { file?: File }
): Promise<TargetList> => {
  try {
    const formData = new FormData();
    
    // Add text fields to form data
    formData.append('name', data.name);
    if (data.description) {
      formData.append('description', data.description);
    }
    
    // Add file if present
    if (data.file) {
      formData.append('file', data.file);
    }
    
    // Use the configured api instance which already has the /api prefix
    const response = await api.post<TargetList>(
      TARGETS_ENDPOINT,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'creating target list');
  }
};

// Update a target list
const updateTargetList = async (
  id: string,
  data: Partial<Omit<TargetList, 'id' | 'createdAt'>>
): Promise<TargetList> => {
  try {
    const response = await api.put<TargetList>(`${TARGETS_ENDPOINT}/${id}`, data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, `updating target list ${id}`);
  }
};

// Delete a target list
const deleteTargetList = async (id: string): Promise<void> => {
  try {
    await api.delete(`${TARGETS_ENDPOINT}/${id}`);
  } catch (error) {
    throw handleApiError(error, `deleting target list ${id}`);
  }
};

// Progress event type with percent property
type UploadProgressEvent = {
  loaded: number;
  total?: number;
  percent?: number;
};

// Upload CSV file for a target list
const uploadTargetListCSV = async (
  targetListId: string,
  formData: FormData,
  onUploadProgress?: (progressEvent: UploadProgressEvent) => void,
  listName: string = '',
  description: string = '',
  fieldMapping: Record<string, string> = {}
): Promise<{ count: number }> => {
  console.log('uploadTargetListCSV called');
  console.log('Target list ID:', targetListId);
  console.log('Form data:', formData);
  
  try {
    // Create a new FormData object to ensure all fields are properly set
    const uploadData = new FormData();
    
    // Get the file from the form data
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      throw new Error('No valid file found in form data');
    }
    
    // Add the file to the upload data
    uploadData.append('file', file);
    
    // Add other required fields
    const listNameValue = listName || '';
    const descriptionValue = description || '';
    const fieldMappingValue = fieldMapping || {};
    
    uploadData.append('list_name', listNameValue);
    uploadData.append('description', descriptionValue);
    uploadData.append('field_mapping', JSON.stringify(fieldMappingValue));
    
    console.log('File from form data:', file.name);
    
    // Log all form data entries for debugging
    console.log('Form data entries:');
    // Use Array.from to iterate over FormData entries
    Array.from(uploadData.entries()).forEach(([key, value]) => {
      console.log(key, value);
    });
    
    // Create the field mapping that matches the backend's expected format
    const field_mapping = {
      ...fieldMapping,
      voter_id: 'uniqueid',
      first_name: 'firstname',
      last_name: 'lastname',
      city: 'city',
      state: 'state',
      zip_code: 'zip',
      cell_1: 'phone1',
      cell_2: 'phone2',
      cell_3: 'phone3'
    };
    
    // Update the form data with the field mapping
    uploadData.set('field_mapping', JSON.stringify(field_mapping));
    
    // Log the form data for debugging
    console.log('Uploading file with form data:', {
      list_name: listNameValue,
      description: descriptionValue,
      field_mapping: field_mapping,
      file: file.name
    });
    
    // Configure the request
    const config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent: { loaded: number; total?: number }) => {
        if (onUploadProgress) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          onUploadProgress({
            loaded: progressEvent.loaded,
            total: progressEvent.total || 0,
            percent: percentCompleted
          });
        }
      },
      timeout: 30000, // 30 seconds timeout
      validateStatus: (status: number) => status >= 200 && status < 500
    };
    
    // Log the request for debugging
    console.log('Sending request to:', `${API_BASE_URL}/targets/import`);
    
    // Send the request to the backend
    const response = await axios.post<{ import_id: number; status: string; message?: string }>(
      `${API_BASE_URL}/targets/import`,
      uploadData,
      config
    );
    
    console.log('Upload response:', response.data);
    
    if (response.status !== 200 || !response.data.import_id) {
      throw new Error(response.data?.message || 'Failed to start import');
    }
    
    return { count: 1 }; // Return a dummy count for now
  } catch (error: any) {
    console.error('Error uploading file:', error);
    
    // Extract error message from the error response if available
    const errorMessage = error.response?.data?.message || error.message || 'Failed to upload file';
    console.error('Error details:', errorMessage);
    
    throw new Error(errorMessage);
  }
};

// Process CSV data (for paste functionality)
const processCSVData = async (
  targetListId: string,
  csvData: string,
  fieldMapping: Record<string, string> = {}
): Promise<{ count: number }> => {
  try {
    const response = await api.post<{ count: number }>(
      `${TARGETS_ENDPOINT}/${targetListId}/process-csv`,
      { csvData, fieldMapping }
    );
    return { count: response.data.count };
  } catch (error) {
    throw handleApiError(error, 'processing CSV data');
  }
};

// Simplified CSV upload function
const uploadCSV = async ({
  file,
  listName,
  description = '',
  fieldMapping = {},
  onProgress
}: {
  file: File;
  listName: string;
  description?: string;
  fieldMapping?: Record<string, string>;
  onProgress?: (progress: number) => void;
}): Promise<{ success: boolean; message: string; list?: TargetList }> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('list_name', listName);
    
    if (description) {
      formData.append('description', description);
    }
    
    // Define all possible fields that can be mapped
    const allFields = [
      // Required fields
      'voter_id', 'first_name', 'last_name', 'zip_code',
      // Address fields
      'address_1', 'address_2', 'city', 'state',
      // Phone fields
      'cell_1', 'cell_2', 'cell_3',
      // Other optional fields
      'email', 'county', 'precinct'
    ];
    
    // Create a new mapping object with all fields from the provided mapping
    const formattedMapping: Record<string, string> = {};
    
    // Add all fields that exist in the provided mapping
    allFields.forEach(field => {
      if (fieldMapping[field]) {
        formattedMapping[field] = fieldMapping[field];
      }
    });
    
    // Ensure required fields are included (with empty string if not provided)
    const requiredFields = ['voter_id', 'first_name', 'last_name', 'zip_code', 'cell_1'];
    requiredFields.forEach(field => {
      if (!formattedMapping[field]) {
        formattedMapping[field] = '';
      }
    });
    
    console.log('Sending field mapping:', formattedMapping);
    
    // Convert the mapping object to a JSON string and add it to the form data
    formData.append('field_mapping', JSON.stringify(formattedMapping));

    const response = await api.post<TargetList>(
      '/targets/import',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        },
      }
    );

    return {
      success: true,
      message: 'File uploaded successfully',
      list: response.data,
    };
  } catch (error: any) {
    console.error('Upload error:', error);
    let errorMessage = 'Failed to upload file';
    
    if (error.response) {
      // Handle HTTP errors
      if (error.response.data) {
        // Try to get detailed error message from response
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = Array.isArray(error.response.data.detail) 
            ? error.response.data.detail.map((d: any) => d.msg || d.message || d).join('. ') 
            : error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      }
      
      // Add status code if available
      if (error.response.status) {
        errorMessage = `[${error.response.status}] ${errorMessage}`;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      message: errorMessage,
    };
  }
};

// --------------------------------------
// Remove voters from list(s)
// --------------------------------------
const removeVoters = async ({
  listId,
  voterIdsText,
  file,
}: {
  listId?: number | null;
  voterIdsText?: string;
  file?: File | null;
}): Promise<{ deleted: number; voter_ids_count: number; list_id: number | null }> => {
  try {
    const formData = new FormData();
    if (listId !== undefined && listId !== null) {
      formData.append('list_id', String(listId));
    }
    if (voterIdsText) {
      formData.append('voter_ids_text', voterIdsText);
    }
    if (file) {
      formData.append('file', file);
    }

    const response = await api.post('/targets/remove_voters', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'removing voters');
  }
};

// Export all the functions and types
export {
  getTargetLists,
  getTargetList,
  createTargetList,
  updateTargetList,
  deleteTargetList,
  uploadTargetListCSV,
  uploadCSV,
  processCSVData,
  removeVoters
};

export type { TargetList, UploadProgressEvent };
