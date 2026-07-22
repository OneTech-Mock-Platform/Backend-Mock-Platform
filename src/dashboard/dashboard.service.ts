import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(userId: number) {
    const [
      specsCount,
      endpointsCount,
      scenarios,
      endpointsByMethod,
      scenariosPerEndpoint,
      allSpecs,
      allEndpoints,
      recentSpecsRaw,
    ] = await Promise.all([
      this.prisma.openApiSpec.count({ where: { userId } }),
      this.prisma.endpoint.count({ where: { spec: { userId } } }),
      this.prisma.scenario.findMany({
        where: { endpoint: { spec: { userId } } },
        select: { statusCode: true },
      }),
      this.prisma.endpoint.groupBy({
        by: ['method'],
        where: { spec: { userId } },
        _count: { id: true },
      }),
      this.prisma.scenario.groupBy({
        by: ['endpointId'],
        where: { endpoint: { spec: { userId } } },
        _count: { id: true },
      }),
      this.prisma.openApiSpec.findMany({ where: { userId }, select: { id: true, name: true } }),
      this.prisma.endpoint.findMany({
        where: { spec: { userId } },
        select: { id: true, specId: true },
      }),
      this.prisma.openApiSpec.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { _count: { select: { endpoints: true } } },
      }),
    ]);

    // Répartition des scénarios par famille de code (2xx/3xx/4xx/5xx)
    const family: Record<string, number> = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
    for (const s of scenarios) {
      const bucket = Math.floor(s.statusCode / 100);
      const key = `${bucket}xx`;
      family[key] = (family[key] ?? 0) + 1;
    }
    const scenariosByFamily = Object.entries(family)
      .filter(([, count]) => count > 0)
      .map(([familyKey, count]) => ({ family: familyKey, count }));

    // % d'endpoints avec plus d'un scénario (au-delà du simple 200 auto-généré)
    const multiScenarioEndpoints = scenariosPerEndpoint.filter((g) => g._count.id > 1).length;
    const multiScenarioPercent =
      endpointsCount > 0 ? Math.round((multiScenarioEndpoints / endpointsCount) * 1000) / 10 : 0;

    // Nombre de scénarios par spec (endpointId -> specId -> nom de la spec)
    const specNameById = new Map(allSpecs.map((s) => [s.id, s.name]));
    const specIdByEndpointId = new Map(allEndpoints.map((e) => [e.id, e.specId]));
    const scenarioCountBySpecId = new Map<string, number>();
    for (const g of scenariosPerEndpoint) {
      const specId = specIdByEndpointId.get(g.endpointId);
      if (!specId) continue;
      scenarioCountBySpecId.set(specId, (scenarioCountBySpecId.get(specId) ?? 0) + g._count.id);
    }
    const scenariosBySpec = Array.from(scenarioCountBySpecId.entries()).map(([specId, count]) => ({
      specId,
      specName: specNameById.get(specId) ?? specId,
      count,
    }));

    const recentSpecs = recentSpecsRaw.map((s) => ({
      id: s.id,
      name: s.name,
      fileName: s.filePath,
      createdAt: s.createdAt,
      endpointCount: s._count.endpoints,
    }));

    return {
      totals: {
        specs: specsCount,
        endpoints: endpointsCount,
        scenarios: scenarios.length,
        multiScenarioPercent,
      },
      scenariosByFamily,
      endpointsByMethod: endpointsByMethod.map((g) => ({ method: g.method, count: g._count.id })),
      scenariosBySpec,
      recentSpecs,
    };
  }
}
