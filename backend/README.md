# FORZA Photo Food Worker — Etapa 2A.1

Backend remoto para Cloudflare Workers Free con proveedor mock. No llama a Gemini ni contiene claves de proveedores visuales.

## Configuración incluida

- `BACKEND_ENABLED=true`: permite healthcheck, pairing, revocación y análisis sujeto al segundo interruptor.
- `PHOTO_ANALYSIS_ENABLED=false`: mantiene `/photo-food/analyze` apagado durante el primer despliegue.
- `ALLOWED_ORIGIN=https://gimeneze332-gif.github.io`: único origen web autorizado mediante CORS.
- Durable Object SQLite `PhotoFoodState`: guarda hashes, expiración, revocación y contadores.
- `workers_dev=true`: Cloudflare asignará una URL bajo `workers.dev`; no hace falta comprar un dominio.

## Único secreto manual

`PAIRING_ADMIN_SECRET` debe ser una contraseña aleatoria y exclusiva de al menos 32 caracteres. Se carga interactivamente en Cloudflare y nunca se guarda en Git, `.env`, el frontend, la PWA ni capturas de pantalla.

## Endpoints

- `GET /health`: estado no sensible del backend, interruptor de análisis y proveedor activo.
- `POST /pairing/create`: requiere `PAIRING_ADMIN_SECRET` como Bearer; devuelve un código temporal.
- `POST /pairing/claim`: consume el código una sola vez y devuelve un token de dispositivo.
- `POST /device/revoke`: revoca el token presentado.
- `POST /photo-food/analyze`: recibe JPEG procesado y devuelve el contrato Photo Food v1. Empieza desactivado.

## Guía simple de despliegue (no ejecutar sin aprobación)

### 1. Crear la cuenta

1. Entrar en `https://dash.cloudflare.com/sign-up`.
2. Crear una cuenta Free con un correo propio y una contraseña exclusiva.
3. Verificar el correo.
4. Abrir **Workers & Pages**.
5. Si Cloudflare lo solicita, elegir un nombre para el subdominio `workers.dev`.

No hace falta agregar un sitio, comprar un dominio ni contratar Workers Paid.

### 2. Abrir una terminal en la carpeta correcta

Abrir PowerShell en:

`C:\Users\PC\.codex\.chatgpt-projects\g-p-6a21f9eceda08191b9b2ad9dcbd19e0f\forza-app\backend`

Ejecutar:

```powershell
npx wrangler login
```

Aceptar en el navegador únicamente el acceso a la cuenta Cloudflare elegida.

### 3. Crear el secreto

Inventar una cadena aleatoria de al menos 32 caracteres y guardarla en un administrador de contraseñas con el nombre `FORZA PAIRING ADMIN`.

Ejecutar:

```powershell
npx wrangler secret put PAIRING_ADMIN_SECRET
```

Pegar el valor cuando Wrangler lo solicite. No escribir el valor directamente en el comando.

No compartir:

- `PAIRING_ADMIN_SECRET`;
- el token del dispositivo;
- códigos de pairing mientras estén vigentes;
- futuras claves de Gemini;
- archivos `.env` o capturas que contengan esos valores.

### 4. Desplegar

Desde la misma carpeta ejecutar:

```powershell
npx wrangler deploy
```

Guardar la URL que termina en `.workers.dev`. El primer despliegue tendrá el backend encendido y el análisis apagado.

### 5. Comprobar el healthcheck

Abrir en Safari o en el navegador:

`https://TU-WORKER.TU-SUBDOMINIO.workers.dev/health`

Debe responder:

```json
{
  "status": "ok",
  "analysisEnabled": false,
  "provider": "mock"
}
```

### 6. Generar el código de pairing

En PowerShell, evitar poner el secreto en el historial:

```powershell
$forzaAdminSecret = Read-Host "PAIRING_ADMIN_SECRET"
$forzaHeaders = @{ Authorization = "Bearer $forzaAdminSecret"; Origin = "https://gimeneze332-gif.github.io" }
Invoke-RestMethod -Method Post -Uri "https://TU-WORKER.TU-SUBDOMINIO.workers.dev/pairing/create" -Headers $forzaHeaders
```

La respuesta mostrará un código de ocho dígitos válido durante diez minutos y una sola vez.

### 7. Probar desde FORZA

Editar únicamente `photo-food-config.js`:

```html
window.FORZA_PHOTO_FOOD_CONFIG = {
  mode: "remote",
  endpoint: "https://TU-WORKER.TU-SUBDOMINIO.workers.dev"
};
```

Después:

1. Abrir FORZA en el iPhone.
2. Entrar en **Registrar comida → Foto**.
3. Ingresar el código temporal.
4. Confirmar que el dispositivo queda vinculado.
5. Mientras `PHOTO_ANALYSIS_ENABLED=false`, intentar analizar debe mostrar que Photo Food está temporalmente desactivado.

El frontend no se publica ni se cambia a modo remoto durante esta etapa sin una aprobación específica.

### 8. Apagar todo

La forma más rápida es abrir Cloudflare → **Workers & Pages → forza-photo-food → Settings → Variables and Secrets**, cambiar `BACKEND_ENABLED` a `false` y desplegar esa configuración.

También puede cambiarse localmente en `wrangler.jsonc` y ejecutar nuevamente:

```powershell
npx wrangler deploy
```

Para apagar solo las fotos y conservar pairing/healthcheck, mantener:

```text
BACKEND_ENABLED=true
PHOTO_ANALYSIS_ENABLED=false
```

## Estado del proveedor

El proveedor activo sigue siendo `mock-provider.js`. `gemini-adapter.js` permanece desactivado y arroja `provider_not_configured` si alguien intenta usarlo.
