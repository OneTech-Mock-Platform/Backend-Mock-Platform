import { Injectable } from '@nestjs/common';

@Injectable()
export class MockDataService {

  generate(schema: any, depth = 0): unknown {
    if (!schema || depth > 6) return null;

    if (schema.example !== undefined) return schema.example;

    if (schema.enum) return schema.enum[0];

    switch (schema.type) {
      case 'string':  return this.generateString(schema);
      case 'integer': return this.generateInteger(schema);
      case 'number':  return this.generateNumber(schema);
      case 'boolean': return true;
      case 'array':   return this.generateArray(schema, depth);
      case 'object':  return this.generateObject(schema, depth);
      default:
    
        if (schema.properties) return this.generateObject(schema, depth);
        return null;
    }
  }

  private generateString(schema: any): string {
    // Heuristique sur le nom du format
    switch (schema.format) {
      case 'date':      return '2024-06-15';
      case 'Date':      return '2024-06-15';
      case 'date-time': return '2024-06-15T10:30:00Z';
      case 'email':     return 'user@example.com';
      case 'uuid':      return 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      case 'uri':       return 'https://example.com';
      case 'iban':      return 'TN5910006035188298755016';
      case 'phone':     return '+21612345678';
      default:          break;
    }

    // Heuristique sur les valeurs possibles communes
    if (schema.minLength) return 'A'.repeat(schema.minLength);

    return 'string_value';
  }

  private generateInteger(schema: any): number {
    if (schema.minimum !== undefined && schema.maximum !== undefined) {
      return Math.floor((schema.minimum + schema.maximum) / 2);
    }
    return schema.minimum ?? 1;
  }

  private generateNumber(schema: any): number {
    if (schema.minimum !== undefined && schema.maximum !== undefined) {
      return (schema.minimum + schema.maximum) / 2;
    }
    return schema.minimum ?? 1.0;
  }

  private generateArray(schema: any, depth: number): unknown[] {
    if (!schema.items) return [];

    let count = 2;
    if (schema.minItems !== undefined) count = Math.max(count, schema.minItems);
    if (schema.maxItems !== undefined) count = Math.min(count, schema.maxItems);

    return Array.from({ length: count }, () => this.generate(schema.items, depth + 1));
  }

  private generateObject(schema: any, depth: number): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    if (!schema.properties) return result;

    for (const [key, prop] of Object.entries(schema.properties as Record<string, any>)) {
      result[key] = this.generate(prop, depth + 1);
    }
    return result;
  }
}