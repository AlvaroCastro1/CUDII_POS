import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createProduct(createProductDto: CreateProductDto) {
    return this.prisma.producto.create({
      data: createProductDto,
    });
  }

  async findAllProducts(empresaId: string) {
    return this.prisma.producto.findMany({
      where: {
        empresaId,
        estaActivo: true,
      },
      include: {
        preciosPorUnidad: true,
        inventario: true,
      },
    });
  }

  async findOneProduct(id: string, empresaId: string) {
    const product = await this.prisma.producto.findFirst({
      where: {
        id,
        empresaId,
        estaActivo: true,
      },
    });
    
    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }
    
    return product;
  }

  async updateProduct(id: string, updateProductDto: UpdateProductDto, empresaId: string) {
    // Validar existencia
    await this.findOneProduct(id, empresaId);

    return this.prisma.producto.update({
      where: { id },
      data: updateProductDto,
    });
  }

  // Borrado Lógico (Soft Delete)
  async removeProduct(id: string, empresaId: string) {
    await this.findOneProduct(id, empresaId);

    return this.prisma.producto.update({
      where: { id },
      data: { estaActivo: false },
    });
  }
}
