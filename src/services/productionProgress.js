import api from './api';


export const getProductionProgress = async ({
  period,
  month,
  date,
  op,
  machine_code: machineCode,
  shift,
  signal,
} = {}) => {
  const params = {};
  if (period) params.period = period;
  if (month) params.month = month;
  if (date) params.date = date;
  if (op) params.op = op;
  if (machineCode) params.machine_code = machineCode;
  if (shift) params.shift = shift;

  const response = await api.get('/monitoring/v1/production-progress', {
    params,
    signal,
  });
  return response.data;
};
