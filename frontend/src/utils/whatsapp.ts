// src/utils/whatsapp.ts

interface DatosNotificacion {
  telefono: string // Debe incluir código de país (ej. 51987654321 para Perú)
  cliente: string
  documento: string
  monto: number
  diasMora: number
}

export function generarLinkWhatsApp({ telefono, cliente, documento, monto, diasMora }: DatosNotificacion): string {
  // Limpiar el teléfono de espacios, guiones o símbolos
  const numLimpio = telefono.replace(/\D/g, '')
  
  // Si no tiene código de país, asegurar que lleve el prefijo de Perú (+51)
  const numFinal = numLimpio.startsWith('51') ? numLimpio : `51${numLimpio}`

  // Estructurar el mensaje con formato de WhatsApp (*negrita*, etc.)
  const mensaje = 
`Hola *${cliente}*, le saludamos del equipo de Cobranzas. 👋

Le recordamos que presenta un documento pendiente de pago:
📄 *Documento:* ${documento}
💰 *Monto pendiente:* S/. ${monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
⚠️ *Días de mora:* ${diasMora} días

Agradeceremos regularizar su saldo a la brevedad. Si ya realizó el pago, por favor ignore este mensaje y envíenos el comprobante por este medio.

¡Muchas gracias!`

  // Codificar para URL
  return `https://wa.me/${numFinal}?text=${encodeURIComponent(mensaje)}`
}