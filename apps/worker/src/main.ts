import { startWorker } from './worker';

async function bootstrap() {
  console.log('Starting Growthomic Worker...');
  
  try {
    const boss = await startWorker();
    
    process.on('SIGINT', async () => {
      console.log('Stopping worker gracefully...');
      await boss.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('Stopping worker gracefully...');
      await boss.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start worker:', error);
    process.exit(1);
  }
}

bootstrap();
