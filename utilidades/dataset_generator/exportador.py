import sqlite3
import pandas as pd
import os

DB_NAME = 'dataset.db'
CSV_NAME = 'cudii_dataset_mx.csv'

def export_to_csv():
    if not os.path.exists(DB_NAME):
        print(f"Error: La base de datos '{DB_NAME}' no existe. Ejecuta main.py primero.")
        return

    print("Conectando a la base de datos...")
    conn = sqlite3.connect(DB_NAME)
    
    # Leer toda la tabla de productos usando Pandas
    print("Extrayendo productos...")
    df = pd.read_sql_query("SELECT * FROM productos", conn)
    conn.close()

    total_rows = len(df)
    if total_rows == 0:
        print("La base de datos está vacía. No hay nada que exportar.")
        return

    print(f"Se encontraron {total_rows} productos. Generando CSV...")
    
    # Guardar a CSV
    df.to_csv(CSV_NAME, index=False, encoding='utf-8-sig')
    
    print(f"¡Éxito! El archivo '{CSV_NAME}' ha sido generado.")
    print("Ya puedes utilizar este archivo para importar tu catálogo masivo en CUDII POS.")

if __name__ == "__main__":
    export_to_csv()
