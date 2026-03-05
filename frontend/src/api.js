import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const api = axios.create({ baseURL: BASE });

export const getChatConfig = () =>
    api.get('/chat/config').then(r => r.data);

export const getWittyPhrase = () =>
    api.get('/chat/witty').then(r => r.data.phrase);

export const askQuestion = (payload) =>
    api.post('/chat/ask', payload).then(r => r.data);

export const getSessions = () =>
    api.get('/chat/sessions').then(r => r.data);

export const getSession = (id) =>
    api.get(`/chat/sessions/${id}`).then(r => r.data);

export const deleteSession = (id) =>
    api.delete(`/chat/sessions/${id}`).then(r => r.data);

export const getChatTopics = () =>
    api.get('/chat/topics').then(r => r.data);
