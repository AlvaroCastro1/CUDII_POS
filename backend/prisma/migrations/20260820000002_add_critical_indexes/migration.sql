-- CreateIndex
CREATE INDEX "Caja_sucursalId_idx" ON "Caja"("sucursalId");

-- CreateIndex
CREATE INDEX "Categoria_empresaId_idx" ON "Categoria"("empresaId");

-- CreateIndex
CREATE INDEX "CorteX_sesionCajaId_idx" ON "CorteX"("sesionCajaId");

-- CreateIndex
CREATE INDEX "CorteX_usuarioId_idx" ON "CorteX"("usuarioId");

-- CreateIndex
CREATE INDEX "CorteZ_usuarioId_idx" ON "CorteZ"("usuarioId");

-- CreateIndex
CREATE INDEX "CorteZ_autorizadoPorId_idx" ON "CorteZ"("autorizadoPorId");

-- CreateIndex
CREATE INDEX "DetalleVenta_ventaId_idx" ON "DetalleVenta"("ventaId");

-- CreateIndex
CREATE INDEX "DetalleVenta_productoId_idx" ON "DetalleVenta"("productoId");

-- CreateIndex
CREATE INDEX "DetalleVentaLote_detalleVentaId_idx" ON "DetalleVentaLote"("detalleVentaId");

-- CreateIndex
CREATE INDEX "Devolucion_ventaId_idx" ON "Devolucion"("ventaId");

-- CreateIndex
CREATE INDEX "Devolucion_fechaHora_idx" ON "Devolucion"("fechaHora");

-- CreateIndex
CREATE INDEX "Devolucion_usuarioId_idx" ON "Devolucion"("usuarioId");

-- CreateIndex
CREATE INDEX "DevolucionProducto_devolucionId_idx" ON "DevolucionProducto"("devolucionId");

-- CreateIndex
CREATE INDEX "DevolucionProducto_loteId_idx" ON "DevolucionProducto"("loteId");

-- CreateIndex
CREATE INDEX "Lote_productoId_idx" ON "Lote"("productoId");

-- CreateIndex
CREATE INDEX "Merma_loteId_idx" ON "Merma"("loteId");

-- CreateIndex
CREATE INDEX "Merma_usuarioId_idx" ON "Merma"("usuarioId");

-- CreateIndex
CREATE INDEX "Merma_fechaHora_idx" ON "Merma"("fechaHora");

-- CreateIndex
CREATE INDEX "MovimientoInventario_productoId_idx" ON "MovimientoInventario"("productoId");

-- CreateIndex
CREATE INDEX "MovimientoInventario_loteId_idx" ON "MovimientoInventario"("loteId");

-- CreateIndex
CREATE INDEX "MovimientoInventario_sucursalId_idx" ON "MovimientoInventario"("sucursalId");

-- CreateIndex
CREATE INDEX "MovimientoInventario_usuarioId_idx" ON "MovimientoInventario"("usuarioId");

-- CreateIndex
CREATE INDEX "MovimientoInventario_fechaHora_idx" ON "MovimientoInventario"("fechaHora");

-- CreateIndex
CREATE INDEX "PagoVenta_ventaId_idx" ON "PagoVenta"("ventaId");

-- CreateIndex
CREATE INDEX "PrecioPorUnidad_productoId_idx" ON "PrecioPorUnidad"("productoId");

-- CreateIndex
CREATE INDEX "Producto_empresaId_estaActivo_idx" ON "Producto"("empresaId", "estaActivo");

-- CreateIndex
CREATE INDEX "Producto_empresaId_codigoBarras_idx" ON "Producto"("empresaId", "codigoBarras");

-- CreateIndex
CREATE INDEX "RecepcionDetalle_recepcionId_idx" ON "RecepcionDetalle"("recepcionId");

-- CreateIndex
CREATE INDEX "RecepcionDetalle_productoId_idx" ON "RecepcionDetalle"("productoId");

-- CreateIndex
CREATE INDEX "RecepcionMercancia_usuarioId_idx" ON "RecepcionMercancia"("usuarioId");

-- CreateIndex
CREATE INDEX "RetiroParcial_sesionCajaId_idx" ON "RetiroParcial"("sesionCajaId");

-- CreateIndex
CREATE INDEX "RetiroParcial_usuarioId_idx" ON "RetiroParcial"("usuarioId");

-- CreateIndex
CREATE INDEX "SesionCaja_cajaId_estado_idx" ON "SesionCaja"("cajaId", "estado");

-- CreateIndex
CREATE INDEX "SesionCaja_cajeroId_idx" ON "SesionCaja"("cajeroId");

-- CreateIndex
CREATE INDEX "Sucursal_empresaId_idx" ON "Sucursal"("empresaId");

-- CreateIndex
CREATE INDEX "Usuario_empresaId_idx" ON "Usuario"("empresaId");

-- CreateIndex
CREATE INDEX "Venta_empresaId_creadoEn_idx" ON "Venta"("empresaId", "creadoEn");

-- CreateIndex
CREATE INDEX "Venta_sucursalId_creadoEn_idx" ON "Venta"("sucursalId", "creadoEn");

-- CreateIndex
CREATE INDEX "Venta_sesionCajaId_idx" ON "Venta"("sesionCajaId");

-- CreateIndex
CREATE INDEX "Venta_cajeroId_idx" ON "Venta"("cajeroId");

-- CreateIndex
CREATE INDEX "Venta_cajaId_idx" ON "Venta"("cajaId");

-- CreateIndex
CREATE UNIQUE INDEX "Venta_empresaId_folio_key" ON "Venta"("empresaId", "folio");

