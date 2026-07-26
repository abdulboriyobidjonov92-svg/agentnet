import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { AdminGuard } from './admin.guard';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(ClerkGuard, AdminGuard)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.products.list({ categoryId, search, limit: limit ? Number(limit) : undefined });
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }
}
