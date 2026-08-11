# FORZA Photo Food Worker — Etapa 2A

Backend remoto en modo mock. No llama a Gemini ni requiere una clave de proveedor visual.

## Configuración no secreta

- `PHOTO_FOOD_ENABLED`: kill switch remoto. Debe permanecer en `false` hasta la prueba aprobada.
- `ALLOWED_ORIGIN`: origen exacto autorizado para CORS: `https://gimeneze332-gif.github.io`.
- Durable Object SQLite `PhotoFoodState`: guarda únicamente hashes, expiración, revocación y contadores.

## Secreto manual

Configurar únicamente `PAIRING_ADMIN_SECRET` desde el panel de Cloudflare o mediante Wrangler. No debe guardarse en Git, `.env`, el frontend ni la PWA.

## Endpoints

- `POST /pairing/create`: requiere el secreto administrativo como Bearer y devuelve un código temporal de ocho dígitos.
- `POST /pairing/claim`: consume el código una sola vez y devuelve un token de dispositivo.
- `POST /device/revoke`: revoca el token presentado.
- `POST /photo-food/analyze`: recibe exclusivamente JPEG procesado, aplica autorización y cuotas, y devuelve el contrato Photo Food v1.

## Estado actual

El proveedor interno es mock. Los escenarios de prueba se seleccionan con `X-Photo-Food-Mock-Scenario`. La estructura de `gemini-adapter.js` continúa desactivada.
