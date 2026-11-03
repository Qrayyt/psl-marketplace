import { Queue, Worker } from 'bullmq';
import { redis } from '../config/redis';
import { sendEmail, welcomeEmail, resetPasswordEmail, orderStatusEmail } from '../services/email.service';

const connection = { connection: redis };

// Очередь отправки email
export const emailQueue = new Queue('email', connection);

interface EmailJobData {
  type: 'welcome' | 'reset-password' | 'order-status';
  to: string;
  name: string;
  // Для reset-password
  resetLink?: string;
  // Для order-status
  orderNumber?: string;
  status?: string;
}

// Добавить email в очередь
export async function enqueueEmail(data: EmailJobData): Promise<void> {
  await emailQueue.add('send', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  });
}

// Worker обработки email
export function startEmailWorker(): void {
  const worker = new Worker('email', async (job) => {
    const data = job.data as EmailJobData;
    let template: { subject: string; html: string };

    switch (data.type) {
      case 'welcome':
        template = welcomeEmail(data.name);
        break;
      case 'reset-password':
        template = resetPasswordEmail(data.name, data.resetLink || '');
        break;
      case 'order-status':
        template = orderStatusEmail(data.name, data.orderNumber || '', data.status || '');
        break;
      default:
        throw new Error(`Неизвестный тип email: ${data.type}`);
    }

    await sendEmail({ to: data.to, ...template });
    console.log(`[EmailWorker] Отправлено: ${data.type} -> ${data.to}`);
  }, connection);

  worker.on('failed', (job, err) => {
    console.error(`[EmailWorker] Ошибка job ${job?.id}:`, err.message);
  });

  console.log('[EmailWorker] Запущен');
}
