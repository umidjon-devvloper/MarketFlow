import { z } from 'zod';

// ============================================
// AUTH
// ============================================

export const RegisterSchema = z.object({
  email: z.string().email('Email noto\'g\'ri'),
  password: z.string().min(8, 'Parol kamida 8 belgi'),
  fullName: z.string().min(2, 'Ism kiritilishi shart'),
  phone: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

// ============================================
// PRODUCT
// ============================================

export const ProductCreateSchema = z.object({
  title: z.string().min(3).max(300),
  description: z.string().min(10),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  brand: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  basePrice: z.number().positive(),
  costPrice: z.number().positive().optional(),
  currency: z.string().default('UZS'),
  stock: z.number().int().min(0).default(0),
  weight: z.number().positive().optional(),
  dimensions: z.object({
    length: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
  attributes: z.record(z.string(), z.any()).default({}),
  tags: z.array(z.string()).default([]),
});

export const ProductUpdateSchema = ProductCreateSchema.partial();

export type ProductCreateInput = z.infer<typeof ProductCreateSchema>;
export type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>;

// ============================================
// LISTING
// ============================================

export const ListingGenerateSchema = z.object({
  productId: z.string(),
  marketplaces: z.array(z.enum(['UZUM', 'OZON', 'WB', 'YANDEX'])),
  autoTranslate: z.boolean().default(true),
  autoOptimizeImages: z.boolean().default(true),
});

export const ListingUpdateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  discountPrice: z.number().positive().optional(),
  keywords: z.array(z.string()).optional(),
});

export type ListingGenerateInput = z.infer<typeof ListingGenerateSchema>;
export type ListingUpdateInput = z.infer<typeof ListingUpdateSchema>;

// ============================================
// AI JOB
// ============================================

export const AiJobCreateSchema = z.object({
  type: z.enum(['BACKGROUND_REMOVE', 'UPSCALE', 'OUTPAINT', 'ENHANCE', 'GENERATE_WHITE_BG']),
  imageUrl: z.string().url(),
  productId: z.string().optional(),
  params: z.record(z.string(), z.any()).optional(),
});

export type AiJobCreateInput = z.infer<typeof AiJobCreateSchema>;

// ============================================
// USER MARKETPLACE (API kalit qo'shish)
// ============================================

export const UserMarketplaceCreateSchema = z.object({
  marketplace: z.enum(['UZUM', 'OZON', 'WB', 'YANDEX']),
  apiKey: z.string().min(1),
  apiSecret: z.string().optional(),
  shopId: z.string().optional(),
  shopName: z.string().optional(),
});

export type UserMarketplaceCreateInput = z.infer<typeof UserMarketplaceCreateSchema>;

// ============================================
// API RESPONSE
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
}
