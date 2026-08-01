import os
import sqlite3
import requests
import random
import time
from tqdm import tqdm
from heuristica import estimar_precio, determinar_unidad_y_granel

DB_NAME = 'dataset.db'
URL_OFF = "https://world.openfoodfacts.org/cgi/search.pl"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS productos (
            codigo_barras TEXT PRIMARY KEY,
            nombre TEXT,
            descripcion TEXT,
            categoria TEXT,
            unidad_medida TEXT,
            es_granel BOOLEAN,
            precio_venta REAL,
            precio_compra REAL,
            stock_inicial INTEGER
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS sync_state (
            id INTEGER PRIMARY KEY,
            last_page INTEGER
        )
    ''')
    c.execute('INSERT OR IGNORE INTO sync_state (id, last_page) VALUES (1, 1)')
    conn.commit()
    return conn

def get_last_page(conn):
    c = conn.cursor()
    c.execute('SELECT last_page FROM sync_state WHERE id = 1')
    return c.fetchone()[0]

def save_last_page(conn, page):
    c = conn.cursor()
    c.execute('UPDATE sync_state SET last_page = ? WHERE id = 1', (page,))
    conn.commit()

def save_product(conn, item):
    c = conn.cursor()
    try:
        c.execute('''
            INSERT OR IGNORE INTO productos 
            (codigo_barras, nombre, descripcion, categoria, unidad_medida, es_granel, precio_venta, precio_compra, stock_inicial)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            item['codigo_barras'], item['nombre'], item['descripcion'], 
            item['categoria'], item['unidad_medida'], item['es_granel'], 
            item['precio_venta'], item['precio_compra'], item['stock_inicial']
        ))
        conn.commit()
        return True
    except Exception:
        return False

def main():
    print("Iniciando Generador de Dataset CUDII POS (Híbrido OFF API)...")
    conn = init_db()
    current_page = get_last_page(conn)
    
    params = {
        "action": "process",
        "tagtype_0": "countries",
        "tag_contains_0": "contains",
        "tag_0": "mexico",
        "page_size": 250,
        "page": current_page,
        "json": "true",
        "fields": "code,product_name,brands,categories_tags,quantity,generic_name"
    }

    headers = {
        "User-Agent": "CUDIIPOS-DatasetGenerator/1.0 (contacto@cudii.mx)"
    }

    print("Conectando con Open Food Facts (Filtro: México)...")
    
    # 1. Obtener conteo total
    try:
        response = requests.get(URL_OFF, params=params, headers=headers, timeout=15)
        response.raise_for_status()
        data = response.json()
        total_count = data.get("count", 0)
        total_pages = (total_count // params["page_size"]) + 1
        
        print(f"Se encontraron aprox. {total_count} productos registrados para México.")
        print(f"Reanudando desde la página {current_page} de {total_pages}...\n")
    except Exception as e:
        print(f"Error inicial al conectar: {e}")
        return

    # Iterar con tqdm pero con soporte para fallos y SQLite
    for page in range(current_page, total_pages + 1):
        print(f"--- Descargando Página {page}/{total_pages} ---")
        params["page"] = page
        
        exito = False
        intentos = 0
        while not exito and intentos < 3:
            try:
                res = requests.get(URL_OFF, params=params, headers=headers, timeout=15)
                res.raise_for_status()
                page_data = res.json()
                exito = True
            except requests.exceptions.RequestException as e:
                intentos += 1
                print(f"Error 50x/401 en página {page}: {e}. Intento {intentos}/3. Durmiendo 30s...")
                time.sleep(30)
                
        if not exito:
            print(f"No se pudo obtener la página {page} tras 3 intentos. Cancelando para evitar baneos.")
            break

        products = page_data.get("products", [])
        if not products:
            break
            
        nuevos = 0
        for p in products:
            codigo = str(p.get("code", "")).strip()
            nombre = str(p.get("product_name", "")).strip()
            
            # Filtro estricto: Solo EAN de México o de 12/13 dígitos
            if not codigo or not nombre:
                continue
            if not (codigo.startswith("750") or len(codigo) >= 12):
                continue
                
            marca = p.get("brands", "").split(",")[0].strip() if p.get("brands") else "Genérico"
            categorias_list = p.get("categories_tags", [])
            categoria_limpia = categorias_list[0].replace("en:", "") if categorias_list else "Abarrotes"
            
            cantidad = str(p.get("quantity", "")).strip()
            descripcion = str(p.get("generic_name", "")).strip() or marca
            
            unidad, es_granel = determinar_unidad_y_granel(cantidad)
            precio_venta = estimar_precio(nombre, categoria_limpia, cantidad)
            precio_compra = round(precio_venta * 0.70, 2)
            stock_inicial = random.randint(10, 100)
            
            item = {
                'codigo_barras': codigo,
                'nombre': nombre,
                'descripcion': descripcion,
                'categoria': categoria_limpia,
                'unidad_medida': unidad,
                'es_granel': es_granel,
                'precio_venta': precio_venta,
                'precio_compra': precio_compra,
                'stock_inicial': stock_inicial
            }
            
            if save_product(conn, item):
                nuevos += 1

        print(f"Página {page} guardada. {nuevos} productos extraídos (Filtrado EAN).")
        save_last_page(conn, page + 1)
        
        # Sleep agresivo para ser amable con la API
        time.sleep(5)

    conn.close()
    print("\nProceso Terminado. Los datos seguros están en dataset.db")
    print("Para generar el CSV de CUDII, ejecuta: python exportador.py")

if __name__ == "__main__":
    main()
