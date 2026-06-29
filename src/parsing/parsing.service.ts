/* import { Injectable, BadRequestException } from '@nestjs/common';
import * as yaml from 'js-yaml';
import { ParsedSpec, ParsedEndpoint } from './dto/parsed-spec.dto';

@Injectable()
export class ParsingService {
  parse(content: string, fileName: string): ParsedSpec {
    const format = this.resolveFormat(fileName);
    let document: Record<string, unknown>;

    try {
      if (format === 'json') {
        document = JSON.parse(content);
      } else {
        document = yaml.load(content) as Record<string, unknown>;
      }
    } catch (error) {
      throw new BadRequestException('Invalid OpenAPI file format');
    }

    const openapi = (document.openapi || document.swagger || '3.0.0') as string;
    const info = (document.info || {}) as ParsedSpec['info'];
    const paths = (document.paths || {}) as Record<string, Record<string, unknown>>;
    const components = document.components as Record<string, unknown> | undefined;

    const endpoints = this.extractEndpoints(paths);

    return {
      openapi,
      info: {
        title: info.title || 'Untitled API',
        version: info.version || '1.0.0',
        description: info.description as string | undefined,
      },
      paths,
      components,
      endpoints,
    };
  }

  private extractEndpoints(paths: Record<string, Record<string, unknown>>): ParsedEndpoint[] {
    const endpoints: ParsedEndpoint[] = [];
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];

    for (const [path, pathItem] of Object.entries(paths)) {
      for (const method of methods) {
        const operation = (pathItem as Record<string, unknown>)[method] as Record<string, unknown> | undefined;

        if (operation) {
          const responses = operation.responses as Record<string, unknown> | undefined;
          const responseCodes = responses ? Object.keys(responses) : [];

          endpoints.push({
            path,
            method: method.toUpperCase(),
            summary: operation.summary as string | undefined,
            operationId: operation.operationId as string | undefined,
            responses: responseCodes,
          });
        }
      }
    }

    return endpoints;
  }

  private resolveFormat(fileName: string): 'json' | 'yaml' {
    const extension = fileName.split('.').pop()?.toLowerCase();

    if (extension === 'yaml' || extension === 'yml') {
      return 'yaml';
    }

    return 'json';
  }
} */


import { Injectable, BadRequestException } from '@nestjs/common';
import * as yaml from 'js-yaml';
import {
  ParsedSpec,
  ParsedEndpoint,
  ParsedParameter,
  ParsedResponse,
  ParsedRequestBody,
} from './dto/parsed-spec.dto';

@Injectable()
export class ParsingService {
  parse(content: string, fileName: string): ParsedSpec {
    const format = this.resolveFormat(fileName);
    let document: Record<string, unknown>;

    try {
      if (format === 'json') {
        document = JSON.parse(content);
      } else {
        document = yaml.load(content) as Record<string, unknown>;
      }
    } catch {
      throw new BadRequestException('Invalid OpenAPI file format');
    }

    const openapi = (document.openapi || document.swagger || '3.0.0') as string;
    const info = (document.info || {}) as ParsedSpec['info'];
    const paths = (document.paths || {}) as Record<string, Record<string, unknown>>;
    const components = document.components as Record<string, unknown> | undefined;

    const endpoints = this.extractEndpoints(paths);

    return {
      openapi,
      info: {
        title: info.title || 'Untitled API',
        version: info.version || '1.0.0',
        description: info.description,
      },
      paths,
      components,
      endpoints,
    };
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
          const contentType = Object.keys(rbContent)[0] ?? 'application/json';
          requestBody = {
            required: rb.required ?? false,
            contentType,
            schema: rbContent[contentType]?.schema,
          };
        }

        // ── Réponses ──
        const responsesRaw = (op.responses as Record<string, any>) ?? {};
        const responses: ParsedResponse[] = Object.entries(responsesRaw).map(
          ([code, res]) => {
            const resContent = res.content ?? {};
            const contentType = Object.keys(resContent)[0];
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
}