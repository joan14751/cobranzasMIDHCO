import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { getDocumentos } from '../lib/supabaseService';
import { parseCobranzaExcelFile } from '../lib/excelService';
import { Search, Calendar, Check, CheckCircle2, FileText, AlertCircle, XCircle, MessageSquare } from 'lucide-react';

interface DocumentoExtendido {
  id: string;
  nombre: string;
  ruta_archivo: string;
  url_archivo: string;
}

interface PagoProgramado {
  id: string;
  cliente: string;
  documento: string;
  representante: string;
  montoOriginal: number;
  montoProgramado: number;
  fechaProgramada: string;
  metodoPago: string;
  estado: 'Pendiente' | 'Completado';
}

export default function PagosPage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState(() => {
    return (location.state as any)?.filterText || '';
  });

  const [subFilter, setSubFilter] = useState<string>(() => {
    return (location.state as any)?.filterType || 'TODO';
  });
  
  const [allRows, setAllRows] = useState<any[]>([]);
  const [pagosProgramados, setPagosProgramados] = useState<PagoProgramado[]>([]);

  const [inputsMonto, setInputsMonto] = useState<{ [key: string]: string }>({});
  const [inputsFecha, setInputsFecha] = useState<{ [key: string]: string }>({});
  const [inputsMetodo, setInputsMetodo] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (location.state?.searchDocumento) {
      setSearchTerm(location.state.searchDocumento);
      setSubFilter('TODO');
    }
  }, [location.state]);

  const loadExcelData = async () => {
    setLoading(true);
    try {
      const { data, error } = await getDocumentos();
      if (error) throw new Error(error);

      const documentos = (data || []) as unknown as DocumentoExtendido[];
      const excelDocs = documentos.filter((doc) => 
        doc.ruta_archivo && (doc.ruta_archivo.endsWith('.xls') || doc.ruta_archivo.endsWith('.xlsx'))
      );

      if (excelDocs.length === 0) {
        setLoading(false);
        return;
      }

      const ultimoExcel = excelDocs[0];
      const response = await fetch(ultimoExcel.url_archivo);
      const blob = await response.blob();
      const file = new File([blob], ultimoExcel.nombre, { type: blob.type });

      const parsedRows = await parseCobranzaExcelFile(file);
      setAllRows(parsedRows);

      const mañana = new Date();
      mañana.setDate(mañana.getDate() + 1);
      const fechaDefecto = mañana.toISOString().split('T')[0];

      const savedMontos = localStorage.getItem('cobranza_ediciones_monto');
      const savedFechas = localStorage.getItem('cobranza_ediciones_fecha');
      const savedMetodos = localStorage.getItem('cobranza_ediciones_metodo');

      const localMontos = savedMontos ? JSON.parse(savedMontos) : {};
      const localFechas = savedFechas ? JSON.parse(savedFechas) : {};
      const localMetodos = savedMetodos ? JSON.parse(savedMetodos) : {};

      const inicialMonto: { [key: string]: string } = {};
      const inicialFecha: { [key: string]: string } = {};
      const inicialMetodo: { [key: string]: string } = {};

      parsedRows.forEach((row: any, index: number) => {
        const rowId = row.id || `row-${index}`;
        inicialMonto[rowId] = localMontos[rowId] !== undefined ? localMontos[rowId] : '';
        inicialFecha[rowId] = localFechas[rowId] !== undefined ? localFechas[rowId] : fechaDefecto;
        inicialMetodo[rowId] = localMetodos[rowId] !== undefined ? localMetodos[rowId] : 'Transferencia BCP';
      });

      setInputsMonto(inicialMonto);
      setInputsFecha(inicialFecha);
      setInputsMetodo(inicialMetodo);

      const localSaved = localStorage.getItem('cobranza_pagos_programados');
      if (localSaved) setPagosProgramados(JSON.parse(localSaved));
    } catch (err: any) {
      toast.error('Error al cargar datos de pagos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadExcelData(); }, []);

  const handleMontoChange = (rowId: string, value: string) => {
    const nuevosMontos = { ...inputsMonto, [rowId]: value };
    setInputsMonto(nuevosMontos);
    localStorage.setItem('cobranza_ediciones_monto', JSON.stringify(nuevosMontos));
  };

  const handleFechaChange = (rowId: string, value: string) => {
    const nuevasFechas = { ...inputsFecha, [rowId]: value };
    setInputsFecha(nuevasFechas);
    localStorage.setItem('cobranza_ediciones_fecha', JSON.stringify(nuevasFechas));
  };

  const handleMetodoChange = (rowId: string, value: string) => {
    const nuevosMetodos = { ...inputsMetodo, [rowId]: value };
    setInputsMetodo(nuevosMetodos);
    localStorage.setItem('cobranza_ediciones_metodo', JSON.stringify(nuevosMetodos));
  };

  const getWhatsAppUrl = (row: any) => {
    const docNum = row.documento || row.doc || row.num_doc || 'S/N';
    const saldoExcel = Number(row.saldo || 0);
    const diasMora = Number(row.dias_mora || 0);
    const cliente = row.cliente || 'Estimado/a cliente';
    const rep = row.representante || row.vendedor || '-';

    const mensaje = `Estimado/a *${cliente}*,\n\n` +
      `Le contactamos respecto a la cuenta pendiente con el documento *${docNum}* por un monto de *S/. ${saldoExcel.toLocaleString('es-PE', { minimumFractionDigits: 2 })}*.` +
      `${diasMora > 0 ? ` (Días de mora: ${diasMora})` : ''}\n\n` +
      `Agradecemos coordinar con su representante *${rep}* para el registro de su comprobante de pago.\n\n` +
      `¡Que tenga un excelente día!`;

    return `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
  };

  const filteredRows = allRows.filter((row: any) => {
    const term = searchTerm.toLowerCase().trim();
    const docNum = (row.documento || row.doc || row.num_doc || '').toLowerCase();
    const diasMora = Number(row.dias_mora || 0);

    const matchesText = (row.cliente || '').toLowerCase().includes(term) || 
                        (row.representante || row.vendedor || '').toLowerCase().includes(term) ||
                        docNum.includes(term);

    if (!matchesText) return false;

    if (subFilter === 'MORA') return diasMora > 0;
    if (subFilter === 'ALDIA') return diasMora <= 0;
    
    return true;
  });

  const getMoraBadge = (dias: number) => {
    if (dias <= 0) return <span className="text-[10px] px-2 py-0.5 bg-green-50 text-green-700 font-semibold border border-green-200 rounded-md">Al Día</span>;
    if (dias <= 15) return <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 font-semibold border border-amber-200 rounded-md">Mora ≤ 15d</span>;
    if (dias <= 45) return <span className="text-[10px] px-2 py-0.5 bg-orange-50 text-orange-700 font-semibold border border-orange-200 rounded-md">Mora 16-45d</span>;
    return <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 bg-red-50 text-red-700 font-bold border border-red-200 rounded-md animate-pulse"><AlertCircle className="h-3 w-3" /> Crítico</span>;
  };

  const handleProgramarFila = (row: any, index: number) => {
    const rowId = row.id || `row-${index}`;
    const monto = inputsMonto[rowId];
    const fecha = inputsFecha[rowId];
    const metodo = inputsMetodo[rowId] || 'Transferencia BCP';

    if (!monto || monto.trim() === '') {
      toast.error('Por favor, ingresa un monto manual antes de programar.');
      return;
    }

    const valorMonto = parseFloat(monto);
    if (isNaN(valorMonto) || valorMonto <= 0) {
      toast.error('El monto debe ser un número válido y mayor a 0.');
      return;
    }

    const nuevoPago: PagoProgramado = {
      id: `pago-${Date.now()}-${index}`,
      cliente: row.cliente || 'Desconocido',
      documento: row.documento || row.doc || row.num_doc || 'S/N',
      representante: row.representante || row.vendedor || 'No Asignado',
      montoOriginal: Number(row.saldo || 0),
      montoProgramado: valorMonto,
      fechaProgramada: fecha,
      metodoPago: metodo,
      estado: 'Pendiente'
    };

    const listaActualizada = [nuevoPago, ...pagosProgramados];
    setPagosProgramados(listaActualizada);
    localStorage.setItem('cobranza_pagos_programados', JSON.stringify(listaActualizada));
    
    handleMontoChange(rowId, '');
    toast.success(`¡Cobro de S/. ${valorMonto} agendado para ${nuevoPago.cliente}!`);
  };

  const handleCompletarPago = (id: string) => {
    const listaActualizada = pagosProgramados.map((p) => p.id === id ? { ...p, estado: 'Completado' as const } : p);
    setPagosProgramados(listaActualizada);
    localStorage.setItem('cobranza_pagos_programados', JSON.stringify(listaActualizada));
    toast.success('Pago marcado como recibido correctamente.');
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="text-sm text-gray-500 font-medium">Cargando pasarela de cobros...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Pagos</h1>
        <p className="text-sm text-gray-500">Programa abonos directamente en la tabla ingresando los montos y las fechas estimadas.</p>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-800 text-sm mr-2">Cartera Activa</h3>
            {subFilter !== 'TODO' && (
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                subFilter === 'MORA' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
              }`}>
                Viendo: {subFilter === 'MORA' ? 'Solo en Mora' : 'Solo Al Día'}
                <button onClick={() => setSubFilter('TODO')} className="hover:text-gray-900 ml-0.5">
                  <XCircle className="h-3 w-3 fill-current" />
                </button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={() => {
                localStorage.removeItem('cobranza_ediciones_monto');
                setInputsMonto({});
                toast.success('Se han limpiado todas las casillas manuales.');
              }}
              className="text-[11px] font-medium text-red-500 border border-red-200 hover:bg-red-50 px-2.5 py-2 rounded-xl transition"
            >
              Vaciar Casillas
            </button>

            <div className="relative w-full sm:w-72">
              <Search className="absolute inset-y-0 left-3 h-4 w-4 text-gray-400 self-center my-auto" />
              <input
                type="text"
                placeholder="Filtrar por cliente, rep. o documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-xs outline-none transition focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-gray-50 rounded-xl text-xs">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead className="bg-gray-50 font-semibold text-gray-600 border-b border-gray-100">
              <tr>
                <th className="p-3 w-[20%]">Cliente / Rep.</th>
                <th className="p-3 w-[10%] text-center">Estado (Mora)</th>
                <th className="p-3 w-[11%]">Nro. Documento</th>
                <th className="p-3 text-right w-[10%]">Saldo Excel</th>
                <th className="p-3 w-[12%] text-blue-600 bg-blue-50/30">Monto Manual (S/.)</th>
                <th className="p-3 w-[12%] text-blue-600 bg-blue-50/30">Fecha Prog.</th>
                <th className="p-3 text-right w-[11%] bg-gray-100/50 text-gray-700">Saldo Restante</th>
                <th className="p-3 w-[10%]">Vía Canal</th>
                <th className="p-3 text-center w-[8%]">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-700">
              {filteredRows.slice(0, 60).map((row: any, index: number) => {
                const rowId = row.id || `row-${index}`;
                const docNum = row.documento || row.doc || row.num_doc || 'S/N';
                const diasMora = Number(row.dias_mora || 0);
                
                const saldoExcel = Number(row.saldo || 0);
                const montoManual = parseFloat(inputsMonto[rowId] || '0');
                const saldoRestante = saldoExcel - (isNaN(montoManual) ? 0 : montoManual);

                return (
                  <tr key={rowId} className="hover:bg-gray-50/40 transition">
                    <td className="p-3">
                      <div className="font-bold text-gray-900 truncate max-w-[180px]">{row.cliente}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Rep: {row.representante || row.vendedor || '-'}</div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        {getMoraBadge(diasMora)}
                        {diasMora > 0 && <span className="text-[9px] text-gray-400 font-medium">({diasMora} días)</span>}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                        <FileText className="h-3 w-3 text-gray-400" />{docNum}
                      </span>
                    </td>
                    <td className="p-3 text-right font-semibold text-gray-900">
                      S/. {saldoExcel.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 bg-blue-50/10">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={inputsMonto[rowId] || ''}
                        onChange={(e) => handleMontoChange(rowId, e.target.value)}
                        className="w-full rounded-lg border border-gray-200 py-1.5 px-2 font-bold text-gray-900 focus:border-blue-500 outline-none"
                      />
                    </td>
                    <td className="p-2 bg-blue-50/10">
                      <input
                        type="date"
                        value={inputsFecha[rowId] ?? ''}
                        onChange={(e) => handleFechaChange(rowId, e.target.value)}
                        className="w-full rounded-lg border border-gray-200 py-1.5 px-2 text-gray-700 focus:border-blue-500 outline-none"
                      />
                    </td>
                    <td className={`p-3 text-right font-bold bg-gray-50/40 ${saldoRestante < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      S/. {saldoRestante.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2">
                      <select
                        value={inputsMetodo[rowId] ?? 'Transferencia BCP'}
                        onChange={(e) => handleMetodoChange(rowId, e.target.value)}
                        className="w-full rounded-lg border border-gray-200 py-1.5 px-1 bg-white text-[11px] outline-none"
                      >
                        <option value="Transferencia BCP">Transf. BCP</option>
                        <option value="Transferencia BBVA">Transf. BBVA</option>
                        <option value="Banco de la Nación">Depo. BN</option>
                        <option value="Efectivo Cobrador">Efectivo</option>
                      </select>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <a
                          href={getWhatsAppUrl(row)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition shadow-sm"
                          title="Enviar mensaje por WhatsApp"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </a>
                        <button 
                          onClick={() => handleProgramarFila(row, index)} 
                          className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-sm"
                          title="Programar cobro"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-gray-400">
                    No se encontraron documentos para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CRONOGRAMA */}
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-blue-500" /> Cronograma de Compromisos Agendados
        </h3>
        {pagosProgramados.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">No has agendado ningún cobro todavía.</p>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-gray-50 font-semibold text-gray-600 border-b border-gray-100">
                <tr>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Documento</th>
                  <th className="p-3">Representante</th>
                  <th className="p-3">Fecha Prog.</th>
                  <th className="p-3">Canal</th>
                  <th className="p-3 text-right">Monto Asignado</th>
                  <th className="p-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-700">
                {pagosProgramados.map((pago) => (
                  <tr key={pago.id} className={`hover:bg-gray-50/50 transition ${pago.estado === 'Completado' ? 'bg-green-50/30' : ''}`}>
                    <td className="p-3 font-bold text-gray-900">{pago.cliente}</td>
                    <td className="p-3 font-mono text-gray-500">{pago.documento}</td>
                    <td className="p-3 text-gray-500">{pago.representante}</td>
                    <td className="p-3 text-gray-600 font-semibold">{pago.fechaProgramada}</td>
                    <td className="p-3 text-gray-500">{pago.metodoPago}</td>
                    <td className="p-3 text-right font-black text-blue-600 text-sm">S/. {pago.montoProgramado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-center">
                      {pago.estado === 'Pendiente' ? (
                        <button onClick={() => handleCompletarPago(pago.id)} className="bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-md font-semibold hover:bg-green-100 hover:text-green-700 transition">Pendiente</button>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2.5 py-0.5 rounded-md font-semibold"><CheckCircle2 className="h-3 w-3" /> Cobrado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}