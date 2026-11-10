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

export type SpecWarning = { line?: number; column?: number; message: string };

@Injectable()
export class ParsingService {
  
  async validateStrict(content: string, fileName: string): Promise<SpecWarning[]> {
    const format = this.resolveFormat(fileName);
    let raw: unknown;

    try {
      raw = format === 'json' ? JSON.parse(content) : yaml.load(content);
    } catch {
      return []; 
    }

    try {
      await SwaggerParser.validate(raw as never);
      return [];
    } catch (err) {
      return this.formatValidationErrors(err as Error);
    }
  }

  private formatValidationErrors(err: Error): SpecWarning[] {
    return err.message
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((message) => ({ message }));
  }

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

        const parameters: ParsedParameter[] = (
          (op.parameters as any[]) ?? []
        ).map((p: any) => ({
          name: p.name,
          in: p.in,
          required: p.required ?? false,
          description: p.description,
          schema: p.schema,
        }));

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

        const accessControlResource = op['x-BbAccessControl-resource'] as string | undefined;
        const accessControlFunction = op['x-BbAccessControl-function'] as string | undefined;
        const accessControlPrivilege = op['x-BbAccessControl-privilege'] as string | undefined;
        const accessControl =
          accessControlResource || accessControlFunction || accessControlPrivilege
            ? {
                resource: accessControlResource,
                function: accessControlFunction,
                privilege: accessControlPrivilege,
              }
            : undefined;

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
          accessControl,
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