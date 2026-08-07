import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('CRUD & Inventory Operations with Teardown (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let sucursalId: string;
  
  // Guardamos IDs para el teardown
  let categoryId: string;
  let productId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Iniciar sesión como ADMIN
    const adminRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin_demo@demo.com', password: 'Admin1234!' })
      .expect(200);
    adminToken = adminRes.body.access_token;

    // El seed asigna todo a la primera empresa y sucursal. Asumiremos que podemos traer el inventario
    // con "all" o buscaremos la sucursal.
  });

  afterAll(async () => {
    // ==========================================
    // TEARDOWN: Soft Delete de la data generada
    // ==========================================
    // Borramos el producto (esto hará un soft delete: estaActivo = false)
    if (productId) {
      await request(app.getHttpServer())
        .delete(`/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }

    // Borramos la categoría
    if (categoryId) {
      await request(app.getHttpServer())
        .delete(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }

    await app.close();
  });

  // ================= CATEGORÍAS =================
  it('Debe crear una categoría (POST /categories)', async () => {
    const res = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Categoría E2E Temp',
        descripcion: 'Test E2E Teardown',
        colorHex: '#000000',
        icono: 'test'
      })
      .expect(201);
    
    categoryId = res.body.id;
    expect(categoryId).toBeDefined();
  });

  // ================= PRODUCTOS =================
  it('Debe crear un producto y validar unicidad de código (POST /products)', async () => {
    const codigoUnico = `E2E-${Date.now()}`;
    const payload = {
      nombre: 'Producto E2E Temp',
      codigoBarras: codigoUnico,
      codigoInterno: 'E2E-001',
      unidadMedida: 'pieza',
      precioVentaBase: 100,
      precioCompra: 50,
      esGranel: false,
      categoriasIds: [categoryId]
    };

    // Creación exitosa
    const res = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);
    
    productId = res.body.id;
    expect(productId).toBeDefined();

    // Intentar crear de nuevo con el mismo código de barras debe fallar (409 Conflict)
    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(409);
  });

  // ================= INVENTARIO =================
  it('Debe registrar un ajuste de entrada en el inventario (POST /inventory/adjust)', async () => {
    // Para registrar ajuste necesitamos saber la sucursal. 
    // Dado que el sistema requiere sucursalId, lo buscaremos usando el endpoint de listado general de inventario
    const invRes = await request(app.getHttpServer())
      .get('/inventory/stock/all')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    
    // Obtenemos una sucursal del primer item para usarla
    sucursalId = invRes.body.data[0]?.sucursalId;
    expect(sucursalId).toBeDefined();

    // Registrar ajuste
    await request(app.getHttpServer())
      .post('/inventory/adjust')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productoId: productId,
        sucursalId: sucursalId,
        tipo: 'entrada',
        cantidad: 10,
        motivo: 'Compra a proveedor'
      })
      .expect(201);
  });

  it('Debe reflejar el ajuste en el stock (GET /inventory/stock)', async () => {
    const invRes = await request(app.getHttpServer())
      .get(`/inventory/stock/${sucursalId}?search=Producto E2E Temp`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    
    const productoEnInventario = invRes.body.data.find((item: any) => item.productoId === productId);
    expect(productoEnInventario).toBeDefined();
    // La creación de producto en Fase 1 no inicializa el inventario automáticamente a 0 en el controller a menos que 
    // se haga la entrada (nuestro post anterior de 10). Dependiendo si había registro previo o no.
    // Si no había registro, se creó con 10.
    expect(productoEnInventario.stockActual).toBe(10);
  });

});
