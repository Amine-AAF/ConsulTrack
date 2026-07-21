import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, User, LogIn, AlertTriangle } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [sessionExpiree, setSessionExpiree] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    // Drapeau posé par l'intercepteur axios quand un 401 a purgé la session.
    // Jamais remis à false ici : StrictMode monte le composant deux fois et le
    // second passage ne trouverait plus le drapeau.
    useEffect(() => {
        if (sessionStorage.getItem('sessionExpiree') === '1') {
            setSessionExpiree(true);
            sessionStorage.removeItem('sessionExpiree');
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSessionExpiree(false);

        const result = await login(email, password);

        if (result.success) {
            // Redirection selon le rôle
            if (result.role === 'ADMIN') navigate('/admin');
            else if (result.role === 'RESPONSABLE') navigate('/validation');
            else navigate('/timesheet');
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
                <div className="text-center mb-8">
                    <div className="bg-[#003366] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <Lock className="text-white" size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-[#003366]">Connexion</h2>
                    <p className="text-gray-400 text-sm">ConsultTrack System</p>
                </div>

                {sessionExpiree && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-700 p-3 rounded-lg text-sm mb-4 font-bold flex items-start gap-2">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                        <span>Votre session a expiré. Merci de vous authentifier à nouveau pour continuer.</span>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm mb-4 font-bold text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input
                                type="email"
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#003366] outline-none transition-all font-medium"
                                placeholder="nom@cdgcapital.ma"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mot de passe</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input
                                type="password"
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#003366] outline-none transition-all font-medium"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-[#003366] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#002244] transition-all shadow-lg hover:shadow-xl">
                        <LogIn size={20} /> Se connecter
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;