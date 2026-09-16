import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

client.interceptors.request.use((config) => {
  const jeton = localStorage.getItem('jeton');
  if (jeton) config.headers.Authorization = `Bearer ${jeton}`;
  return config;
});

export default client;
