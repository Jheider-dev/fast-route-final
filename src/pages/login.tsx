import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 1. Iniciar sesión
    const { data: { session }, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError || !session) {
      setError("Credenciales incorrectas o usuario no registrado.");
      setLoading(false);
      return;
    }

    // 2. Verificar Rol
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (profileError) {
      console.error("Error obteniendo perfil:", profileError);
      setError("Inicio correcto, pero no se pudo verificar tu rol.");
      setLoading(false);
      return;
    }

    // 3. Redirección basada en Rol
    if (profile?.role === 'admin') router.push('/admin');
    else if (profile?.role === 'driver') router.push('/driver');
    else router.push('/map'); // Estudiantes por defecto
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Fondo decorativo */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>

      <div className="z-10 w-full max-w-md bg-slate-800/50 backdrop-blur-md p-8 rounded-2xl border border-slate-700 shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">Bienvenido</h1>
          <p className="text-slate-400 mt-2">Sistema de Transporte Universitario</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm text-center mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Correo Institucional</label>
            <input
              type="email"
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-slate-500 outline-none transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@est.unap.edu.pe"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Contraseña</label>
            <input
              type="password"
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-slate-500 outline-none transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition duration-200 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="text-center text-sm text-slate-400 mt-6">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium hover:underline">
            Regístrate aquí
          </Link>
        </div>
      </div>
    </div>
  );
}