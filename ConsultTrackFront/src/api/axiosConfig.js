import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8081/api',
});

// --- Intercepteur REQUEST : ajoute systématiquement le token s'il existe ---
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// --- Intercepteur RESPONSE : auto-logout sur 401 ---
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(err);
    }
);

export default api;
