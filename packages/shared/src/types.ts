export type Marketplace = 'UZUM' | 'OZON' | 'WB' | 'YANDEX';
export type Role = 'SELLER' | 'ADMIN';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type ListingStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'PAUSED' | 'ERROR';
export type ImageVariant = 'ORIGINAL' | 'UZUM' | 'OZON' | 'WB' | 'YANDEX';
export type AiJobType = 'BACKGROUND_REMOVE' | 'UPSCALE' | 'OUTPAINT' | 'GENERATE';
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: Role;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
