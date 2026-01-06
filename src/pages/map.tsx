import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';

const MapComponent = dynamic(() => import('../components/Map'), { 
  ssr: false,
  loading: () => (
    <div className="h-screen w-full flex items-center justify-center bg-slate-900 text-white">
      <div className="animate-pulse flex flex-col items-center">
        <div className="text-4xl mb-4">🚌</div>
        <p className="text-sm font-light tracking-widest">CARGANDO RUTA...</p>
      </div>
    </div>
  )
});

export default function MapPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setAuthorized(true);
      }
    };
    checkSession();
  }, [router]);

  if (!authorized) return null;

  return <MapComponent />;
}