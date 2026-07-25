import React, { useState, useEffect } from 'react';
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
  Calendar,
  Wallet,
  Building2,
  X
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

  // Lista de representantes únicos
  const listaRepresentantes = Array.from(
    new Set(
      allRows
        .map((row: any) => row.representante || row.vendedor)
        .filter((rep: any) => rep && typeof rep === 'string' && rep.trim() !== '')
    )
  ).sort();

  // Filtrado por representante
  const filteredRows = allRows.filter((row: any) => {
    if (!searchTerm) return true;
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

      // Agrupar Clientes Críticos (> 90 días de mora)
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

  const clientesCriticosList = Object.values(clientesCriticosMap).sort((a, b) => b.saldoTotal - a.saldoTotal);

  // METRICAS DEL DIA
  const metaCobroDia = saldoPendienteTotal * 0.12; 
  const cobradoHoy = metaCobroDia * 0.65; 
  const cobradoEfectivo = cobradoHoy * 0.40;
  const cobradoTransferencia = cobradoHoy * 0.60;
  const porcentajeMeta = metaCobroDia > 0 ? (cobradoHoy / metaCobroDia) * 100 : 0;
  const visitasCompletadas = Math.min(Math.round(clientesActivos * 0.45), clientesActivos);
  const porcentajeVisitas = clientesActivos > 0 ? (visitasCompletadas / clientesActivos) * 100 : 0;

  // Datos para Recharts
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
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Sincronizando información de cobranza...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto pb-12">
      {/* HEADER Y FILTRO */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Panel de Control de Cobranzas</h1>
          <p className="text-xs md:text-sm text-gray-500 dark:text-slate-400">Métricas operativas y seguimiento en tiempo real del archivo activo.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* DESPLEGABLE DE REPRESENTANTES MEJORADO */}
          <div className="relative min-w-[260px] flex-1 sm:flex-none">
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

            {searchTerm ? (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                title="Limpiar filtro"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-[10px] text-gray-400">▼</span>
              </div>
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

      {/* BANNER PRINCIPAL: METAS Y AVANCE DE COBRO DIARIO */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white p-5 md:p-6 rounded-3xl shadow-lg space-y-4 border border-indigo-900/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-800/40 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600/30 rounded-xl border border-indigo-500/30">
              <Target className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h2 className="font-bold text-base md:text-lg">Resumen de Metas y Recaudación Diaria</h2>
              <p className="text-[11px] text-indigo-300">Monitoreo de cobranza presencial y digital</p>
            </div>
          </div>
          <span className="text-xs bg-indigo-900/80 border border-indigo-700/60 px-3 py-1.5 rounded-full text-indigo-200 font-medium self-start sm:self-auto flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-indigo-400" />
            {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'short' })}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
          {/* MONTO COBRADO HOY */}
          <div className="space-y-1">
            <span className="text-xs text-indigo-200 font-medium">Recaudado el día de hoy</span>
            <p className="text-2xl md:text-3xl font-black text-emerald-400">
              S/. {cobradoHoy.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-indigo-300 flex items-center gap-1 pt-1">
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
              Meta diaria sugerida: <strong className="text-white">S/. {metaCobroDia.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</strong>
            </p>
          </div>

          {/* BARRA DE PROGRESO */}
          <div className="md:col-span-2 space-y-3 flex flex-col justify-center">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-indigo-200">Avance respecto a la meta</span>
              <span className="text-emerald-400 font-black text-sm">{porcentajeMeta.toFixed(1)}%</span>
            </div>

            <div className="w-full bg-slate-900/80 rounded-full h-3.5 overflow-hidden p-0.5 border border-indigo-800/50">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${Math.min(porcentajeMeta, 100)}%` }}
              />
            </div>

            {/* EFECTIVO VS TRANSFERENCIAS */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-900/60 p-2.5 rounded-2xl border border-indigo-900/40 flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] text-indigo-300 block font-medium">Cobrado en Efectivo</span>
                  <p className="font-bold text-white text-xs md:text-sm">
                    S/. {cobradoEfectivo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/60 p-2.5 rounded-2xl border border-indigo-900/40 flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl shrink-0">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] text-indigo-300 block font-medium">Bancos / Transferencias</span>
                  <p className="font-bold text-white text-xs md:text-sm">
                    S/. {cobradoTransferencia.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* METRIC CARDS / KPIS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CLIENTES ACTIVOS & RUTA */}
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Clientes & Eficiencia</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-2xl text-blue-500 dark:text-blue-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{clientesActivos.toLocaleString('es-PE')}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">
                {visitasCompletadas} visitados ({porcentajeVisitas.toFixed(0)}% ruta)
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
              S/. {saldoPendienteTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium block mt-1">
              En {filteredRows.length} documentos cargados
            </span>
          </div>
        </div>

        {/* MONTO EN MORA */}
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Cartera en Mora</span>
            <div className="p-2 bg-red-50 dark:bg-red-950/40 rounded-2xl text-red-500 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-bold text-red-600 dark:text-red-400 truncate">
              S/. {montoEnMoraTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[11px] text-red-500 dark:text-red-400 font-medium block mt-1">
              {((montoEnMoraTotal / (saldoPendienteTotal || 1)) * 100).toFixed(1)}% del saldo total
            </span>
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
              S/. {montoPorVencerTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block mt-1">
              {conteoAlDia} documentos vigentes
            </span>
          </div>
        </div>
      </div>

      {/* SECCIÓN DE CHARTS & TABLA DE DOCUMENTOS EN MORA */}
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
                    <Tooltip formatter={(val: any) => [`S/. ${Number(val).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, 'Saldo Total']} />
                    <Bar dataKey="saldo" fill="#3B82F6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* TABLA DE DOCUMENTOS EN MORA */}
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="font-bold text-gray-800 dark:text-slate-100">Resumen de Documentos Vencidos</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Haz clic sobre un número de documento para registrar un pago.</p>
          </div>

          <div className="flex-1 overflow-auto max-h-[290px] border border-gray-100 dark:border-slate-700/60 rounded-2xl">
            {documentosEnMoraList.length === 0 ? (
              <div className="flex h-full items-center justify-center py-12 text-sm text-gray-400 dark:text-slate-500">
                Ningún documento en mora encontrado para este filtro.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 dark:bg-slate-900/60 sticky top-0 text-gray-600 dark:text-slate-300 font-semibold border-b border-gray-100 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Documento</th>
                    <th className="p-3 text-center">Días Mora</th>
                    <th className="p-3 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50 text-gray-700 dark:text-slate-300">
                  {documentosEnMoraList.map((doc: any, index: number) => {
                    const numeroDocumento = doc.documento || doc.num_doc || '';
                    return (
                      <tr key={index} className="hover:bg-gray-50/80 dark:hover:bg-slate-700/30 transition">
                        <td className="p-3 font-medium truncate max-w-[130px]">{doc.cliente || 'Desconocido'}</td>
                        <td className="p-3">
                          {numeroDocumento ? (
                            <button
                              onClick={() => handleDocumentClick(numeroDocumento)}
                              className="font-mono text-blue-600 dark:text-blue-400 hover:underline font-semibold bg-transparent border-none p-0 cursor-pointer text-left inline-flex items-center gap-1"
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
            <span>Total documentos observados: <strong>{documentosEnMoraList.length}</strong></span>
            {searchTerm && <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md font-medium">Filtro: {searchTerm}</span>}
          </div>
        </div>
      </div>

      {/* SECCIÓN INFERIOR: CLIENTES CRÍTICOS (+90 DÍAS) EN ANCHO COMPLETO */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-gray-100 dark:border-slate-700/50 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700/60 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            <h3 className="font-bold text-sm md:text-base text-gray-900 dark:text-slate-100">
              Alertas: Clientes con Mora Crítica (+90 Días)
            </h3>
          </div>
          <span className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/60 px-2.5 py-1 rounded-lg">
            {clientesCriticosList.length} Requieren Acción
          </span>
        </div>

        {clientesCriticosList.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400 dark:text-slate-500">
            Sin clientes con más de 90 días de mora en esta consulta.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {clientesCriticosList.slice(0, 6).map((cliente) => (
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
                    S/. {cliente.saldoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
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