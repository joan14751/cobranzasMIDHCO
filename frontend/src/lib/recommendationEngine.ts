export interface PlanPagoRecomendado {
  sugerenciaTexto: string
  montoSugerido: number
  plazoSugeridoDias: number
  cuotasSugeridas: number
  razonamiento: string // Explicación técnica de la decisión del algoritmo
}

export function obtenerPlanPagoIA(saldo: number, diasMora: number): PlanPagoRecomendado {
  const monto = Math.max(0, saldo)

  // Caso 0: Saldo regularizado, en cero o saldo a favor (<= 0)
  if (saldo <= 0) {
    return {
      sugerenciaTexto: `No requiere plan de pagos (Saldo regularizado o en cero).`,
      montoSugerido: 0,
      plazoSugeridoDias: 0,
      cuotasSugeridas: 0,
      razonamiento: `El cliente no registra saldo pendiente de cobro en el sistema.`
    }
  }

  // Caso 1: Retraso Crítico (> 45 días)
  if (diasMora > 45) {
    const numCuotas = monto > 5000 ? 4 : 2
    const cuotaMonto = Math.round((monto / numCuotas) * 100) / 100

    return {
      sugerenciaTexto: `Fraccionar deuda en ${numCuotas} cuotas semanales de S/. ${cuotaMonto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}. Primera cuota obligatoria en máximo 3 días.`,
      montoSugerido: cuotaMonto,
      plazoSugeridoDias: 3,
      cuotasSugeridas: numCuotas,
      razonamiento: `Mora crítica de ${diasMora} días. Exigir un pago único genera alto riesgo de morosidad definitiva. Fraccionar reduce el impacto financiero y permite verificar liquidez inmediata.`
    }
  }

  // Caso 2: Retraso Alto/Medio (15 a 45 días)
  if (diasMora > 15) {
    const cuotaInicial = Math.round((monto * 0.5) * 100) / 100
    return {
      sugerenciaTexto: `Compromiso de pago inicial del 50% (S/. ${cuotaInicial.toLocaleString('es-PE', { minimumFractionDigits: 2 })}) en 5 días y saldo restante a 15 días.`,
      montoSugerido: cuotaInicial,
      plazoSugeridoDias: 5,
      cuotasSugeridas: 2,
      razonamiento: `Mora moderada (${diasMora} días). Un adelanto del 50% asegura el compromiso financiero del cliente antes de otorgar una prórroga.`
    }
  }

  // Caso 3: Retraso Leve (1 a 15 días)
  if (diasMora > 0) {
    return {
      sugerenciaTexto: `Compromiso de cancelación total de S/. ${monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })} en máximo 72 horas.`,
      montoSugerido: monto,
      plazoSugeridoDias: 3,
      cuotasSugeridas: 1,
      razonamiento: `Retraso leve (${diasMora} días). Suele responder a demoras operativas habituales, resolviéndose con un recordatorio directo a corto plazo.`
    }
  }

  // Caso 4: Al día (0 días de mora)
  return {
    sugerenciaTexto: `Mantener fecha de vencimiento habitual. Pago regular de S/. ${monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}.`,
    montoSugerido: monto,
    plazoSugeridoDias: 0,
    cuotasSugeridas: 1,
    razonamiento: `Cliente al día. Mantiene un perfil de bajo riesgo crediticio.`
  }
}