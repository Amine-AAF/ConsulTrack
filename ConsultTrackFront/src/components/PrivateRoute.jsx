import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ allowedRoles }) => {
    const { user } = useAuth();

    // 1. Pas connecté ? -> Login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // 2. Rôle non autorisé ? -> Redirection safe (ou page 403)
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Si un consultant tente d'aller en admin, on le renvoie sur sa timesheet
        return <Navigate to="/timesheet" replace />;
    }

    // 3. Tout est bon -> Affiche la page demandée
    return <Outlet />;
};

export default PrivateRoute;