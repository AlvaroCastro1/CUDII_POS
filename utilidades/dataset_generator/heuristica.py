import re

def estimar_precio(nombre, categorias, cantidad_str):
    """
    Motor heurístico para calcular un precio base sugerido en pesos mexicanos (MXN)
    basado en el nombre del producto, categoría y su gramaje/volumen.
    """
    nombre = str(nombre).lower()
    categorias = str(categorias).lower()
    cantidad = str(cantidad_str).lower()

    # Extraer el número de la cantidad (ej. "600 ml" -> 600)
    match_num = re.search(r'([0-9]+[.,]?[0-9]*)', cantidad)
    volumen_o_peso = float(match_num.group(1).replace(',', '.')) if match_num else 0

    # 1. Reglas para Bebidas y Refrescos
    if 'refresco' in nombre or 'cola' in nombre or 'beverage' in categorias or 'soda' in categorias:
        if volumen_o_peso > 0:
            return round(volumen_o_peso * 0.03, 2) # Ej. 600ml * 0.03 = 18.00 MXN
        return 18.00

    # 2. Reglas para Agua
    if 'agua' in nombre and 'sabor' not in nombre:
        if volumen_o_peso > 0:
            return round(volumen_o_peso * 0.012, 2) # Ej. 1000ml * 0.012 = 12.00 MXN
        return 12.00

    # 3. Reglas para Botanas / Papas (Sabritas, Barcel)
    if 'papas' in nombre or 'botanas' in categorias or 'chips' in nombre:
        if volumen_o_peso > 0:
            return round(volumen_o_peso * 0.35, 2) # Ej. 42g * 0.35 = 14.70 MXN
        return 16.00
    
    # 4. Reglas para Galletas / Pan dulce
    if 'galletas' in nombre or 'pan' in nombre or 'biscuit' in categorias or 'marinela' in nombre or 'bimbo' in nombre:
        if volumen_o_peso > 0:
            return round(volumen_o_peso * 0.25, 2) # Ej. 90g * 0.25 = 22.50 MXN
        return 18.00

    # 5. Reglas para Leche y Lácteos
    if 'leche' in nombre or 'dairies' in categorias:
        if volumen_o_peso > 0 and 'l' in cantidad or 'ml' in cantidad:
            if volumen_o_peso < 10: # Asumiendo Litros
                return round(volumen_o_peso * 26.0, 2)
            else: # Asumiendo Mililitros
                return round(volumen_o_peso * 0.026, 2) # Ej. 1000ml * 0.026 = 26.00 MXN
        return 26.00

    # 6. Reglas para Enlatados (Atún, Frijoles)
    if 'atun' in nombre or 'frijol' in nombre or 'canned' in categorias:
        if volumen_o_peso > 0:
            return round(volumen_o_peso * 0.15, 2)
        return 20.00

    # Regla General (Fallback)
    if volumen_o_peso > 0:
        if 'ml' in cantidad or 'l' in cantidad:
            return round(volumen_o_peso * 0.025, 2)
        elif 'g' in cantidad or 'kg' in cantidad:
            return round(volumen_o_peso * 0.10, 2)
    
    # Si no hay datos, un precio por defecto aleatorio pero sensato
    return 25.00

def determinar_unidad_y_granel(cantidad_str):
    """
    Determina si se vende por pieza, kilogramo o litro y si es a granel.
    Por defecto, OpenFoodFacts contiene casi puros productos empaquetados (pieza).
    """
    cantidad = str(cantidad_str).lower()
    
    es_granel = False
    unidad = "pieza" # La mayoría en OFF es empaquetado (código de barras = pieza cerrada)
    
    # Para abarrotes comerciales con EAN, el 99% se vende por pieza, 
    # incluso si el contenido es 1kg de arroz, el cliente compra 1 pieza de la bolsa.
    
    return unidad, es_granel
