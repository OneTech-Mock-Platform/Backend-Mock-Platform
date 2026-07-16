import { Injectable } from '@nestjs/common';
import { Endpoint, Scenario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { countDynamicSegments, pathToRegex } from './utils/path-matcher.util';

type ResolveParams = {
  specId: string;
  method: string;
  requestedPath: string;
  preferHeader?: string;
};

type ResolveResult =
  | { scenario: Scenario; endpoint: Endpoint }
  | { error: 'endpoint_not_found' | 'scenario_not_found'; message: string };

type Preference = { scenarioId: string } | { code: number };

@Injectable()
export class MockProxyService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(params: ResolveParams): Promise<ResolveResult> {
    const { specId, method, requestedPath, preferHeader } = params;

    const endpoints = await this.prisma.endpoint.findMany({
      where: { specId, method: method.toUpperCase() },
    });

    const matches = endpoints.filter((ep) => pathToRegex(ep.path).test(requestedPath));

    if (matches.length === 0) {
      return {
        error: 'endpoint_not_found',
        message: `Aucun endpoint trouvé pour ${method.toUpperCase()} ${requestedPath} — vérifie que la spec a bien été importée.`,
      };
    }

    matches.sort((a, b) => countDynamicSegments(a.path) - countDynamicSegments(b.path));
    const endpoint = matches[0];

    const scenarios = await this.prisma.scenario.findMany({ where: { endpointId: endpoint.id } });

    if (scenarios.length === 0) {
      return {
        error: 'scenario_not_found',
        message: `L'endpoint ${method.toUpperCase()} ${endpoint.path} existe mais n'a aucun scénario généré.`,
      };
    }

    const preference = this.parsePreferHeader(preferHeader);
    let scenario: Scenario | undefined;

    if (preference && 'scenarioId' in preference) {
      scenario = scenarios.find((s) => s.id === preference.scenarioId);
      if (!scenario) {
        return {
          error: 'scenario_not_found',
          message: `Aucun scénario avec l'id "${preference.scenarioId}" pour ${method.toUpperCase()} ${endpoint.path}.`,
        };
      }
    } else if (preference && 'code' in preference) {
      const byCode = scenarios.filter((s) => s.statusCode === preference.code);
      if (byCode.length === 0) {
        return {
          error: 'scenario_not_found',
          message: `Aucun scénario avec le code ${preference.code} pour ${method.toUpperCase()} ${endpoint.path}.`,
        };
      }
      scenario = byCode.find((s) => s.isDefault) ?? byCode[0];
    } else {
      scenario = scenarios.find((s) => s.isDefault) ?? scenarios[0];
    }

    return { scenario, endpoint };
  }

  private parsePreferHeader(header?: string): Preference | null {
    if (!header) return null;

    const scenarioMatch = header.match(/scenario=([^;,\s]+)/i);
    if (scenarioMatch) return { scenarioId: scenarioMatch[1] };

    const codeMatch = header.match(/code=(\d+)/i);
    if (codeMatch) return { code: parseInt(codeMatch[1], 10) };

    return null;
  }
}
