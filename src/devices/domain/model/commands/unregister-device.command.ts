/**
 * @author LiquiLabs
 * @summary Dejar de enviar push a un dispositivo (por ejemplo, al cerrar sesión).
 */
export class UnregisterDeviceCommand {
  constructor(
    public readonly userId: string,
    public readonly deviceToken: string,
  ) {}
}
