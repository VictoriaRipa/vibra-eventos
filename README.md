# Vibra — agenda de eventos con administrador

La web pública muestra eventos, fechas, sectores disponibles, plano por función, ubicación y consulta de compra por WhatsApp. El panel permite crear y editar eventos, publicar o despublicar, cargar imágenes y planos, ubicar sectores sobre el plano y mantener el stock por fecha.

## Iniciar

Necesitás Node.js 24 o superior. La base SQLite utiliza `node:sqlite`, incluido en Node; no hay dependencias para instalar.

```powershell
node server.js
```

- Web pública: `http://127.0.0.1:3000/`
- Administrador: `http://127.0.0.1:3000/admin`

`127.0.0.1` funciona solo en tu computadora. Para que otras personas entren, hay que desplegar el servidor Node en un alojamiento público. El archivo `render.yaml` deja preparada una opción con URL pública, HTTPS y un disco persistente para la base y las imágenes.

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

### Publicar en Render

1. Creá una cuenta en [Render](https://dashboard.render.com/) y un repositorio **privado** en GitHub. Subí los archivos de esta web al repositorio, incluido `render.yaml`, `data/events.json` y `assets/`. No subas `.data/`, `uploads/` ni `storage/`.
2. En Render elegí **New → Blueprint**, conectá el repositorio y confirmá el servicio definido en `render.yaml`. El plan configurado es pago porque la base SQLite y las imágenes requieren un disco persistente. Render mostrará el costo antes de crear el servicio.
3. Cuando Render pida `ADMIN_PASSWORD`, elegí una clave larga y única y guardala en un gestor de contraseñas. Es la clave del panel en `/admin`.
4. Al terminar el despliegue, abrí la URL `https://...onrender.com` que entrega Render. Esa URL ya sirve para compartir la web; el dominio propio se puede conectar más adelante.
5. Comprobá la portada y una imagen, iniciá sesión en `/admin`, editá un evento y recargá la portada para verificar el cambio.

La carga inicial incluye el estado local exportado al momento de preparar el proyecto, con Omar Courtz y ARGENTINA VS BENIN. Las imágenes subidas que usan esos eventos se copiaron a `assets/` para ese primer despliegue. Si se modifica la base local **antes de crear el sitio**, ejecutá `node scripts/export-seed.js` y subí al repositorio el JSON y las imágenes actualizadas. Luego de publicar, administrá los eventos desde la URL pública: la base local y la alojada son independientes. `data/events.json` no sobrescribe la base de un sitio ya creado.

**Hacé copias de seguridad de `.data/` y `uploads/`**, preferentemente con el servidor detenido para que el archivo SQLite y su registro WAL queden consistentes. Para publicar en Internet, usá un servidor con disco persistente y HTTPS. El proceso Node debe permanecer funcionando. El panel está protegido con clave y sesión; configurá `ADMIN_PASSWORD` de forma segura en el entorno de alojamiento. No subas `.data/` a un repositorio público. SQLite sirve bien para una única instancia del servidor; si más adelante usás varios servidores o almacenamiento efímero, conviene pasar a una base y un almacenamiento de imágenes compartidos.

El mapa de ubicación usa OpenStreetMap y el botón **Cómo llegar** abre Google Maps. Las coordenadas se cargan desde el panel. El número de WhatsApp se configura en `site.js` y `index.html`.
