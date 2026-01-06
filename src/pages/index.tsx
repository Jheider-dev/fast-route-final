import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';
import ThemeToggle from '../components/ThemeToggle'; 

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Verificar rol antes de mandar a ciegas
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .single();
        
        if (profile?.role === 'admin') router.push('/admin');
        else if (profile?.role === 'driver') router.push('/driver');
        else router.push('/map'); // Solo estudiantes al mapa
      }
      setLoading(false);
    };
    checkUser();
  }, [router]);

  if (loading) return null; 

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden transition-colors duration-300 bg-gray-50 text-slate-900 dark:bg-slate-900 dark:text-white">
      
      {/* Decoración de Fondo (Solo visible en modo oscuro para no molestar en blanco) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none opacity-0 dark:opacity-20 transition-opacity duration-500">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600 rounded-full mix-blend-multiply filter blur-[120px] animate-blob"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600 rounded-full mix-blend-multiply filter blur-[120px] animate-blob animation-delay-2000"></div>
      </div>

      {/* Navbar */}
      <nav className="relative z-10 p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="text-2xl font-bold tracking-tighter bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-500 bg-clip-text text-transparent">
          FAST ROUTE
        </div>
        
        <div className="flex items-center gap-4">
          {/* Aquí vive tu botón de cambio de tema */}
          <ThemeToggle />
          
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-black dark:text-slate-300 dark:hover:text-white transition">
            Soy Administrativo
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 mt-10">
        <div className="inline-block px-4 py-1.5 mb-6 rounded-full border border-blue-500/30 bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 text-xs font-semibold tracking-wide uppercase transition-colors">
          Versión 2.0 • Universidad Nacional del Altiplano
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight text-slate-900 dark:text-white transition-colors">
          Tu transporte, <br />
          <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-500 dark:from-blue-400 dark:via-purple-400 dark:to-emerald-400 bg-clip-text text-transparent">
            en tiempo real.
          </span>
        </h1>
        
        <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-400 mb-10 leading-relaxed transition-colors">
          Olvídate de esperar sin saber. Ubica los buses universitarios al instante, 
          calcula tus tiempos y llega seguro a tus clases con nuestra nueva plataforma.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <Link href="/login" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:scale-105 text-center">
            Iniciar Sesión
          </Link>
          <Link href="/register" className="flex-1 bg-white text-slate-900 border border-slate-200 hover:bg-gray-50 dark:bg-slate-800 dark:text-white dark:border-slate-700 dark:hover:bg-slate-700 font-bold py-4 rounded-xl transition-all hover:scale-105 text-center">
            Crear Cuenta
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-16 border-t border-slate-200 dark:border-slate-800/50 mt-20 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm transition-colors">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-8">
            Desarrollado por el Equipo de Ingeniería de Sistemas - 4to semestre
          </h2>
          
          <div className="flex flex-wrap justify-center gap-8">
            {/* MIEMBRO 1 */}
            <div className="group">
              <div className="w-16 h-16 mx-auto rounded-full p-[2px] bg-gradient-to-br from-blue-500 to-purple-600">
                <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-xl transition-colors">
                  👨‍💻
                </div>
              </div>
              <p className="mt-3 font-medium text-slate-900 dark:text-white">Elvis Zela</p>
              <p className="text-xs text-slate-500">---</p>
            </div>

            {/* MIEMBRO 2 */}
            <div className="group">
              <div className="w-16 h-16 mx-auto rounded-full p-[2px] bg-slate-200 dark:bg-slate-700 group-hover:bg-gradient-to-br group-hover:from-emerald-500 group-hover:to-teal-500 transition-all">
                 <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-xl transition-colors">
                  🚀
                </div>
              </div>
              <p className="mt-3 font-medium text-slate-900 dark:text-white">Jhon Mamani</p>
              <p className="text-xs text-slate-500">---</p>
            </div>

            {/* MIEMBRO 3 */}
            <div className="group">
              <div className="w-16 h-16 mx-auto rounded-full p-[2px] bg-slate-200 dark:bg-slate-700 group-hover:bg-gradient-to-br group-hover:from-pink-500 group-hover:to-orange-500 transition-all">
                 <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-xl transition-colors">
                  🎨
                </div>
              </div>
              <p className="mt-3 font-medium text-slate-900 dark:text-white">Cristian Cauna</p>
              <p className="text-xs text-slate-500">---</p>
            </div>
          </div>
          
          <p className="mt-12 text-slate-400 text-xs">
            © 2025 Universidad Nacional del Altiplano - Puno
          </p>
        </div>
      </footer>
    </div>
  );
}