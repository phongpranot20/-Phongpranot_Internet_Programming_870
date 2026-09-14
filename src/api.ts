const API_BASE_URL = 'http://119.59.102.161:3089/api';

export const apiCall = async (endpoint: string, options: any = {}) => {
  const authToken = null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    if (!response.ok) {
      let message = `HTTP Error! Status: ${response.status}`;
      try {
        const errBody = await response.json();
        if (errBody?.error) message = errBody.error;
      } catch {
        // response body was not JSON, keep the default message
      }
      throw new Error(message);
    }
    return await response.json();
  } catch (error) {
    console.error('API Call Error:', error);
    throw error;
  }
};