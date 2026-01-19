import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';

// --- IMPORT DES COMPOSANTS ---
import Dashboard from './components/Dashboard'; // Assurez-vous d'avoir ce composant ou créez un placeholder
import TimesheetForm from './components/TimesheetForm';
import AdminPanel from './components/AdminPanel';
import AbsenceForm from './components/AbsenceForm'; // Assurez-vous d'avoir ce composant ou créez un placeholder

// --- IMPORT DES ASSETS ---
import logoConsultrack from './assets/logo_consultrack.png';

import {
    LayoutDashboard,
    CalendarCheck,
    LogOut,
    ShieldCheck,
    Coffee,
    Users,
    ChevronRight
} from 'lucide-react';

// Composant NavLink personnalisé pour gérer l'état actif (surbrillance)
const NavLink = ({ to, children, active }) => {
    const activeClass = active
        ? 'bg-[#008858] text-white shadow-lg shadow-[#008858]/20'
        : 'text-blue-100 hover:bg-white/10 hover:text-white';

    return (
        <Link to={to} className={`flex items-center justify-between gap-3 p-3.5 rounded-xl transition-all font-bold no-underline text-sm mb-1 ${activeClass}`}>
            {children}
        </Link>
    );
};

const App = () => {
    // --- ÉTAT GLOBAL (Simule le contexte d'authentification) ---
    // Dans une vraie app, cela viendrait de votre AuthContext
    const [userRole, setUserRole] = useState('ADMIN');
    const currentUserId = 1; // ID simulé (ex: Ahmed Amine)

    // --- STYLES INLINE (Pour la structure principale) ---
    const sidebarStyle = {
        width: '18rem',
        backgroundColor: '#003366', // Bleu CDG
        color: 'white',
        position: 'fixed',
        height: '100vh',
        left: 0,
        top: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        padding: '2rem 1.5rem',
        boxShadow: '4px 0 15px rgba(0,0,0,0.2)'
    };

    const mainStyle = {
        marginLeft: '18rem',
        flex: 1,
        padding: '2rem',
        backgroundColor: '#f4f7fa',
        minHeight: '100vh'
    };

    const sectionTitleStyle = {
        fontSize: '11px',
        color: '#008858', // Vert CDG
        fontWeight: '900',
        marginLeft: '12px',
        textTransform: 'uppercase',
        marginTop: '30px',
        marginBottom: '10px',
        letterSpacing: '1.5px',
        opacity: 0.8
    };

    return (
        <Router>
            <div className="flex min-h-screen">

                {/* ================= SIDEBAR (MENU GAUCHE) ================= */}
                <aside style={sidebarStyle}>

                    {/* --- ZONE LOGO --- */}
                    <div className="mb-10 px-2 flex flex-col items-center">
                        <div className="bg-white p-2 rounded-xl shadow-lg mb-3 w-full flex justify-center">
                            <img
                                src={logoConsultrack}
                                alt="ConsulTrack Logo"
                                style={{
                                    height: '50px',
                                    width: 'auto',
                                    objectFit: 'contain'
                                }}
                            />
                        </div>
                        <p style={{
                            fontSize: '10px',
                            textTransform: 'uppercase',
                            color: '#008858',
                            fontWeight: 'bold',
                            letterSpacing: '2px',
                            margin: 0,
                            opacity: 0.9,
                            textAlign: 'center'
                        }}>
                            CDG CAPITAL
                        </p>
                    </div>

                    {/* --- NAVIGATION --- */}
                    <nav className="flex-1">
                        {/* On passe userRole pour afficher le bon menu */}
                        <NavigationContent userRole={userRole} sectionTitleStyle={sectionTitleStyle} />
                    </nav>

                    {/* --- BOUTON DÉCONNEXION --- */}
                    <button className="flex items-center gap-3 p-4 text-red-300 hover:text-red-100 hover:bg-red-500/10 rounded-xl transition-all mt-auto border-t border-white/10 font-black uppercase text-[10px] bg-transparent border-none cursor-pointer tracking-widest">
                        <LogOut size={18} /> Déconnexion
                    </button>
                </aside>

                {/* ================= MAIN CONTENT (CONTENU DROITE) ================= */}
                <main style={mainStyle}>
                    <div className="max-w-7xl mx-auto w-full">

                        {/* --- HEADER SUPERIEUR --- */}
                        <header className="mb-10 flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <div className="flex flex-col">
                                <h2 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#003366', textTransform: 'uppercase', margin: 0, letterSpacing: '-0.02em' }}>
                                    {userRole === 'ADMIN' ? 'Supervision Prestataires' : 'Mon Espace Consultant'}
                                </h2>
                            </div>

                            <div className="flex items-center gap-5">
                                {/* SWITCH ROLE (POUR TESTER RAPIDEMENT) */}
                                <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl border border-gray-200">
                                    <button
                                        onClick={() => setUserRole('CONSULTANT')}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${userRole === 'CONSULTANT' ? 'bg-white shadow-sm text-[#003366]' : 'text-gray-400'}`}
                                    >CONSULTANT</button>
                                    <button
                                        onClick={() => setUserRole('ADMIN')}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${userRole === 'ADMIN' ? 'bg-white shadow-sm text-[#003366]' : 'text-gray-400'}`}
                                    >ADMIN</button>
                                </div>

                                {/* PROFIL UTILISATEUR */}
                                <div className="flex items-center gap-4 border-l pl-5 border-gray-200">
                                    <div className="text-right">
                                        <div style={{ fontWeight: '900', color: '#003366', fontSize: '14px' }}>Ahmed Amine</div>
                                        <div style={{ fontSize: '10px', color: '#008858', fontWeight: 'bold', textTransform: 'uppercase' }}>{userRole}</div>
                                    </div>
                                    <div style={{
                                        width: '42px', height: '42px',
                                        backgroundColor: '#003366',
                                        borderRadius: '14px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#008858',
                                        fontWeight: '900', fontSize: '14px',
                                        border: '2px solid #e5e7eb'
                                    }}>
                                        AA
                                    </div>
                                </div>
                            </div>
                        </header>

                        {/* --- ROUTING & AFFICHAGE DES PAGES --- */}
                        <div className="animate-in fade-in duration-500">
                            <Routes>
                                {/* Dashboard Général */}
                                <Route path="/" element={<Dashboard userRole={userRole} userId={currentUserId} />} />

                                {/* ROUTES CONSULTANT
                                    Ici, on passe userId={currentUserId} pour que le formulaire sache charger
                                    les données de CE consultant spécifique (Ahmed Amine).
                                */}
                                <Route path="/timesheet" element={<TimesheetForm userRole="CONSULTANT" userId={currentUserId} />} />
                                <Route path="/absences" element={<AbsenceForm userRole="CONSULTANT" userId={currentUserId} />} />

                                {/* ROUTES ADMIN
                                    Ici, l'AdminPanel n'a pas besoin d'ID spécifique car il charge tout.
                                    Le TimesheetForm en mode ADMIN affichera la liste déroulante des consultants.
                                */}
                                <Route path="/admin" element={userRole === 'ADMIN' ? <AdminPanel /> : <Navigate to="/" />} />
                                <Route path="/admin/timesheet-global" element={userRole === 'ADMIN' ? <TimesheetForm userRole="ADMIN" /> : <Navigate to="/" />} />
                                <Route path="/admin/saisie-absence" element={userRole === 'ADMIN' ? <AbsenceForm userRole="ADMIN" /> : <Navigate to="/" />} />

                                {/* Fallback */}
                                <Route path="*" element={<Navigate to="/" />} />
                            </Routes>
                        </div>
                    </div>
                </main>
            </div>
        </Router>
    );
};

