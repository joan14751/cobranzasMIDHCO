import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { getDocumentos } from '../lib/supabaseService';
import { parseCobranzaExcelFile } from '../lib/excelService';
import { supabase } from '../lib/supabaseClient';
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
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  X,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  User as UserIcon,
  Filter,
  Eye,
  EyeOff,
  MessageCircle,
  Download,
  CheckSquare,
  Square,
  FileSearch,
  Bell,
  ArrowRight
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

interface DocumentoDetalle {
  cliente: string;
  documento: string;
  saldo: number;
  dias_mora: number;
  representante: string;
  fecha_vencimiento?: string;
  telefono?: string;
}

type ChartType = 'pie' | 'tramos' | 'representantes';
type RangoMoraPill = 'todos' | 'al_dia' | '1_15' | '16_45' | '46_mas';

// HELPER REUTILIZABLE PARA MONEDA EN SOLES
const fmtSoles = (monto: number, decimales: number = 2, compact: boolean = false) => {
  const val = Number(monto || 0);
  if (compact) {
    if (Math.abs(val) >= 1_000_000) return `S/. ${(val / 1_000_000).toFixed(1)}M`;
    if (Math.abs(val) >= 1_000) return `S/. ${(val / 1_000).toFixed(1)}K`;
  }
  return `S/. ${val.toLocaleString('es-PE', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}`;
};

// MINI SPARKLINE SVG PARA TARJETAS KPI
const MiniSparkline = ({ data, color = '#3B82F6' }: { data: number[]; color?: string }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 24;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

// HELPER PARA OBTENER BADGE DE SEVERIDAD DE MORA
const renderMoraBadge = (dias: number) => {
  if (dias <= 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
        🟢 Al Día
      </span>
    );
  }
  if (dias <= 15) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300">
        🟢 {dias}d (Bajo)
      </span>
    );
  }
  if (dias <= 45) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/70 dark:border-amber-800 dark:text-amber-300">
        🟡 {dias}d (Atención)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 dark:bg-red-950/80 dark:border-red-800 dark:text-red-300 animate-pulse">
      🔴 {dias}d (Crítico)
    </span>
  );
};

// SKELETON COMPONENT PARA ESTADOS DE CARGA
const DashboardSkeleton = () => (
  <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto animate-pulse">
    <div className="h-16 bg-gray-200 dark:bg-slate-800 rounded-2xl w-full" />
    <div className="h-24 bg-gray-200 dark:bg-slate-800 rounded-2xl w-full" />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-32 bg-gray-200 dark:bg-slate-800 rounded-3xl" />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="h-80 bg-gray-200 dark:bg-slate-800 rounded-3xl" />
      <div className="h-80 bg-gray-200 dark:bg-slate-800 rounded-3xl" />
    </div>
  </div>
);

