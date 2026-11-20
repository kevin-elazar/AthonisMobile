import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const authResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  user: z.object({
    id: z.number(),
    email: z.string(),
    name: z.string(),
    role: z.string(),
    id_company: z.number(),
    driver_id: z.number().nullable().optional(),
  }),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    name: string;
    driverId: number;
    idCompany: number;
  };
}

export const driverProfileSchema = z.object({
  user: z.object({ id: z.number(), email: z.string(), name: z.string() }),
  driver: z.object({
    driver_id: z.number(),
    name: z.string(),
    phone: z.string().nullable(),
    status: z.string(),
  }),
  company: z.object({
    id_company: z.number(),
    name: z.string().nullable(),
    timezone: z.string(),
  }),
});
export type DriverProfile = z.infer<typeof driverProfileSchema>;
