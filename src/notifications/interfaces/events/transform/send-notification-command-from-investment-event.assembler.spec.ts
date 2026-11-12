import { NotificationChannel } from '../../../domain/model/valueobjects/notification-channel.enum';
import { NotificationType } from '../../../domain/model/valueobjects/notification-type.enum';
import { SendNotificationCommandFromInvestmentEventAssembler } from './send-notification-command-from-investment-event.assembler';

describe('SendNotificationCommandFromInvestmentEventAssembler', () => {
  it('turns AuctionPublished into an email with the auction data', () => {
    const command =
      SendNotificationCommandFromInvestmentEventAssembler.toCommandFromAuctionPublished(
        'event-1',
        {
          invoiceId: 'invoice-1',
          mypeId: 'mype-1',
          payerName: 'Alicorp SAA',
          targetAmount: 15000,
          currency: 'PEN',
          expiresAt: '2026-12-01T00:00:00Z',
        },
      );

    expect(command.sourceEventKey).toBe('event-1');
    expect(command.type).toBe(NotificationType.AUCTION_PUBLISHED);
    expect(command.recipientId).toBe('mype-1');
    expect(command.channels).toEqual([NotificationChannel.EMAIL]);
    expect(command.variables).toEqual({
      invoiceId: 'invoice-1',
      payerName: 'Alicorp SAA',
      targetAmount: 15000,
      currency: 'PEN',
      expiresAt: '2026-12-01T00:00:00Z',
    });
  });

  it('turns AuctionRejected into an email to the MYPE with the reason', () => {
    const command =
      SendNotificationCommandFromInvestmentEventAssembler.toCommandFromAuctionRejected(
        'event-2',
        {
          invoiceId: 'invoice-2',
          mypeId: 'mype-2',
          reasonCode: 'PAYER_NOT_IN_REGISTRY',
          reason: 'El pagador no figura en el padrón',
        },
      );

    expect(command.sourceEventKey).toBe('event-2');
    expect(command.type).toBe(NotificationType.INVOICE_REJECTED);
    expect(command.recipientId).toBe('mype-2');
    expect(command.channels).toEqual([NotificationChannel.EMAIL]);
    expect(command.variables).toEqual({
      invoiceId: 'invoice-2',
      reason: 'El pagador no figura en el padrón',
    });
  });
});
