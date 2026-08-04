import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Award, 
  Search, 
  Filter, 
  DollarSign, 
  PieChart, 
  CheckCircle2,
  Calendar,
  Layers,
  FileText // <-- Agregado para el ícono del RUC
} from 'lucide-react';

// Tipos de datos para el reporte
export interface DocumentoCXC {
  representante: string;
  zona: string;
  rucDni: string;
  razonSocial: string;
  nombreComercial: string;
  documento: string;
  fechaEmision: string;
  importe: number;
  fechaVencimiento: string;
  saldo: number;
  diasMora: number;
}

interface Props {
  documentos: DocumentoCXC[];
}

export const GestionCobranzasView: React.FC<Props> = ({ documentos }) => {
  // Se agregó 'clientes' como opción válida para las pestañas
  const [tabActiva, setTabActiva] = useState<'zonas' | 'vendedores' | 'clientes'>('zonas');
  
  // Filtros globales
  const [vendedorFiltro, setVendedorFiltro] = useState<string>('TODOS');
  const [zonaFiltro, setZonaFiltro] = useState<string>('TODAS');
  const [busqueda, setBusqueda] = useState<string>('');

  // 1. Obtener listas para desplegables de filtro
  const listaVendedores = useMemo(() => {
    const setV = new Set(documentos.map(d => d.representante).filter(Boolean));
    return Array.from(setV).sort();
  }, [documentos]);

  const listaZonas = useMemo(() => {
    const setZ = new Set(documentos.map(d => d.zona).filter(Boolean));
    return Array.from(setZ).sort();
  }, [documentos]);

  // 2. Documentos filtrados
  const docsFiltrados = useMemo(() => {
    return documentos.filter(doc => {
      const cumpleVendedor = vendedorFiltro === 'TODOS' || doc.representante === vendedorFiltro;
      const cumpleZona = zonaFiltro === 'TODAS' || doc.zona === zonaFiltro;
      const cumpleBusqueda = busqueda === '' || 
        doc.razonSocial.toLowerCase().includes(busqueda.toLowerCase()) ||
        doc.nombreComercial.toLowerCase().includes(busqueda.toLowerCase()) ||
        doc.rucDni.includes(busqueda) ||
        doc.documento.toLowerCase().includes(busqueda.toLowerCase());

      return cumpleVendedor && cumpleZona && cumpleBusqueda;
    });
  }, [documentos, vendedorFiltro, zonaFiltro, busqueda]);

  // ------------------------------------------------------------------
  // METRICAS & AGRUPACIÓN POR ZONAS (VENTANA 1)
  // ------------------------------------------------------------------
  const analisisPorZona = useMemo(() => {
    const zonasMap = new Map<string, {
      zona: string;
      representantes: Set<string>;
      clientes: Set<string>;
      saldoTotal: number;
      saldoVencido: number;
      moraAcumulada: number;
      cantDocs: number;
    }>();

    docsFiltrados.forEach(doc => {
      const key = doc.zona || 'SIN ZONA';
      if (!zonasMap.has(key)) {
        zonasMap.set(key, {
          zona: key,
          representantes: new Set(),
          clientes: new Set(),
          saldoTotal: 0,
          saldoVencido: 0,
          moraAcumulada: 0,
          cantDocs: 0,
        });
      }
      const reg = zonasMap.get(key)!;
      reg.representantes.add(doc.representante);
      reg.clientes.add(doc.rucDni || doc.razonSocial);
      reg.saldoTotal += doc.saldo;
      if (doc.diasMora > 0) {
        reg.saldoVencido += doc.saldo;
      }
      reg.moraAcumulada += doc.diasMora;
      reg.cantDocs += 1;
    });

    return Array.from(zonasMap.values()).map(z => ({
      zona: z.zona,
      vendedores: Array.from(z.representantes).join(', '),
      cantClientes: z.clientes.size,
      saldoTotal: z.saldoTotal,
      saldoVencido: z.saldoVencido,
      porcentajeRiesgo: z.saldoTotal > 0 ? (z.saldoVencido / z.saldoTotal) * 100 : 0,
      promedioDiasMora: z.cantDocs > 0 ? Math.round(z.moraAcumulada / z.cantDocs) : 0,
    })).sort((a, b) => b.saldoVencido - a.saldoVencido);
  }, [docsFiltrados]);

  // ------------------------------------------------------------------
  // METRICAS & RANKING DE VENDEDORES (VENTANA 2)
  // ------------------------------------------------------------------
  const rankingVendedores = useMemo(() => {
    const vMap = new Map<string, {
      nombre: string;
      carteraEmitida: number;
      saldoPendiente: number;
      saldoVencido: number;
      clientes: Set<string>;
      zonas: Set<string>;
      moraAcumulada: number;
      totalDocs: number;
    }>();

    docsFiltrados.forEach(doc => {
      const rep = doc.representante || 'DESCONOCIDO';
      if (!vMap.has(rep)) {
        vMap.set(rep, {
          nombre: rep,
          carteraEmitida: 0,
          saldoPendiente: 0,
          saldoVencido: 0,
          clientes: new Set(),
          zonas: new Set(),
          moraAcumulada: 0,
          totalDocs: 0,
        });
      }
      const data = vMap.get(rep)!;
      data.carteraEmitida += doc.importe;
      data.saldoPendiente += doc.saldo;
      if (doc.diasMora > 0) {
        data.saldoVencido += doc.saldo;
      }
      data.clientes.add(doc.rucDni || doc.razonSocial);
      data.zonas.add(doc.zona);
      data.moraAcumulada += doc.diasMora;
      data.totalDocs += 1;
    });

    return Array.from(vMap.values()).map(v => {
      const recuperado = Math.max(0, v.carteraEmitida - v.saldoPendiente);
      const pctCobranza = v.carteraEmitida > 0 ? (recuperado / v.carteraEmitida) * 100 : 0;
      const pctMora = v.saldoPendiente > 0 ? (v.saldoVencido / v.saldoPendiente) * 100 : 0;
      const ticketPromedio = v.clientes.size > 0 ? v.saldoPendiente / v.clientes.size : 0;
      
      let incentivo = 'Sin Bono';
      let badgeColor = 'bg-gray-100 text-gray-700';
      if (pctCobranza >= 85) {
        incentivo = 'Bono Nivel 1 (100%)';
        badgeColor = 'bg-green-100 text-green-800 border-green-300';
      } else if (pctCobranza >= 70) {
        incentivo = 'Bono Nivel 2 (50%)';
        badgeColor = 'bg-blue-100 text-blue-800 border-blue-300';
      } else if (pctMora > 40) {
        incentivo = 'Alerta Cartera Vencida';
        badgeColor = 'bg-red-100 text-red-800 border-red-300';
      }

      return {
        ...v,
        carteraRecuperada: recuperado,
        pctCobranza,
        pctMora,
        ticketPromedio,
        cantClientes: v.clientes.size,
        cantZonas: v.zonas.size,
        promDiasMora: v.totalDocs > 0 ? Math.round(v.moraAcumulada / v.totalDocs) : 0,
        incentivo,
        badgeColor
      };
    }).sort((a, b) => b.pctCobranza - a.pctCobranza);
  }, [docsFiltrados]);

  // ------------------------------------------------------------------
  // AGRUPACIÓN POR CLIENTES (NUEVA VENTANA 3 - TARJETAS CON RUC)
  // ------------------------------------------------------------------
  const clientesAgrupados = useMemo(() => {
    const cMap = new Map<string, {
      ruc: string;
      razonSocial: string;
      zona: string;
      diasMora: number;
      montoTotal: number;
      totalDocs: number;
    }>();

    docsFiltrados.forEach(doc => {
      const key = doc.rucDni || doc.razonSocial || 'SIN_ID';
      if (!cMap.has(key)) {
        cMap.set(key, {
          ruc: doc.rucDni,
          razonSocial: doc.razonSocial || doc.nombreComercial,
          zona: doc.zona,
          diasMora: 0,
          montoTotal: 0,
          totalDocs: 0
        });
      }
      const cli = cMap.get(key)!;
      cli.montoTotal += doc.saldo;
      cli.totalDocs += 1;
      // Guardamos la mora más alta del cliente
      if (doc.diasMora > cli.diasMora) {
        cli.diasMora = doc.diasMora;
      }
    });

    // Ordenamos por los que deben más
    return Array.from(cMap.values()).sort((a, b) => b.montoTotal - a.montoTotal);
  }, [docsFiltrados]);

  return (
    <div className="p-6 bg-slate-50 min-h-screen space-y-6">
      {/* CABECERA Y CONTROL DE PESTAÑAS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Layers className="text-blue-600" /> Control de Gestión & Cobranzas
          </h1>
          <p className="text-sm text-slate-500">
            Análisis táctico por zonas geográficas y desempeño de la fuerza de ventas.
          </p>
        </div>

        {/* TAB SWITCHER ACTUALIZADO CON LA PESTAÑA 'CLIENTES' */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 flex-wrap">
          <button
            onClick={() => setTabActiva('zonas')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tabActiva === 'zonas'
                ? 'bg-white text-blue-700 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin size={16} /> Mapa de Riesgo
          </button>
          <button
            onClick={() => setTabActiva('vendedores')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tabActiva === 'vendedores'
                ? 'bg-white text-blue-700 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award size={16} /> Vendedores
          </button>
          <button
            onClick={() => setTabActiva('clientes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tabActiva === 'clientes'
                ? 'bg-white text-blue-700 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users size={16} /> Cartera de Clientes
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS COMBINADOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
            <Users size={14} /> Filtrar Representante:
          </label>
          <select
            className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={vendedorFiltro}
            onChange={(e) => setVendedorFiltro(e.target.value)}
          >
            <option value="TODOS">-- Todos los Vendedores ({listaVendedores.length}) --</option>
            {listaVendedores.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
            <MapPin size={14} /> Filtrar Zona:
          </label>
          <select
            className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={zonaFiltro}
            onChange={(e) => setZonaFiltro(e.target.value)}
          >
            <option value="TODAS">-- Todas las Zonas ({listaZonas.length}) --</option>
            {listaZonas.map(z => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
            <Search size={14} /> Buscar Cliente / Doc:
          </label>
          <input
            type="text"
            placeholder="RUC, Razón Social, Nombre Comercial..."
            className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: MAPA DE RIESGO Y DISTRIBUCIÓN POR ZONAS                       */}
      {/* ==================================================================== */}
      {tabActiva === 'zonas' && (
        <div className="space-y-6">
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                <MapPin size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Zonas Analizadas</p>
                <p className="text-xl font-extrabold text-slate-800">{analisisPorZona.length}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-red-50 text-red-600 rounded-lg">
                <AlertTriangle size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Mayor Cartera Vencida</p>
                <p className="text-lg font-extrabold text-red-600">
                  {analisisPorZona[0]?.zona || 'N/A'}
                </p>
                <p className="text-xs text-slate-400">
                  S/ {analisisPorZona[0]?.saldoVencido.toLocaleString('es-PE', { minimumFractionDigits: 2 }) || 0}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                <Users size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Clientes Activos Filtrados</p>
                <p className="text-xl font-extrabold text-slate-800">
                  {analisisPorZona.reduce((acc, z) => acc + z.cantClientes, 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Tabla de Zonas */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
                <PieChart size={16} className="text-blue-600" /> Distribución y Penetración por Zona
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                Ordenado por Mayor Saldo Vencido
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 uppercase text-xs border-b border-slate-200">
                    <th className="p-3">Zona Geográfica</th>
                    <th className="p-3">Vendedores a Cargo</th>
                    <th className="p-3 text-center">Clientes Activos</th>
                    <th className="p-3 text-right">Saldo Total</th>
                    <th className="p-3 text-right">Saldo Vencido</th>
                    <th className="p-3 text-center">% Riesgo Mora</th>
                    <th className="p-3 text-center">Prom. Días Mora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analisisPorZona.map((z, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-semibold text-slate-800 flex items-center gap-1.5">
                        <MapPin size={14} className="text-slate-400" /> {z.zona}
                      </td>
                      <td className="p-3 text-xs text-slate-600 max-w-xs truncate" title={z.vendedores}>
                        {z.vendedores || 'N/A'}
                      </td>
                      <td className="p-3 text-center font-semibold text-slate-700">
                        {z.cantClientes}
                      </td>
                      <td className="p-3 text-right font-medium text-slate-700">
                        S/ {z.saldoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-bold text-red-600">
                        S/ {z.saldoVencido.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                          z.porcentajeRiesgo > 60 
                            ? 'bg-red-100 text-red-700' 
                            : z.porcentajeRiesgo > 30 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {z.porcentajeRiesgo.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3 text-center font-medium text-slate-600">
                        {z.promedioDiasMora > 0 ? `${z.promedioDiasMora} días` : 'Al día'}
                      </td>
                    </tr>
                  ))}
                  {analisisPorZona.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center p-6 text-slate-400">
                        No se encontraron zonas que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: RANKING Y EFICIENCIA DE VENDEDORES                            */}
      {/* ==================================================================== */}
      {tabActiva === 'vendedores' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
                <Award size={16} className="text-blue-600" /> Ranking de Desempeño Comercial y Cobranzas
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                Ordenado por % Efectividad de Cobro
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 uppercase text-xs border-b border-slate-200">
                    <th className="p-3">#</th>
                    <th className="p-3">Representante</th>
                    <th className="p-3 text-center">Zonas / Clientes</th>
                    <th className="p-3 text-right">Cartera Emitida</th>
                    <th className="p-3 text-right">Saldo Recaudado</th>
                    <th className="p-3 text-right">Saldo Pendiente</th>
                    <th className="p-3 text-center">% Cobrado</th>
                    <th className="p-3 text-center">% Mora</th>
                    <th className="p-3 text-right">Ticket Prom.</th>
                    <th className="p-3 text-center">Incentivo / Estatus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rankingVendedores.map((v, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-bold text-slate-400">{index + 1}</td>
                      <td className="p-3 font-semibold text-slate-800 flex items-center gap-2">
                        <Users size={14} className="text-blue-500" /> {v.nombre}
                      </td>
                      <td className="p-3 text-center text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">{v.cantZonas}</span> zonas | <span className="font-semibold text-slate-800">{v.cantClientes}</span> cli.
                      </td>
                      <td className="p-3 text-right text-slate-600">
                        S/ {v.carteraEmitida.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-semibold text-green-600">
                        S/ {v.carteraRecuperada.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-800">
                        S/ {v.saldoPendiente.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${Math.min(100, v.pctCobranza)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-700">{v.pctCobranza.toFixed(1)}%</span>
                      </td>
                      <td className="p-3 text-center font-bold text-red-600">
                        {v.pctMora.toFixed(1)}%
                      </td>
                      <td className="p-3 text-right text-slate-600">
                        S/ {v.ticketPromedio.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${v.badgeColor}`}>
                          {v.incentivo}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rankingVendedores.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center p-6 text-slate-400">
                        No se encontraron representantes con el filtro seleccionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: CARTERA DE CLIENTES (VISTA DE TARJETAS CON RUC)               */}
      {/* ==================================================================== */}
      {tabActiva === 'clientes' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {clientesAgrupados.map((cliente, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
              
              {/* Encabezado: Zonas y Mora */}
              <div className="flex items-center gap-2 mb-3">
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-600 uppercase">
                  {cliente.zona || 'SIN ZONA'}
                </span>
                {cliente.diasMora > 0 ? (
                  <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
                    Mora: {cliente.diasMora}d
                  </span>
                ) : (
                  <span className="rounded-md bg-green-50 px-2 py-0.5 text-xs font-bold text-green-600">
                    Al día
                  </span>
                )}
              </div>

              {/* Nombre + RUC + Monto Total */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-col gap-1.5 items-start">
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      {cliente.razonSocial || 'SIN NOMBRE'}
                    </h3>
                    
                    {/* AQUI ESTÁ EL BADGE DE RUC */}
                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
                      <FileText className="h-3 w-3 text-slate-500" />
                      RUC: <span className="font-mono">{cliente.ruc || 'S/N'}</span>
                    </span>
                  </div>
                </div>

                {/* Documentos y Monto Total */}
                <div className="text-right shrink-0">
                  <span className="text-xs font-semibold text-slate-400">
                    {cliente.totalDocs} doc(s)
                  </span>
                  <p className="text-lg font-black text-slate-900">
                    S/ {cliente.montoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {clientesAgrupados.length === 0 && (
            <div className="col-span-full text-center p-10 bg-white rounded-xl border border-slate-200">
              <Users className="mx-auto h-10 w-10 text-slate-300 mb-2" />
              <p className="text-slate-500 font-medium">No se encontraron clientes para mostrar.</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
};