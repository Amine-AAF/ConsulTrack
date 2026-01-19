import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/axiosConfig'; // Votre instance axios existante

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Au chargement, on vérifie si l'utilisateur est déjà stocké (localStorage)
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');

        if (storedUser && storedToken) {
            setUser(JSON.parse(storedUser));
            // On remet le token dans les headers par défaut
            api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        }
        setLoading(false);
    }, []);

    // Fonction de connexion
    const login = async (email, password) => {
        try {
            // Remplacez '/auth/login' par votre endpoint backend réel
            const res = await api.post('/auth/login', { email, password });

            // On suppose que le back renvoie : { token: "...", user: { id: 1, role: "ADMIN", nom: "..." } }
            const { token, user: userData } = res.data;

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(userData));

            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            setUser(userData);
            return { success: true, role: userData.role };
        } catch (error) {
            console.error("Login failed", error);
            return { success: false, message: "Identifiants incorrects" };
        }
    };

    // Fonction de déconnexion
    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete api.defaults.headers.common['Authorization'];
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);