// CUSTOM TOOLTIP PERSONALIZADO PARA RECHARTS
const CustomRechartsTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 text-xs space-y-1">
        <p className="font-bold text-gray-800 dark:text-slate-100">{label || payload[0].name}</p>
        <p className="text-blue-600 dark:text-blue-400 font-extrabold">
          {typeof payload[0].value === 'number' && payload[0].value > 100
            ? fmtSoles(payload[0].value)
            : `${payload[0].value} documentos`}
        </p>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [compactNumbers, setCompactNumbers] = useState(false);
  
  // FILTROS
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTableTerm, setSearchTableTerm] = useState('');
  const [selectedPill, setSelectedPill] = useState<RangoMoraPill>('todos');

  // DATOS
  const [allRows, setAllRows] = useState<any[]>([]);
  const [previousRows, setPreviousRows] = useState<any[]>([]);
  const [excelDocs, setExcelDocs] = useState<DocumentoExtendido[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [chartType, setChartType] = useState<ChartType>('pie');

  // SELECCIÓN MASIVA
  const [selectedDocsList, setSelectedDocsList] = useState<string[]>([]);

  // DRAWER (PANEL LATERAL)
  const [activeDrawerDoc, setActiveDrawerDoc] = useState<DocumentoDetalle | null>(null);
  const [drawerNote, setDrawerNote] = useState('');

  // ALERTA DE RIESGO
  const [criticalToast, setCriticalToast] = useState<{ count: number; monto: number } | null>(null);

  // PAGINACIÓN
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const name = user.user_metadata?.full_name || 
                     user.user_metadata?.name || 
                     user.email?.split('@')[0] || 
                     'Usuario';
        setUserName(name);
      }
    } catch (err) {
      console.error('Error al obtener usuario:', err);
    }
  };

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

  const loadDashboardData = async () => {
    if (!selectedDocId && excelDocs.length === 0) return;
    setLoading(true);
    setCriticalToast(null);

    try {
      const currentIndex = excelDocs.findIndex(d => d.id === selectedDocId);
      const targetDoc = excelDocs[currentIndex] || excelDocs[0];

      if (!targetDoc?.url_archivo) {
        throw new Error('El archivo seleccionado no posee una URL válida.');
      }

      const response = await fetch(targetDoc.url_archivo);
      const blob = await response.blob();
      const file = new File([blob], targetDoc.nombre, { type: blob.type });
      const parsedRows = await parseCobranzaExcelFile(file);
      setAllRows(parsedRows);

      // ALERTA INTELIGENTE PARA DEUDAS CRÍTICAS (+90 DÍAS)
      const criticos = parsedRows.filter((r: any) => Number(r.dias_mora || 0) >= 90);
      if (criticos.length > 0) {
        const sumaCritica = criticos.reduce((acc: number, r: any) => acc + Number(r.saldo || 0), 0);
        setCriticalToast({ count: criticos.length, monto: sumaCritica });
      }

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

      setLastSyncTime(new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      console.error(err);
      toast.error('Error al procesar el archivo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
    fetchExcelList();
  }, []);

  useEffect(() => {
    if (selectedDocId) {
      loadDashboardData();
    }
  }, [selectedDocId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchTableTerm, selectedDocId, selectedPill]);

  const listaRepresentantes = useMemo(() => {
    return Array.from(
      new Set(
        allRows
          .map((row: any) => row.representante || row.vendedor)
          .filter((rep: any) => rep && typeof rep === 'string' && rep.trim() !== '')
      )
    ).sort();
  }, [allRows]);

  // FILTRADO CON QUICK PILLS + REPRESENTANTE
  const filteredRows = useMemo(() => {
    return allRows.filter((row: any) => {
      // Filtro por Representante
      if (searchTerm) {
        const rep = (row.representante || row.vendedor || '').toLowerCase();
        if (!rep.includes(searchTerm.toLowerCase().trim())) return false;
      }
      
      // Filtro por Píldora de Rango de Mora
      const dias = Number(row.dias_mora || 0);
      if (selectedPill === 'al_dia') return dias <= 0;
      if (selectedPill === '1_15') return dias >= 1 && dias <= 15;
      if (selectedPill === '16_45') return dias >= 16 && dias <= 45;
      if (selectedPill === '46_mas') return dias >= 46;

      return true;
    });
  }, [allRows, searchTerm, selectedPill]);

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

  const filteredDocsInMora = useMemo(() => {
    return filteredRows.filter((doc: any) => {
      const dias = Number(doc.dias_mora || 0);
      if (dias <= 0 && selectedPill === 'todos') return false; 
      if (!searchTableTerm.trim()) return true;

      const term = searchTableTerm.toLowerCase().trim();
      const cliente = (doc.cliente || '').toLowerCase();
      const numDoc = (doc.documento || doc.num_doc || '').toLowerCase();
      return cliente.includes(term) || numDoc.includes(term);
    });
  }, [filteredRows, searchTableTerm, selectedPill]);

  const totalPages = Math.ceil(filteredDocsInMora.length / ITEMS_PER_PAGE) || 1;
  const paginatedDocsInMora = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDocsInMora.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDocsInMora, currentPage]);

  const activeFiltersCount = (selectedDocId ? 1 : 0) + (searchTerm ? 1 : 0) + (selectedPill !== 'todos' ? 1 : 0);

  const estadoData = [
    { name: 'Al Día', value: metrics.conteoAlDia, color: '#10B981' },
    { name: 'En Mora', value: metrics.conteoEnMora, color: '#EF4444' }
  ].filter(item => item.value > 0);

  const tramosData = [
    { tramo: 'Al Día', cantidad: metrics.conteoAlDia, color: '#10B981' },
    { tramo: '1-15 días', cantidad: metrics.conteo1_15, color: '#10B981' },
    { tramo: '16-45 días', cantidad: metrics.conteo16_45, color: '#F59E0B' },
    { tramo: '46+ días', cantidad: metrics.conteo46Mas, color: '#EF4444' }
  ];

  const representantesData = Object.keys(metrics.repSaldosMap)
    .map((rep) => ({
      nombre: rep.length > 12 ? rep.substring(0, 12) + '...' : rep,
      saldo: metrics.repSaldosMap[rep]
    }))
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, 5);

  const handleDocumentClick = (numDoc: string) => {
    if (!numDoc) return;
    const cleanDoc = numDoc.trim();
    navigate(`/pagos?documento=${encodeURIComponent(cleanDoc)}`, { 
      state: { searchDocumento: cleanDoc, exactMatch: true } 
    });
  };

  // ACCIONES MASIVAS
  const handleSelectAllInPage = () => {
    const pageDocNums = paginatedDocsInMora.map((d: any) => d.documento || d.num_doc);
    const allSelected = pageDocNums.every(num => selectedDocsList.includes(num));

    if (allSelected) {
      setSelectedDocsList(prev => prev.filter(num => !pageDocNums.includes(num)));
    } else {
      setSelectedDocsList(prev => Array.from(new Set([...prev, ...pageDocNums])));
    }
  };

  const handleToggleSelectDoc = (numDoc: string) => {
    setSelectedDocsList(prev => 
      prev.includes(numDoc) ? prev.filter(id => id !== numDoc) : [...prev, numDoc]
    );
  };

  // EXPORTAR A CSV
  const handleExportCSV = () => {
    if (filteredDocsInMora.length === 0) return toast.error('No hay datos para exportar.');
    
    const headers = ['Cliente', 'Documento', 'Dias Mora', 'Saldo'];
    const rows = filteredDocsInMora.map((d: any) => [
      `"${d.cliente || ''}"`,
      `"${d.documento || d.num_doc || ''}"`,
      d.dias_mora || 0,
      d.saldo || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Reporte_Cobranzas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Reporte CSV descargado');
  };

  // ENVIAR WHATSAPP DE RECORDATORIO
  const handleSendWhatsApp = (doc: DocumentoDetalle) => {
    const text = `Hola ${doc.cliente}, le saludamos del departamento de Cobranzas. Le recordamos que su comprobante ${doc.documento} presenta un saldo pendiente de S/. ${doc.saldo.toFixed(2)} con ${doc.dias_mora} días de morosidad. Quedamos atentos a su confirmación de pago.`;
    const url = `https://wa.me/${doc.telefono || ''}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto pb-12 relative">
      
      {/* ALERTA INTELIGENTE (TOAST DE MORA CRÍTICA) */}
      {criticalToast && (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 p-4 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500 text-white rounded-xl shrink-0">
              <Bell className="h-5 w-5 animate-bounce" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-red-900 dark:text-red-200 uppercase tracking-wider">Alerta de Riesgo Alto</h4>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                Se detectaron <strong>{criticalToast.count} documentos</strong> en mora crítica (+90 días) que suman <strong>{fmtSoles(criticalToast.monto)}</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedPill('46_mas')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shrink-0"
          >
            Filtrar Críticos <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* HEADER DE USUARIO + STATUS DOT DE SINCRONIZACIÓN */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold text-xs">
              {userName ? userName.charAt(0).toUpperCase() : <UserIcon className="h-3.5 w-3.5" />}
            </div>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 rounded-full">
              ¡Hola, {userName || 'Bienvenido'}!
            </span>
            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                Sincronizado {lastSyncTime ? `a las ${lastSyncTime}` : 'recientemente'}
              </span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Panel de Control de Cobranzas</h1>
        </div>

        <button
          onClick={() => setCompactNumbers(!compactNumbers)}
          className="self-start md:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 transition"
        >
          {compactNumbers ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {compactNumbers ? 'Ver cifras completas' : 'Abreviar cifras (K/M)'}
        </button>
      </div>

      {/* CONTENEDOR TIPO CARD SUAVE CON FILTROS Y QUICK PILLS */}
      <div className="rounded-2xl border border-gray-100 dark:border-slate-700/60 bg-gradient-to-r from-gray-50/80 to-blue-50/30 dark:from-slate-800/60 dark:to-slate-800/30 p-3.5 shadow-sm space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wide">
              Filtros de Análisis
            </span>
            {activeFiltersCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-600 text-white">
                {activeFiltersCount} activo{activeFiltersCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:flex-none">
              <FileSpreadsheet className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-500" />
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full min-w-[190px] rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 pl-8 pr-7 text-xs font-semibold text-gray-800 dark:text-slate-100 outline-none cursor-pointer appearance-none truncate"
              >
                {excelDocs.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <select
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full min-w-[190px] rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 pl-8 pr-7 text-xs font-medium text-gray-800 dark:text-slate-100 outline-none cursor-pointer appearance-none truncate"
              >
                <option value="">Todos los representantes</option>
                {listaRepresentantes.map((rep: any, idx: number) => (
                  <option key={idx} value={rep}>{rep}</option>
                ))}
              </select>
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <button
              onClick={loadDashboardData}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-100 transition"
            >
              <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
              Actualizar
            </button>
          </div>
        </div>

        {/* QUICK PILLS (FILTROS RÁPIDOS POR MORA) */}
        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-gray-200/60 dark:border-slate-700/50">
          <span className="text-[11px] font-bold text-gray-400 mr-1">Filtrar Tramo:</span>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'al_dia', label: '🟢 Al día' },
            { id: '1_15', label: '🟢 1-15 días' },
            { id: '16_45', label: '🟡 16-45 días' },
            { id: '46_mas', label: '🔴 +46 días' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setSelectedPill(pill.id as RangoMoraPill)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                selectedPill === pill.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-100'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* TARJETAS KPI CON SPARKLINES Y FORMATO DE CIFRAS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CLIENTES ACTIVOS */}
        <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-800 p-5 shadow-xs border border-gray-100 dark:border-slate-700/60 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Clientes Activos</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-2xl text-blue-600 dark:text-blue-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black tracking-tight text-gray-900 dark:text-slate-100">
              {metrics.clientesActivos.toLocaleString('es-PE')}
            </p>
            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1">
              Ticket Prom: {fmtSoles(metrics.ticketPromedio, 0, compactNumbers)}
            </p>
          </div>
        </div>

        {/* SALDO PENDIENTE + SPARKLINE */}
        <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-800 p-5 shadow-xs border border-gray-100 dark:border-slate-700/60 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Saldo Total Pendiente</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 rounded-2xl text-amber-600 dark:text-amber-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-xl md:text-2xl font-black tracking-tight text-gray-900 dark:text-slate-100">
                {fmtSoles(metrics.saldoPendienteTotal, 2, compactNumbers)}
              </p>
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                {filteredRows.length} documentos
              </span>
            </div>
            <MiniSparkline data={[120, 140, 135, 160, 150, 180, metrics.saldoPendienteTotal / 1000]} color="#F59E0B" />
          </div>
        </div>

        {/* CARTERA EN MORA + SPARKLINE */}
        <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-800 p-5 shadow-xs border border-gray-100 dark:border-slate-700/60 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Cartera en Mora</span>
            <div className="p-2 bg-red-50 dark:bg-red-950/50 rounded-2xl text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-xl md:text-2xl font-black tracking-tight text-red-600 dark:text-red-400">
                {fmtSoles(metrics.montoEnMoraTotal, 2, compactNumbers)}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {metrics.moraDeltaPorcentaje <= 0 ? (
                  <span className="inline-flex items-center text-[10px] font-extrabold text-emerald-700 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 rounded-md">
                    <ArrowDownRight className="h-3 w-3 mr-0.5" />
                    {Math.abs(metrics.moraDeltaPorcentaje).toFixed(1)}% vs ant.
                  </span>
                ) : (
                  <span className="inline-flex items-center text-[10px] font-extrabold text-red-700 bg-red-100 dark:bg-red-950 px-1.5 py-0.5 rounded-md">
                    <ArrowUpRight className="h-3 w-3 mr-0.5" />
                    +{metrics.moraDeltaPorcentaje.toFixed(1)}% vs ant.
                  </span>
                )}
              </div>
            </div>
            <MiniSparkline data={[50, 65, 60, 75, 70, metrics.montoEnMoraTotal / 1000]} color="#EF4444" />
          </div>
        </div>

        {/* POR VENCER */}
        <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-800 p-5 shadow-xs border border-gray-100 dark:border-slate-700/60 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Por Vencer (Al Día)</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl text-emerald-600 dark:text-emerald-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
              {fmtSoles(metrics.montoPorVencerTotal, 2, compactNumbers)}
            </p>
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 mt-1 block">
              {metrics.conteoAlDia} docs vigentes
            </span>
          </div>
        </div>
      </div>

      {/* GRÁFICOS Y TABLA DE VENCIDOS CON TOOLBAR Y DRAWER */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* GRÁFICO */}
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-6 shadow-xs border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-slate-100 text-base">Análisis Gráfico</h3>
              <p className="text-xs text-gray-400">Distribución de la cartera</p>
            </div>

            <div className="inline-flex rounded-xl bg-gray-100 dark:bg-slate-700/60 p-1 gap-1">
              <button
                onClick={() => setChartType('pie')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  chartType === 'pie' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-xs' : 'text-gray-500'
                }`}
              >
                <PieIcon className="h-3.5 w-3.5" /> Estado
              </button>
              <button
                onClick={() => setChartType('tramos')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  chartType === 'tramos' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-xs' : 'text-gray-500'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" /> Tramos
              </button>
              <button
                onClick={() => setChartType('representantes')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  chartType === 'representantes' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-xs' : 'text-gray-500'
                }`}
              >
                <BarChartHorizontal className="h-3.5 w-3.5" /> Top Reps
              </button>
            </div>
          </div>

          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'pie' ? (
                <PieChart>
                  <Pie data={estadoData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3}>
                    {estadoData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<CustomRechartsTooltip />} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              ) : chartType === 'tramos' ? (
                <BarChart data={tramosData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                  <XAxis dataKey="tramo" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip content={<CustomRechartsTooltip />} />
                  <Bar dataKey="cantidad" radius={[6, 6, 0, 0]}>
                    {tramosData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              ) : (
                <BarChart data={representantesData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(val) => `S/.${(val/1000).toFixed(0)}k`} />
                  <YAxis dataKey="nombre" type="category" tick={{ fontSize: 11, fill: '#94A3B8' }} width={90} />
                  <Tooltip content={<CustomRechartsTooltip />} />
                  <Bar dataKey="saldo" fill="#3B82F6" radius={[0, 6, 6, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* TABLA DE DOCUMENTOS VENCIDOS */}
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-6 shadow-xs border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="font-bold text-gray-800 dark:text-slate-100">Documentos Vencidos</h3>
                <p className="text-xs text-gray-400">Haz clic en una fila para desplegar detalles y acciones rápidas</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 transition"
                  title="Exportar tabla a CSV"
                >
                  <Download className="h-3.5 w-3.5 text-blue-500" /> Exportar
                </button>

                <div className="relative w-full sm:w-36">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchTableTerm}
                    onChange={(e) => setSearchTableTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto min-h-[240px] border border-gray-100 dark:border-slate-700/60 rounded-2xl">
            {filteredDocsInMora.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-center space-y-2">
                <FileSearch className="h-9 w-9 text-gray-300 dark:text-slate-600" />
                <p className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                  No se encontraron documentos vencidos para este filtro
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 dark:bg-slate-900/60 sticky top-0 text-gray-600 dark:text-slate-300 font-semibold border-b border-gray-100 dark:border-slate-700">
                  <tr>
                    <th className="p-2.5 w-8">
                      <button onClick={handleSelectAllInPage} className="text-gray-400 hover:text-gray-600">
                        <CheckSquare className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="p-2.5">Cliente</th>
                    <th className="p-2.5">Documento</th>
                    <th className="p-2.5 text-center">Nivel Riesgo</th>
                    <th className="p-2.5 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {paginatedDocsInMora.map((doc: any, index: number) => {
                    const numDoc = doc.documento || doc.num_doc || '';
                    const diasMora = Number(doc.dias_mora || 0);
                    const isSelected = selectedDocsList.includes(numDoc);

                    return (
                      <tr 
                        key={index} 
                        className="hover:bg-blue-50/50 dark:hover:bg-slate-700/30 transition cursor-pointer"
                        onClick={() => setActiveDrawerDoc({
                          cliente: doc.cliente || 'Desconocido',
                          documento: numDoc,
                          saldo: Number(doc.saldo || 0),
                          dias_mora: diasMora,
                          representante: doc.representante || doc.vendedor || 'No asignado',
                          telefono: doc.telefono || ''
                        })}
                      >
                        <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => handleToggleSelectDoc(numDoc)} className="text-gray-400 hover:text-blue-600">
                            {isSelected ? <CheckSquare className="h-3.5 w-3.5 text-blue-600" /> : <Square className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                        <td className="p-2.5 font-medium truncate max-w-[110px]">{doc.cliente || 'Desconocido'}</td>
                        <td className="p-2.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDocumentClick(numDoc);
                            }}
                            className="font-mono text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                          >
                            {numDoc || '-'}
                          </button>
                        </td>
                        <td className="p-2.5 text-center">
                          {renderMoraBadge(diasMora)}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-red-600 dark:text-red-400">
                          {fmtSoles(doc.saldo, 2, compactNumbers)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* PAGINACIÓN */}
          <div className="pt-2 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between text-xs text-gray-400">
            <span>Pág <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>
            <div className="flex gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-1 border rounded-lg disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-1 border rounded-lg disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN MORA CRÍTICA (+90 DÍAS) */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-gray-100 dark:border-slate-700/50 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700/60 pb-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            <h3 className="font-bold text-sm text-gray-900 dark:text-slate-100">
              Alertas: Clientes con Mora Crítica (+90 Días)
            </h3>
          </div>
          <span className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950 px-2.5 py-0.5 rounded-lg">
            {metrics.clientesCriticosList.length} Críticos
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {metrics.clientesCriticosList.slice(0, 4).map((cliente) => (
            <div 
              key={cliente.ruc_dni}
              className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3"
            >
              <div className="space-y-1 min-w-0">
                <p className="font-bold text-xs text-gray-900 dark:text-slate-100 truncate">{cliente.cliente}</p>
                <p className="text-[11px] text-gray-400">RUC: {cliente.ruc_dni} • {cliente.representante}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-extrabold text-red-600 text-xs md:text-sm">{fmtSoles(cliente.saldoTotal, 2, compactNumbers)}</p>
                {renderMoraBadge(cliente.maxDiasMora)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SLIDE-OVER DRAWER (PANEL LATERAL DE COBRANZA) */}
      {activeDrawerDoc && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full p-6 shadow-2xl flex flex-col justify-between border-l border-gray-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-slate-100">Gestión de Cobro</h3>
                  <p className="text-xs text-gray-400">Comprobante #{activeDrawerDoc.documento}</p>
                </div>
                <button onClick={() => setActiveDrawerDoc(null)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-2 border border-slate-100 dark:border-slate-800">
                <p className="text-xs text-gray-400 font-medium">Cliente</p>
                <p className="font-bold text-sm text-gray-800 dark:text-slate-100">{activeDrawerDoc.cliente}</p>
                
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div>
                    <p className="text-[10px] text-gray-400">Saldo Pendiente</p>
                    <p className="font-extrabold text-sm text-red-600">{fmtSoles(activeDrawerDoc.saldo)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Mora</p>
                    <p className="font-bold text-xs text-amber-600">{activeDrawerDoc.dias_mora} días vencido</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 dark:text-slate-200">Acción Rápida</label>
                <button
                  onClick={() => handleSendWhatsApp(activeDrawerDoc)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  <MessageCircle className="h-4 w-4" /> Enviar Recordatorio por WhatsApp
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 dark:text-slate-200">Promesa de Pago / Notas</label>
                <textarea
                  rows={4}
                  value={drawerNote}
                  onChange={(e) => setDrawerNote(e.target.value)}
                  placeholder="Escribe un compromiso de pago o nota interna..."
                  className="w-full p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl text-xs outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex gap-2">
              <button
                onClick={() => {
                  toast.success('Nota guardada correctamente');
                  setActiveDrawerDoc(null);
                }}
                className="flex-1 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition"
              >
                Guardar Gestión
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}