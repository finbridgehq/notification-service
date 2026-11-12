import {
  NotificationAudience,
  NotificationTypeDefinition,
} from '../../domain/model/entities/notification-type-definition.entity';
import { GetAllNotificationTypesQuery } from '../../domain/model/queries/get-all-notification-types.query';
import { NotificationChannel } from '../../domain/model/valueobjects/notification-channel.enum';
import { NotificationType } from '../../domain/model/valueobjects/notification-type.enum';
import { RecipientId } from '../../domain/model/valueobjects/recipient-id.vo';
import type { INotificationTemplateCatalog } from '../../domain/services/notification-template-catalog';
import { ExternalProfileService } from './outboundservices/acl/external-profile.service';
import type { IProfileContactClient } from './outboundservices/acl/profile-contact-client';
import { NotificationQueryServiceImpl } from './queryservices/notification-query.service.impl';

describe('NotificationQueryServiceImpl', () => {
  it('devuelve las definiciones del catálogo', () => {
    const definition = new NotificationTypeDefinition(
      NotificationType.USER_WELCOME,
      'Bienvenida',
      'd',
      NotificationAudience.ANY,
      [NotificationChannel.EMAIL],
      'vankoo.iam.events',
    );
    const catalog: jest.Mocked<INotificationTemplateCatalog> = {
      render: jest.fn(),
      definitions: jest.fn().mockReturnValue([definition]),
    };
    const service = new NotificationQueryServiceImpl(catalog);
    expect(
      service.handleGetAllNotificationTypes(new GetAllNotificationTypesQuery()),
    ).toEqual([definition]);
  });
});

describe('ExternalProfileService (ACL)', () => {
  const client: jest.Mocked<IProfileContactClient> = {
    fetchCompanyContact: jest.fn(),
  };
  const service = new ExternalProfileService(client);

  it('traduce el contactEmail de la empresa a un EmailAddress', async () => {
    client.fetchCompanyContact.mockResolvedValue({
      contactEmail: 'Mype@Vankoo.test',
      businessName: 'Textiles Andinos S.A.C.',
    });
    const email = await service.findEmail(new RecipientId('user-1'));
    expect(client.fetchCompanyContact).toHaveBeenCalledWith('user-1');
    expect(email?.value).toBe('mype@vankoo.test');
  });

  it.each([
    ['sin empresa', null],
    ['sin email', { contactEmail: null, businessName: null }],
    [
      'con un email inválido',
      { contactEmail: 'no-es-email', businessName: null },
    ],
  ])('devuelve null %s', async (_case, contact) => {
    client.fetchCompanyContact.mockResolvedValue(contact);
    await expect(service.findEmail(new RecipientId('u'))).resolves.toBeNull();
  });
});
