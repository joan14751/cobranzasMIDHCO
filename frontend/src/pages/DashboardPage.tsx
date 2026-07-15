import React, { useState, useEffect } from 'react';
import { getDashboardMetrics } from '../lib/supabaseService'; // Asegúrate de ajustar la ruta si está en otra carpeta
import { Cliente } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface EstadoClienteGrafico {
  name: string;
  value: number;
  color: string;
}

interface HistorialPagoGrafico {
  mes: string;
  Cobrado: number;
  Pendiente: number;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [clientesActivos, setClientesActivos] = useState(0);
  const [saldoPendiente, setSaldoPendiente] = useState(0);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [estadoClientes, setEstadoClientes] = useState<EstadoClienteGrafico[]>([]);
  const [pagosMensuales, setPagosMensuales] = useState<HistorialPagoGrafico[]>([]);

  const fetchMetrics = async () => {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await getDashboardMetrics();
    
    if (error) {
      setErrorMsg(error);
    } else if (data) {
      setClientesActivos(data.clientesActivos);
      setSaldoPendiente(data.saldoPendienteTotal);
      setClientes(data.clientesLista);
      setEstadoClientes(data.datosEstadoClientes);
      setPagosMensuales(data.datosPagosMensuales);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const formatearMoneda = (valor: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(valor);
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        <p className="text-sm font-medium text-gray-500">Analizando registros y flujo financiero...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-6 text-center">
        <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-6">
          <h3 className="text-lg font-bold text-red-800">Error al cargar datos</h3>
          <p className="mt-2 text-sm text-red-600">{errorMsg}</p>
          <button 
            onClick={fetchMetrics} 
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
          >
            Reintentar enlace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Encabezado del Dashboard */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-500">Resumen operativo y estadísticas reales del control de pagos.</p>
        </div>
        <button 
          onClick={fetchMetrics}
          className="self-start rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
        >
          Sincronizar Supabase
        </button>
      </div>

      {/* Tarjetas de Indicadores Principales (KPIs) */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Clientes activos</span>
          <h3 className="mt-2 text-3xl font-bold text-gray-800">{clientesActivos}</h3>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Saldo pendiente</span>
          <h3 className={`mt-2 text-3xl font-bold ${saldoPendiente > 0 ? 'text-red-600' : 'text-gray-800'}`}>
            {formatearMoneda(saldoPendiente)}
          </h3>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Estado del Sistema</span>
          <h3 className="mt-2 text-3xl font-bold text-emerald-600">Operativo</h3>
        </div>
      </div>

      {/* SECCIÓN DE GRÁFICOS ESTADÍSTICOS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Gráfico 1: Control de Flujo de Caja (Barras) */}
        <div className="rounded-xl border bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-800">Historial de Cobros vs. Pendientes</h3>
            <p className="text-xs text-gray-400">Comparativa mensual de montos cobrados frente a saldos vencidos.</p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={pagosMensuales}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="mes" stroke="#9CA3AF" fontSize={11} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip 
                  formatter={(value) => [formatearMoneda(Number(value)), '']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', pt: 10 }} />
                <Bar name="Cobrado ($)" dataKey="Cobrado" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                <Bar name="Pendiente ($)" dataKey="Pendiente" fill="#FDA4AF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Composición de la Cartera (Dona) */}
        <div className="rounded-xl border bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Distribución de Clientes</h3>
            <p className="text-xs text-gray-400">Estado de salud de la cartera.</p>
          </div>
          
          <div className="flex h-56 items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={estadoClientes}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {estadoClientes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} Clientes`, 'Cantidad']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-800">{clientesActivos}</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Total</span>
            </div>
          </div>
          
          {/* Leyenda inteligente */}
          <div className="mt-2 space-y-2">
            {estadoClientes.map((estado, idx) => {
              const porcentaje = clientesActivos > 0 ? Math.round((estado.value / clientesActivos) * 100) : 0;
              return (
                <div key={idx} className="flex items-center justify-between text-xs font-medium text-gray-600 border-t border-gray-50 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: estado.color }} />
                    <span>{estado.name}</span>
                  </div>
                  <span className="font-semibold text-gray-800">{estado.value} ({porcentaje}%)</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* TABLA DE CLIENTES */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-800">Últimos clientes</h3>
          <p className="text-xs text-gray-500">Monitoreo de cuentas sincronizadas recientemente.</p>
        </div>
        
        {clientes.length === 0 ? (
          <p className="text-center py-6 text-sm text-gray-400">No hay clientes cargados en la base de datos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                  <th className="py-3 px-4">Nombre</th>
                  <th className="py-3 px-4">Nº de Crédito</th>
                  <th className="py-3 px-4">Saldo Pendiente</th>
                  <th className="py-3 px-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clientes.map((cli) => {
                  const isMora = (cli.estado || '').toLowerCase().includes('mora');
                  return (
                    <tr key={cli.id} className="hover:bg-gray-50 transition duration-150">
                      <td className="py-4 px-4 font-medium text-gray-900 capitalize">{cli.nombre}</td>
                      <td className="py-4 px-4 text-gray-500">{cli.numero_credito || 'N/A'}</td>
                      <td className={`py-4 px-4 font-semibold ${Number(cli.saldo_pendiente) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatearMoneda(Number(cli.saldo_pendiente))}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isMora ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {cli.estado || 'Al Día'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}