import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.port === 465,
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  if (!env.smtp.host) {
    console.log('[Email] SMTP не настроен, письмо пропущено:', options.subject);
    return;
  }

  await transporter.sendMail({
    from: env.smtp.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}

// --- Шаблоны писем ---

export function welcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Добро пожаловать в PSL Marketplace!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Добро пожаловать, ${name}!</h2>
        <p>Спасибо за регистрацию в PSL Marketplace (Galenite).</p>
        <p>Теперь вы можете добавлять товары в избранное, оформлять заказы и отслеживать их статус.</p>
        <br>
        <p>С уважением,<br>Команда PSL Marketplace</p>
      </div>
    `,
  };
}

export function resetPasswordEmail(name: string, resetLink: string): { subject: string; html: string } {
  return {
    subject: 'Сброс пароля - PSL Marketplace',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Сброс пароля</h2>
        <p>Здравствуйте, ${name}!</p>
        <p>Вы запросили сброс пароля. Нажмите на кнопку ниже:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: #000; color: #fff; padding: 12px 32px; text-decoration: none; border-radius: 16px; font-size: 16px;">
            Сбросить пароль
          </a>
        </p>
        <p>Ссылка действительна 1 час.</p>
        <p>Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>
        <br>
        <p>С уважением,<br>Команда PSL Marketplace</p>
      </div>
    `,
  };
}

export function orderStatusEmail(
  name: string,
  orderNumber: string,
  status: string,
): { subject: string; html: string } {
  const statusLabels: Record<string, string> = {
    NEW: 'Новый',
    PROCESSING: 'В обработке',
    SHIPPED: 'Отправлен',
    DELIVERED: 'Доставлен',
    CANCELLED: 'Отменен',
  };

  const label = statusLabels[status] || status;

  return {
    subject: `Заказ ${orderNumber} - ${label}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Статус заказа обновлен</h2>
        <p>Здравствуйте, ${name}!</p>
        <p>Статус вашего заказа <strong>${orderNumber}</strong> изменен на: <strong>${label}</strong></p>
        <br>
        <p>С уважением,<br>Команда PSL Marketplace</p>
      </div>
    `,
  };
}
