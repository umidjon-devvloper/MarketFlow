import { z } from 'zod';

export const createProductSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  category: z.string().min(1),
  brand: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  basePrice: z.number().positive(),
  currency: z.enum(['UZS', 'RUB', 'USD']).default('UZS'),
  stock: z.number().int().min(0).default(0),
  attributes: z.record(z.string(), z.any()).default({}),
});

export const updateProductSchema = createProductSchema.partial();

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  category: z.string().optional(),
});

export const addImageSchema = z.object({
  url: z.string().url(),
  fileKey: z.string().optional(),
  isPrimary: z.boolean().default(false),
  order: z.number().int().min(0).default(0),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListQueryInput = z.infer<typeof listQuerySchema>;
export type AddImageInput = z.infer<typeof addImageSchema>;
