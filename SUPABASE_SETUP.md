# Guía paso a paso para configurar Supabase

Esta guía está pensada para que puedas integrar rápidamente **Supabase** (auth + storage) con tu aplicación `servidor`.

---
## 1️⃣ Crear el proyecto en Supabase
1. Entra a https://app.supabase.com y, si no tienes cuenta, regístrate.
2. Haz clic en **New project**.
3. Completa los datos:
   - **Project name**: `servidor`
   - **Password**: elige una contraseña segura (guárdala, la necesitarás para la consola).
   - **Region**: elige la más cercana a tus usuarios (p. ej. `us-east-1`).
4. Pulsa **Create new project** y espera a que el clúster esté listo (≈1 min).

---
## 2️⃣ Configurar **Authentication**
1. En el menú lateral, selecciona **Authentication → Settings**.
2. En **URL de redirección** (`Redirect URLs`) agrega la URL donde tu frontend se servirá en desarrollo y producción, por ejemplo:
   - `http://localhost:5173` (Vite dev)
   - `https://<tu‑sitio>.netlify.app` (producción).
3. En **External OAuth** puedes habilitar Google, GitHub, etc., si lo deseas.
4. Guarda los cambios.

---
## 3️⃣ Crear el **bucket** de storage
1. En el menú lateral, elige **Storage → Buckets**.
2. Haz clic en **New bucket**.
3. Nombre del bucket: `files` (o el que prefieras).
4. Marca **Public** **OFF** – mantendremos los archivos privados.
5. Haz clic en **Create bucket**.

---
## 4️⃣ Generar las credenciales que usará tu aplicación
1. En **Settings → API** copia los valores:
   - **URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`
2. (Opcional) Genera una **service_role** key si vas a operar desde el backend con privilegios administrativos, pero *NO* la expongas al cliente.

---
## 5️⃣ Definir **políticas de acceso** (RLS) para el bucket
1. Ve a **Storage → Buckets → files → Policies**.
2. Crea una política **Insert** para permitir subir archivos a usuarios autenticados:
   ```sql
   create policy "allow upload" on storage.objects for insert
   using (auth.role() = 'authenticated');
   ```
3. Crea una política **Select** para permitir la visualización/descarga mediante signed URLs:
   ```sql
   create policy "allow read" on storage.objects for select
   using (true);
   ```
4. Guarda ambas políticas.

---
## 6️⃣ Configurar **CORS** (para que Netlify pueda acceder)
1. En **Settings → API** desplázate a **CORS**.
2. Añade la URL de tu sitio Netlify, p. ej.: `https://<tu‑sitio>.netlify.app`.
3. Marca **Allow all origins** *solo* en desarrollo si lo necesitas.
4. Guarda.

---
## 7️⃣ Añadir variables de entorno a tu proyecto
### Backend (`backend/.env`)
```dotenv
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY   # solo si necesitas acceso desde backend sin privilegios elevados
# Si usas service_role (para admin), añade también:
# SUPABASE_SERVICE_ROLE=YOUR_SERVICE_ROLE_KEY
JWT_SECRET=YOUR_JWT_SECRET   # ya existente
``` 

### Frontend (`frontend/.env.production`)
```dotenv
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
VITE_API_URL=https://<backend‑url>   # p.ej. Render URL
``` 

---
## 8️⃣ Probar la integración localmente
1. Reinicia el backend para que lea el nuevo `.env`.
2. Ejecuta `npm run dev` en el frontend.
3. Regístrate / inicia sesión usando la UI de Supabase (ya está incluida en `auth.js`).
4. Sube un archivo desde la aplicación y verifica que aparezca en el bucket (puedes verlo en **Storage → Buckets → files → Objects**).
5. Haz clic en el archivo para asegurarte de que la previsualización funciona (se genera una signed URL).

---
## 9️⃣ Deploy (Netlify + Render)
1. En **Render** crea un nuevo **Web Service** apuntando a la carpeta `backend`.
   - Build command: `npm install && npm run start`
   - Environment: añade las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `JWT_SECRET`.
2. En **Netlify** enlaza el repositorio Git y selecciona **Vite** como framework (el `netlify.toml` ya está preparado).
3. Publica. La aplicación debería cargar la imagen hero, permitir login, subir y previsualizar cualquier tipo de archivo.

---
## 🎉 ¡Listo!
Con estos pasos tendrás **Supabase** configurado para autenticación y almacenamiento, y tu aplicación `servidor` podrá usarlo sin problemas.

---
**Resumen rápido**
1️⃣ Crear proyecto → 2️⃣ Auth → 3️⃣ Bucket → 4️⃣ Copiar URL & anon key → 5️⃣ Políticas RLS → 6️⃣ CORS → 7️⃣ .env → 8️⃣ Probar → 9️⃣ Deploy.
