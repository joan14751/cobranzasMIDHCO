import React, { useState, useEffect } from 'react';
import { getDocumentos } from '../lib/supabaseService';
import { parseCobranzaExcelFile } from '../lib/excelService';
import { toast } from 'react-hot-toast';
import { 
  Phone, 
  MapPin, 
  Navigation, 
  CheckCircle, 
  Search, 
  RefreshCw, 
  Filter, 
  Map as MapIcon,
  List,
  Edit3,
  X,
  Save,
  Compass,
  FileText,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Zap,
  RotateCcw
} from 'lucide-react';

// Importaciones de React-Leaflet
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix para prevenir que los íconos por defecto de Leaflet se rompan en React / Vite / Webpack
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface DocumentoDetalle {
  numero: string;
  saldo: number;
}

interface ClienteRuta {
  ruc_dni: string;
  cliente: string;
  direccion: string;
  zona: string;
  telefono: string;
  saldoTotal: number;
  maxDiasMora: number;
  documentosCount: number;
  documentosList: DocumentoDetalle[];
  latitud?: number;
  longitud?: number;
  ordenRuta?: number;
}

// Componente para re-centrar el mapa cuando cambian las coordenadas seleccionadas
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 14);
  }, [lat, lng, map]);
  return null;
}

function calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function RutaCobranzaPage() {
  const [loading, setLoading] = useState(true);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZona, setSelectedZona] = useState<string>('TODAS');
  const [checkIns, setCheckIns] = useState<{ [key: string]: string }>({});
  const [expandedDocs, setExpandedDocs] = useState<{ [key: string]: boolean }>({});
  const [vistaMapa, setVistaMapa] = useState(false);
  
  const [ordenOptimizado, setOrdenOptimizado] = useState<{ [ruc: string]: number } | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  const [customLocations, setCustomLocations] = useState<{ 
    [ruc: string]: { direccion: string; telefono?: string; latitud?: number; longitud?: number } 
  }>(() => {
    const saved = localStorage.getItem('rutas_custom_locations');
    return saved ? JSON.parse(saved) : {};
  });

  const [editingCliente, setEditingCliente] = useState<ClienteRuta | null>(null);
  const [inputDireccion, setInputDireccion] = useState('');
  const [inputTelefono, setInputTelefono] = useState('');
  const [inputLat, setInputLat] = useState<string>('');
  const [inputLng, setInputLng] = useState<string>('');
  const [gettingGps, setGettingGps] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await getDocumentos();
      if (error) throw new Error(error);

      const documentos = data || [];
      const excelDocs = documentos.filter((doc: any) => 
        doc.ruta_archivo && (doc.ruta_archivo.endsWith('.xls') || doc.ruta_archivo.endsWith('.xlsx'))
      );

      if (excelDocs.length === 0) {
        setLoading(false);
        return;
      }

      const ultimoExcel = excelDocs[0] as any;
      const fileUrl = ultimoExcel.url_archivo || ultimoExcel.url;

      if (!fileUrl) {
        throw new Error('Sin URL válida para el archivo de cobranza.');
      }

      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const file = new File([blob], ultimoExcel.nombre || 'cobranza.xlsx', { type: blob.type });

      const parsedRows = await parseCobranzaExcelFile(file);
      setAllRows(parsedRows);

    } catch (err: any) {
      console.error(err);
      toast.error('Error al cargar clientes para la ruta: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const clientesMap: { [key: string]: ClienteRuta } = {};

  allRows.forEach((row: any) => {
    const key = row.ruc_dni || row.cliente || 'Desconocido';
    const saldoItem = Number(row.saldo || 0);
    const moraItem = Number(row.dias_mora || 0);
    
    const numDoc = row.documento || row.num_doc || row.factura || row.nro_doc || 'Sin Nro';
    const savedLoc = customLocations[key];

    if (!clientesMap[key]) {
      clientesMap[key] = {
        ruc_dni: key,
        cliente: row.cliente || 'Sin Nombre',
        direccion: savedLoc?.direccion || row.direccion || row.domicilio || 'Sin Dirección Registrada',
        zona: row.zona || row.distrito || 'General',
        telefono: savedLoc?.telefono !== undefined ? savedLoc.telefono : (row.telefono || row.celular || ''),
        saldoTotal: 0,
        maxDiasMora: 0,
        documentosCount: 0,
        documentosList: [],
        latitud: savedLoc?.latitud,
        longitud: savedLoc?.longitud,
        ordenRuta: ordenOptimizado ? ordenOptimizado[key] : undefined
      };
    }

    clientesMap[key].saldoTotal += saldoItem;
    clientesMap[key].documentosCount += 1;
    clientesMap[key].documentosList.push({
      numero: numDoc,
      saldo: saldoItem
    });

    if (moraItem > clientesMap[key].maxDiasMora) {
      clientesMap[key].maxDiasMora = moraItem;
    }
  });

  const listaClientes = Object.values(clientesMap);
  const zonasUnicas = Array.from(new Set(listaClientes.map(c => c.zona))).sort();

  let clientesFiltrados = listaClientes.filter(c => {
    const matchSearch = c.cliente.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        c.direccion.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.ruc_dni.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.telefono.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.documentosList.some(d => d.numero.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchZona = selectedZona === 'TODAS' || c.zona === selectedZona;
    return matchSearch && matchZona;
  });

  if (ordenOptimizado) {
    clientesFiltrados.sort((a, b) => {
      const ordenA = a.ordenRuta ?? 9999;
      const ordenB = b.ordenRuta ?? 9999;
      return ordenA - ordenB;
    });
  } else {
    clientesFiltrados.sort((a, b) => b.saldoTotal - a.saldoTotal);
  }

  const optimizarRuta = () => {
    if (!navigator.geolocation) {
      toast.error('GPS no soportado en este dispositivo.');
      return;
    }

    const conGps = clientesFiltrados.filter(c => c.latitud !== undefined && c.longitud !== undefined);

    if (conGps.length === 0) {
      toast.error('Ningún cliente filtrado tiene coordenadas GPS asignadas.');
      return;
    }

    setOptimizing(true);
    toast.loading('Obteniendo tu ubicación actual...', { id: 'opt' });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        let latActual = pos.coords.latitude;
        let lngActual = pos.coords.longitude;

        let pendientes = [...conGps];
        let ordenMapa: { [ruc: string]: number } = {};
        let numeroParada = 1;

        while (pendientes.length > 0) {
          let masCercanoIdx = 0;
          let menorDistancia = Infinity;

          for (let i = 0; i < pendientes.length; i++) {
            const dist = calcularDistanciaKm(
              latActual,
              lngActual,
              pendientes[i].latitud!,
              pendientes[i].longitud!
            );

            if (dist < menorDistancia) {
              menorDistancia = dist;
              masCercanoIdx = i;
            }
          }

          const clienteSeleccionado = pendientes[masCercanoIdx];
          ordenMapa[clienteSeleccionado.ruc_dni] = numeroParada++;

          latActual = clienteSeleccionado.latitud!;
          lngActual = clienteSeleccionado.longitud!;

          pendientes.splice(masCercanoIdx, 1);
        }

        const sinGps = clientesFiltrados.filter(c => c.latitud === undefined || c.longitud === undefined);
        sinGps.forEach((c) => {
          ordenMapa[c.ruc_dni] = numeroParada++;
        });

        setOrdenOptimizado(ordenMapa);
        setOptimizing(false);
        toast.success(`Ruta optimizada para ${conGps.length} puntos GPS.`, { id: 'opt' });
      },
      () => {
        setOptimizing(false);
        toast.error('No se pudo obtener tu ubicación GPS actual.', { id: 'opt' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const resetearOrden = () => {
    setOrdenOptimizado(null);
    toast.success('Orden restablecido por Saldo Total.');
  };

  const toggleExpandDocs = (ruc: string) => {
    setExpandedDocs(prev => ({ ...prev, [ruc]: !prev[ruc] }));
  };

  const handleCheckIn = (clienteId: string) => {
    if (!navigator.geolocation) {
      toast.error('GPS no soportado en este dispositivo.');
      return;
    }

    toast.loading('Obteniendo ubicación GPS...', { id: 'gps' });

    navigator.geolocation.getCurrentPosition(
      () => {
        const horaStr = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        setCheckIns(prev => ({ ...prev, [clienteId]: horaStr }));
        toast.success(`Visita registrada a las ${horaStr}`, { id: 'gps' });
      },
      () => {
        toast.error('Error al obtener la ubicación GPS.', { id: 'gps' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const abrirNavegador = (cliente: ClienteRuta) => {
    if (cliente.latitud && cliente.longitud) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${cliente.latitud},${cliente.longitud}`, '_blank');
    } else if (cliente.direccion && cliente.direccion !== 'Sin Dirección Registrada') {
      const query = encodeURIComponent(`${cliente.cliente}, ${cliente.direccion}`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    } else {
      toast.error('Por favor asigna una dirección o ubicación GPS primero.');
      abrirModalUbicacion(cliente);
    }
  };

  const abrirModalUbicacion = (cliente: ClienteRuta) => {
    setEditingCliente(cliente);
    setInputDireccion(cliente.direccion === 'Sin Dirección Registrada' ? '' : cliente.direccion);
    setInputTelefono(cliente.telefono);
    setInputLat(cliente.latitud ? cliente.latitud.toString() : '');
    setInputLng(cliente.longitud ? cliente.longitud.toString() : '');
  };

  const capturarGpsActual = () => {
    if (!navigator.geolocation) {
      toast.error('GPS no disponible en tu navegador.');
      return;
    }

    setGettingGps(true);
    toast.loading('Capturando posición exacta...', { id: 'gps-capture' });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setInputLat(pos.coords.latitude.toFixed(6));
        setInputLng(pos.coords.longitude.toFixed(6));
        setGettingGps(false);
        toast.success('Coordenadas GPS capturadas.', { id: 'gps-capture' });
      },
      () => {
        setGettingGps(false);
        toast.error('No se pudo obtener la posición GPS.', { id: 'gps-capture' });
      },
      { enableHighAccuracy: true }
    );
  };

  const guardarDatosCliente = () => {
    if (!editingCliente) return;

    const latNum = inputLat ? parseFloat(inputLat) : undefined;
    const lngNum = inputLng ? parseFloat(inputLng) : undefined;

    const updated = {
      ...customLocations,
      [editingCliente.ruc_dni]: {
        direccion: inputDireccion.trim() || 'Sin Dirección Registrada',
        telefono: inputTelefono.trim(),
        latitud: latNum,
        longitud: lngNum
      }
    };

    setCustomLocations(updated);
    localStorage.setItem('rutas_custom_locations', JSON.stringify(updated));
    
    toast.success('Datos del cliente actualizados');
    setEditingCliente(null);
  };

  // Filtrar clientes con GPS asignado para el mapa
  const clientesConMapa = clientesFiltrados.filter(c => c.latitud !== undefined && c.longitud !== undefined);
  const mapaCentroLat = clientesConMapa.length > 0 ? clientesConMapa[0].latitud! : -12.0651;
  const mapaCentroLng = clientesConMapa.length > 0 ? clientesConMapa[0].longitud! : -75.2048;

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Cargando hoja de ruta de cobranza...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <MapIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Rutas de Cobranza en Campo
          </h1>
          <p className="text-xs md:text-sm text-gray-500 dark:text-slate-400">
            Optimizada para visitas en el local comercial o botica.
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* Toggle Vista Lista / Mapa */}
          <button
            onClick={() => setVistaMapa(!vistaMapa)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-200 transition hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            {vistaMapa ? <List className="h-3.5 w-3.5" /> : <MapIcon className="h-3.5 w-3.5" />}
            {vistaMapa ? 'Vista Lista' : 'Vista Mapa'}
          </button>

          {ordenOptimizado ? (
            <button
              onClick={resetearOrden}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 transition hover:bg-amber-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restablecer
            </button>
          ) : (
            <button
              onClick={optimizarRuta}
              disabled={optimizing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Zap className="h-3.5 w-3.5" />
              {optimizing ? 'Calculando...' : 'Optimizar Ruta de Hoy'}
            </button>
          )}

          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-200 transition hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </button>
        </div>
      </div>

      {/* FILTROS Y BUSCADOR */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, RUC, teléfono, documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 pl-9 pr-4 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="relative">
          <Filter className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <select
            value={selectedZona}
            onChange={(e) => setSelectedZona(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 pl-9 pr-4 text-sm text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
          >
            <option value="TODAS">Todas las Zonas</option>
            {zonasUnicas.map((z, idx) => (
              <option key={idx} value={z}>{z}</option>
            ))}
          </select>
        </div>
      </div>

      {/* BANNER INFORMATIVO RUTA OPTIMIZADA */}
      {ordenOptimizado && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-3 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 fill-emerald-500" />
            <span><strong>Ruta inteligente activada:</strong> Ordenado por cercanía GPS desde tu ubicación.</span>
          </div>
        </div>
      )}

      {/* VISTA MAPA INTERACTIVO */}
      {vistaMapa ? (
        <div className="h-[550px] w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700 shadow-sm relative">
          {clientesConMapa.length === 0 ? (
            <div className="flex h-full items-center justify-center bg-white dark:bg-slate-800 p-6 text-center">
              <p className="text-sm text-gray-500 dark:text-slate-400">
                No hay clientes con coordenadas GPS registradas para mostrar en el mapa.
              </p>
            </div>
          ) : (
            <MapContainer
              center={[mapaCentroLat, mapaCentroLng]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <RecenterMap lat={mapaCentroLat} lng={mapaCentroLng} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {clientesConMapa.map((cliente) => (
                <Marker
                  key={cliente.ruc_dni}
                  position={[cliente.latitud!, cliente.longitud!]}
                >
                  <Popup>
                    <div className="p-1 space-y-1">
                      <p className="font-bold text-xs text-gray-900">{cliente.cliente}</p>
                      <p className="text-[11px] text-gray-600">{cliente.direccion}</p>
                      <p className="text-xs font-bold text-blue-600">
                        S/. {cliente.saldoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </p>
                      <button
                        onClick={() => abrirModalUbicacion(cliente)}
                        className="mt-1 text-[11px] text-blue-500 underline font-semibold block"
                      >
                        Editar datos
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>
      ) : (
        /* VISTA LISTADO DE TARJETAS MÓVILES */
        <div className="space-y-3 pt-1">
          {clientesFiltrados.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 p-8 text-center rounded-2xl border border-gray-100 dark:border-slate-700/50">
              <p className="text-sm text-gray-500 dark:text-slate-400">No se encontraron clientes para la ruta seleccionada.</p>
            </div>
          ) : (
            clientesFiltrados.map((cliente) => {
              const visitadoHora = checkIns[cliente.ruc_dni];
              const tieneDireccionValida = cliente.direccion && cliente.direccion !== 'Sin Dirección Registrada';
              const isExpanded = expandedDocs[cliente.ruc_dni];
              const docsToShow = isExpanded ? cliente.documentosList : cliente.documentosList.slice(0, 3);

              return (
                <div 
                  key={cliente.ruc_dni}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700/50 space-y-3 transition hover:border-blue-200 dark:hover:border-blue-900/50 relative"
                >
                  {/* CABECERA TARJETA */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {cliente.ordenRuta !== undefined && (
                          <span className="text-[10px] font-extrabold text-white bg-emerald-600 px-2 py-0.5 rounded-md shadow-sm flex items-center gap-1">
                            Parada #{cliente.ordenRuta}
                          </span>
                        )}

                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md">
                          {cliente.zona}
                        </span>
                        {cliente.maxDiasMora > 0 && (
                          <span className="text-[10px] font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded-md">
                            Mora: {cliente.maxDiasMora}d
                          </span>
                        )}
                        {cliente.latitud && (
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Compass className="h-3 w-3" /> GPS
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm leading-snug">
                        {cliente.cliente}
                      </h3>
                      
                      {/* DIRECCIÓN EDITABLE */}
                      <div 
                        onClick={() => abrirModalUbicacion(cliente)}
                        className="group flex items-start gap-1.5 cursor-pointer rounded-lg py-0.5 pr-2 transition hover:bg-slate-50 dark:hover:bg-slate-700/40"
                      >
                        <MapPin className={`h-4 w-4 shrink-0 mt-0.5 ${tieneDireccionValida ? 'text-red-500' : 'text-gray-400 dark:text-slate-600'}`} />
                        <span className={`text-xs ${tieneDireccionValida ? 'text-gray-700 dark:text-slate-300 font-medium' : 'text-amber-600 dark:text-amber-400 font-bold italic'}`}>
                          {cliente.direccion}
                        </span>
                        <Edit3 className="h-3.5 w-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition shrink-0 ml-1" />
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">{cliente.documentosCount} doc(s)</p>
                      <p className="text-base font-black text-gray-900 dark:text-slate-100">
                        S/. {cliente.saldoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* DETALLE DE NÚMEROS DE DOCUMENTOS */}
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5 text-blue-500" />
                        Documentos pendientes:
                      </span>
                      {cliente.documentosList.length > 3 && (
                        <button 
                          onClick={() => toggleExpandDocs(cliente.ruc_dni)}
                          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                        >
                          {isExpanded ? (
                            <>Ver menos <ChevronUp className="h-3 w-3" /></>
                          ) : (
                            <>Ver todos ({cliente.documentosList.length}) <ChevronDown className="h-3 w-3" /></>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {docsToShow.map((doc, idx) => (
                        <div 
                          key={idx}
                          className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md text-[11px]"
                        >
                          <span className="font-mono font-bold text-gray-800 dark:text-slate-200">{doc.numero}</span>
                          <span className="text-gray-400 dark:text-slate-500">|</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            S/. {doc.saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* BOTONES DE ACCIÓN RÁPIDA */}
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {/* LLAMAR */}
                    {cliente.telefono ? (
                      <a
                        href={`tel:${cliente.telefono}`}
                        className="flex items-center justify-center gap-1 py-2 px-1 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold transition active:scale-95 text-center"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {cliente.telefono}
                      </a>
                    ) : (
                      <button 
                        onClick={() => abrirModalUbicacion(cliente)}
                        className="flex items-center justify-center gap-1 py-2 px-1 bg-amber-50/60 dark:bg-amber-950/20 text-amber-600 dark:text-amber-500 hover:bg-amber-100 rounded-xl text-xs font-bold transition active:scale-95"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        + Teléfono
                      </button>
                    )}

                    {/* DATOS / UBICACIÓN */}
                    <button
                      onClick={() => abrirModalUbicacion(cliente)}
                      className="flex items-center justify-center gap-1 py-2 px-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-bold transition active:scale-95"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Datos
                    </button>

                    {/* GPS MAPA */}
                    <button
                      onClick={() => abrirNavegador(cliente)}
                      className="flex items-center justify-center gap-1 py-2 px-1 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl text-xs font-bold transition active:scale-95"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      GPS Mapa
                    </button>

                    {/* CHECK-IN */}
                    <button
                      onClick={() => handleCheckIn(cliente.ruc_dni)}
                      className={`flex items-center justify-center gap-1 py-2 px-1 rounded-xl text-xs font-bold transition active:scale-95 ${
                        visitadoHora
                          ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300'
                          : 'bg-green-600 text-white shadow-sm hover:bg-green-700'
                      }`}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      {visitadoHora ? visitadoHora : 'Check-in'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL PARA EDITAR DATOS / UBICACIÓN / TELÉFONO */}
      {editingCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-xl border border-gray-100 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Editar Datos del Cliente
              </h3>
              <button 
                onClick={() => setEditingCliente(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{editingCliente.cliente}</p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500">RUC/DNI: {editingCliente.ruc_dni}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Teléfono / Celular de Contacto
                </label>
                <input
                  type="tel"
                  placeholder="Ej: 987654321"
                  value={inputTelefono}
                  onChange={(e) => setInputTelefono(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Dirección o Referencia Comercial
                </label>
                <input
                  type="text"
                  placeholder="Ej: Av. Ferrocarril 123 - Frente a Botica Bembos"
                  value={inputDireccion}
                  onChange={(e) => setInputDireccion(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-slate-700/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">Coordenadas Exactas GPS</span>
                  <button
                    type="button"
                    onClick={capturarGpsActual}
                    disabled={gettingGps}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 transition"
                  >
                    <Compass className="h-3.5 w-3.5" />
                    {gettingGps ? 'Obteniendo...' : 'Capturar GPS actual'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-400 dark:text-slate-500 mb-1">Latitud</label>
                    <input
                      type="text"
                      placeholder="-12.0651"
                      value={inputLat}
                      onChange={(e) => setInputLat(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-gray-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 dark:text-slate-500 mb-1">Longitud</label>
                    <input
                      type="text"
                      placeholder="-75.2048"
                      value={inputLng}
                      onChange={(e) => setInputLng(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-gray-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setEditingCliente(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarDatosCliente}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition"
              >
                <Save className="h-3.5 w-3.5" />
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}