import React from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';

import Dashboard from './components/Dashboard';
import TimesheetForm from './components/TimesheetForm';
import AdminPanel from './components/AdminPanel';
import AbsenceForm from './components/AbsenceForm';
import Rpi from './components/Rpi';
import RapportActivite from './components/RapportActivite';
import RapportActiviteValidation from './components/RapportActiviteValidation';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import { useAuth } from './context/AuthContext';

import logoConsultrack from './assets/logo_consultrack.png';

import {
    LayoutDashboard,
    CalendarCheck,
    LogOut,
    ShieldCheck,
    Coffee,
    Users,
    FileText,
    ClipboardList,
    ChevronRight
} from 'lucide-react';

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
    const { user, logout } = useAuth();

    // Si pas connecté → uniquement les routes publiques
    if (!user) {
        return (
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        );
    }

    const userRole = user.role;
    const currentUserId = user.id;
    const userInitials = ((user.prenom?.[0] || '') + (user.nom?.[0] || '')).toUpperCase() || 'U';

    const sidebarStyle = {
        width: '18rem',
        backgroundColor: '#003366',
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
        color: '#008858',
        fontWeight: '900',
        marginLeft: '12px',
        textTransform: 'uppercase',
        marginTop: '30px',
        marginBottom: '10px',
        letterSpacing: '1.5px',
        opacity: 0.8
    };

    return (
        <div className="flex min-h-screen">
            <aside style={sidebarStyle}>
                <div className="mb-10 px-2 flex flex-col items-center">
                    <div className="bg-white p-2 rounded-xl shadow-lg mb-3 w-full flex justify-center">
                        <img
                            src={logoConsultrack}
                            alt="ConsulTrack Logo"
                            style={{ height: '50px', width: 'auto', objectFit: 'contain' }}
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

                <nav className="flex-1">
                    <NavigationContent userRole={userRole} sectionTitleStyle={sectionTitleStyle} />
                </nav>

                <button
                    onClick={logout}
                    className="flex items-center gap-3 p-4 text-red-300 hover:text-red-100 hover:bg-red-500/10 rounded-xl transition-all mt-auto border-t border-white/10 font-black uppercase text-[10px] bg-transparent border-none cursor-pointer tracking-widest"
                >
                    <LogOut size={18} /> Déconnexion
                </button>
            </aside>

            <main style={mainStyle}>
                <div className="max-w-7xl mx-auto w-full">
                    <header className="mb-10 flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex flex-col">
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#003366', textTransform: 'uppercase', margin: 0, letterSpacing: '-0.02em' }}>
                                {userRole === 'ADMIN' ? 'Supervision Prestataires' : 'Mon Espace Consultant'}
                            </h2>
                        </div>

                        <div className="flex items-center gap-4 border-l pl-5 border-gray-200">
                            <div className="text-right">
                                <div style={{ fontWeight: '900', color: '#003366', fontSize: '14px' }}>
                                    {user.prenom} {user.nom}
                                </div>
                                <div style={{ fontSize: '10px', color: '#008858', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                    {userRole}
                                </div>
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
                                {userInitials}
                            </div>
                        </div>
                    </header>

                    <div className="animate-in fade-in duration-500">
                        <Routes>
                            <Route path="/login" element={<Navigate to="/" replace />} />

                            <Route path="/" element={<Dashboard userRole={userRole} userId={currentUserId} />} />

                            {/* Routes consultant */}
                            <Route element={<PrivateRoute allowedRoles={['CONSULTANT', 'ADMIN']} />}>
                                <Route path="/timesheet" element={<TimesheetForm userRole={userRole} userId={currentUserId} />} />
                                <Route path="/absences" element={<AbsenceForm userRole={userRole} userId={currentUserId} />} />
                                <Route path="/rpi" element={<Rpi userRole={userRole} userId={currentUserId} />} />
                                <Route path="/rapport-activite" element={<RapportActivite userRole={userRole} userId={currentUserId} />} />
                            </Route>

                            {/* Routes admin uniquement */}
                            <Route element={<PrivateRoute allowedRoles={['ADMIN']} />}>
                                <Route path="/admin" element={<AdminPanel />} />
                                <Route path="/admin/rapports-validation" element={<RapportActiviteValidation />} />
                                <Route path="/admin/timesheet-global" element={<TimesheetForm userRole="ADMIN" />} />
                                <Route path="/admin/saisie-absence" element={<AbsenceForm userRole="ADMIN" />} />
                            </Route>

                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </div>
                </div>
            </main>
        </div>
    );
};

const NavigationContent = ({ userRole, sectionTitleStyle }) => {
    const location = useLocation();

    return (
        <>
            <div style={sectionTitleStyle}>Général</div>
            <NavLink to="/" active={location.pathname === '/'}>
                <div className="flex items-center gap-3">
                    <LayoutDashboard size={18} />
                    <span>{userRole === 'ADMIN' ? 'Pilotage Global' : 'Mon Dashboard'}</span>
                </div>
            </NavLink>

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
                    <NavLink to="/rpi" active={location.pathname === '/rpi'}>
                        <div className="flex items-center gap-3">
                            <FileText size={18} />
                            <span>Mes RPI</span>
                        </div>
                    </NavLink>
                    <NavLink to="/rapport-activite" active={location.pathname === '/rapport-activite'}>
                        <div className="flex items-center gap-3">
                            <ClipboardList size={18} />
                            <span>Mon Rapport d'Activité</span>
                        </div>
                    </NavLink>
                </>
            )}

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
                    <NavLink to="/rpi" active={location.pathname === '/rpi'}>
                        <div className="flex items-center gap-3">
                            <FileText size={18} />
                            <span>RPI Consultants</span>
                        </div>
                    </NavLink>
                    <NavLink to="/rapport-activite" active={location.pathname === '/rapport-activite'}>
                        <div className="flex items-center gap-3">
                            <ClipboardList size={18} />
                            <span>Rapports d'Activité</span>
                        </div>
                    </NavLink>
                    <NavLink to="/admin/rapports-validation" active={location.pathname === '/admin/rapports-validation'}>
                        <div className="flex items-center gap-3">
                            <ClipboardList size={18} />
                            <span>Valider les RA</span>
                        </div>
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
