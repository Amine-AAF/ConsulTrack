import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ allowedRoles }) => {
    const { user } = useAuth();

    // 1. Pas connecté ? -> Login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // 2. Rôle non autorisé ? -> retour au dashboard (route commune à tous les rôles,
    //    évite toute boucle de redirection : /timesheet n'est pas accessible au RESPONSABLE)
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    // 3. Tout est bon -> Affiche la page demandée
    return <Outlet />;
};

export default PrivateRoute;