import type { TemplateVariables } from '../../domain/model/commands/send-notification.command';
import {
  NotificationAudience,
  NotificationTypeDefinition,
} from '../../domain/model/entities/notification-type-definition.entity';
import { NotificationChannelPolicy } from '../../domain/model/valueobjects/notification-channel-policy';
import { NotificationContent } from '../../domain/model/valueobjects/notification-content.vo';
import { NotificationType } from '../../domain/model/valueobjects/notification-type.enum';
import type { INotificationTemplateCatalog } from '../../domain/services/notification-template-catalog';

interface RenderedText {
  title: string;
  body: string;
  /** Ruta del web de la Mype a la que lleva el botón del email. */
  webPath?: string;
}

interface NotificationTemplate {
  name: string;
  description: string;
  audience: NotificationAudience;
  sourceEvent: string;
  /** Variables que viajan en `data` del push, para que la app abra la pantalla correcta. */
  dataKeys?: string[];
  render(variables: TemplateVariables, format: Formatters): RenderedText;
}

interface Formatters {
  text(value: unknown, fallback?: string): string;
  money(amount: unknown, currency: unknown): string;
  date(value: unknown): string;
}

/** Textos de cada notificación, en español. */
const TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  [NotificationType.USER_WELCOME]: {
    name: 'Bienvenida',
    description: 'Se creó la cuenta del usuario en IAM',
    audience: NotificationAudience.ANY,
    sourceEvent: 'vankoo.iam.events · UserCreated',
    render: (v) =>
      v.role === 'MYPE'
        ? {
            title: '¡Bienvenido a Vankoo!',
            body: 'Tu cuenta de empresa está lista.\nCompleta el perfil de tu empresa y verifica tu RUC para empezar a financiar tus facturas.',
            webPath: '/',
          }
        : {
            title: '¡Bienvenido a Vankoo!',
            body: 'Tu cuenta de inversionista está lista.\nCompleta tu perfil y verifica tu DNI desde la app para empezar a invertir en facturas.',
          },
  },
  [NotificationType.INVESTOR_KYC_VERIFIED]: {
    name: 'Identidad verificada',
    description: 'Profile verificó el DNI del inversionista',
    audience: NotificationAudience.INVESTOR,
    sourceEvent: 'vankoo.profile.events · KycVerified',
    render: () => ({
      title: 'Tu identidad fue verificada',
      body: 'Ya puedes invertir en las facturas del marketplace de Vankoo.',
    }),
  },
  [NotificationType.INVESTOR_KYC_REJECTED]: {
    name: 'Identidad rechazada',
    description: 'Profile rechazó la verificación del DNI del inversionista',
    audience: NotificationAudience.INVESTOR,
    sourceEvent: 'vankoo.profile.events · KycRejected',
    render: (v, f) => ({
      title: 'No pudimos verificar tu identidad',
      body: `Motivo: ${f.text(v.reason, 'los datos no coinciden')}.\nRevisa tus datos y vuelve a subir tu DNI desde la app.`,
    }),
  },
  [NotificationType.COMPANY_KYC_VERIFIED]: {
    name: 'Empresa verificada',
    description: 'La empresa pasó el KYC y ya puede subir facturas',
    audience: NotificationAudience.MYPE,
    sourceEvent: 'vankoo.profile.events · CompanyKycStatusChanged (VERIFIED)',
    render: () => ({
      title: 'Tu empresa fue verificada',
      body: 'Ya puedes subir tus facturas para financiarlas en Vankoo.',
      webPath: '/',
    }),
  },
  [NotificationType.COMPANY_KYC_REJECTED]: {
    name: 'Empresa rechazada',
    description: 'La empresa no pasó el KYC',
    audience: NotificationAudience.MYPE,
    sourceEvent: 'vankoo.profile.events · CompanyKycStatusChanged (REJECTED)',
    render: () => ({
      title: 'No pudimos verificar tu empresa',
      body: 'Revisa el detalle de la verificación en el perfil de tu empresa.',
      webPath: '/',
    }),
  },
  [NotificationType.COMPANY_VERIFICATION_CORRECTION_REQUIRED]: {
    name: 'Corrección de datos',
    description:
      'Risk pidió corregir datos de la empresa que no coinciden con SUNAT',
    audience: NotificationAudience.MYPE,
    sourceEvent:
      'risk.company-verifications.v1 · CompanyVerificationIssued (CORRECTION_REQUIRED)',
    render: (v, f) => {
      const fields = f.text(v.fields, '');
      return {
        title: 'Necesitamos que corrijas los datos de tu empresa',
        body: `Algunos datos no coinciden con SUNAT${fields ? ` (${fields})` : ''}.\nCorrígelos en el perfil de tu empresa y vuelve a enviarlo.`,
        webPath: '/',
      };
    },
  },
  [NotificationType.GREEN_CERTIFICATION_GRANTED]: {
    name: 'Certificado verde aprobado',
    description: 'Risk aprobó el certificado de sostenibilidad de la empresa',
    audience: NotificationAudience.MYPE,
    sourceEvent:
      'risk.green-certifications.v1 · GreenCertificationIssued (GREEN)',
    render: (v, f) => ({
      title: 'Tu certificado verde fue aprobado',
      body: `Tu certificado ${f.text(v.standard, 'de sostenibilidad')}${v.validUntil ? ` es válido hasta el ${f.date(v.validUntil)}` : ' fue aprobado'}.\nTus facturas se mostrarán como financiamiento verde.`,
      webPath: '/',
    }),
  },
  [NotificationType.GREEN_CERTIFICATION_DENIED]: {
    name: 'Certificado verde rechazado',
    description:
      'Risk no aprobó el certificado de sostenibilidad de la empresa',
    audience: NotificationAudience.MYPE,
    sourceEvent:
      'risk.green-certifications.v1 · GreenCertificationIssued (NOT_GREEN)',
    render: () => ({
      title: 'Tu certificado verde no fue aprobado',
      body: 'No pudimos validar el certificado que subiste.\nRevisa el detalle en el perfil de tu empresa.',
      webPath: '/',
    }),
  },
  [NotificationType.INVOICE_RECEIVED]: {
    name: 'Factura recibida',
    description:
      'Invoicing validó la factura y la envió a evaluación de riesgo',
    audience: NotificationAudience.MYPE,
    sourceEvent:
      'invoicing.invoice-eligible-for-funding · InvoiceEligibleForFunding',
    render: (v, f) => ({
      title: 'Recibimos tu factura',
      body: `Tu factura a ${f.text(v.payerName, 'tu cliente')} por ${f.money(v.amount, v.currency)} pasó a la evaluación de riesgo.\nTe avisaremos cuando esté lista para subasta.`,
      webPath: '/',
    }),
  },
  [NotificationType.INVOICE_REJECTED]: {
    name: 'Factura rechazada',
    description: 'La evaluación de riesgo rechazó la factura',
    audience: NotificationAudience.MYPE,
    sourceEvent: 'investment.auction-lifecycle.v1 · AuctionRejected',
    render: (v, f) => ({
      title: 'Tu factura no fue aprobada',
      body: `Tu factura no fue aprobada para financiamiento.\nMotivo: ${f.text(v.reason, 'no cumple los criterios de riesgo')}`,
      webPath: '/',
    }),
  },
  [NotificationType.AUCTION_PUBLISHED]: {
    name: 'Subasta publicada',
    description: 'La factura se publicó en el marketplace',
    audience: NotificationAudience.MYPE,
    sourceEvent: 'investment.auction-lifecycle.v1 · AuctionPublished',
    render: (v, f) => ({
      title: 'Tu factura ya está en subasta',
      body: `Tu factura a ${f.text(v.payerName, 'tu cliente')} se publicó en el marketplace por ${f.money(v.targetAmount, v.currency)}.${v.expiresAt ? `\nLa subasta cierra el ${f.date(v.expiresAt)}.` : ''}`,
      webPath: '/',
    }),
  },
  [NotificationType.DEPOSIT_SUCCEEDED]: {
    name: 'Recarga acreditada',
    description: 'Finance confirmó la recarga de la billetera',
    audience: NotificationAudience.INVESTOR,
    sourceEvent: 'vankoo.finance.events.v1 · DepositSucceededEvent',
    dataKeys: ['depositId'],
    render: (v, f) => ({
      title: 'Recarga acreditada',
      body: `Se acreditaron ${f.money(v.amount, v.currency)} en tu billetera.`,
    }),
  },
  [NotificationType.DEPOSIT_FAILED]: {
    name: 'Recarga fallida',
    description: 'La recarga de la billetera falló',
    audience: NotificationAudience.INVESTOR,
    sourceEvent: 'vankoo.finance.events.v1 · DepositFailedEvent',
    dataKeys: ['depositId'],
    render: (v, f) => ({
      title: 'Tu recarga no se pudo completar',
      body: `La recarga de ${f.money(v.amount, v.currency)} no se pudo completar${v.reason ? `: ${f.text(v.reason)}` : ''}. Inténtalo de nuevo.`,
    }),
  },
  [NotificationType.DEPOSIT_CANCELLED]: {
    name: 'Recarga cancelada',
    description: 'La recarga de la billetera se canceló',
    audience: NotificationAudience.INVESTOR,
    sourceEvent: 'vankoo.finance.events.v1 · DepositCancelledEvent',
    dataKeys: ['depositId'],
    render: (v, f) => ({
      title: 'Recarga cancelada',
      body: `La recarga de ${f.money(v.amount, v.currency)} se canceló.`,
    }),
  },
};

