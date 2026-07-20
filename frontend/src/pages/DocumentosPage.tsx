import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  getDocumentos, 
  uploadDocumentoCompleto, 
  deleteDocumentoCompleto 
} from '../lib/supabaseService';
import { parseCobranzaExcelFile } from '../lib/excelService';

interface DocumentoExtendido {
  id: string;
  nombre: string;
  ruta_archivo: string;
  url_archivo: string;
  fecha_carga?: string;
  cliente_id?: string | null;
}

export default function DocumentosPage() {
  const [documentos, setDocumentos] = useState<DocumentoExtendido[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [nombreArchivoActual, setNombreArchivoActual] = useState<string>('');
  
  // Estado para el término de búsqueda
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadDocumentos = async () => {
    setLoading(true);
    const { data, error } = await getDocumentos();
    if (error) {
      toast.error('Error al cargar documentos: ' + error);
    } else if (data) {
      setDocumentos(data as unknown as DocumentoExtendido[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDocumentos();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const allowedExtensions = /(\.pdf|\.doc|\.docx|\.xls|\.xlsx)$/i;
    if (!allowedExtensions.exec(file.name)) {
      toast.error('Solo se aceptan .pdf, .doc, .docx, .xls, .xlsx');
      return;
    }

    setUploading(true);
    const toastId = toast.loading('Subiendo documento...');

    const { error } = await uploadDocumentoCompleto(file, file.name);

    setUploading(false);
    toast.dismiss(toastId);

    if (error) {
      toast.error('Error al subir: ' + error);
    } else {
      toast.success('Documento subido correctamente');
      loadDocumentos();
    }

    e.target.value = '';
  };

  const handlePreview = async (doc: DocumentoExtendido) => {
    if (!doc.ruta_archivo.endsWith('.xls') && !doc.ruta_archivo.endsWith('.xlsx')) {
      window.open(doc.url_archivo, '_blank');
      return;
    }

    const toastId = toast.loading('Descargando datos para previsualización...');
    try {
      const response = await fetch(doc.url_archivo);
      const blob = await response.blob();
      const file = new File([blob], doc.nombre, { type: blob.type });
      const parsedRows = await parseCobranzaExcelFile(file);
      
      setNombreArchivoActual(doc.nombre);
      setPreviewData(parsedRows);
      setSearchTerm(''); // Limpiar búsquedas previas al abrir otro archivo
      setShowPreview(true);
      toast.dismiss(toastId);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error('Error al previsualizar Excel');
    }
  };

  const handleDownloadStructuredExcel = async () => {
    if (!previewData || previewData.length === 0) return;

    const toastId = toast.loading('Generando archivo estructurado...');
    try {
      const { utils, writeFile } = await import('xlsx');

      const formattedRows = filteredData.map(row => ({
        'Representante': row.representante || '',
        'Zona': row.zona || '',
        'Cod. Socio': row.codigo_socio || '',
        'RUC / DNI': row.ruc_dni || '',
        'Razón Social': row.cliente || '',
        'Nombre Comercial': row.nombre_comercial || row.nombreComercial || '',
        'Documento': row.documento || '',
        'Fecha Emisión': row.fecha_emision || '',
        'Importe': row.importe || 0,
        'Fecha Vencimiento': row.fecha_vencimiento || '',
        'Saldo': row.saldo || 0,
        'Días Mora': row.dias_mora || 0,
        'Estado': row.estado || 'Al Día'
      }));

      const worksheet = utils.json_to_sheet(formattedRows);
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, 'Cobranzas Procesadas');

      const baseName = nombreArchivoActual.replace(/\.[^/.]+$/, "");
      const finalFileName = `${baseName}_ESTRUCTURADO.xlsx`;

      writeFile(workbook, finalFileName);
      toast.dismiss(toastId);
      toast.success('Archivo descargado con éxito');
    } catch (error) {
      toast.dismiss(toastId);
      toast.error('Error al exportar archivo Excel');
    }
  };

  const handleDelete = async (id: string, rutaArchivo: string, nombre: string) => {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;

    const toastId = toast.loading('Eliminando...');
    const { error } = await deleteDocumentoCompleto(id, rutaArchivo);
    toast.dismiss(toastId);

    if (error) {
      toast.error('Error al eliminar: ' + error);
    } else {
      toast.success('Documento eliminado');
      loadDocumentos();
    }
  };

  // Filtrado de datos global y en tiempo real
  const filteredData = (previewData || []).filter((row) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (row.representante || '').toLowerCase().includes(search) ||
      (row.zona || '').toLowerCase().includes(search) ||
      (row.codigo_socio || '').toLowerCase().includes(search) ||
      (row.ruc_dni || '').toLowerCase().includes(search) ||
      (row.cliente || '').toLowerCase().includes(search) ||
      (row.documento || '').toLowerCase().includes(search) ||
      (row.estado || '').toLowerCase().includes(search)
    );
  });

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Gestión de Documentos</h2>
          <p className="text-sm text-gray-500">Sube y organiza archivos PDF, Word y Excel</p>
        </div>

        <label className={`cursor-pointer inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition duration-150 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <span>{uploading ? 'Subiendo...' : 'Subir Documento'}</span>
          <input 
            type="file" 
            className="hidden" 
            onChange={handleFileUpload} 
            disabled={uploading}
            accept=".pdf,.doc,.docx,.xls,.xlsx"
          />
        </label>
      </div>

      <hr className="mb-6 border-gray-200" />

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          Cargando documentos...
        </div>
      ) : documentos.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-12 text-center text-gray-500">
          No hay documentos cargados.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <th className="py-3 px-4">Nombre del archivo</th>
                <th className="py-3 px-4">Fecha de carga</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documentos.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50 transition duration-150">
                  <td className="py-4 px-4 font-medium text-gray-900 truncate max-w-xs sm:max-w-md">
                    {doc.nombre}
                  </td>
                  <td className="py-4 px-4 text-gray-500">
                    {doc.fecha_carga ? new Date(doc.fecha_carga).toLocaleDateString('es-ES') : 'Sin fecha'}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handlePreview(doc)}
                        className="rounded bg-blue-100 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-200 transition"
                      >
                        Previsualizar
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id, doc.ruta_archivo, doc.nombre)}
                        className="rounded bg-red-50 px-3 py-1.5 font-medium text-red-600 hover:bg-red-100 transition"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DE PREVISUALIZACIÓN DE DATOS COMPLETOS */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-[95vw] w-full max-h-[90vh] overflow-hidden flex flex-col p-8 shadow-2xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Previsualización del Excel</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Encontrados {filteredData.length} de {previewData.length} registros del reporte estructurado limpio.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadStructuredExcel}
                  className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 transition shadow-sm flex items-center gap-2 text-sm"
                >
                  📥 Descargar Formato Limpio
                </button>
                <button 
                  onClick={() => setShowPreview(false)} 
                  className="rounded-lg bg-gray-100 px-4 py-2 font-semibold text-gray-600 hover:bg-gray-200 transition text-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* SECCIÓN NUEVA: CUADRO DE BÚSQUEDA INTERNO */}
            <div className="mb-4">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Buscar por representante, zona, RUC/DNI, razón social o documento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 hover:text-gray-600"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
            
            <div className="overflow-auto border border-gray-100 rounded-xl max-h-[65vh]">
              <table className="w-full text-sm border-collapse text-left whitespace-nowrap">
                <thead className="sticky top-0 bg-gray-50 border-b z-10">
                  <tr className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                    <th className="py-3 px-4">Representante</th>
                    <th className="py-3 px-4">Zona</th>
                    <th className="py-3 px-4">Cod. Socio</th>
                    <th className="py-3 px-4">RUC / DNI</th>
                    <th className="py-3 px-4">Razón Social</th>
                    <th className="py-3 px-4">Nombre Comercial</th>
                    <th className="py-3 px-4">Documento</th>
                    <th className="py-3 px-4">F. Emisión</th>
                    <th className="py-3 px-4">Importe</th>
                    <th className="py-3 px-4">F. Venc.</th>
                    <th className="py-3 px-4">Saldo</th>
                    <th className="py-3 px-4">Días Mora</th>
                    <th className="py-3 px-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-8 text-gray-400">
                        No se encontraron registros que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50/70 transition duration-75">
                        <td className="py-3 px-4 text-gray-600 max-w-[180px] truncate">{row.representante || '-'}</td>
                        <td className="py-3 px-4 text-gray-600">{row.zona || '-'}</td>
                        <td className="py-3 px-4 font-mono text-xs text-gray-600">{row.codigo_socio || '-'}</td>
                        <td className="py-3 px-4 font-mono text-xs text-gray-700">{row.ruc_dni || '-'}</td>
                        <td className="py-3 px-4 font-medium text-gray-900 max-w-[220px] truncate">{row.cliente || '-'}</td>
                        <td className="py-3 px-4 text-gray-600 max-w-[180px] truncate">{row.nombre_comercial || row.nombreComercial || '-'}</td>
                        <td className="py-3 px-4 text-gray-600 font-mono text-xs">{row.documento || '-'}</td>
                        <td className="py-3 px-4 text-gray-500">
                          {row.fecha_emision ? new Date(row.fecha_emision).toLocaleDateString('es-ES') : '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-900 font-medium">
                          {row.importe !== undefined ? `$${Number(row.importe).toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-500">
                          {row.fecha_vencimiento ? new Date(row.fecha_vencimiento).toLocaleDateString('es-ES') : '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-900 font-medium">
                          {row.saldo !== undefined ? `$${Number(row.saldo).toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-mono px-2 py-0.5 rounded text-xs ${Number(row.dias_mora) > 0 ? 'text-red-600 font-bold bg-red-50' : 'text-gray-500'}`}>
                            {row.dias_mora}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            (row.estado || '').toLowerCase().includes('mora')
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {row.estado || 'Al Día'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}