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

// --- Intercepteur RESPONSE : session expirée → purge + retour au login ---
// 401 = plus authentifié (token absent, invalide ou expiré).
// Les appels /auth/* sont exclus : un échec de connexion renvoie lui aussi 401
// et doit rester une simple erreur de saisie, pas une expiration de session.
api.interceptors.response.use(
    (res) => res,
    (err) => {
        const estAppelAuth = err.config?.url?.includes('/auth/');
        if (err.response?.status === 401 && !estAppelAuth) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (!window.location.pathname.includes('/login')) {
                // Lu puis effacé par la page de connexion pour afficher le message.
                sessionStorage.setItem('sessionExpiree', '1');
                window.location.href = '/login';
            }
        }
        return Promise.reject(err);
    }
);

export default api;
