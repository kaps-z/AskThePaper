import axios from 'axios';

// The URL for our FastAPI backend
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// We use Axios because it automatically parses JSON responses
// and makes handling headers (like Authorization) easier than `fetch()`.
const api = axios.create({
  baseURL: API_URL,
});

/**
 * Attempts to log in to the admin panel using Basic Auth.
 * If successful, we return that the login worked.
 */
export const loginAdmin = async (username, password) => {
  // Basic Auth encodes the username and password in the headers.
  const response = await api.post('/admin/login', null, {
    auth: { username, password }
  });
  return response.data;
};

/**
 * Uploads a PDF file to the backend.
 * Requires the credentials to be passed in to build the Auth header.
 */
export const uploadPaper = async (file, credentials) => {
  // 'multipart/form-data' is the HTTP standard for sending files
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/admin/upload', formData, {
    auth: {
      username: credentials.username,
      password: credentials.password
    },
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
};

/**
 * Fetches the list of uploaded papers from the backend.
 */
export const getFiles = async (credentials) => {
  const response = await api.get('/admin/files', {
    auth: {
      username: credentials.username,
      password: credentials.password
    }
  });
  return response.data;
};

/**
 * Deletes a file from the backend (both MongoDB and disk).
 */
export const deleteFile = async (fileId, credentials) => {
  const response = await api.delete(`/admin/files/${fileId}`, {
    auth: {
      username: credentials.username,
      password: credentials.password
    }
  });
  return response.data;
};

/**
 * Fetches the global configuration from the backend.
 */
export const getConfig = async (credentials) => {
  const response = await api.get('/admin/config', {
    auth: {
      username: credentials.username,
      password: credentials.password
    }
  });
  return response.data;
};

/**
 * Updates the active strategies and model choices in the global configuration.
 * configData shape: { active_strategies: string[], embedding?: string, evaluation?: string }
 */
export const updateConfig = async (configData, credentials) => {
  const response = await api.put('/admin/config', configData, {
    auth: { username: credentials.username, password: credentials.password }
  });
  return response.data;
};

/**
 * Triggers the chunking pipeline for a specific file.
 * Pass strategies array to run specific strategies; omit for config default.
 */
export const processFile = async (fileId, credentials, strategies = null) => {
  const response = await api.post(`/admin/files/${fileId}/process`,
    strategies ? { strategies } : {},
    {
      auth: { username: credentials.username, password: credentials.password }
    }
  );
  return response.data;
};

/**
 * Fetches all chunks associated with a specific paper.
 * Optionally filter by strategy name.
 */
export const getChunks = async (fileId, credentials, strategy = null) => {
  const url = strategy
    ? `/admin/files/${fileId}/chunks?strategy=${strategy}`
    : `/admin/files/${fileId}/chunks`;
  const response = await api.get(url, {
    auth: { username: credentials.username, password: credentials.password }
  });
  return response.data;
};

/**
 * Deletes chunks for a paper. Pass strategy to clear only one strategy.
 */
export const deleteChunks = async (fileId, credentials, strategy = null) => {
  const url = strategy
    ? `/admin/files/${fileId}/chunks?strategy=${strategy}`
    : `/admin/files/${fileId}/chunks`;
  const response = await api.delete(url, {
    auth: { username: credentials.username, password: credentials.password }
  });
  return response.data;
};

export default api;
