import { z } from 'zod';

export const signupSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(2).max(100),
  organizationName: z.string().min(2).max(100),
  timezone: z.string().default('Asia/Dhaka'),
  currency: z.string().default('BDT'),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const switchTenantSchema = z.object({
  tenantId: z.string().uuid(),
});

export type SwitchTenantInput = z.infer<typeof switchTenantSchema>;

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
});

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

export const createRoleSchema = z.object({
  name: z.string().min(2).max(50),
  permissionKeys: z.array(z.string()).min(1),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  permissionKeys: z.array(z.string()).min(1),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(100),
  roleId: z.string().uuid(),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({
  roleId: z.string().uuid(),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export * from './products.js';
export * from './inventory.js';
export * from './customers.js';
export * from './orders.js';
export * from './risk.js';
export * from './documents.js';
export * from './courier.js';
export * from './integrations.js';
export * from './returns.js';
export * from './notifications.js';
export * from './finance.js';
export * from './subscriptions.js';
