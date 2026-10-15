import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@growthomic/shared';
import { createProductSchema, updateProductSchema, updateVariantSchema } from '@growthomic/shared';

@Controller('products')
@UseGuards(AuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PRODUCTS_VIEW)
  async listProducts(@Req() req: any, @Query() query: any) {
    return this.productsService.listProducts(req.tenantId, {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 20,
      search: query.search,
      categoryId: query.categoryId,
      brandId: query.brandId,
      status: query.status,
    });
  }

  @Get('categories')
  @RequirePermissions(PERMISSIONS.PRODUCTS_VIEW)
  async listCategories(@Req() req: any) {
    return this.productsService.listCategories(req.tenantId);
  }

  @Post('categories')
  @RequirePermissions(PERMISSIONS.PRODUCTS_CREATE)
  async createCategory(@Req() req: any, @Body('name') name: string) {
    return this.productsService.createCategory(req.tenantId, name);
  }

  @Get('brands')
  @RequirePermissions(PERMISSIONS.PRODUCTS_VIEW)
  async listBrands(@Req() req: any) {
    return this.productsService.listBrands(req.tenantId);
  }

  @Post('brands')
  @RequirePermissions(PERMISSIONS.PRODUCTS_CREATE)
  async createBrand(@Req() req: any, @Body('name') name: string) {
    return this.productsService.createBrand(req.tenantId, name);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_VIEW)
  async getProduct(@Req() req: any, @Param('id') id: string) {
    return this.productsService.getProductById(req.tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PRODUCTS_CREATE)
  async createProduct(@Req() req: any, @Body() body: any) {
    const validated = createProductSchema.parse(body);
    const requestId = req.headers['x-request-id'];
    return this.productsService.createProduct(req.tenantId, req.user.id, validated, requestId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_EDIT)
  async updateProduct(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const validated = updateProductSchema.parse(body);
    const requestId = req.headers['x-request-id'];
    return this.productsService.updateProduct(req.tenantId, req.user.id, id, validated, requestId);
  }

  @Patch('variants/:variantId')
  @RequirePermissions(PERMISSIONS.PRODUCTS_EDIT)
  async updateVariant(@Req() req: any, @Param('variantId') variantId: string, @Body() body: any) {
    const validated = updateVariantSchema.parse(body);
    const requestId = req.headers['x-request-id'];
    return this.productsService.updateVariant(req.tenantId, req.user.id, variantId, validated, requestId);
  }
}
