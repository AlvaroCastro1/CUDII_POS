# CUDII POS (Punto de Venta SaaS)

CUDII es una plataforma de Punto de Venta (POS) y Gestión Comercial multitenant en la nube. Está diseñada para proveer una solución robusta a comercios locales en México y Latinoamérica, incluyendo soporte para múltiples sucursales, facturación CFDI 4.0, gestión avanzada de inventarios, roles de acceso granular y análisis de inteligencia de negocio.

## Arquitectura y Tecnologías

El sistema está construido bajo una arquitectura modular y Cloud-First:

- **Backend:** NestJS (Node.js) con TypeScript.
- **Base de Datos:** PostgreSQL como fuente principal de verdad, gestionada con el ORM **Prisma**.
- **Caché:** Redis para sesiones, colas y optimización de consultas.
- **Frontend / Cliente POS:** React (Vite) para web, con capacidades futuras en Expo.
- **Estilos y Diseño (CSS):** Tailwind CSS, usado obligatoriamente para mantener un diseño coherente y prevenir código espagueti.
- **Despliegue:** 100% Dockerizado para garantizar la paridad entre desarrollo y producción.

Para conocer más sobre la arquitectura, reglas de negocio y el plan de desarrollo, consulta la documentación en la carpeta [`.agents/`](./.agents/).

## Requisitos Previos

Para ejecutar el proyecto en tu entorno local, solo necesitas tener instalado:

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

*(No es necesario instalar Node.js, PostgreSQL o Redis localmente, todo se ejecuta dentro de los contenedores en modo Hot-Reload)*.

## Primeros Pasos (Configuración y Ejecución)

Sigue estos pasos para levantar el entorno de desarrollo:

1. **Clona el repositorio** y entra en la carpeta del proyecto.
   ```bash
   git clone <url-del-repo> cudii-pos
   cd cudii-pos
   ```

2. **Configura las variables de entorno:**
   Copia el archivo `.env.example` y renómbralo a `.env`. Puedes usar los valores por defecto para desarrollo.
   ```bash
   cp .env.example .env
   ```

3. **Levanta los contenedores:**
   Usa Docker Compose para construir e iniciar los servicios (API, PostgreSQL y Redis).
   ```bash
   docker-compose up --build
   ```
   *Nota: La primera vez que ejecutes este comando, Docker descargará las imágenes y construirá el contenedor de la API (NestJS). Esto puede tomar unos minutos.*

4. **Migraciones de Base de Datos (Prisma):**
   Una vez que los contenedores estén corriendo, abre otra terminal y ejecuta las migraciones para crear las tablas en PostgreSQL.
   ```bash
   docker exec -it cudii_api npx prisma migrate dev
   ```

## Desarrollo en Caliente (Hot-Reload)

El archivo `docker-compose.yml` está configurado con **volúmenes** que mapean el código de tu máquina local al interior del contenedor (`cudii_api`). 

Esto significa que cualquier cambio que guardes en tu editor de código se detectará instantáneamente y NestJS/Vite se reiniciará automáticamente dentro de Docker, sin necesidad de bajar y subir los contenedores.

## Pruebas

El proyecto incluye una suite de pruebas API automatizada con 39 escenarios:

```bash
# Ejecutar todas las pruebas (requiere backend corriendo)
node tests/run_tests.js
```

Para pruebas con Postman, importa `tests/POS_API_TESTS.postman_collection.json`.

Ver `docs/GUIA_PRUEBAS_FASE4.md` para documentación completa de la suite.

## Documentación de Referencia

Asegúrate de leer los siguientes documentos antes de comenzar a desarrollar:

- [Especificación Técnica (SPEC.md)](./.agents/SPEC.md)
- [Reglas de Negocio](./.agents/REGLAS_NEGOCIO.md)
- [Plan de Desarrollo](./.agents/PLAN_DESARROLLO.md)
