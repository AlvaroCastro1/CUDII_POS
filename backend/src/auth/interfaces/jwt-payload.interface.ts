import { Rol } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  rol: Rol;
  empresaId: string;
}

export interface CurrentUserPayload {
  id: string;
  email: string;
  rol: Rol;
  empresaId: string;
}
