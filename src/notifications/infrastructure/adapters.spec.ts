import type { Messaging } from 'firebase-admin/messaging';
import type { Transporter } from 'nodemailer';
import { ExternalServiceError } from '../../shared/application/errors/external-service.error';
import { PushTopicNaming } from '../../shared/infrastructure/firebase/push-topic-naming';
import { silentLogger } from '../../test-support/silent-logger';
import { EmailAddress } from '../domain/model/valueobjects/email-address.vo';
import { NotificationContent } from '../domain/model/valueobjects/notification-content.vo';
import { RecipientId } from '../domain/model/valueobjects/recipient-id.vo';
import { HttpProfileContactClient } from './acl/http-profile-contact.client';
import {
  escapeHtml,
  renderEmailHtml,
  renderEmailText,
} from './email/email-layout';
import { LoggingEmailSender } from './email/logging-email.sender';
import { SmtpEmailSender } from './email/smtp-email.sender';
import { InMemoryProcessedEventRegistry } from './idempotency/in-memory-processed-event.registry';
import { FirebasePushNotificationSender } from './push/firebase-push-notification.sender';
import { LoggingPushNotificationSender } from './push/logging-push-notification.sender';

const content = new NotificationContent(
  'Recarga acreditada',
  'Se acreditaron S/ 10.00.\nGracias.',
  'https://app.vankoo.test/',
  { type: 'DEPOSIT_SUCCEEDED', depositId: 'dep-1' },
);
const recipient = new RecipientId('user-1');

describe('FirebasePushNotificationSender', () => {
  const topicNaming = new PushTopicNaming('a-secret-of-16-chars');

  it('envía al topic del usuario con título, cuerpo y data', async () => {
    const messaging = { send: jest.fn().mockResolvedValue('msg-1') };
    const sender = new FirebasePushNotificationSender(
      messaging as unknown as Messaging,
      topicNaming,
    );

    await sender.send(recipient, content);

    expect(messaging.send).toHaveBeenCalledWith({
      topic: topicNaming.topicFor('user-1'),
      notification: { title: 'Recarga acreditada', body: content.body },
      data: {
        type: 'DEPOSIT_SUCCEEDED',
        depositId: 'dep-1',
        actionUrl: 'https://app.vankoo.test/',
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
  });

  it('traduce un fallo de FCM a ExternalServiceError', async () => {
    const messaging = { send: jest.fn().mockRejectedValue(new Error('503')) };
    const sender = new FirebasePushNotificationSender(
      messaging as unknown as Messaging,
      topicNaming,
    );
    await expect(
      sender.send(recipient, new NotificationContent('t', 'b')),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });
});

describe('SmtpEmailSender', () => {
  it('manda el email con asunto, texto y HTML', async () => {
    const transporter = { sendMail: jest.fn().mockResolvedValue({}) };
    const sender = new SmtpEmailSender(
      transporter as unknown as Transporter,
      'Vankoo <no-reply@vankoo.test>',
    );

    await sender.send(new EmailAddress('ana@vankoo.test'), content);

    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Vankoo <no-reply@vankoo.test>',
        to: 'ana@vankoo.test',
        subject: 'Recarga acreditada',
        text: expect.stringContaining('https://app.vankoo.test/'),
        html: expect.stringContaining('<h1'),
      }),
    );
  });

  it('traduce un fallo de SMTP a ExternalServiceError', async () => {
    const transporter = {
      sendMail: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    };
    const sender = new SmtpEmailSender(
      transporter as unknown as Transporter,
      'x',
    );
    await expect(
      sender.send(new EmailAddress('a@b.co'), content),
    ).rejects.toThrow('SMTP: ECONNREFUSED');
  });
});

describe('email-layout', () => {
  it('escapa el HTML de los datos que vienen de otros servicios', () => {
    expect(escapeHtml(`<b>"A&B's"</b>`)).toBe(
      '&lt;b&gt;&quot;A&amp;B&#39;s&quot;&lt;/b&gt;',
    );
    const html = renderEmailHtml(
      new NotificationContent('<script>', 'Hola <img>'),
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('Hola &lt;img&gt;');
    expect(html).not.toContain('Ir a Vankoo');
  });

  it('pone el botón y un párrafo por línea', () => {
    const html = renderEmailHtml(content);
    expect(html).toContain('href="https://app.vankoo.test/"');
    expect(html.match(/<p style="margin:0 0 12px/g)).toHaveLength(2);
    expect(renderEmailText(new NotificationContent('t', 'b'))).toBe(
      'b\n\n— El equipo de Vankoo',
    );
  });
});

describe('Logging adapters', () => {
  it('escriben en el log en vez de enviar', async () => {
    const logger = silentLogger();
    await new LoggingPushNotificationSender(logger).send(recipient, content);
    await new LoggingEmailSender(logger).send(
      new EmailAddress('a@b.co'),
      content,
    );
    expect(logger.info).toHaveBeenCalledTimes(2);
  });
});

describe('InMemoryProcessedEventRegistry', () => {
  it('recuerda las claves y, al llenarse, descarta la más antigua', () => {
    const registry = new InMemoryProcessedEventRegistry(2, 60_000);
    registry.markProcessed('a');
    registry.markProcessed('b');
    expect(registry.has('a')).toBe(true);
    registry.markProcessed('c');
    expect(registry.has('a')).toBe(false);
    expect(registry.has('b')).toBe(true);
    expect(registry.has('c')).toBe(true);
  });
});

describe('HttpProfileContactClient', () => {
  const okResponse = (body: unknown, status = 200) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }) as Response;

  it('pide /companies/me con X-User-Id y lee contactEmail', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        okResponse({ contactEmail: 'mype@vankoo.test', businessName: 'ACME' }),
      );
    const client = new HttpProfileContactClient(
      () => 'http://profile-service:3000',
      1000,
      fetchFn,
    );

    await expect(client.fetchCompanyContact('user-1')).resolves.toEqual({
      contactEmail: 'mype@vankoo.test',
      businessName: 'ACME',
    });
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://profile-service:3000/api/v1/companies/me');
    expect(init.headers).toMatchObject({ 'X-User-Id': 'user-1' });
  });

  it('devuelve null si el usuario no tiene empresa (404)', async () => {
    const client = new HttpProfileContactClient(
      () => 'http://p',
      1000,
      jest.fn().mockResolvedValue(okResponse({}, 404)),
    );
    await expect(client.fetchCompanyContact('u')).resolves.toBeNull();
  });

  it('ignora campos con otro tipo', async () => {
    const client = new HttpProfileContactClient(
      () => 'http://p',
      1000,
      jest.fn().mockResolvedValue(okResponse({ contactEmail: 3 })),
    );
    await expect(client.fetchCompanyContact('u')).resolves.toEqual({
      contactEmail: null,
      businessName: null,
    });
  });

  it.each([
    ['no hay instancia en Eureka', () => null, jest.fn()],
    [
      'responde 500',
      () => 'http://p',
      jest.fn().mockResolvedValue(okResponse({}, 500)),
    ],
    [
      'la red falla',
      () => 'http://p',
      jest.fn().mockRejectedValue(new Error('timeout')),
    ],
  ])('lanza ExternalServiceError si %s', async (_case, resolveUrl, fetchFn) => {
    const client = new HttpProfileContactClient(resolveUrl, 1000, fetchFn);
    await expect(client.fetchCompanyContact('u')).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });
});
