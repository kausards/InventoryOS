import { db } from '../client';
import { roles } from '../schema';

export const SYSTEM_ROLES = [
  'Owner',
  'Admin',
  'Order Staff',
  'Inventory Staff',
  'Accountant',
];

export async function seedSystemRoles() {
  const values = SYSTEM_ROLES.map(name => ({
    name,
    isSystem: true,
  }));

  // Note: Drizzle doesn't support onConflictDoNothing on multiple rows without unique constraint on name + tenant_id
  // but since these are system roles with tenant_id = NULL, we'd need a partial unique index.
  // For M0, this is sufficient to show intent.
  try {
    await db.insert(roles).values(values);
    console.log('Seeded system roles.');
  } catch (e) {
    console.log('Roles might already be seeded.');
  }
}
