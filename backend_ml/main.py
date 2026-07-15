from fastapi import FastAPI
from pydantic import BaseModel
from typing import List

app = FastAPI(title='Cobranza ML API')

class Recommendation(BaseModel):
    id: str
    cliente_id: str
    probabilidad_pago: float
    nivel_riesgo: str
    recomendacion: str
    estado_recomendado: str
    fecha_analisis: str

@app.get('/health')
def health():
    return {'status': 'ok'}

@app.get('/api/ml/recommendations', response_model=List[Recommendation])
def recommendations():
    return [
        Recommendation(
            id='rec-1',
            cliente_id='cliente-1',
            probabilidad_pago=0.82,
            nivel_riesgo='bajo',
            recomendacion='Priorizar seguimiento telefónico en los próximos 3 días.',
            estado_recomendado='contactar',
            fecha_analisis='2026-07-11'
        ),
        Recommendation(
            id='rec-2',
            cliente_id='cliente-2',
            probabilidad_pago=0.41,
            nivel_riesgo='alto',
            recomendacion='Reestructurar pago con plan de cuotas reducido.',
            estado_recomendado='reestructurar',
            fecha_analisis='2026-07-11'
        )
    ]
