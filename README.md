# Ui-biblioteca · «Tu biblioteca física en digital»

Interfaz web (HTML + CSS + JavaScript puro, sin frameworks ni build) de la app que convierte la foto de una página
de un libro impreso en texto editable.

## Pantallas
- **Iniciar sesión / Crear cuenta**
- **Mi biblioteca:** libros en tarjetas, creación de libros y búsqueda de frases en todo lo que has escaneado
- **Libro:** lista de páginas escaneadas
- **Escanear:** elige libro → toma o sube una foto → el OCR devuelve el texto
- **Página:** leer, **subrayar con 4 colores**, notas, editar el texto, y herramientas de IA (resumen, mapa de conceptos, lectura en voz alta)
- **Respaldo:** crear, descargar, restaurar y borrar respaldos

## Cómo usarlo
1. Levanta el backend ([Back-biblioteca](https://github.com/moraleitor/Back-biblioteca)): `python run_all.py` (queda en `http://127.0.0.1:8000`).
2. Sirve esta carpeta con cualquier servidor estático, por ejemplo:
   ```bash
   python -m http.server 5173
   ```
   y abre <http://localhost:5173>.
3. Si el backend está en otra dirección, edita `config.js` (`window.API_URL`).

## Estructura
```
index.html        contenedor y barra superior
config.js         URL del backend
css/styles.css    estilos (paleta azul marino del proyecto)
js/api.js         cliente HTTP del gateway
js/views.js       pantallas
js/app.js         enrutador por hash (#/library, #/scan, ...)
```

## Despliegue en Vercel
Es un sitio estático: en Vercel «Add New → Project», importa este repo, *Framework Preset: Other*, sin build.
Antes, en `config.js` pon la URL pública del backend (`window.API_URL = "https://tu-api.onrender.com"`).
