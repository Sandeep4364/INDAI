import axios from 'axios';

export const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const uploadDocument = async (file) => {
  const form = new FormData();
  form.append('file', file);
  const { data } = await axios.post(`${BASE}/ingest`, form);
  return data;
};

export const askCopilot = async (question) => {
  const { data } = await axios.post(`${BASE}/ask`, { question });
  return data;
};

export const runRCA = async (symptom) => {
  const { data } = await axios.post(`${BASE}/rca`, { symptom });
  return data;
};

export const runCompliance = async () => {
  const { data } = await axios.get(`${BASE}/compliance`);
  return data;
};

export const listDocuments = async () => {
  const { data } = await axios.get(`${BASE}/documents`);
  return data;
};
