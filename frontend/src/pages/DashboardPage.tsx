import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { getDocumentos } from '../lib/supabaseService';
import { parseCobranzaExcelFile } from '../lib/excelService';
import { 
  Users, 
  DollarSign, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Search, 
  PieChart as PieIcon, 
  BarChart3, 
  BarChartHorizontal,
  Target,
  CheckCircle2,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Wallet,
  Building2,
  X,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet
} from 'lucide-react'; 
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

interface ClienteCritico {
  ruc_dni: string;
  cliente: string;
  saldoTotal: number;
  maxDiasMora: number;
  representante: string;
}

type ChartType = 'pie' | 'tramos' | 'representantes';

// HELPER REUTILIZABLE PARA MONEDA EN SOLES
const fmtSoles = (monto: number, decimales: number = 2) => {
  return `S/. ${Number(monto || 0).toLocaleString('es-PE', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}`;
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [allRows, setAllRows] = useState<any[]>([]);
  const [previousRows, setPreviousRows] = useState<any[]>([]); // Para deltas de comparación
  
  // Lista de archivos Excel disponibles en Supabase
  const [excelDocs, setExcelDocs] = useState<DocumentoExtendido[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');

  const [chartType, setChartType] = useState<ChartType>('pie');

  // Paginación para la tabla de vencidos
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Cargar lista de documentos Excel
  const fetchExcelList = async () => {
    try {
      const { data, error } = await getDocumentos();
      if (error) throw new Error(error);

      const documentos = (data || []) as unknown as DocumentoExtendido[];
      const excels = documentos.filter((doc) => 
        doc.ruta_archivo && (doc.ruta_archivo.endsWith('.xls') || doc.ruta_archivo.endsWith('.xlsx'))
      );

      setExcelDocs(excels);

      if (excels.length > 0 && !selectedDocId) {
        setSelectedDocId(excels[0].id);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Error al obtener lista de documentos: ' + err.message);
    }
  };

  // Cargar datos del documento seleccionado y del previo (para comparativas)
  const loadDashboardData = async () => {
    if (!selectedDocId && excelDocs.length === 0) return;
    setLoading(true);

    try {
      const currentIndex = excelDocs.findIndex(d => d.id === selectedDocId);
      const targetDoc = excelDocs[currentIndex] || excelDocs[0];

      if (!targetDoc?.url_archivo) {
        throw new Error('El archivo seleccionado no posee una URL válida.');
      }

      // 1. Cargar el Excel principal
      const response = await fetch(targetDoc.url_archivo);
      const blob = await response.blob();
      const file = new File([blob], targetDoc.nombre, { type: blob.type });
      const parsedRows = await parseCobranzaExcelFile(file);
      setAllRows(parsedRows);

      // 2. Cargar el Excel anterior si existe para calcular la métrica comparativa (delta)
      if (currentIndex >= 0 && currentIndex + 1 < excelDocs.length) {
        const prevDoc = excelDocs[currentIndex + 1];
        if (prevDoc?.url_archivo) {
          const prevRes = await fetch(prevDoc.url_archivo);
          const prevBlob = await prevRes.blob();
          const prevFile = new File([prevBlob], prevDoc.nombre, { type: prevBlob.type });
          const prevParsed = await parseCobranzaExcelFile(prevFile);
          setPreviousRows(prevParsed);
        } else {
          setPreviousRows([]);
        }
      } else {
        setPreviousRows([]);
      }

    } catch (err: any) {
      console.error(err);
      toast.error('Error al procesar el archivo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExcelList();
  }, []);

  useEffect(() => {
    if (selectedDocId) {
      loadDashboardData();
    }
  }, [selectedDocId]);

  // Restablecer paginación al buscar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDocId]);

  // Lista de representantes únicos
  const listaRepresentantes = useMemo(() => {
    return Array.from(
      new Set(
        allRows
          .map((row: any) => row.representante || row.vendedor)
          .filter((rep: any) => rep && typeof rep === 'string' && rep.trim() !== '')
      )
    ).sort();
  }, [allRows]);

  // Filtrado por representante
  const filteredRows = useMemo(() => {
    return allRows.filter((row: any) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase().trim();
      const representante = (row.representante || row.vendedor || '').toLowerCase();
      return representante.includes(term);
    });
  }, [allRows, searchTerm]);

  // Cálculo del Período Anterior (para Deltas)
  const prevMontoEnMoraTotal = useMemo(() => {
    if (previousRows.length === 0) return 0;
    return previousRows.reduce((acc: number, row: any) => {
      const diasMora = Number(row.dias_mora || 0);
      const estado = (row.estado || '').toLowerCase();
      if (diasMora > 0 || estado.includes('mora')) {
        return acc + Number(row.saldo || 0);
      }
      return acc;
    }, 0);
  }, [previousRows]);

  // Procesamiento general de Métricas
  const metrics = useMemo(() => {
    const clientesSet = new Set(filteredRows.map((row: any) => row.ruc_dni || row.cliente));
    const clientesActivos = clientesSet.size;
    
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
    const clientesCriticosMap: { [key: string]: ClienteCritico } = {};

    filteredRows.forEach((row: any) => {
      const saldoItem = Number(row.saldo || 0);
      saldoPendienteTotal += saldoItem;
      
      const diasMora = Number(row.dias_mora || 0);
      const estado = (row.estado || '').toLowerCase();
      const repNombre = row.representante || row.vendedor || 'No Asignado';
      const clienteKey = row.ruc_dni || row.cliente || 'Desconocido';

      repSaldosMap[repNombre] = (repSaldosMap[repNombre] || 0) + saldoItem;

      if (diasMora > 0 || estado.includes('mora')) {
        montoEnMoraTotal += saldoItem; 
        conteoEnMora++;
        documentosEnMoraList.push(row); 

        if (diasMora <= 15) conteo1_15++;
        else if (diasMora <= 45) conteo16_45++;
        else conteo46Mas++;

        if (diasMora >= 90) {
          if (!clientesCriticosMap[clienteKey]) {
            clientesCriticosMap[clienteKey] = {
              ruc_dni: clienteKey,
              cliente: row.cliente || 'Cliente sin nombre',
              saldoTotal: 0,
              maxDiasMora: diasMora,
              representante: repNombre
            };
          }
          clientesCriticosMap[clienteKey].saldoTotal += saldoItem;
          if (diasMora > clientesCriticosMap[clienteKey].maxDiasMora) {
            clientesCriticosMap[clienteKey].maxDiasMora = diasMora;
          }
        }
      } else {
        montoPorVencerTotal += saldoItem; 
        conteoAlDia++;
      }
    });

    const ticketPromedio = clientesActivos > 0 ? saldoPendienteTotal / clientesActivos : 0;
    
    // Cálculo del Delta de Cartera en Mora
    let moraDeltaPorcentaje = 0;
    if (prevMontoEnMoraTotal > 0) {
      moraDeltaPorcentaje = ((montoEnMoraTotal - prevMontoEnMoraTotal) / prevMontoEnMoraTotal) * 100;
    }

    return {
      clientesActivos,
      saldoPendienteTotal,
      montoEnMoraTotal,
      montoPorVencerTotal,
      conteoAlDia,
      conteoEnMora,
      conteo1_15,
      conteo16_45,
      conteo46Mas,
      repSaldosMap,
      documentosEnMoraList,
      clientesCriticosList: Object.values(clientesCriticosMap).sort((a, b) => b.saldoTotal - a.saldoTotal),
      ticketPromedio,
      moraDeltaPorcentaje
    };
  }, [filteredRows, prevMontoEnMoraTotal]);

  // Paginación para la tabla
  const totalPages = Math.ceil(metrics.documentosEnMoraList.length / ITEMS_PER_PAGE) || 1;
  const paginatedDocsInMora = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return metrics.documentosEnMoraList.slice(start, start + ITEMS_PER_PAGE);
  }, [metrics.documentosEnMoraList, currentPage]);

  // Datos para Recharts
  const estadoData = [
    { name: 'Al Día', value: metrics.conteoAlDia, color: '#10B981' },
    { name: 'En Mora', value: metrics.conteoEnMora, color: '#EF4444' }
  ].filter(item => item.value > 0);

  const tramosData = [
    { tramo: 'Al Día', cantidad: metrics.conteoAlDia, color: '#10B981' },
    { tramo: '1-15 días', cantidad: metrics.conteo1_15, color: '#FBBF24' },
    { tramo: '16-45 días', cantidad: metrics.conteo16_45, color: '#F97316' },
    { tramo: '46+ días', cantidad: metrics.conteo46Mas, color: '#EF4444' }
  ];

  const representantesData = Object.keys(metrics.repSaldosMap)
    .map((rep) => ({
      nombre: rep.length > 12 ? rep.substring(0, 12) + '...' : rep,
      saldo: metrics.repSaldosMap[rep]
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
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Sincronizando información de cobranza...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto pb-12">
      {/* HEADER, SELECTOR DE FECHA/ARCHIVO Y FILTRO DE REPRESENTANTE */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Panel de Control de Cobranzas</h1>
          <p className="text-xs md:text-sm text-gray-500 dark:text-slate-400">Métricas operativas y seguimiento en tiempo real de la cartera.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 3. SELECTOR DE ARCHIVO / PERÍODO */}
          <div className="relative flex-1 sm:flex-none">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <FileSpreadsheet className="h-4 w-4 text-blue-500" />
            </div>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="w-full min-w-[200px] rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 pl-9 pr-8 text-xs font-semibold text-gray-800 dark:text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 cursor-pointer appearance-none truncate"
            >
              {excelDocs.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.nombre} {doc.fecha_carga ? `(${new Date(doc.fecha_carga).toLocaleDateString()})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* DESPLEGABLE DE REPRESENTANTES */}
          <div className="relative min-w-[200px] flex-1 sm:flex-none">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400 dark:text-slate-500" />
            </div>
            
            <select
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 pl-9 pr-8 text-xs font-medium text-gray-900 dark:text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 cursor-pointer appearance-none truncate"
            >
              <option value="">Todos los representantes</option>
              {listaRepresentantes.map((rep: any, idx: number) => (
                <option key={idx} value={rep} className="py-1">
                  {rep}
                </option>
              ))}
            </select>

            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                title="Limpiar filtro"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={loadDashboardData}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 shadow-sm transition hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </button>
        </div>
      </div>

      {/* METRIC CARDS / KPIS CON DELTA Y TICKET PROMEDIO */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CLIENTES ACTIVOS & TICKET PROMEDIO */}
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Clientes & Eficiencia</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-2xl text-blue-500 dark:text-blue-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{metrics.clientesActivos.toLocaleString('es-PE')}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">
                Ticket Prom.: <strong className="text-gray-700 dark:text-slate-200">{fmtSoles(metrics.ticketPromedio, 0)}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* SALDO PENDIENTE */}
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Saldo Total Pendiente</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-2xl text-amber-500 dark:text-amber-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-slate-100 truncate">
              {fmtSoles(metrics.saldoPendienteTotal)}
            </p>
            <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium block mt-1">
              En {filteredRows.length} documentos cargados
            </span>
          </div>
        </div>

        {/* MONTO EN MORA CON TENDENCIA (DELTA) */}
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Cartera en Mora</span>
            <div className="p-2 bg-red-50 dark:bg-red-950/40 rounded-2xl text-red-500 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-bold text-red-600 dark:text-red-400 truncate">
              {fmtSoles(metrics.montoEnMoraTotal)}
            </p>
            
            {/* INDICADOR DE TENDENCIA (DELTA vs ARCHIVO PREVIO) */}
            <div className="flex items-center gap-1.5 mt-1">
              {prevMontoEnMoraTotal > 0 ? (
                metrics.moraDeltaPorcentaje <= 0 ? (
                  <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                    <ArrowDownRight className="h-3 w-3 mr-0.5" />
                    {Math.abs(metrics.moraDeltaPorcentaje).toFixed(1)}% vs ant.
                  </span>
                ) : (
                  <span className="inline-flex items-center text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/60 px-1.5 py-0.5 rounded">
                    <ArrowUpRight className="h-3 w-3 mr-0.5" />
                    +{metrics.moraDeltaPorcentaje.toFixed(1)}% vs ant.
                  </span>
                )
              ) : (
                <span className="text-[11px] text-red-500 font-medium">
                  {((metrics.montoEnMoraTotal / (metrics.saldoPendienteTotal || 1)) * 100).toFixed(1)}% del saldo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* MONTO POR VENCER */}
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Por Vencer (Al Día)</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl text-emerald-500 dark:text-emerald-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-bold text-emerald-600 dark:text-emerald-400 truncate">
              {fmtSoles(metrics.montoPorVencerTotal)}
            </p>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block mt-1">
              {metrics.conteoAlDia} documentos vigentes
            </span>
          </div>
        </div>
      </div>

      {/* SECCIÓN DE CHARTS & TABLA PAGINADA */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* GRÁFICO DINÁMICO */}
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-slate-100 text-base">Análisis Gráfico</h3>
              <p className="text-xs text-gray-400 dark:text-slate-500">Distribución según el filtro seleccionado</p>
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
                    <Tooltip formatter={(val: any) => [fmtSoles(Number(val)), 'Saldo Total']} />
                    <Bar dataKey="saldo" fill="#3B82F6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* TABLA DE DOCUMENTOS EN MORA (PAGINADA) */}
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-800 dark:text-slate-100">Resumen de Documentos Vencidos</h3>
              <span className="text-[11px] font-bold text-gray-500 bg-gray-100 dark:bg-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg">
                Página {currentPage} de {totalPages}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">Haz clic sobre un número de documento para registrar un pago.</p>
          </div>

          <div className="flex-1 overflow-auto min-h-[250px] border border-gray-100 dark:border-slate-700/60 rounded-2xl">
            {metrics.documentosEnMoraList.length === 0 ? (
              <div className="flex h-full items-center justify-center py-12 text-xs text-gray-400 dark:text-slate-500">
                Ningún documento en mora encontrado.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 dark:bg-slate-900/60 sticky top-0 text-gray-600 dark:text-slate-300 font-semibold border-b border-gray-100 dark:border-slate-700">
                  <tr>
                    <th className="p-2.5">Cliente</th>
                    <th className="p-2.5">Documento</th>
                    <th className="p-2.5 text-center">Mora</th>
                    <th className="p-2.5 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50 text-gray-700 dark:text-slate-300">
                  {paginatedDocsInMora.map((doc: any, index: number) => {
                    const numeroDocumento = doc.documento || doc.num_doc || '';
                    return (
                      <tr key={index} className="hover:bg-gray-50/80 dark:hover:bg-slate-700/30 transition">
                        <td className="p-2.5 font-medium truncate max-w-[120px]">{doc.cliente || 'Desconocido'}</td>
                        <td className="p-2.5">
                          {numeroDocumento ? (
                            <button
                              onClick={() => handleDocumentClick(numeroDocumento)}
                              className="font-mono text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                            >
                              {numeroDocumento}
                            </button>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="inline-block px-1.5 py-0.5 rounded font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 text-[11px]">
                            {doc.dias_mora || 0}d
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-semibold text-red-600 dark:text-red-400">
                          {fmtSoles(doc.saldo)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* CONTROLES DE PAGINACIÓN */}
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <span className="text-[11px] text-gray-400">Total: <strong>{metrics.documentosEnMoraList.length}</strong></span>
            
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-1 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="p-1 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN INFERIOR: CLIENTES CRÍTICOS (+90 DÍAS) */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-gray-100 dark:border-slate-700/50 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700/60 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            <h3 className="font-bold text-sm md:text-base text-gray-900 dark:text-slate-100">
              Alertas: Clientes con Mora Crítica (+90 Días)
            </h3>
          </div>
          <span className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/60 px-2.5 py-1 rounded-lg">
            {metrics.clientesCriticosList.length} Requieren Acción
          </span>
        </div>

        {metrics.clientesCriticosList.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400 dark:text-slate-500">
            Sin clientes con más de 90 días de mora en esta consulta.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {metrics.clientesCriticosList.slice(0, 6).map((cliente) => (
              <div 
                key={cliente.ruc_dni}
                className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-red-200 dark:hover:border-red-900/50 transition"
              >
                <div className="space-y-0.5 min-w-0 flex-1">
                  <p className="font-bold text-xs text-gray-900 dark:text-slate-100 leading-tight truncate">
                    {cliente.cliente}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">
                    RUC/DNI: {cliente.ruc_dni} • <span className="text-blue-600 dark:text-blue-400 font-medium">{cliente.representante}</span>
                  </p>
                </div>

                <div className="text-right shrink-0 space-y-0.5">
                  <p className="font-bold text-xs text-red-600 dark:text-red-400">
                    {fmtSoles(cliente.saldoTotal)}
                  </p>
                  <span className="inline-block text-[10px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-extrabold px-1.5 py-0.5 rounded">
                    {cliente.maxDiasMora} días
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}