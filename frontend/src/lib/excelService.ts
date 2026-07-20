export interface ParsedCobranzaRow {
  representante: string
  zona: string
  codigo_socio: string
  ruc_dni: string
  cliente: string
  documento: string
  fecha_emision: string
  importe: number
  fecha_vencimiento: string
  saldo: number
  dias_mora: number
  estado: string
}

const normalizeText = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  return String(value).toString().trim()
}

const normalizeNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeDate = (value: unknown): string => {
  if (!value) return ''
  const text = normalizeText(value)
  if (!text) return ''
  
  // Manejo si Excel ya lo entrega como objeto de fecha o texto de fecha ISO
  const date = new Date(text)
  if (!Number.isNaN(date.getTime())) {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return text
}

export const parseCobranzaRows = (rows: Array<Array<unknown>>): ParsedCobranzaRow[] => {
  const parsedRows: ParsedCobranzaRow[] = []
  let currentRepresentante = ''
  let currentZona = ''

  for (const row of rows) {
    const values = row.map((cell) => normalizeText(cell))

    if (!values.length || values.every(v => v === '')) continue

    const col0 = values[0] || ''
    const col1 = values[1] || ''

    // 1. Detectar cabecera de Representante (Suele venir col0: 'REP:' y col1: Nombre)
    if (col0.toUpperCase().startsWith('REP:')) {
      currentRepresentante = col1 ? col1 : col0.replace(/^REP:\s*/i, '').trim()
      continue
    }

    // 2. Detectar cabecera de Zona (Suele venir col0: 'ZONA:' y col1: Nombre de Zona)
    if (col0.toUpperCase().startsWith('ZONA:')) {
      currentZona = col1 ? col1 : col0.replace(/^ZONA:\s*/i, '').trim()
      continue
    }

    // Saltar filas informativas o de títulos de columnas
    if (
      col0.toUpperCase().includes('RESUMEN DE CUENTAS') || 
      col0.toUpperCase().includes('REPRESENTANTE') ||
      col0.toUpperCase().startsWith('CLIENTE:') ||
      col0.toUpperCase().startsWith('SUBTOTAL')
    ) {
      continue
    }

    // Mapeo basado en los índices reales del reporte estructurado
    const codigoSocio = values[2] || ''
    const rucDni = values[3] || ''
    const cliente = values[4] || '' // Razon Social
    const documento = values[6] || '' // Documento está en la col 6

    // Si no tiene los campos clave mínimos de transacciones, omitir (evita jalar basura o celdas de totales)
    if (!codigoSocio && !documento) {
      continue
    }

    // Calcular estado dinámicamente basado en los Días de Mora (Col 12)
    const diasMora = normalizeNumber(values[12])
    const estadoCalculado = diasMora > 0 ? 'En Mora' : 'Al Día'

    parsedRows.push({
      representante: currentRepresentante || col0, // Si col0 trae el nombre directo en la fila
      zona: currentZona || col1,
      codigo_socio: codigoSocio,
      ruc_dni: rucDni,
      cliente,
      documento,
      fecha_emision: normalizeDate(values[8]),
      importe: normalizeNumber(values[9]),
      fecha_vencimiento: normalizeDate(values[10]),
      saldo: normalizeNumber(values[11]),
      dias_mora: diasMora,
      estado: estadoCalculado
    })
  }

  return parsedRows
}

export const parseCobranzaExcelFile = async (file: File): Promise<ParsedCobranzaRow[]> => {
  const { read, utils } = await import('xlsx')
  const arrayBuffer = await file.arrayBuffer()
  const workbook = read(arrayBuffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  
  // Forzamos lectura cruda de matrices para procesar fila por fila limpiamente
  const rows = utils.sheet_to_json(sheet, { header: 1, defval: '' }) as Array<Array<unknown>>
  return parseCobranzaRows(rows)
}