// --- SOUS-COMPOSANT NAVIGATION ---
// Gère l'affichage des liens selon le rôle
const NavigationContent = ({ userRole, sectionTitleStyle }) => {
    const location = useLocation(); // Hook pour savoir sur quelle page on est

    return (
        <>
            {/* TOUS LES RÔLES */}
            <div style={sectionTitleStyle}>Général</div>
            <NavLink to="/" active={location.pathname === '/'}>
                <div className="flex items-center gap-3">
                    <LayoutDashboard size={18} />
                    <span>{userRole === 'ADMIN' ? 'Pilotage Global' : 'Mon Dashboard'}</span>
                </div>
            </NavLink>

            {/* MENU CONSULTANT */}
            {userRole === 'CONSULTANT' && (
                <>
                    <div style={sectionTitleStyle}>Ma Mission</div>
                    <NavLink to="/timesheet" active={location.pathname === '/timesheet'}>
                        <div className="flex items-center gap-3">
                            <CalendarCheck size={18} />
                            <span>Pointages & Activités</span>
                        </div>
                        <ChevronRight size={14} className="opacity-50" />
                    </NavLink>
                    <NavLink to="/absences" active={location.pathname === '/absences'}>
                        <div className="flex items-center gap-3">
                            <Coffee size={18} />
                            <span>Mes Absences</span>
                        </div>
                    </NavLink>
                </>
            )}

            {/* MENU ADMIN */}
            {userRole === 'ADMIN' && (
                <>
                    <div style={sectionTitleStyle}>Supervision</div>
                    <NavLink to="/admin" active={location.pathname === '/admin'}>
                        <div className="flex items-center gap-3">
                            <ShieldCheck size={18} />
                            <span>Console Admin</span>
                        </div>
                        <ChevronRight size={14} className="opacity-50" />
                    </NavLink>

                    <div style={sectionTitleStyle}>Saisie Déléguée</div>
                    <NavLink to="/admin/timesheet-global" active={location.pathname === '/admin/timesheet-global'}>
                        <div className="flex items-center gap-3">
                            <Users size={18} />
                            <span>Timesheets Externes</span>
                        </div>
                    </NavLink>
                    <NavLink to="/admin/saisie-absence" active={location.pathname === '/admin/saisie-absence'}>
                        <div className="flex items-center gap-3">
                            <Coffee size={18} />
                            <span>Saisir une Absence</span>
                        </div>
                    </NavLink>
                </>
            )}
        </>
    );
};

export default App;