import { Injectable, BadRequestException } from '@nestjs/common';
import * as yaml from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser';
import {
  ParsedSpec,
  ParsedEndpoint,
  ParsedParameter,
  ParsedResponse,
  ParsedRequestBody,
} from './dto/parsed-spec.dto';

@Injectable()
export class ParsingService {
  async parse(content: string, fileName: string): Promise<ParsedSpec> {
    const format = this.resolveFormat(fileName);
    let raw: unknown;

    try {
      if (format === 'json') {
        raw = JSON.parse(content);
      } else {
        raw = yaml.load(content);
      }
    } catch {
      throw new BadRequestException('Invalid OpenAPI file format');
    }

    try {
      const resolved = (await SwaggerParser.dereference(raw as never)) as any;

      const endpoints = this.extractEndpoints(resolved.paths ?? {});

      return {
        openapi: resolved.openapi ?? '3.0.0',
        info: {
          title: resolved.info?.title ?? 'Untitled',
          version: resolved.info?.version ?? '1.0.0',
          description: resolved.info?.description,
        },
        paths: resolved.paths ?? {},
        components: resolved.components,
        endpoints,
      };
    } catch (err) {
      throw new BadRequestException(`Parsing failed: ${(err as Error).message}`);
    }
  }

  private extractEndpoints(
    paths: Record<string, Record<string, unknown>>,
  ): ParsedEndpoint[] {
    const endpoints: ParsedEndpoint[] = [];
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];

    for (const [path, pathItem] of Object.entries(paths)) {
      for (const method of methods) {
        const op = (pathItem as Record<string, unknown>)[method] as
          | Record<string, unknown>
          | undefined;

        if (!op) continue;

        // ── Paramètres ──
        const parameters: ParsedParameter[] = (
          (op.parameters as any[]) ?? []
        ).map((p: any) => ({
          name: p.name,
          in: p.in,
          required: p.required ?? false,
          description: p.description,
          schema: p.schema,
        }));

        // ── Request Body ──
        let requestBody: ParsedRequestBody | undefined;
        if (op.requestBody) {
          const rb = op.requestBody as any;
          const rbContent = rb.content ?? {};
          const contentType = this.pickContentType(rbContent) ?? 'application/json';
          requestBody = {
            required: rb.required ?? false,
            contentType,
            schema: rbContent[contentType]?.schema,
          };
        }

        // ── Réponses avec schémas résolus ──
        const responsesRaw = (op.responses as Record<string, any>) ?? {};
        const responses: ParsedResponse[] = Object.entries(responsesRaw).map(
          ([code, res]) => {
            const resContent = res.content ?? {};
            const contentType = this.pickContentType(resContent);
            return {
              statusCode: code,
              description: res.description ?? '',
              contentType,
              schema: contentType ? resContent[contentType]?.schema : undefined,
            };
          },
        );

        endpoints.push({
          path,
          method: method.toUpperCase(),
          summary: op.summary as string | undefined,
          description: op.description as string | undefined,
          operationId: op.operationId as string | undefined,
          tags: (op.tags as string[]) ?? [],
          parameters,
          requestBody,
          responses,
        });
      }
    }

    return endpoints;
  }

  private resolveFormat(fileName: string): 'json' | 'yaml' {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension === 'yaml' || extension === 'yml') return 'yaml';
    return 'json';
  }


  private pickContentType(content: Record<string, unknown>): string | undefined {
    const keys = Object.keys(content);
    if (keys.includes('application/json')) return 'application/json';
    return keys[0];
  }
}