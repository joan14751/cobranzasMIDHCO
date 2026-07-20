import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // AÑADIDO: Importamos useNavigate para la redirección
import { toast } from 'react-hot-toast';
import { getDocumentos } from '../lib/supabaseService';
import { parseCobranzaExcelFile } from '../lib/excelService';
import { Users, DollarSign, AlertTriangle, Clock, RefreshCw, Search } from 'lucide-react'; 
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

interface DocumentoExtendido {
  id: string;
  nombre: string;
  ruta_archivo: string;
  url_archivo: string;
  fecha_carga?: string;
  cliente_id?: string | null;
}

export default function DashboardPage() {
  const navigate = useNavigate(); // AÑADIDO: Inicializamos el hook de navegación
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [allRows, setAllRows] = useState<any[]>([]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const { data, error } = await getDocumentos();
      if (error) throw new Error(error);

      const documentos = (data || []) as unknown as DocumentoExtendido[];

      if (documentos.length === 0) {
        setLoading(false);
        return;
      }

      const excelDocs = documentos.filter((doc) => 
        doc.ruta_archivo && (doc.ruta_archivo.endsWith('.xls') || doc.ruta_archivo.endsWith('.xlsx'))
      );

      if (excelDocs.length === 0) {
        setLoading(false);
        return;
      }

      const ultimoExcel = excelDocs[0];

      if (!ultimoExcel.url_archivo) {
        throw new Error('El archivo encontrado no posee una URL de descarga válida.');
      }

      const response = await fetch(ultimoExcel.url_archivo);
      const blob = await response.blob();
      const file = new File([blob], ultimoExcel.nombre, { type: blob.type });

      const parsedRows = await parseCobranzaExcelFile(file);
      setAllRows(parsedRows);

    } catch (err: any) {
      console.error(err);
      toast.error('Error al sincronizar gráficos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // --- FILTRADO POR REPRESENTANTE ---
  const filteredRows = allRows.filter((row: any) => {
    const term = searchTerm.toLowerCase().trim();
    const representante = (row.representante || row.vendedor || '').toLowerCase();
    return representante.includes(term);
  });

  // --- MÉTRICAS Y FILTRADO DE MORA ---
  const clientesActivos = new Set(filteredRows.map((row: any) => row.ruc_dni || row.cliente)).size;
  
  let saldoPendienteTotal = 0;
  let montoEnMoraTotal = 0;       
  let montoPorVencerTotal = 0;    
  let conteoAlDia = 0;
  let conteoEnMora = 0;

  const documentosEnMoraList: any[] = [];

  filteredRows.forEach((row: any) => {
    const saldoItem = Number(row.saldo || 0);
    saldoPendienteTotal += saldoItem;
    
    const diasMora = Number(row.dias_mora || 0);
    const estado = (row.estado || '').toLowerCase();

    if (diasMora > 0 || estado.includes('mora')) {
      montoEnMoraTotal += saldoItem; 
      conteoEnMora++;
      documentosEnMoraList.push(row); 
    } else {
      montoPorVencerTotal += saldoItem; 
      conteoAlDia++;
    }
  });

  const estadoData = [
    { name: 'Al Día', value: conteoAlDia, color: '#10B981' },
    { name: 'En Mora', value: conteoEnMora, color: '#EF4444' }
  ].filter(item => item.value > 0);

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent === 0) return null;
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-xs font-bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // NUEVO: Función encargada de redirigir a la vista de Pagos mandando el ID del documento
  const handleDocumentClick = (numDoc: string) => {
    if (!numDoc) return;
    navigate('/pagos', { state: { searchDocumento: numDoc } });
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="text-sm font-medium text-gray-500">Procesando archivo activo y generando gráficos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-500">Resumen operativo basado en los datos del último Excel cargado.</p>
        </div>
        <button
          onClick={loadDashboardData}
          className="self-start inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          <RefreshCw className="h-3 w-3" />
          Actualizar
        </button>
      </div>

      {/* BUSCADOR */}
      <div className="relative max-w-md">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar por representante..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Clientes Activos */}
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="inline-flex p-3 bg-blue-50 rounded-2xl mb-4">
              <Users className="h-6 w-6 text-blue-500" />
            </div>
            <p className="text-gray-500 text-sm font-medium">Clientes Activos</p>
          </div>
          <p className="text-4xl font-bold text-gray-900 mt-1">{clientesActivos.toLocaleString('es-PE')}</p>
        </div>

        {/* Saldo Pendiente */}
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="inline-flex p-3 bg-amber-50 rounded-2xl mb-4">
              <DollarSign className="h-6 w-6 text-amber-500" />
            </div>
            <p className="text-gray-500 text-sm font-medium">Saldo Pendiente</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1 truncate">
            S/. {saldoPendienteTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* En Mora (Monto) */}
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="inline-flex p-3 bg-red-50 rounded-2xl mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-gray-500 text-sm font-medium">En Mora (Monto)</p>
          </div>
          <p className="text-2xl font-bold text-red-600 mt-1 truncate">
            S/. {montoEnMoraTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Monto Por Vencer */}
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="inline-flex p-3 bg-green-50 rounded-2xl mb-4">
              <Clock className="h-6 w-6 text-green-500" />
            </div>
            <p className="text-gray-500 text-sm font-medium">Monto Por Vencer</p>
          </div>
          <p className="text-2xl font-bold text-green-600 mt-1 truncate">
            S/. {montoPorVencerTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* CHARTS & DETAILED LIST SECTION */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        
        {/* Distribución por Estado */}
        <div className="rounded-3xl bg-white p-8 shadow-sm border border-gray-100 flex flex-col justify-between">
          <h3 className="mb-4 font-bold text-gray-800">Distribución por Estado</h3>
          <div className="w-full h-[320px] flex items-center justify-center">
            {estadoData.length === 0 ? (
              <p className="text-sm text-gray-400">No hay información para el representante buscado</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={estadoData} 
                    dataKey="value" 
                    nameKey="name" 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={100}
                    labelLine={false}
                    label={renderCustomizedLabel}
                  >
                    {estadoData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} documentos`, 'Cantidad']} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Resumen General: LISTADO DE MORA CON DÍAS */}
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-gray-800">Resumen General</h3>
            <p className="text-xs text-gray-500 mt-0.5">Lista de documentos vencidos o en mora para este criterio.</p>
          </div>

          {/* Tabla con scroll interno */}
          <div className="flex-1 overflow-auto max-h-[290px] border border-gray-100 rounded-xl">
            {documentosEnMoraList.length === 0 ? (
              <div className="flex h-full items-center justify-center py-12 text-sm text-gray-400">
                Ningún documento en mora encontrado.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 sticky top-0 text-gray-600 font-semibold border-b border-gray-100">
                  <tr>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Documento</th>
                    <th className="p-3 text-center">Días Mora</th>
                    <th className="p-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-700">
                  {documentosEnMoraList.map((doc: any, index: number) => {
                    const numeroDocumento = doc.documento || doc.num_doc || '';
                    return (
                      <tr key={index} className="hover:bg-gray-50/70 transition">
                        <td className="p-3 font-medium truncate max-w-[130px]">{doc.cliente || 'Desconocido'}</td>
                        
                        {/* MODIFICADO: Celda de documento ahora es un botón clickeable */}
                        <td className="p-3">
                          {numeroDocumento ? (
                            <button
                              onClick={() => handleDocumentClick(numeroDocumento)}
                              className="font-mono text-blue-600 hover:text-blue-800 hover:underline font-semibold transition bg-transparent border-none p-0 cursor-pointer text-left focus:outline-none"
                            >
                              {numeroDocumento}
                            </button>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>

                        <td className="p-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-md font-bold text-red-700 bg-red-50">
                            {doc.dias_mora || 0} d
                          </span>
                        </td>
                        <td className="p-3 text-right font-semibold text-red-600">
                          S/. {Number(doc.saldo || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
            <span>Total ítems observados: <strong>{documentosEnMoraList.length}</strong></span>
            {searchTerm && <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-medium">Filtro: {searchTerm}</span>}
          </div>
        </div>

      </div>
    </div>
  );
}