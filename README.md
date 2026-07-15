# Cobranza App

Aplicación full-stack para gestión de cobranza con:
- Frontend React + Vite + TypeScript
- Backend ML con FastAPI
- Supabase como base de datos y autenticación

## Ejecutar frontend

```bash
cd frontend
npm install
npm run dev
```

## Ejecutar backend ML

```bash
cd backend_ml
pip install fastapi uvicorn
uvicorn main:app --reload --port 8000
```

## Variables de entorno

Crear un archivo `.env` en frontend con:

```env
VITE_SUPABASE_URL=tu_url
VITE_SUPABASE_ANON_KEY=tu_key
```
