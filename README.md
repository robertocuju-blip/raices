# Raíces

Aplicación web pública para crear un árbol genealógico y conservar los recuerdos familiares.

**Abrir la aplicación:** https://robertocuju-blip.github.io/raices/

No requiere cuentas, ChatGPT ni servicios externos. Los árboles se guardan en el navegador de cada persona. Descarga copias JSON desde «Descargar una copia» y recupéralas con «Importar árbol». Los datos no se sincronizan entre dispositivos y pueden perderse si se borran los datos del navegador; conserva siempre una copia descargada.

## Funciones

- Árbol de arriba abajo, con parejas al mismo nivel y conexiones en forma de llaves. Toca una persona para editarla.
- Fichas de mujer u hombre en rosa o azul, con fechas opcionales de nacimiento y defunción.
- Edad actual y edad al fallecer calculadas automáticamente.
- Vista minimalista, buscador de vínculos familiares y copias de seguridad JSON.
- Validación de fechas y relaciones para evitar ciclos de ascendencia.

## Desarrollo

Requiere Node.js >=22.13.0 y npm.

```sh
npm ci
npm run dev
```

```sh
node --experimental-strip-types family.test.mjs
node --experimental-strip-types storage.test.mjs
node --experimental-strip-types hierarchy.test.mjs
npx tsc --noEmit
npm run build
```

La compilación estática se genera en `dist/`, con rutas relativas compatibles con GitHub Pages y cualquier alojamiento estático. No contiene una base de datos ni autenticación. Los archivos del servidor de la versión original permanecen en el historial; no se utilizan en esta compilación.

## Publicación

La rama `main` contiene el código fuente y `gh-pages` la compilación pública. GitHub Pages sirve la raíz de `gh-pages`. Después de cada cambio, genera `dist/` y actualiza esa rama con su contenido.


