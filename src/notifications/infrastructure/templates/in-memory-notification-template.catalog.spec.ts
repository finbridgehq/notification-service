import { NotificationChannel } from '../../domain/model/valueobjects/notification-channel.enum';
import { NotificationType } from '../../domain/model/valueobjects/notification-type.enum';
import { InMemoryNotificationTemplateCatalog } from './in-memory-notification-template.catalog';

const catalog = new InMemoryNotificationTemplateCatalog(
  'https://app.vankoo.test',
);

describe('InMemoryNotificationTemplateCatalog', () => {
  it.each(Object.values(NotificationType))(
    'tiene una plantilla con título y cuerpo para %s',
    (type) => {
      const content = catalog.render(type, {});
      expect(content.title.length).toBeGreaterThan(0);
      expect(content.body.length).toBeGreaterThan(0);
      expect(content.data.type).toBe(type);
    },
  );

  it('da una bienvenida distinta a la Mype, con enlace al web', () => {
    const mype = catalog.render(NotificationType.USER_WELCOME, {
      role: 'MYPE',
    });
    const investor = catalog.render(NotificationType.USER_WELCOME, {
      role: 'INVESTOR',
    });
    expect(mype.body).toContain('empresa');
    expect(mype.actionUrl).toBe('https://app.vankoo.test/');
    expect(investor.body).toContain('DNI');
    expect(investor.actionUrl).toBeUndefined();
  });

  it('formatea montos en soles y pasa a data los ids que necesita la app', () => {
    const content = catalog.render(NotificationType.DEPOSIT_SUCCEEDED, {
      amount: 1500.5,
      currency: 'PEN',
      depositId: 'dep-1',
    });
    expect(content.body).toMatch(/S\/\s?1,500\.50/);
    expect(content.data).toEqual({
      type: NotificationType.DEPOSIT_SUCCEEDED,
      depositId: 'dep-1',
    });
  });

  it('formatea fechas en español y tolera monedas y fechas inválidas', () => {
    const published = catalog.render(NotificationType.AUCTION_PUBLISHED, {
      payerName: 'Pagador S.A.',
      targetAmount: 9884,
      currency: 'XXX-INVALID',
      expiresAt: '2026-09-21T16:00:00Z',
    });
    expect(published.body).toContain('Pagador S.A.');
    expect(published.body).toContain('9884.00 XXX-INVALID');
    // es-PE escribe "setiembre"; otras versiones de ICU, "septiembre".
    expect(published.body).toMatch(/21 de sep?tiembre de 2026/);

    const green = catalog.render(NotificationType.GREEN_CERTIFICATION_GRANTED, {
      standard: 'ISO 14001',
      validUntil: '2028-03-31',
    });
    expect(green.body).toContain('31 de marzo de 2028');

    const badDate = catalog.render(NotificationType.AUCTION_PUBLISHED, {
      targetAmount: 'no',
      expiresAt: 'pronto',
    });
    expect(badDate.body).toContain('el monto indicado');
    expect(badDate.body).toContain('pronto');
  });

  it('incluye el motivo y los campos a corregir', () => {
    expect(
      catalog.render(NotificationType.INVESTOR_KYC_REJECTED, {
        reason: 'DNI vencido',
      }).body,
    ).toContain('DNI vencido');
    expect(
      catalog.render(
        NotificationType.COMPANY_VERIFICATION_CORRECTION_REQUIRED,
        { fields: 'RUC' },
      ).body,
    ).toContain('(RUC)');
    expect(
      catalog.render(NotificationType.DEPOSIT_FAILED, {
        amount: 10,
        currency: 'PEN',
        reason: 'tarjeta rechazada',
      }).body,
    ).toContain('tarjeta rechazada');
  });

  it('describe cada tipo con sus canales', () => {
    const definitions = catalog.definitions();
    expect(definitions).toHaveLength(Object.values(NotificationType).length);
    expect(
      definitions.find(
        (definition) => definition.type === NotificationType.DEPOSIT_SUCCEEDED,
      )?.channels,
    ).toEqual([NotificationChannel.PUSH]);
  });
});
