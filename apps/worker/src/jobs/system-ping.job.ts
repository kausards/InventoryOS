import { Job } from 'pg-boss';

export async function handleSystemPing(job: Job<any>) {
  const { id, data } = job;
  console.log(`[system.ping] Job ${id} received:`, data);
  
  // Example data payload might contain a timestamp
  return { success: true, processedAt: new Date().toISOString() };
}
