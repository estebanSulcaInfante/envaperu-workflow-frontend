import axios from 'axios';
import { API_BASE_URL } from './api';

export const getPortfolioDemoStatus = async () => {
  const response = await axios.get(`${API_BASE_URL}/demo/status`);
  return response.data;
};

export const resetPortfolioDemo = async () => {
  const response = await axios.post(`${API_BASE_URL}/demo/reset`);
  return response.data;
};