/** Solo texto, números y booleanos llegan a una plantilla; cualquier otra cosa queda vacía. */
const asText = (value: unknown): string =>
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean'
    ? String(value).trim()
    : '';

const FORMATTERS: Formatters = {
  text: (value, fallback = '') => asText(value) || fallback,
  money: (amount, currency) => {
    const value = Number(amount);
    const code = typeof currency === 'string' ? currency : 'PEN';
    if (!Number.isFinite(value)) return 'el monto indicado';
    try {
      return new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: code,
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${code}`;
    }
  },
  date: (value) => {
    const text = asText(value);
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    // Las fechas sin hora ("2028-03-31") son fechas de calendario: se muestran tal cual.
    const timeZone = /^\d{4}-\d{2}-\d{2}$/.test(text) ? 'UTC' : 'America/Lima';
    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'long',
      timeZone,
    }).format(date);
  },
};

/**
 * @author LiquiLabs
 * @summary Catálogo de plantillas en código: textos en español y canales de cada tipo.
 *
 * No necesita base de datos porque los textos cambian con el código. Si algún día se
 * editan desde un panel, basta con otra implementación de INotificationTemplateCatalog.
 */
export class InMemoryNotificationTemplateCatalog implements INotificationTemplateCatalog {
  constructor(private readonly webAppUrl: string) {}

  render(
    type: NotificationType,
    variables: TemplateVariables,
  ): NotificationContent {
    const template = TEMPLATES[type];
    const { title, body, webPath } = template.render(variables, FORMATTERS);
    const data: Record<string, string> = { type };
    for (const key of template.dataKeys ?? []) {
      const value = variables[key];
      if (asText(value) !== '') data[key] = asText(value);
    }
    return new NotificationContent(
      title,
      body,
      webPath === undefined ? undefined : `${this.webAppUrl}${webPath}`,
      data,
    );
  }

  definitions(): NotificationTypeDefinition[] {
    return Object.values(NotificationType).map((type) => {
      const template = TEMPLATES[type];
      return new NotificationTypeDefinition(
        type,
        template.name,
        template.description,
        template.audience,
        NotificationChannelPolicy.channelsFor(type),
        template.sourceEvent,
      );
    });
  }
}
