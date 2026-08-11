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
  ArrowRight,
  Calendar,
  Award,
  TrendingUp,
  MapPin
} from 'lucide-react'; 
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
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
  created_at?: string;
  fecha?: string;
  cliente_id?: string | null;
}

interface ClienteCritico {
  ruc_dni: string;
  cliente: string;
  saldoTotal: number;
  maxDiasMora: number;
  representante: string;
  zona?: string;
}

interface DocumentoDetalle {
  cliente: string;
  documento: string;
  saldo: number;
  dias_mora: number;
  representante: string;
  zona?: string;
  fecha_vencimiento?: string;
  telefono?: string;
}

type ChartType = 'pie' | 'tramos' | 'representantes';
type RangoMoraPill = 'todos' | 'al_dia' | '1_15' | '16_45' | '46_mas';

const formatFechaHora = (fechaRaw?: string) => {
  if (!fechaRaw) return 'Fecha no disponible';
  try {
    const date = new Date(fechaRaw);
    if (isNaN(date.getTime())) return 'Fecha no disponible';
    return date.toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return 'Fecha no disponible';
  }
};

const formatHoraCorta = (fechaRaw?: string) => {
  if (!fechaRaw) return '';
  try {
    const date = new Date(fechaRaw);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return '';
  }
};

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

const DashboardSkeleton = () => (
  <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto animate-pulse">
    <div className="h-20 bg-gray-200 dark:bg-slate-800 rounded-3xl w-full" />
    <div className="h-14 bg-gray-200 dark:bg-slate-800 rounded-2xl w-full" />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-32 bg-gray-200 dark:bg-slate-800 rounded-3xl" />
      ))}
    </div>
  </div>
);

const CustomRechartsTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 text-xs space-y-1">
        <p className="font-bold text-gray-800 dark:text-slate-100">{data.nombreCompleto || label || payload[0].name}</p>
        
        {data.porcentajeMora !== undefined ? (
          <>
            <p className="text-red-600 dark:text-red-400 font-extrabold">
              Morosidad: {data.porcentajeMora}%
            </p>
            <p className="text-slate-500 font-medium">
              Mora: {fmtSoles(data.mora)} de {fmtSoles(data.saldo)}
            </p>
          </>
        ) : (
          <p className="text-blue-600 dark:text-blue-400 font-extrabold">
            {typeof payload[0].value === 'number' && payload[0].value > 100
              ? fmtSoles(payload[0].value)
              : `${payload[0].value} documentos`}
          </p>
        )}
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
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTableTerm, setSearchTableTerm] = useState('');
  const [searchVendorTerm, setSearchVendorTerm] = useState('');
  const [selectedPill, setSelectedPill] = useState<RangoMoraPill>('todos');

  const [allRows, setAllRows] = useState<any[]>([]);
  const [previousRows, setPreviousRows] = useState<any[]>([]);
  const [excelDocs, setExcelDocs] = useState<DocumentoExtendido[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [chartType, setChartType] = useState<ChartType>('pie');

  const [selectedDocsList, setSelectedDocsList] = useState<string[]>([]);
  const [activeDrawerDoc, setActiveDrawerDoc] = useState<DocumentoDetalle | null>(null);

  const [criticalToast, setCriticalToast] = useState<{ count: number; monto: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const activeDocument = useMemo(() => {
    return excelDocs.find(doc => doc.id === selectedDocId) || excelDocs[0] || null;
  }, [excelDocs, selectedDocId]);

  const activeDocFechaCargaRaw = activeDocument?.fecha_carga || activeDocument?.created_at || activeDocument?.fecha;
  const activeDocFechaHoraFormatted = useMemo(() => formatFechaHora(activeDocFechaCargaRaw), [activeDocFechaCargaRaw]);
  const activeDocHoraShort = useMemo(() => formatHoraCorta(activeDocFechaCargaRaw), [activeDocFechaCargaRaw]);

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

  const filteredRows = useMemo(() => {
    return allRows.filter((row: any) => {
      if (searchTerm) {
        const rep = (row.representante || row.vendedor || '').toLowerCase();
        if (!rep.includes(searchTerm.toLowerCase().trim())) return false;
      }
      
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
    const repMoraMap: { [key: string]: number } = {};
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

        repMoraMap[repNombre] = (repMoraMap[repNombre] || 0) + saldoItem;

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
              representante: repNombre,
              zona: row.zona || row.region || row.sucursal || 'General'
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
      repMoraMap,
      documentosEnMoraList,
      clientesCriticosList: Object.values(clientesCriticosMap).sort((a, b) => b.saldoTotal - a.saldoTotal),
      ticketPromedio,
      moraDeltaPorcentaje
    };
  }, [filteredRows, prevMontoEnMoraTotal]);

  const rankingVendedores = useMemo(() => {
    return Object.keys(metrics.repSaldosMap)
      .map((rep) => {
        const total = metrics.repSaldosMap[rep] || 0;
        const mora = metrics.repMoraMap[rep] || 0;
        const pctMora = total > 0 ? (mora / total) * 100 : 0;

        return {
          vendedor: rep,
          saldoTotal: total,
          saldoMora: mora,
          porcentajeMora: Number(pctMora.toFixed(1))
        };
      })
      .filter((v) => {
        if (!searchVendorTerm.trim()) return true;
        return v.vendedor.toLowerCase().includes(searchVendorTerm.toLowerCase().trim());
      })
      .sort((a, b) => b.porcentajeMora - a.porcentajeMora || b.saldoMora - a.saldoMora);
  }, [metrics.repSaldosMap, metrics.repMoraMap, searchVendorTerm]);

  const filteredDocsInMora = useMemo(() => {
    return filteredRows.filter((doc: any) => {
      const dias = Number(doc.dias_mora || 0);
      if (dias <= 0 && selectedPill === 'todos') return false; 
      if (!searchTableTerm.trim()) return true;

      const term = searchTableTerm.toLowerCase().trim();
      const cliente = (doc.cliente || '').toLowerCase();
      const numDoc = (doc.documento || doc.num_doc || '').toLowerCase();
      const zona = (doc.zona || doc.region || doc.sucursal || '').toLowerCase();
      return cliente.includes(term) || numDoc.includes(term) || zona.includes(term);
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

  const representantesData = rankingVendedores.slice(0, 5).map(r => ({
    nombreCompleto: r.vendedor,
    nombre: r.vendedor.length > 12 ? r.vendedor.substring(0, 12) + '...' : r.vendedor,
    saldo: r.saldoTotal,
    mora: r.saldoMora,
    porcentajeMora: r.porcentajeMora
  }));

  const handleDocumentClick = (numDoc: string) => {
    if (!numDoc) return;
    const cleanDoc = numDoc.trim();
    navigate(`/pagos?documento=${encodeURIComponent(cleanDoc)}`, { 
      state: { searchDocumento: cleanDoc, exactMatch: true } 
    });
  };

  const handleSelectAllInPage = () => {
    const pageDocNums = paginatedDocsInMora.map((d: any) => d.documento || d.num_doc);
    const allSelected = pageDocNums.every(num => selectedDocsList.includes(num));

    if (allSelected) {
      setSelectedDocsList(prev => prev.filter(num => !pageDocNums.includes(num)));
    } else {
      setSelectedDocsList(prev => Array.from(new Set([...prev, ...pageDocNums])));
    }
  };

  const handleToggleDocSelection = (numDoc: string) => {
    setSelectedDocsList(prev => 
      prev.includes(numDoc) ? prev.filter(n => n !== numDoc) : [...prev, numDoc]
    );
  };

  const handleExportSelectedToExcel = () => {
    if (selectedDocsList.length === 0) return;
    const itemsToExport = filteredDocsInMora.filter((d: any) => selectedDocsList.includes(d.documento || d.num_doc));
    
    const headers = ["Cliente", "Documento", "Saldo (S/.)", "Dias Mora", "Zona", "Representante"];
    const rows = itemsToExport.map((d: any) => [
      `"${d.cliente || ''}"`,
      `"${d.documento || d.num_doc || ''}"`,
      d.saldo || 0,
      d.dias_mora || 0,
      `"${d.zona || d.region || d.sucursal || 'Sin Zona'}"`,
      `"${d.representante || d.vendedor || ''}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cobranza_seleccionados_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exportados ${selectedDocsList.length} documentos`);
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-6 lg:p-8 font-sans space-y-6 transition-colors duration-200">
      
      {/* 1. TOP BAR DE BIENVENIDA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            Hola, {userName} 👋
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Resumen de Cartera y Gestión de Cobranzas
            </span>
            {activeDocHoraShort && (
              <span className="inline-flex items-center gap-1 font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900 px-2 py-0.5 rounded-full text-[10px]">
                <Clock className="w-3 h-3 animate-pulse" /> Sync {activeDocHoraShort}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex items-center bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-gray-200 dark:border-slate-800 p-1.5 pr-3 shadow-inner">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 ml-2 mr-1 flex-shrink-0" />
            <div className="flex flex-col text-left">
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="bg-transparent font-extrabold text-slate-800 dark:text-slate-100 text-xs outline-none cursor-pointer max-w-[240px] truncate"
              >
                {excelDocs.map((doc) => (
                  <option key={doc.id} value={doc.id} className="bg-white dark:bg-slate-900 font-medium">
                    {doc.nombre}
                  </option>
                ))}
              </select>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-blue-500" />
                Actualizado hasta: <strong className="text-blue-600 dark:text-blue-400">{activeDocFechaHoraFormatted}</strong>
              </span>
            </div>
          </div>

          <button
            onClick={() => setCompactNumbers(!compactNumbers)}
            className={`px-3 py-2 rounded-2xl border transition flex items-center gap-1.5 text-xs font-bold ${
              compactNumbers 
                ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 text-blue-600 dark:text-blue-400' 
                : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {compactNumbers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="hidden sm:inline">{compactNumbers ? 'S/. Compacto' : 'S/. Completo'}</span>
          </button>

          <button
            onClick={loadDashboardData}
            className="p-2.5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. FILTROS RÁPIDOS */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Tramo:
            </span>
            {[
              { key: 'todos', label: 'Todos' },
              { key: 'al_dia', label: '🟢 Al Día' },
              { key: '1_15', label: '🟢 1-15d' },
              { key: '16_45', label: '🟡 16-45d' },
              { key: '46_mas', label: '🔴 +46d' }
            ].map(pill => (
              <button
                key={pill.key}
                onClick={() => setSelectedPill(pill.key as RangoMoraPill)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedPill === pill.key
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-bold outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-48"
            >
              <option value="">👤 Todos los Vendedores</option>
              {listaRepresentantes.map((rep, idx) => (
                <option key={idx} value={rep}>{rep}</option>
              ))}
            </select>

            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedPill('todos');
                }}
                className="px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900 text-xs font-bold flex items-center gap-1 hover:bg-red-100 transition whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" /> Limpiar ({activeFiltersCount})
              </button>
            )}
          </div>
        </div>
      </div>

      {criticalToast && (
        <div className="bg-gradient-to-r from-red-500 to-rose-600 text-white p-4 rounded-3xl shadow-lg flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
              <Bell className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div>
              <p className="font-extrabold text-xs uppercase tracking-wider text-red-100">Alerta de Deuda Crítica (+90 Días)</p>
              <p className="text-xs text-white/90 font-medium">
                Se detectaron <strong className="underline">{criticalToast.count} documentos</strong> en mora extrema acumulando <strong>{fmtSoles(criticalToast.monto)}</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedPill('46_mas')}
            className="px-3 py-1.5 bg-white text-red-600 rounded-xl text-xs font-black shadow hover:bg-red-50 transition whitespace-nowrap flex items-center gap-1"
          >
            Filtrar Morosos <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. GRID DE TARJETAS METRICAS (KPIs) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-3 hover:border-blue-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Clientes Activos</span>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{metrics.clientesActivos}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
              Ticket Promedio: <strong className="text-slate-700 dark:text-slate-300">{fmtSoles(metrics.ticketPromedio, 2, compactNumbers)}</strong>
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-3 hover:border-indigo-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Cartera Total</span>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{fmtSoles(metrics.saldoPendienteTotal, 2, compactNumbers)}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
              Documentos Totales: <strong className="text-slate-700 dark:text-slate-300">{filteredRows.length}</strong>
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-3 hover:border-red-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-500 dark:text-red-400 uppercase tracking-wider">Deuda En Mora</span>
            <div className="p-2.5 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-2xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-black text-red-600 dark:text-red-400">{fmtSoles(metrics.montoEnMoraTotal, 2, compactNumbers)}</p>
              {previousRows.length > 0 && metrics.moraDeltaPorcentaje !== 0 && (
                <span className={`inline-flex items-center text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                  metrics.moraDeltaPorcentaje > 0 
                    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' 
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  {metrics.moraDeltaPorcentaje > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(metrics.moraDeltaPorcentaje).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
              Documentos Vencidos: <strong className="text-red-600 dark:text-red-400">{metrics.conteoEnMora}</strong>
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-3 hover:border-emerald-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Por Vencer / Al Día</span>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{fmtSoles(metrics.montoPorVencerTotal, 2, compactNumbers)}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
              Documentos Al Día: <strong className="text-emerald-600 dark:text-emerald-400">{metrics.conteoAlDia}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* 4. SECCIÓN GRÁFICOS INTERACTIVOS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
            <div>
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" /> Distribución y Salud de Cartera
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Visualización de saldos por estado y zonas</p>
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl text-xs font-bold">
              <button
                onClick={() => setChartType('pie')}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
                  chartType === 'pie' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'
                }`}
              >
                <PieIcon className="w-3.5 h-3.5" /> Estado
              </button>
              <button
                onClick={() => setChartType('tramos')}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
                  chartType === 'tramos' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" /> Tramos
              </button>
              <button
                onClick={() => setChartType('representantes')}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
                  chartType === 'representantes' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" /> Top 5 Vendedores
              </button>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'pie' ? (
                <PieChart>
                  <Pie
                    data={estadoData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {estadoData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomRechartsTooltip />} />
                </PieChart>
              ) : chartType === 'tramos' ? (
                <BarChart data={tramosData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="tramo" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomRechartsTooltip />} />
                  <Bar dataKey="cantidad" radius={[8, 8, 0, 0]}>
                    {tramosData.map((entry, index) => (
                      <Cell key={`cell-bar-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <BarChart data={representantesData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis type="number" unit="%" tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <YAxis dataKey="nombre" type="category" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip content={<CustomRechartsTooltip />} />
                  <Bar dataKey="porcentajeMora" fill="#EF4444" radius={[0, 8, 8, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-red-500" /> Riesgo Crítico (+90 días)
              </h3>
              <span className="text-[10px] font-bold bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400 px-2 py-0.5 rounded-full">
                {metrics.clientesCriticosList.length} Clientes
              </span>
            </div>

            <div className="mt-3 space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {metrics.clientesCriticosList.slice(0, 5).map((critico, idx) => (
                <div key={idx} className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div className="truncate pr-2">
                    <p className="font-extrabold text-slate-800 dark:text-slate-200 truncate">{critico.cliente}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      Rep: {critico.representante} {critico.zona ? `• ${critico.zona}` : ''}
                    </p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className="font-black text-red-600 dark:text-red-400">{fmtSoles(critico.saldoTotal, 2, compactNumbers)}</p>
                    <span className="text-[9px] font-bold text-red-500 bg-red-100 dark:bg-red-950/80 px-1.5 py-0.2 rounded">
                      {critico.maxDiasMora}d mora
                    </span>
                  </div>
                </div>
              ))}
              {metrics.clientesCriticosList.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-8">🎉 No se registran clientes con mora crítica superior a 90 días.</p>
              )}
            </div>
          </div>

          <button
            onClick={() => navigate('/clientes')}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            Ver Directorio Completo 360° <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 5. RANKING COMPLETO DE MOROSIDAD POR VENDEDOR */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
          <div>
            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" /> Ranking de Morosidad por Vendedor
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Listado completo ordenado de <strong>mayor a menor porcentaje de morosidad</strong>
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar vendedor..."
              value={searchVendorTerm}
              onChange={(e) => setSearchVendorTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3">Vendedor / Representante</th>
                <th className="p-3 text-right">Saldo Total</th>
                <th className="p-3 text-right">Monto en Mora</th>
                <th className="p-3 text-center">% Morosidad</th>
                <th className="p-3 w-48">Nivel de Riesgo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800/60">
              {rankingVendedores.map((v, index) => {
                const isTop1 = index === 0 && v.porcentajeMora > 0;
                return (
                  <tr key={index} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 text-center font-black text-slate-400">
                      {isTop1 ? '🚨' : `#${index + 1}`}
                    </td>
                    <td className="p-3">
                      <p className="font-extrabold text-slate-800 dark:text-slate-200">{v.vendedor}</p>
                    </td>
                    <td className="p-3 text-right font-medium text-slate-600 dark:text-slate-300">
                      {fmtSoles(v.saldoTotal, 2, compactNumbers)}
                    </td>
                    <td className="p-3 text-right font-black text-red-600 dark:text-red-400">
                      {fmtSoles(v.saldoMora, 2, compactNumbers)}
                    </td>
                    <td className="p-3 text-center font-black text-xs">
                      <span className={`px-2.5 py-1 rounded-full ${
                        v.porcentajeMora >= 50 
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300' 
                          : v.porcentajeMora >= 20 
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                      }`}>
                        {v.porcentajeMora}%
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            v.porcentajeMora >= 50 ? 'bg-red-500' : v.porcentajeMora >= 20 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(v.porcentajeMora, 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rankingVendedores.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    No se encontraron vendedores registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. TABLA DE DOCUMENTOS EN MORA Y ACCIONES MASIVAS */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
          <div>
            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-blue-600" /> Detalle de Documentos
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Listado detallado con gestión directa y accesos a cobros
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder="Buscar por cliente, doc o zona..."
                value={searchTableTerm}
                onChange={(e) => setSearchTableTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            {selectedDocsList.length > 0 && (
              <button
                onClick={handleExportSelectedToExcel}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" /> Exportar ({selectedDocsList.length})
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-3 w-10 text-center">
                  <button onClick={handleSelectAllInPage} className="text-slate-400 hover:text-blue-600">
                    <CheckSquare className="w-4 h-4" />
                  </button>
                </th>
                <th className="p-3">Cliente / RUC</th>
                <th className="p-3">Documento</th>
                <th className="p-3 text-right">Saldo</th>
                <th className="p-3 text-center">Estado Mora</th>
                <th className="p-3">Zona</th>
                <th className="p-3">Vendedor</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800/60">
              {paginatedDocsInMora.map((doc: any, index: number) => {
                const numDoc = doc.documento || doc.num_doc || 'S/N';
                const dias = Number(doc.dias_mora || 0);
                const isSelected = selectedDocsList.includes(numDoc);
                const zonaTexto = doc.zona || doc.region || doc.sucursal || 'Sin Zona';

                return (
                  <tr key={index} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group">
                    <td className="p-3 text-center">
                      <button onClick={() => handleToggleDocSelection(numDoc)} className="text-slate-400 hover:text-blue-600">
                        {isSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="p-3">
                      <p className="font-extrabold text-slate-800 dark:text-slate-200">{doc.cliente || 'Desconocido'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{doc.ruc_dni || 'S/N'}</p>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleDocumentClick(numDoc)}
                        className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {numDoc}
                      </button>
                    </td>
                    <td className="p-3 text-right font-black text-slate-800 dark:text-slate-100">
                      {fmtSoles(doc.saldo, 2, compactNumbers)}
                    </td>
                    <td className="p-3 text-center">
                      {renderMoraBadge(dias)}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg text-[11px]">
                        <MapPin className="w-3 h-3 text-indigo-500" />
                        {zonaTexto}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400 font-medium">
                      {doc.representante || doc.vendedor || 'No Asignado'}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleDocumentClick(numDoc)}
                          className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition"
                          title="Ir a gestión de cobro"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setActiveDrawerDoc({
                            cliente: doc.cliente,
                            documento: numDoc,
                            saldo: doc.saldo,
                            dias_mora: dias,
                            representante: doc.representante || doc.vendedor,
                            zona: zonaTexto,
                            fecha_vencimiento: doc.fecha_venc,
                            telefono: doc.telefono
                          })}
                          className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"
                          title="Ver Ficha Rápida"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedDocsInMora.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                    No se encontraron documentos con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800 text-xs">
            <span className="text-slate-400 dark:text-slate-500">
              Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> ({filteredDocsInMora.length} registros)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-xl border border-gray-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-50 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-xl border border-gray-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-50 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 7. DRAWER PARA DETALLE DE DOCUMENTO */}
      {activeDrawerDoc && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between border-l border-gray-100 dark:border-slate-800">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full">
                    Ficha de Documento
                  </span>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mt-1">{activeDrawerDoc.documento}</h3>
                </div>
                <button
                  onClick={() => setActiveDrawerDoc(null)}
                  className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 space-y-2">
                  <p className="text-xs text-slate-400 font-bold uppercase">Cliente</p>
                  <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200">{activeDrawerDoc.cliente}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Saldo Pendiente</p>
                    <p className="text-base font-black text-blue-600 dark:text-blue-400">{fmtSoles(activeDrawerDoc.saldo)}</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Días de Mora</p>
                    <div className="pt-0.5">{renderMoraBadge(activeDrawerDoc.dias_mora)}</div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Zona / Región:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{activeDrawerDoc.zona || 'Sin zona'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vendedor:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{activeDrawerDoc.representante || 'No asignado'}</span>
                  </div>
                  {activeDrawerDoc.fecha_vencimiento && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fecha Vencimiento:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{activeDrawerDoc.fecha_vencimiento}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-slate-800">
              <button
                onClick={() => {
                  const docNum = activeDrawerDoc.documento;
                  setActiveDrawerDoc(null);
                  handleDocumentClick(docNum);
                }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2"
              >
                <DollarSign className="w-4 h-4" /> Ir a Registrar Abono
              </button>
              
              <button
                onClick={() => {
                  const msg = `Hola, le saludamos para coordinar sobre el documento *${activeDrawerDoc.documento}* con un saldo de *${fmtSoles(activeDrawerDoc.saldo)}*.`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" /> Contactar por WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}