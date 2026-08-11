import React, { useState } from 'react';
import { DocumentoComparado } from '../types/cobranza';

interface Props {
  documentos: DocumentoComparado[];
  onGuardarProgramacion: (id: string, monto: number, canal: string, fecha: string) => void;
}

export const TablaComparativa: React.FC<Props> = ({ documentos, onGuardarProgramacion }) => {
  const [formValues, setFormValues] = useState<Record<string, { monto: number; canal: string; fecha: string }>>({});

  const handleInputChange = (id: string, field: string, value: any) => {
    setFormValues((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const badgeEstado = (estado: DocumentoComparado['estadoCumplimiento']) => {
    switch (estado) {
      case 'CUMPLIDO':
        return <span className="bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-xs font-semibold">Cumplió</span>;
      case 'PARCIAL':
        return <span className="bg-amber-900/60 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-xs font-semibold">Parcial</span>;
      case 'INCUMPLIDO':
        return <span className="bg-rose-900/60 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded text-xs font-semibold">No Cumplió</span>;
      default:
        return <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-xs">Sin Prog.</span>;
    }
  };

  return (
    <div className="bg-[#0f172a] text-slate-200 rounded-xl border border-slate-800 p-4 shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-medium">
              <th className="py-3 px-2">Documento</th>
              <th className="py-3 px-2">Mora</th>
              <th className="py-3 px-2 text-right">Saldo (05-08)</th>
              <th className="py-3 px-2">Monto Programar</th>
              <th className="py-3 px-2">Canal Pago</th>
              <th className="py-3 px-2">Fecha</th>
              <th className="py-3 px-2 text-right">Saldo (07-08)</th>
              <th className="py-3 px-2 text-center">Cumplimiento</th>
              <th className="py-3 px-2 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {documentos.map((doc) => {
              const currentForm = formValues[doc.id] || {
                monto: doc.montoProgramado || 0,
                canal: doc.canalPago || 'Transferencia BCP',
                fecha: doc.fecha || '2026-08-04'
              };

              return (
                <tr key={doc.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 px-2 font-medium text-blue-400">{doc.id}</td>
                  <td className="py-2.5 px-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] ${doc.mora === 'Al día' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                      {doc.mora}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right font-bold text-slate-300">
                    S/. {doc.saldoAnterior.toFixed(2)}
                  </td>
                  
                  {/* Formulario Integrado */}
                  <td className="py-2.5 px-2">
                    <input
                      type="number"
                      value={currentForm.monto}
                      onChange={(e) => handleInputChange(doc.id, 'monto', parseFloat(e.target.value) || 0)}
                      className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="py-2.5 px-2">
                    <select
                      value={currentForm.canal}
                      onChange={(e) => handleInputChange(doc.id, 'canal', e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
                    >
                      <option value="Transferencia BCP">Transferencia BCP</option>
                      <option value="Yape / Plin">Yape / Plin</option>
                      <option value="Efectivo">Efectivo</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-2">
                    <input
                      type="date"
                      value={currentForm.fecha}
                      onChange={(e) => handleInputChange(doc.id, 'fecha', e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </td>

                  {/* Saldo Foto Nueva (07-08) */}
                  <td className="py-2.5 px-2 text-right font-bold text-white">
                    S/. {doc.saldoActual.toFixed(2)}
                  </td>

                  <td className="py-2.5 px-2 text-center">
                    {badgeEstado(doc.estadoCumplimiento)}
                  </td>

                  <td className="py-2.5 px-2 text-center">
                    <button
                      onClick={() => onGuardarProgramacion(doc.id, currentForm.monto, currentForm.canal, currentForm.fecha)}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-3 py-1 rounded transition-colors text-xs"
                    >
                      Actualizar
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