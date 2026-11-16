/**
 * @author LiquiLabs
 * @summary Lo que Notification lee de Profile Service: solo el email de contacto de la empresa.
 */
export interface CompanyContact {
  contactEmail: string | null;
  businessName: string | null;
}

/**
 * @author LiquiLabs
 * @summary Puerto del cliente HTTP de Profile Service.
 *
 * Devuelve `null` si el usuario no tiene empresa; lanza si Profile no responde.
 */
export interface IProfileContactClient {
  fetchCompanyContact(userId: string): Promise<CompanyContact | null>;
}
