import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';

export default function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [buses, setBuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /* =========================
     1. Verificación ADMIN
     ========================= */
  useEffect(() => {
    async function checkAdmin() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (error || data?.role !== 'admin') {
        alert('Acceso denegado');
        router.push('/');
        return;
      }

      await fetchData();
    }

    checkAdmin();
  }, []);

  /* =========================
     2. Cargar datos (RPC)
     ========================= */
  async function fetchData() {
    setLoading(true);

    const { data: usersData, error: usersError } =
      await supabase.rpc('get_all_users');

    const { data: busesData, error: busesError } =
      await supabase.from('buses').select('*');

    if (usersError) {
      alert('Error cargando usuarios');
      console.error(usersError);
    }

    if (busesError) {
      alert('Error cargando buses');
      console.error(busesError);
    }

    if (usersData) setUsers(usersData);
    if (busesData) setBuses(busesData);

    setLoading(false);
  }

  /* =========================
     3. Actualizar usuario (RPC)
     ========================= */
  async function updateUser(
    userId: string,
    field: 'role' | 'bus_id',
    value: any
  ) {
    const { error } = await supabase.rpc('admin_update_user', {
      p_user_id: userId,
      p_field: field,
      p_value: value
    });

    if (error) {
      alert('Error actualizando');
      console.error(error);
      return;
    }

    setUsers(users.map(u =>
      u.user_id === userId ? { ...u, [field]: value } : u
    ));
  }

  /* =========================
     4. Logout
     ========================= */
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  /* =========================
     LOADING
     ========================= */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  /* =========================
     UI
     ========================= */
  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 relative overflow-hidden">

      {/* Fondo neón */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply blur-3xl opacity-10 animate-blob"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply blur-3xl opacity-10 animate-blob animation-delay-2000"></div>

      <div className="max-w-7xl mx-auto relative z-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Panel de Administración
            </h1>
            <p className="text-slate-400 mt-1">
              Gestión de Usuarios, Roles y Flota
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm shadow-lg"
          >
            Cerrar Sesión
          </button>
        </div>

        {/* Tabla */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-900/80 text-slate-400 text-xs uppercase border-b border-slate-700">
                  <th className="p-5">Usuario / Email</th>
                  <th className="p-5">Rol</th>
                  <th className="p-5">Bus</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-700/50">
                {users.map(user => (
                  <tr key={user.user_id} className="hover:bg-slate-700/30">

                    {/* Email */}
                    <td className="p-5">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center mr-3 text-xs font-bold">
                          {user.email.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-mono text-sm">{user.email}</span>
                      </div>
                    </td>

                    {/* Rol */}
                    <td className="p-5">
                      <select
                        value={user.role || 'reader'}
                        onChange={(e) =>
                          updateUser(user.user_id, 'role', e.target.value)
                        }
                        className="bg-slate-900 text-white rounded-lg px-3 py-1.5"
                      >
                        <option value="reader">Lector</option>
                        <option value="driver">Conductor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>

                    {/* Bus */}
                    <td className="p-5">
                      {user.role === 'driver' ? (
                        <select
                          value={user.bus_id || ''}
                          onChange={(e) =>
                            updateUser(user.user_id, 'bus_id', e.target.value)
                          }
                          className="bg-slate-900 border border-slate-600 text-white rounded-lg p-2"
                        >
                          <option value="">-- Sin Bus --</option>
                          {buses.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-600 text-xs italic">
                          No requiere bus
                        </span>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-slate-500">
          Mostrando {users.length} usuarios
        </div>

      </div>
    </div>
  );
}
