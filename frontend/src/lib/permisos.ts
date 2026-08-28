export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  GERENTE: 'GERENTE',
  CAJERO: 'CAJERO',
  ALMACEN: 'ALMACEN',
  CONTADOR: 'CONTADOR',
} as const;

export type Rol = (typeof ROLES)[keyof typeof ROLES];

export type ClaveMenu =
  | 'dashboard'
  | 'pos'
  | 'clientes'
  | 'fiados'
  | 'devoluciones'
  | 'categorias'
  | 'productos'
  | 'inventario'
  | 'lotes'
  | 'proveedores'
  | 'usuarios'
  | 'auditoria'
  | 'configuracion'
  | 'reportes';

/**
 * Roles permitidos por ítem del menú.
 * - SUPER_ADMIN es universal (pasa todos los guards del backend) y se le
 *   muestra todo, por lo que no hace falta listarlo explícitamente aquí.
 * - Estos valores reflejan los @Roles() del backend + el guard universal.
 */
const ROLES_POR_MENU: Record<Exclude<ClaveMenu, 'dashboard'>, Rol[]> = {
  pos: [ROLES.ADMIN, ROLES.GERENTE, ROLES.CAJERO],
  clientes: [ROLES.ADMIN, ROLES.GERENTE, ROLES.CAJERO],
  fiados: [ROLES.ADMIN, ROLES.GERENTE, ROLES.CAJERO],
  devoluciones: [ROLES.ADMIN, ROLES.GERENTE, ROLES.CAJERO],
  categorias: [ROLES.ADMIN, ROLES.GERENTE, ROLES.CAJERO, ROLES.ALMACEN, ROLES.CONTADOR],
  productos: [ROLES.ADMIN, ROLES.GERENTE, ROLES.CAJERO, ROLES.ALMACEN, ROLES.CONTADOR],
  inventario: [ROLES.ADMIN, ROLES.GERENTE, ROLES.CAJERO, ROLES.ALMACEN, ROLES.CONTADOR],
  lotes: [ROLES.ADMIN, ROLES.GERENTE, ROLES.CAJERO, ROLES.ALMACEN, ROLES.CONTADOR],
  proveedores: [ROLES.ADMIN, ROLES.GERENTE, ROLES.ALMACEN],
  usuarios: [ROLES.ADMIN, ROLES.GERENTE],
  auditoria: [ROLES.ADMIN, ROLES.GERENTE],
  configuracion: [ROLES.ADMIN],
  reportes: [ROLES.ADMIN, ROLES.GERENTE, ROLES.CONTADOR],
};

/** El dashboard está disponible para todos los roles autenticados. */
const CLAVES_TODOS: ClaveMenu[] = ['dashboard'];

/**
 * ¿El rol puede ver el ítem del menú indicado?
 * SUPER_ADMIN siempre puede verlo (es el privilegio más alto).
 */
export function puedeVerMenu(rol: string | undefined, clave: ClaveMenu): boolean {
  if (!rol) return false;
  if (rol === ROLES.SUPER_ADMIN) return true;
  if (CLAVES_TODOS.includes(clave)) return true;
  return (ROLES_POR_MENU[clave as Exclude<ClaveMenu, 'dashboard'>] ?? []).includes(
    rol as Rol,
  );
}
