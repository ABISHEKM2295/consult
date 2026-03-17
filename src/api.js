// Central API configuration
const BASE_URL = 'http://localhost:5000/api';

const handleResponse = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
};

const post = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(handleResponse);
const put  = (url, body = {}) =>
  fetch(url, { method: 'PUT',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(handleResponse);
const del  = (url) =>
  fetch(url, { method: 'DELETE' }).then(handleResponse);
const get  = (url) => fetch(url).then(handleResponse);

export const api = {
  // ── Auth ─────────────────────────────────────────────────────
  login:  (creds) => post(`${BASE_URL}/auth/login`, creds),

  // ── Batches ──────────────────────────────────────────────────
  getBatches:    (params = {}) => get(`${BASE_URL}/batches?${new URLSearchParams(params)}`),
  getBatchStats: ()            => get(`${BASE_URL}/batches/stats`),
  getAnalytics:  ()            => get(`${BASE_URL}/batches/analytics`),
  getCertificate: (id)         => `${BASE_URL}/batches/${id}/certificate`, // returns URL

  // ── Machines ─────────────────────────────────────────────────
  getMachines:    () => get(`${BASE_URL}/machines`),
  getMachineStats:() => get(`${BASE_URL}/machines/stats`),

  // ── Inventory ────────────────────────────────────────────────
  getInventory:     (params = {}) => get(`${BASE_URL}/inventory?${new URLSearchParams(params)}`),
  createInventoryItem: (body)     => post(`${BASE_URL}/inventory`, body),
  getLowStockAlerts:()             => get(`${BASE_URL}/inventory/alerts`),

  // ── Inspections ──────────────────────────────────────────────
  getInspections:    (params = {}) => get(`${BASE_URL}/inspections?${new URLSearchParams(params)}`),
  getInspectionStats:()             => get(`${BASE_URL}/inspections/stats`),
  calcDeltaE:        (labs)        => post(`${BASE_URL}/inspections/deltaE`, labs),

  // ── Alerts ───────────────────────────────────────────────────
  getAlerts:    (params = {}) => get(`${BASE_URL}/alerts?${new URLSearchParams(params)}`),
  markAlertRead:(id)          => put(`${BASE_URL}/alerts/${id}/read`),

  // ── Schedules ────────────────────────────────────────────────
  getSchedules: (params = {}) => get(`${BASE_URL}/schedules?${new URLSearchParams(params)}`),
  getScheduleSuggest:(duration) => get(`${BASE_URL}/schedules/suggest?duration=${duration}`),
  createSchedule:(body)        => post(`${BASE_URL}/schedules`, body),
  updateSchedule:(id, body)    => put(`${BASE_URL}/schedules/${id}`, body),

  // ── Orders ───────────────────────────────────────────────────
  getOrders:     (params = {}) => get(`${BASE_URL}/orders?${new URLSearchParams(params)}`),
  getOrderStats: ()             => get(`${BASE_URL}/orders/stats`),
  createOrder:   (body)         => post(`${BASE_URL}/orders`, body),
  updateOrder:   (id, body)     => put(`${BASE_URL}/orders/${id}`, body),
  advanceOrder:  (id, body={}) => put(`${BASE_URL}/orders/${id}/advance`, body),
  deleteOrder:   (id)           => del(`${BASE_URL}/orders/${id}`),

  // ── Lab Dips ─────────────────────────────────────────────────
  getLabDips:   (params = {}) => get(`${BASE_URL}/labdips?${new URLSearchParams(params)}`),
  createLabDip: (body)         => post(`${BASE_URL}/labdips`, body),
  updateLabDip: (id, body)     => put(`${BASE_URL}/labdips/${id}`, body),
  approveLabDip:(id, data)     => put(`${BASE_URL}/labdips/${id}/approve`, data),
  rejectLabDip: (id, data)     => put(`${BASE_URL}/labdips/${id}/reject`, data),
  lockLabDip:   (id)           => put(`${BASE_URL}/labdips/${id}/lock`),
  deleteLabDip: (id)           => del(`${BASE_URL}/labdips/${id}`),
};
