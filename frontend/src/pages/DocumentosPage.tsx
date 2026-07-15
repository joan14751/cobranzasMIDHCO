import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  getDocumentos, 
  uploadDocumentoCompleto, 
  deleteDocumentoCompleto 
} from '../lib/supabaseService';

// Declaramos la interfaz exacta con todas las propiedades que usa la tabla 'documentos'
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

  // Cargar lista de documentos desde la Base de Datos
  const loadDocumentos = async () => {
    setLoading(true);
    const { data, error } = await getDocumentos();
    if (error) {
      toast.error('Error al cargar documentos: ' + error);
    } else if (data) {
      // Forzamos el tipado seguro hacia nuestra interfaz local
      setDocumentos(data as unknown as DocumentoExtendido[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDocumentos();
  }, []);

  // Manejar subida de documentos (.pdf, .doc, .docx, .xls, .xlsx)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validar tipo de archivo en el frontend por seguridad
    const allowedExtensions = /(\.pdf|\.doc|\.docx|\.xls|\.xlsx)$/i;
    if (!allowedExtensions.exec(file.name)) {
      toast.error('Formato no permitido. Solo se aceptan archivos .pdf, .doc, .docx, .xls, .xlsx');
      return;
    }

    setUploading(true);
    const toastId = toast.loading('Subiendo y registrando documento...');

    // Usamos el nuevo servicio integrado (Storage + Base de datos)
    const { error } = await uploadDocumentoCompleto(file, file.name);

    setUploading(false);
    toast.dismiss(toastId);

    if (error) {
      toast.error('Error al subir documento: ' + error);
    } else {
      toast.success('Documento subido y registrado correctamente');
      loadDocumentos(); // Recargar lista desde la BD
    }
    
    // Resetear input
    e.target.value = '';
  };

  // Manejar descarga/apertura usando la URL que ya viene en la BD
  const handleDownload = (url: string) => {
    if (!url) {
      toast.error('La URL de descarga no está disponible');
      return;
    }
    window.open(url, '_blank');
  };

  // Manejar eliminación de la BD y del Storage
  const handleDelete = async (id: string, rutaArchivo: string, nombre: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el documento "${nombre}"?`)) return;

    const toastId = toast.loading('Eliminando documento...');
    const { error } = await deleteDocumentoCompleto(id, rutaArchivo);
    toast.dismiss(toastId);

    if (error) {
      toast.error('Error al eliminar: ' + error);
    } else {
      toast.success('Documento eliminado con éxito');
      loadDocumentos();
    }
  };

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Gestión de Documentos</h2>
          <p className="text-sm text-gray-500">Sube y organiza archivos PDF, Word (.doc, .docx) y Excel (.xls, .xlsx)</p>
        </div>

        {/* Botón de carga estilizado */}
        <label className={`cursor-pointer inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition duration-150 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <span>{uploading ? 'Subiendo...' : 'Subir Documento'}</span>
          <input 
            type="file" 
            className="hidden" 
            onChange={handleFileUpload} 
            disabled={uploading}
            accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          />
        </label>
      </div>

      <hr className="mb-6 border-gray-200" />

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <span className="animate-pulse">Cargando documentos...</span>
        </div>
      ) : documentos.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-12 text-center text-gray-500">
          <p className="text-lg font-medium">No hay documentos cargados.</p>
          <p className="text-sm">Usa el botón "Subir Documento" en la esquina superior para añadir tu primer archivo.</p>
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
                    {doc.fecha_carga ? new Date(doc.fecha_carga).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'Sin fecha'}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleDownload(doc.url_archivo)}
                        className="rounded bg-gray-100 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-200 transition"
                      >
                        Ver / Descargar
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
    </div>
  );
}