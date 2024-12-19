import { PostgrestResponse, PostgrestSingleResponse, PostgrestFilterBuilder } from '@supabase/supabase-js';

export type SupabaseQueryResult<T> = PostgrestResponse<T> | PostgrestSingleResponse<T>;

export type SupabaseFilterBuilder<T> = PostgrestFilterBuilder<T, T, any>;

export type DatabaseOperations = {
  create: <T>(table: string, data: Record<string, unknown>) => Promise<SupabaseQueryResult<T>>;
  read: <T>(table: string, query?: Record<string, unknown>) => Promise<SupabaseQueryResult<T>>;
  update: <T>(table: string, data: Record<string, unknown>, query?: Record<string, unknown>) => Promise<SupabaseQueryResult<T>>;
  delete: <T>(table: string, query?: Record<string, unknown>) => Promise<SupabaseQueryResult<T>>;
};

export type StorageOperations = {
  upload: (bucket: string, path: string, file: File | Blob, options?: { cacheControl?: string; contentType?: string; upsert?: boolean }) => Promise<{ data: { Key: string } | null; error: Error | null }>;
  download: (bucket: string, path: string) => Promise<{ data: Blob | null; error: Error | null }>;
};

export type FunctionOperations = {
  invoke: <T = any>(name: string, params?: Record<string, unknown>, options?: { headers?: Record<string, string>; responseType?: 'json' | 'text' | 'arraybuffer' }) => Promise<{ data: T | null; error: Error | null }>;
};

export type AdminAuthOperations = {
  listUsers: (options?: { page?: number; perPage?: number }) => Promise<{ data: any; error: Error | null }>;
  getUserById: (userId: string) => Promise<{ data: any; error: Error | null }>;
  createUser: (userData: {
    email: string;
    password: string;
    user_metadata?: Record<string, unknown>;
    email_confirm?: boolean;
  }) => Promise<{ data: any; error: Error | null }>;
  updateUserById: (userId: string, updates: {
    email?: string;
    password?: string;
    user_metadata?: Record<string, unknown>;
  }) => Promise<{ data: any; error: Error | null }>;
  deleteUser: (userId: string) => Promise<{ error: Error | null }>;
  assignUserRole: (userId: string, role: string) => Promise<{ error: Error | null }>;
  removeUserRole: (userId: string, role: string) => Promise<{ error: Error | null }>;
};
