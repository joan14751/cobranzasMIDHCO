# Supabase setup

1. Crea un proyecto en Supabase.
2. Ejecuta el contenido de schema.sql en el SQL Editor.
3. Ejecuta el contenido de seed.sql para cargar datos iniciales.
4. Crea al menos un usuario autenticado en Auth > Users.
5. Crea un registro en profiles con el mismo UUID del usuario y el campo role.

Ejemplo de insert en profiles:

```sql
insert into profiles (id, full_name, role)
values (
  'uuid-del-usuario',
  'Administrador',
  'admin'
);
```

6. Define las variables de entorno en frontend/.env:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```
