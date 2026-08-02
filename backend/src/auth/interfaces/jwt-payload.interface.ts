export interface JwtPayload {
  sub: string;
  email: string;
  rol: string;
  empresaId: string;
}

export interface CurrentUserPayload {
  id: string;
  email: string;
  rol: string;
  empresaId: string;
}
