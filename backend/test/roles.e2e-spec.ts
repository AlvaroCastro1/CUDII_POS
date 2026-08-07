import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Roles & Access Control (e2e)', () => {
  let app: INestApplication<App>;
  let tokens: Record<string, string> = {};
  let superAdminId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const creds = [
      { rol: 'SUPER_ADMIN', email: 'admin@cudii.demo', password: 'password123' },
      { rol: 'ADMIN', email: 'admin_demo@demo.com', password: 'Admin1234!' },
      { rol: 'GERENTE', email: 'gerente@demo.com', password: 'Gerente1234!' },
      { rol: 'CAJERO', email: 'cajero@demo.com', password: 'Cajero1234!' },
      { rol: 'ALMACEN', email: 'almacen@demo.com', password: 'Almacen1234!' },
      { rol: 'CONTADOR', email: 'contador@demo.com', password: 'Contador1234!' },
    ];

    for (const cred of creds) {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: cred.email, password: cred.password });
      
      if (res.status === 200) {
        tokens[cred.rol] = res.body.access_token;
        if (cred.rol === 'SUPER_ADMIN') {
          superAdminId = res.body.user.id;
        }
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // ========== PRUEBAS DE LISTADO DE USUARIOS ==========
  it('SUPER_ADMIN puede obtener la lista de usuarios (200 OK)', async () => {
    return request(app.getHttpServer()).get('/users').set('Authorization', `Bearer ${tokens['SUPER_ADMIN']}`).expect(200);
  });
  
  it('ADMIN puede obtener la lista de usuarios (200 OK)', async () => {
    return request(app.getHttpServer()).get('/users').set('Authorization', `Bearer ${tokens['ADMIN']}`).expect(200);
  });

  it('GERENTE puede obtener la lista de usuarios (200 OK)', async () => {
    return request(app.getHttpServer()).get('/users').set('Authorization', `Bearer ${tokens['GERENTE']}`).expect(200);
  });

  it('CAJERO NO puede obtener la lista de usuarios (403 Forbidden)', async () => {
    return request(app.getHttpServer()).get('/users').set('Authorization', `Bearer ${tokens['CAJERO']}`).expect(403);
  });

  it('ALMACEN NO puede obtener la lista de usuarios (403 Forbidden)', async () => {
    return request(app.getHttpServer()).get('/users').set('Authorization', `Bearer ${tokens['ALMACEN']}`).expect(403);
  });

  it('CONTADOR NO puede obtener la lista de usuarios (403 Forbidden)', async () => {
    return request(app.getHttpServer()).get('/users').set('Authorization', `Bearer ${tokens['CONTADOR']}`).expect(403);
  });

  // ========== PRUEBAS DE PROTECCIÓN DE SUPER_ADMIN ==========
  it('Admin NO puede crear un SUPER_ADMIN (403 Forbidden)', async () => {
    return request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${tokens['ADMIN']}`)
      .send({
        nombre: 'Intruso',
        email: 'intruso@demo.com',
        password: 'Password123!',
        rol: 'SUPER_ADMIN'
      })
      .expect(403);
  });

  it('Admin NO puede modificar a un SUPER_ADMIN (403 Forbidden)', async () => {
    return request(app.getHttpServer())
      .patch(`/users/${superAdminId}`)
      .set('Authorization', `Bearer ${tokens['ADMIN']}`)
      .send({ nombre: 'Hackeado' })
      .expect(403);
  });
});
