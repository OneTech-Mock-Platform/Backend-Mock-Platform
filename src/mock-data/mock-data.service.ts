import { Injectable, BadRequestException } from '@nestjs/common';
import { GenerateMockDataDto } from './dto/mock-data.dto';

@Injectable()
export class MockDataService {
  generate(schema: Record<string, unknown>, count = 1): Record<string, unknown>[] {
    if (count < 1 || count > 100) {
      throw new BadRequestException('Count must be between 1 and 100');
    }

    const results: Record<string, unknown>[] = [];

    for (let i = 0; i < count; i++) {
      results.push(this.generateFromSchema(schema));
    }

    return results;
  }

  private generateFromSchema(schema: Record<string, unknown>): Record<string, unknown> {
    const type = schema.type as string | undefined;
    const properties = schema.properties as Record<string, unknown> | undefined;
    const required = (schema.required as string[]) || [];

    if (type === 'object' && properties) {
      const result: Record<string, unknown> = {};

      for (const [key, propSchema] of Object.entries(properties)) {
        const propSchemaObj = propSchema as Record<string, unknown>;
        result[key] = this.generateFromSchema(propSchemaObj);
      }

      return result;
    }

    if (type === 'array') {
      const items = schema.items as Record<string, unknown> | undefined;
      const minItems = (schema.minItems as number) || 1;
      const maxItems = (schema.maxItems as number) || 3;
      const length = Math.floor(Math.random() * (maxItems - minItems + 1)) + minItems;

      return {
        type: 'array',
        items: Array.from({ length }, () => this.generateFromSchema(items || {})),
      };
    }

    if (schema.$ref) {
      return this.generateFromSchema({ type: 'string' });
    }

    return this.generatePrimitiveValue(schema);
  }

  private generatePrimitiveValue(schema: Record<string, unknown>): Record<string, unknown> {
    const type = schema.type as string | undefined;

    switch (type) {
      case 'string': {
        const value = this.generateString(schema);
        return { type: 'string', value };
      }
      case 'integer':
      case 'number': {
        const value = this.generateNumber(schema);
        return { type: 'number', value };
      }
      case 'boolean': {
        const value = Math.random() > 0.5;
        return { type: 'boolean', value };
      }
      default:
        return { type: 'string', value: this.generateString(schema) };
    }
  }

  private generateString(schema: Record<string, unknown>): string {
    const format = schema.format as string | undefined;
    const enumValues = schema.enum as string[] | undefined;

    if (enumValues && enumValues.length > 0) {
      return enumValues[Math.floor(Math.random() * enumValues.length)];
    }

    switch (format) {
      case 'email':
        return `user${Math.floor(Math.random() * 1000)}@example.com`;
      case 'uuid':
        return crypto.randomUUID();
      case 'date':
        return new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString().split('T')[0];
      case 'date-time':
        return new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString();
      default:
        return `sample-${Math.random().toString(36).substring(7)}`;
    }
  }

  private generateNumber(schema: Record<string, unknown>): number {
    const minimum = schema.minimum as number | undefined;
    const maximum = schema.maximum as number | undefined;
    const min = minimum ?? 0;
    const max = maximum ?? 1000;

    if (schema.type === 'integer') {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    return Math.random() * (max - min) + min;
  }
}