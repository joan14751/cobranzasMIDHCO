import React, { useState } from 'react';
import { DocumentoComparado } from '../types/cobranza';

interface Props {
  documentos: DocumentoComparado[];
  onGuardar: (numDoc: string, monto: number, canal: string, fecha: string) => Promise<void>;
}

export const TablaComparativaPagos: React.FC<Props> = ({ documentos, onGuardar }) => {
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);
  const [stateForm, setStateForm] = useState<Record<string, { monto: number; canal: string; fecha: string }>>({});

  const handleChange = (numDoc: string, field: string, value: any) => {
    setStateForm((prev) => ({
      ...prev,
      [numDoc]: {
        ...prev[numDoc],
        [field]: value
      }
    }));
  };

  const handleSave = async (doc: DocumentoComparado) => {
    const current = stateForm[doc.numeroDocumento] || {
      monto: doc.montoProgramado,
      canal: doc.canalPago,
      fecha: doc.fechaProgramada
    };

    setLoadingDoc(doc.numeroDocumento);
    try {
      await onGuardar(doc.numeroDocumento, current.monto, current.canal, current.fecha);
      alert(`Programación actualizada para ${doc.numeroDocumento}`);
    } catch (err) {
      alert('Error al guardar la programación');
    } finally {
      setLoadingDoc(null);
    }
  };

  const renderBadge = (estado: DocumentoComparado['estadoCumplimiento']) => {
    switch (estado) {
      case 'CUMPLIDO':
        return <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[11px] font-semibold">Cumplió</span>;
      case 'PARCIAL':
        return <span className="bg-amber-950 text-amber-400 border border-amber-800 px-2 py-0.5 rounded text-[11px] font-semibold">Parcial</span>;
      case 'INCUMPLIDO':
        return <span className="bg-rose-950 text-rose-400 border border-rose-800 px-2 py-0.5 rounded text-[11px] font-semibold">Incumplió</span>;
      default:
        return <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[11px]">Sin Prog.</span>;
    }
  };

  return (
    <div className="bg-[#0b1329] text-white rounded-lg border border-slate-800 overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#131e3a] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-3">Documento</th>
              <th className="py-3 px-3">Mora</th>
              <th className="py-3 px-3 text-right">Saldo (05-08)</th>
              <th className="py-3 px-3">Monto Programar</th>
              <th className="py-3 px-3">Canal Pago</th>
              <th className="py-3 px-3">Fecha</th>
              <th className="py-3 px-3 text-right">Saldo (07-08)</th>
              <th className="py-3 px-3 text-center">Estado</th>
              <th className="py-3 px-3 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {documentos.map((doc) => {
              const values = stateForm[doc.numeroDocumento] || {
                monto: doc.montoProgramado,
                canal: doc.canalPago,
                fecha: doc.fechaProgramada
              };

              return (
                <tr key={doc.numeroDocumento} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-blue-400">{doc.numeroDocumento}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${doc.mora === 'Al día' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                      {doc.mora}
                    </span>
                  </td>

                  {/* Saldo Foto Anterior */}
                  <td className="py-2.5 px-3 text-right font-bold text-slate-300">
                    S/. {doc.saldoAnterior.toFixed(2)}
                  </td>

                  {/* Inputs de Programación */}
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      value={values.monto}
                      onChange={(e) => handleChange(doc.numeroDocumento, 'monto', parseFloat(e.target.value) || 0)}
                      className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                    />
                  </td>

                  <td className="py-2.5 px-3">
                    <select
                      value={values.canal}
                      onChange={(e) => handleChange(doc.numeroDocumento, 'canal', e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Transferencia BCP">Transferencia BCP</option>
                      <option value="Yape / Plin">Yape / Plin</option>
                      <option value="Efectivo">Efectivo</option>
                    </select>
                  </td>

                  <td className="py-2.5 px-3">
                    <input
                      type="date"
                      value={values.fecha}
                      onChange={(e) => handleChange(doc.numeroDocumento, 'fecha', e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                    />
                  </td>

                  {/* Saldo Nuevo */}
                  <td className="py-2.5 px-3 text-right font-bold text-white">
                    S/. {doc.saldoActual.toFixed(2)}
                  </td>

                  {/* Estado Evaluado */}
                  <td className="py-2.5 px-3 text-center">
                    {renderBadge(doc.estadoCumplimiento)}
                  </td>

                  {/* Botón Guardar en Supabase */}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => handleSave(doc)}
                      disabled={loadingDoc === doc.numeroDocumento}
                      className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-3 py-1 rounded font-medium text-xs transition-colors"
                    >
                      {loadingDoc === doc.numeroDocumento ? '...' : 'Actualizar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};