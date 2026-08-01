# Usa una imagen oficial de Python ligera
FROM python:3.11-slim

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia el archivo de requerimientos y las dependencias
COPY dataset_generator/requirements.txt .

# Instala las dependencias sin guardar cache para mantener la imagen ligera
RUN pip install --no-cache-dir -r requirements.txt

# Copia todo el código del generador
COPY dataset_generator/ .

# Comando por defecto al levantar el contenedor (inicia el scraper)
# También puedes sobrescribir el comando para ejecutar 'python exportador.py'
CMD ["python", "-u", "main.py"]
