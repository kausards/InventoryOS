import { PERMISSIONS } from '@growthomic/shared';
import { db } from '../client';
import { permissions } from '../schema';

export async function seedPermissions() {
  const values = Object.values(PERMISSIONS).map(key => ({
    key,
    description: `Permission for ${key}`,
  }));

  await db.insert(permissions).values(values).onConflictDoNothing();
  console.log('Seeded permissions.');
}
