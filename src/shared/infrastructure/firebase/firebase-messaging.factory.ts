import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { Messaging } from 'firebase-admin/messaging';
import type { AppConfig } from '../config/env.config';

/**
 * @author LiquiLabs
 * @summary Inicializa Firebase Admin y devuelve su cliente de Cloud Messaging.
 *
 * Con FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY usa esa cuenta
 * de servicio; sin ellas, las credenciales por defecto de Google
 * (GOOGLE_APPLICATION_CREDENTIALS).
 */
export function createFirebaseMessaging(
  config: AppConfig['push']['firebase'],
): Messaging {
  const app = initializeApp(
    config
      ? {
          credential: cert({
            projectId: config.projectId,
            clientEmail: config.clientEmail,
            privateKey: config.privateKey,
          }),
          projectId: config.projectId,
        }
      : { credential: applicationDefault() },
    'notification-service',
  );
  return getMessaging(app);
}
