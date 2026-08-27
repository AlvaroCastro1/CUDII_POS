import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { construirRespuestaPaginada } from '../common/helpers/pagination.helper';

/** Servicio de proveedores: CRUD completo multitenant */
@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crear un nuevo proveedor */
  async create(empresaId: string, dto: CreateSupplierDto) {
    // Verificar nombre único por empresa
    const existente = await this.prisma.proveedor.findFirst({
      where: { empresaId, nombre: dto.nombre, estaActivo: true },
    });
    if (existente) {
      throw new BadRequestException(
        'Ya existe un proveedor activo con ese nombre en esta empresa',
      );
    }

    return this.prisma.proveedor.create({
      data: {
        empresaId,
        ...dto,
      },
    });
  }

  /** Listar proveedores con paginación y búsqueda */
  async findAll(
    empresaId: string,
    page = 1,
    limit = 20,
    search = '',
    incluirInactivos = false,
  ) {
    const where: any = { empresaId };
    if (!incluirInactivos) where.estaActivo = true;
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { rfc: { contains: search, mode: 'insensitive' } },
        { contacto: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [total, datos] = await Promise.all([
      this.prisma.proveedor.count({ where }),
      this.prisma.proveedor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nombre: 'asc' },
        include: {
          _count: { select: { lotes: true } },
        },
      }),
    ]);

    return construirRespuestaPaginada(datos, total, page, limit);
  }

  /** Obtener un proveedor por ID */
  async findOne(empresaId: string, id: string) {
    const proveedor = await this.prisma.proveedor.findFirst({
      where: { id, empresaId },
      include: {
        _count: { select: { lotes: true } },
      },
    });
    if (!proveedor) {
      throw new NotFoundException('Proveedor no encontrado');
    }
    return proveedor;
  }

  /** Actualizar un proveedor */
  async update(empresaId: string, id: string, dto: UpdateSupplierDto) {
    const proveedor = await this.prisma.proveedor.findFirst({
      where: { id, empresaId },
    });
    if (!proveedor) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    // Si cambia el nombre, verificar que no exista otro con el mismo nombre
    if (dto.nombre && dto.nombre !== proveedor.nombre) {
      const existente = await this.prisma.proveedor.findFirst({
        where: {
          empresaId,
          nombre: dto.nombre,
          estaActivo: true,
          id: { not: id },
        },
      });
      if (existente) {
        throw new BadRequestException(
          'Ya existe otro proveedor activo con ese nombre',
        );
      }
    }

    return this.prisma.proveedor.update({
      where: { id },
      data: dto,
    });
  }

  /** Desactivar (soft delete) un proveedor */
  async remove(empresaId: string, id: string) {
    const proveedor = await this.prisma.proveedor.findFirst({
      where: { id, empresaId },
    });
    if (!proveedor) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    return this.prisma.proveedor.update({
      where: { id },
      data: { estaActivo: false },
    });
  }

  /** Reactivar un proveedor */
  async reactivate(empresaId: string, id: string) {
    const proveedor = await this.prisma.proveedor.findFirst({
      where: { id, empresaId },
    });
    if (!proveedor) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    return this.prisma.proveedor.update({
      where: { id },
      data: { estaActivo: true },
    });
  }
}
