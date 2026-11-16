import { createHmac } from 'node:crypto';

/**
 * @author LiquiLabs
 * @summary Nombre del topic de FCM de cada usuario: `user_<HMAC-SHA256(userId)>`.
 *
 * Así el servicio no guarda tokens: el mobile se suscribe (a través de nuestro endpoint)
 * al topic de su usuario y Firebase recuerda qué dispositivos hay en cada topic. El HMAC
 * con un secreto del servidor evita que alguien adivine el topic de otro usuario a partir
 * de su userId. Cambiar el secreto deja a todos los dispositivos fuera de su topic.
 */
export class PushTopicNaming {
  constructor(private readonly secret: string) {}

  topicFor(userId: string): string {
    const digest = createHmac('sha256', this.secret)
      .update(userId)
      .digest('hex');
    return `user_${digest}`;
  }
}
