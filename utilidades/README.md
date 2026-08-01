# CUDII Utilidades (Docker)

Este contenedor aísla herramientas de automatización y scripts utilitarios del ecosistema principal (Frontend/Backend) para no ensuciar la máquina host con dependencias de Python u otros lenguajes.

## 📦 Herramienta 1: Generador de Dataset (Open Food Facts ETL)

Este script (`dataset_generator`) se conecta a la API de Open Food Facts México, descarga todos los productos disponibles de forma paginada y controlada, estima sus precios usando heurística y los guarda en una base de datos local SQLite. Finalmente, los exporta a un CSV compatible con CUDII POS.

### ¿Cómo funciona la tolerancia a fallos?
1. **Sleeps:** Se detiene 2 segundos entre cada página para no saturar a OFF y evitar baneos de IP.
2. **SQLite Local:** Guarda cada producto en el archivo `dataset.db` al vuelo.
3. **Paginación Guardada:** Si el script crashea o apagas tu PC, la tabla `sync_state` guarda la última página analizada. Al volver a iniciar el script, continuará exactamente donde se quedó.

### ¿Cómo ejecutarlo toda la noche?

Gracias a que está en Docker Compose, es muy sencillo:

1. Entra a la carpeta de utilidades:
   ```bash
   cd utilidades
   ```
2. Inicia el proceso en segundo plano (detached):
   ```bash
   docker-compose up -d --build
   ```
3. Verifica cómo va descargando (puedes ver los logs en vivo):
   ```bash
   docker-compose logs -f
   ```
4. Si quieres detenerlo para irte a dormir, solo apaga tu PC o corre:
   ```bash
   docker-compose stop
   ```
   *No te preocupes, cuando lo vuelvas a arrancar con `docker-compose start`, continuará donde se quedó.*

### ¿Cómo exportar el CSV una vez que terminó?

Cuando en los logs veas el mensaje de **"Proceso ETL Terminado"** o simplemente cuando sientas que ya tienes suficientes datos (ej. al día siguiente), exporta el CSV:

Ejecuta el script de exportación dentro del contenedor que ya está corriendo:
```bash
docker-compose exec dataset-generator python exportador.py
```

Esto generará un archivo llamado `cudii_dataset_mx.csv` directamente en tu carpeta física `utilidades/dataset_generator/` (gracias al mapeo de volúmenes de Docker). Ese CSV está listo para importarse en la Base de Datos de CUDII.
