import { Injectable, BadRequestException } from '@nestjs/common';
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
          endpoints.push({
            path,
            method: method.toUpperCase(),
            summary: operation.summary as string | undefined,
            operationId: operation.operationId as string | undefined,
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
}