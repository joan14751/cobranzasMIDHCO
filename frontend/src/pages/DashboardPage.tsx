import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { getDocumentos } from '../lib/supabaseService';
import { parseCobranzaExcelFile } from '../lib/excelService';
import { Users, DollarSign, AlertTriangle, Clock, RefreshCw, Search, PieChart as PieIcon, BarChart3, BarChartHorizontal } from 'lucide-react'; 
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';

interface DocumentoExtendido {
  id: string;
  nombre: string;
  ruta_archivo: string;
  url_archivo: string;
  fecha_carga?: string;
  cliente_id?: string | null;
}

type ChartType = 'pie' | 'tramos' | 'representantes';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [allRows, setAllRows] = useState<any[]>([]);
  
  const [chartType, setChartType] = useState<ChartType>('pie');

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

  const filteredRows = allRows.filter((row: any) => {
    const term = searchTerm.toLowerCase().trim();
    const representante = (row.representante || row.vendedor || '').toLowerCase();
    return representante.includes(term);
  });

  const clientesActivos = new Set(filteredRows.map((row: any) => row.ruc_dni || row.cliente)).size;
  
  let saldoPendienteTotal = 0;
  let montoEnMoraTotal = 0;       
  let montoPorVencerTotal = 0;    
  let conteoAlDia = 0;
  let conteoEnMora = 0;

  let conteo1_15 = 0;
  let conteo16_45 = 0;
  let conteo46Mas = 0;

  const repSaldosMap: { [key: string]: number } = {};
  const documentosEnMoraList: any[] = [];

  filteredRows.forEach((row: any) => {
    const saldoItem = Number(row.saldo || 0);
    saldoPendienteTotal += saldoItem;
    
    const diasMora = Number(row.dias_mora || 0);
    const estado = (row.estado || '').toLowerCase();
    const repNombre = row.representante || row.vendedor || 'No Asignado';

    repSaldosMap[repNombre] = (repSaldosMap[repNombre] || 0) + saldoItem;

    if (diasMora > 0 || estado.includes('mora')) {
      montoEnMoraTotal += saldoItem; 
      conteoEnMora++;
      documentosEnMoraList.push(row); 

      if (diasMora <= 15) conteo1_15++;
      else if (diasMora <= 45) conteo16_45++;
      else conteo46Mas++;
    } else {
      montoPorVencerTotal += saldoItem; 
      conteoAlDia++;
    }
  });

  const estadoData = [
    { name: 'Al Día', value: conteoAlDia, color: '#10B981' },
    { name: 'En Mora', value: conteoEnMora, color: '#EF4444' }
  ].filter(item => item.value > 0);

  const tramosData = [
    { tramo: 'Al Día', cantidad: conteoAlDia, color: '#10B981' },
    { tramo: '1-15 días', cantidad: conteo1_15, color: '#FBBF24' },
    { tramo: '16-45 días', cantidad: conteo16_45, color: '#F97316' },
    { tramo: '46+ días', cantidad: conteo46Mas, color: '#EF4444' }
  ];

  const representantesData = Object.keys(repSaldosMap)
    .map((rep) => ({
      nombre: rep.length > 12 ? rep.substring(0, 12) + '...' : rep,
      saldo: repSaldosMap[rep]
    }))
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, 5);

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

  const handleDocumentClick = (numDoc: string) => {
    if (!numDoc) return;
    navigate('/pagos', { state: { searchDocumento: numDoc } });
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Procesando archivo activo y generando gráficos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Resumen operativo basado en los datos del último Excel cargado.</p>
        </div>
        <button
          onClick={loadDashboardData}
          className="self-start inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 transition hover:bg-gray-50 dark:hover:bg-slate-700"
        >
          <RefreshCw className="h-3 w-3" />
          Actualizar
        </button>
      </div>

      {/* BUSCADOR */}
      <div className="relative max-w-md">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4 w-4 text-gray-400 dark:text-slate-500" />
        </div>
        <input
          type="text"
          placeholder="Buscar por representante..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
        />
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Clientes Activos */}
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between">
          <div>
            <div className="inline-flex p-3 bg-blue-50 dark:bg-blue-950/40 rounded-2xl mb-4">
              <Users className="h-6 w-6 text-blue-500 dark:text-blue-400" />
            </div>
            <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">Clientes Activos</p>
          </div>
          <p className="text-4xl font-bold text-gray-900 dark:text-slate-100 mt-1">{clientesActivos.toLocaleString('es-PE')}</p>
        </div>

        {/* Saldo Pendiente */}
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between">
          <div>
            <div className="inline-flex p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl mb-4">
              <DollarSign className="h-6 w-6 text-amber-500 dark:text-amber-400" />
            </div>
            <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">Saldo Pendiente</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 mt-1 truncate">
            S/. {saldoPendienteTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* En Mora (Monto) */}
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between">
          <div>
            <div className="inline-flex p-3 bg-red-50 dark:bg-red-950/40 rounded-2xl mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500 dark:text-red-400" />
            </div>
            <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">En Mora (Monto)</p>
          </div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1 truncate">
            S/. {montoEnMoraTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Monto Por Vencer */}
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between">
          <div>
            <div className="inline-flex p-3 bg-green-50 dark:bg-green-950/40 rounded-2xl mb-4">
              <Clock className="h-6 w-6 text-green-500 dark:text-green-400" />
            </div>
            <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">Monto Por Vencer</p>
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1 truncate">
            S/. {montoPorVencerTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* CHARTS & DETAILED LIST SECTION */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        
        {/* SECCIÓN DEL GRÁFICO DINÁMICO */}
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-slate-100 text-base">Análisis Gráfico</h3>
              <p className="text-xs text-gray-400 dark:text-slate-500">Selecciona el tipo de visualización</p>
            </div>

            <div className="inline-flex rounded-xl bg-gray-100 dark:bg-slate-700/60 p-1 gap-1 self-start sm:self-auto">
              <button
                onClick={() => setChartType('pie')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  chartType === 'pie'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                }`}
              >
                <PieIcon className="h-3.5 w-3.5" />
                Estado
              </button>

              <button
                onClick={() => setChartType('tramos')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  chartType === 'tramos'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Tramos
              </button>

              <button
                onClick={() => setChartType('representantes')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  chartType === 'representantes'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                }`}
              >
                <BarChartHorizontal className="h-3.5 w-3.5" />
                Top Rep.
              </button>
            </div>
          </div>

          <div className="w-full h-[300px] flex items-center justify-center">
            {filteredRows.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500">No hay información para el criterio buscado</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'pie' ? (
                  <PieChart>
                    <Pie 
                      data={estadoData} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={3}
                      labelLine={false}
                      label={renderCustomizedLabel}
                    >
                      {estadoData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} docs`, 'Cantidad']} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>

                ) : chartType === 'tramos' ? (
                  <BarChart data={tramosData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                    <XAxis dataKey="tramo" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <Tooltip formatter={(val) => [`${val} documentos`, 'Total']} />
                    <Bar dataKey="cantidad" radius={[6, 6, 0, 0]}>
                      {tramosData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>

                ) : (
                  <BarChart data={representantesData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(val) => `S/.${(val/1000).toFixed(0)}k`} />
                    <YAxis dataKey="nombre" type="category" tick={{ fontSize: 11, fill: '#94A3B8' }} width={90} />
                    <Tooltip formatter={(val: any) => [`S/. ${Number(val).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, 'Saldo Total']} />
                    <Bar dataKey="saldo" fill="#3B82F6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Resumen General: LISTADO DE MORA CON DÍAS */}
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-gray-800 dark:text-slate-100">Resumen General</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Lista de documentos vencidos o en mora para este criterio.</p>
          </div>

          <div className="flex-1 overflow-auto max-h-[290px] border border-gray-100 dark:border-slate-700 rounded-xl">
            {documentosEnMoraList.length === 0 ? (
              <div className="flex h-full items-center justify-center py-12 text-sm text-gray-400 dark:text-slate-500">
                Ningún documento en mora encontrado.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 dark:bg-slate-900/60 sticky top-0 text-gray-600 dark:text-slate-300 font-semibold border-b border-gray-100 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Documento</th>
                    <th className="p-3 text-center">Días Mora</th>
                    <th className="p-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50 text-gray-700 dark:text-slate-300">
                  {documentosEnMoraList.map((doc: any, index: number) => {
                    const numeroDocumento = doc.documento || doc.num_doc || '';
                    return (
                      <tr key={index} className="hover:bg-gray-50/70 dark:hover:bg-slate-700/30 transition">
                        <td className="p-3 font-medium truncate max-w-[130px]">{doc.cliente || 'Desconocido'}</td>
                        <td className="p-3">
                          {numeroDocumento ? (
                            <button
                              onClick={() => handleDocumentClick(numeroDocumento)}
                              className="font-mono text-blue-600 dark:text-blue-400 hover:underline font-semibold bg-transparent border-none p-0 cursor-pointer text-left"
                            >
                              {numeroDocumento}
                            </button>
                          ) : (
                            <span className="text-gray-400 dark:text-slate-500">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-md font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50">
                            {doc.dias_mora || 0} d
                          </span>
                        </td>
                        <td className="p-3 text-right font-semibold text-red-600 dark:text-red-400">
                          S/. {Number(doc.saldo || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500">
            <span>Total ítems observados: <strong>{documentosEnMoraList.length}</strong></span>
            {searchTerm && <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md font-medium">Filtro: {searchTerm}</span>}
          </div>
        </div>

      </div>
    </div>
  );
}