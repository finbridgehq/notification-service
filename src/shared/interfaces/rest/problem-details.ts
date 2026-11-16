import type { Response } from 'express';

/**
 * @author LiquiLabs
 * @summary Error HTTP con su estado; el error handler lo responde como problem+json.
 */
export class HttpProblem extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    public readonly detail: string,
    public readonly errors?: { field: string; message: string }[],
  ) {
    super(detail);
    this.name = 'HttpProblem';
  }
}

/** @author LiquiLabs */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: { field: string; message: string }[];
}

/**
 * @author LiquiLabs
 * @summary Responde un error en formato RFC 9457 (`application/problem+json`), como el gateway.
 */
export function sendProblem(
  res: Response,
  instance: string,
  problem: Omit<ProblemDetails, 'type' | 'instance'>,
): void {
  const body: ProblemDetails = { type: 'about:blank', ...problem, instance };
  res.status(problem.status).type('application/problem+json').json(body);
}
