# Vibra — agenda de eventos con administrador

La web pública muestra eventos, fechas, sectores disponibles, plano por función, ubicación y consulta de compra por WhatsApp. El panel permite crear y editar eventos, publicar o despublicar, cargar imágenes y planos, ubicar sectores sobre el plano y mantener el stock por fecha.

## Iniciar

Necesitás Node.js 24 o superior. La base SQLite utiliza `node:sqlite`, incluido en Node; no hay dependencias para instalar.

```powershell
node server.js
```

- Web pública: `http://127.0.0.1:3000/`
- Administrador: `http://127.0.0.1:3000/admin`

`127.0.0.1` funciona solo en tu computadora. Para que otras personas entren, hay que desplegarlo. La configuración principal para esta publicación está en `vercel.json`.

La primera vez, el servidor muestra una **clave aleatoria de administrador en la terminal**. Guardala: no vuelve a aparecer. Para generar otra clave local, detené el servidor y ejecutá `node server.js --reset-password`. También podés definir `ADMIN_PASSWORD` como variable de entorno antes de iniciar el servidor; si existe, reemplaza la clave local.

## Cargar un evento

1. Entrá al administrador y elegí **Crear evento**.
2. Completá nombre, recinto, dirección y descripción. Subí la imagen principal o usá una URL HTTPS.
3. Agregá cada fecha por separado. Para cada una, subí su plano y cargá solamente los sectores que ofrecés, con su cantidad disponible. Si cambia la configuración del recinto, podés subir otro plano para esa fecha.
4. Tocá **Ubicar en plano** junto a un sector y luego hacé clic en su posición de la imagen. Los números sobre el plano público mostrarán el stock cargado.
5. Marcá **Publicado** y guardá.

La consulta por WhatsApp incluye evento, fecha, sector y cantidad. **No reserva ni descuenta stock automáticamente.** Cuando confirmes una venta, actualizá la cantidad en el panel. Si la cantidad llega a 0, el sector aparece agotado y no se puede seleccionar.

## Datos cargados

El proyecto incluye el evento Omar Courtz en Movistar Arena con las fechas **30/11/2026** y **02/12/2026**. El stock inicial refleja exactamente las cuatro filas proporcionadas: 104 × 2 y 112 × 2 para el 30/11; 116 × 5 y 103 × 2 para el 02/12. El plano adjunto está en `assets/movistar-arena-sectores.png`. Solo aparecen esas dos fechas porque son las que tienen stock informado.

## Datos y publicación

Los eventos, fechas y sectores se guardan en la base SQLite `.data/vibra.sqlite`; las imágenes subidas desde el panel, en `uploads/`. La primera vez se importan los datos previos de `data/events.json`. A partir de entonces, el JSON queda como copia inicial y los cambios del administrador se guardan en SQLite.

### Publicar con GitHub y Vercel

1. Creá un repositorio **privado** en GitHub y subí este proyecto. `.gitignore` excluye la base local, las imágenes privadas de trabajo y los archivos generados.
2. En Vercel, elegí **Add New → Project** e importá ese repositorio. Usá Framework Preset **Other** y Node.js **24.x**. `vercel.json` ejecuta `npm run build` y publica los archivos estáticos de `public/`.
3. En la configuración del proyecto agregá `ADMIN_PASSWORD` con una clave larga y única para `/admin`. Guardala en un gestor de contraseñas; no la subas al repositorio ni la envíes por chat.
4. En **Storage**, agregá **Neon Postgres** al proyecto. La integración debe definir `DATABASE_URL` para Production. En **Storage** agregá un **Vercel Blob público** conectado al mismo proyecto para las imágenes del panel.
5. Volvé a desplegar la versión de Production después de conectar la base y Blob. Abrí la URL `https://...vercel.app`, verificá `/api/events`, entrá a `/admin` y cargá una imagen de prueba.

En Vercel, los eventos se guardan en Neon Postgres y las imágenes nuevas en Vercel Blob. La base SQLite sigue funcionando solo para el desarrollo local. El estado inicial en `data/events.json` se carga una única vez en una base Neon nueva; los cambios siguientes se hacen en el administrador alojado y quedan compartidos para todos los visitantes. Los archivos de `assets/` forman parte del despliegue y sirven las imágenes que ya estaban cargadas.

La carga inicial incluye el estado local exportado al momento de preparar el proyecto, con Omar Courtz y ARGENTINA VS BENIN. Las imágenes subidas que usan esos eventos se copiaron a `assets/` para ese primer despliegue. Si se modifica la base local **antes de crear el sitio**, ejecutá `node scripts/export-seed.js` y subí al repositorio el JSON y las imágenes actualizadas. Luego de publicar, administrá los eventos desde la URL pública: la base local y la alojada son independientes. `data/events.json` no sobrescribe la base de un sitio ya creado.

**Hacé copias de seguridad** de los datos locales en `.data/` y `uploads/`, preferentemente con el servidor detenido. Para los datos publicados, revisá las opciones de copia de Neon y Vercel Blob. El panel está protegido con clave y una cookie de sesión firmada. No subas `.data/` ni variables de entorno a GitHub. La consulta por WhatsApp no descuenta stock automáticamente: una venta confirmada requiere actualizarlo en el panel.

El mapa de ubicación usa OpenStreetMap y el botón **Cómo llegar** abre Google Maps. Las coordenadas se cargan desde el panel. El número de WhatsApp se configura en `site.js` y `index.html`.
