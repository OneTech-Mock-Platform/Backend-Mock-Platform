import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildFieldKey } from './field-suggestion.util';


export type GenerationContext = {
  index: number;
  responseDescription?: string;
  violatedField?: string;
  suppressGenericErrorItems?: boolean;
  violationMessage?: string;
  isSuccessResponse?: boolean;
  accessControlMessage?: string;
};

const DEFAULT_CONTEXT: GenerationContext = { index: 0 };
const DETERMINABLE_CAUSE_CODES = new Set([200, 201, 202, 400, 422]);

export function isCauseDeterminable(statusCode: number): boolean {
  return DETERMINABLE_CAUSE_CODES.has(statusCode);
}

export function buildAccessControlMessage(
  accessControl?: { resource?: string; function?: string; privilege?: string } | null,
): string | undefined {
  if (!accessControl?.resource && !accessControl?.privilege) return undefined;

  if (accessControl.privilege && accessControl.resource) {
    return `Le privilège '${accessControl.privilege}' sur la ressource '${accessControl.resource}' est requis.`;
  }
  if (accessControl.resource) {
    return `L'accès à la ressource '${accessControl.resource}' est requis.`;
  }
  return `Le privilège '${accessControl.privilege}' est requis.`;
}

@Injectable()
export class MockDataService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}
  private suggestionCache = new Map<string, unknown>();

  async onModuleInit() {
    await this.reloadSuggestionCache();
  }

  async reloadSuggestionCache() {
    const rows = await this.prisma.fieldSuggestion.findMany();
    this.suggestionCache = new Map(rows.map((row: { fieldKey: string; value: unknown }) => [row.fieldKey, row.value]));
  }

  hasSuggestion(fieldKey: string): boolean {
    return this.suggestionCache.has(fieldKey);
  }

  getSuggestion(fieldKey: string): unknown {
    return this.suggestionCache.get(fieldKey);
  }

  generate(
    schema: any,
    depth = 0,
    fieldName?: string,
    siblingKeys?: string[],
    parentTitle?: string,
    ctx: GenerationContext = DEFAULT_CONTEXT,
  ): unknown {
    if (!schema || depth > 6) return null;

    if (schema.example !== undefined) return schema.example;
    if (schema.enum) return schema.enum[ctx.index % schema.enum.length];

    switch (schema.type) {
      case 'string':  return this.generateString(schema, depth, fieldName, siblingKeys, parentTitle, ctx);
      case 'integer': return this.generateInteger(schema, ctx.index);
      case 'number':  return this.generateNumber(schema, ctx.index);
      case 'boolean': return ctx.index % 2 === 0;
      case 'array':   return this.generateArray(schema, depth, fieldName, ctx);
      case 'object':  return this.generateObject(schema, depth, fieldName, ctx);
      default:

        if (schema.properties) return this.generateObject(schema, depth, fieldName, ctx);
        return null;
    }
  }

  private generateString(
    schema: any,
    depth: number,
    fieldName?: string,
    siblingKeys?: string[],
    parentTitle?: string,
    ctx: GenerationContext = DEFAULT_CONTEXT,
  ): string {
    const base = this.generateBaseString(schema, depth, fieldName, siblingKeys, parentTitle, ctx);
    return ctx.index === 0 ? base : this.varyString(base, ctx.index);
  }

  private generateBaseString(
    schema: any,
    depth: number,
    fieldName?: string,
    siblingKeys?: string[],
    parentTitle?: string,
    ctx: GenerationContext = DEFAULT_CONTEXT,
  ): string {
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


    if (schema.format && this.looksLikeDateFormat(schema.format)) {
      return this.generateFromDatePattern(schema.format);
    }

    if (fieldName) {
      const looksLikeErrorItem = !!siblingKeys?.includes('key') && !!siblingKeys?.includes('context');
      const parentIsErrorSchema = typeof parentTitle === 'string' && /error/i.test(parentTitle);
      const isErrorContext = looksLikeErrorItem || parentIsErrorSchema;

      if (/message|reason/i.test(fieldName)) {
        if (!isErrorContext) {
          if (ctx.isSuccessResponse && depth <= 1) {
            return ctx.responseDescription?.trim() || 'Opération réussie.';
          }
          return '';
        }
        if (looksLikeErrorItem && ctx.violationMessage) {
          return ctx.violationMessage;
        }
        if (!looksLikeErrorItem && ctx.accessControlMessage) {
          return ctx.accessControlMessage;
        }
        return ctx.responseDescription?.trim() || 'Une erreur est survenue lors du traitement de la requête.';
      }
      if (/description/i.test(fieldName)) return 'Description générée automatiquement pour ce mock.';
      if (/status/i.test(fieldName)) return 'ACTIVE';
      if (/creator|createdBy|author/i.test(fieldName)) return 'Utilisateur Système';
      if (/name/i.test(fieldName)) return 'Nom Exemple';
      if (/key/i.test(fieldName)) {
        return ctx.violatedField ?? 'request.field';
      }
      if (/code/i.test(fieldName)) return 'ERR_VALIDATION';
      if (/field/i.test(fieldName)) return 'champ_exemple';
      if (/info/i.test(fieldName)) return 'Information complémentaire.';
      if (/context/i.test(fieldName)) return 'Contexte non structuré.';
    }

    if (schema.minLength) return 'A'.repeat(schema.minLength);

    if (fieldName) {
      const cached = this.suggestionCache.get(buildFieldKey('string', fieldName, schema.description));
      if (typeof cached === 'string') return cached;
    }

    return 'string_value';
  }

  private varyString(value: string, index: number): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(value)) {
      const suffix = index.toString(16).padStart(4, '0');
      return value.slice(0, -4) + suffix;
    }
    return `${value} #${index + 1}`;
  }

  private looksLikeDateFormat(format: string): boolean {
    return /^[DMY]{1,4}[-/.][DMY]{1,4}[-/.][DMY]{1,4}$/i.test(format);
  }

  private generateFromDatePattern(format: string): string {
    const day = '15';
    const month = '06';
    const year = '2024';
    return format
      .replace(/YYYY/gi, year)
      .replace(/YY/gi, year.slice(-2))
      .replace(/MM/gi, month)
      .replace(/DD/gi, day);
  }

  private generateInteger(schema: any, index = 0): number {
    const base = schema.minimum !== undefined && schema.maximum !== undefined
      ? Math.floor((schema.minimum + schema.maximum) / 2)
      : schema.minimum ?? 1;
    return base + index;
  }

  private generateNumber(schema: any, index = 0): number {
    const base = schema.minimum !== undefined && schema.maximum !== undefined
      ? (schema.minimum + schema.maximum) / 2
      : schema.minimum ?? 1.0;
    return base + index;
  }

  private generateArray(
    schema: any,
    depth: number,
    fieldName?: string,
    ctx: GenerationContext = DEFAULT_CONTEXT,
  ): unknown[] {
    if (!schema.items) return [];


    if (fieldName && /^errors$/i.test(fieldName) && ctx.suppressGenericErrorItems) {
      return [];
    }

    let count = 1;
    if (schema.minItems !== undefined) count = Math.max(count, schema.minItems);
    if (schema.maxItems !== undefined) count = Math.min(count, schema.maxItems);

    /*return Array.from({ length: count }, (_, i) =>
      this.generate(schema.items, depth + 1, undefined, undefined, undefined, { ...ctx, index: i }),
    */
    return Array.from({ length: count }, (_, i) =>
    this.generate(schema.items, depth + 1, fieldName, undefined, undefined, { ...ctx, index: i }),
    );
  }

  private generateObject(
    schema: any,
    depth: number,
    fieldName?: string,
    ctx: GenerationContext = DEFAULT_CONTEXT,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (schema.properties) {
      const siblingKeys = Object.keys(schema.properties);
      const parentTitle = typeof schema.title === 'string' ? schema.title : undefined;
      for (const [key, prop] of Object.entries(schema.properties as Record<string, any>)) {
        result[key] = this.generate(prop, depth + 1, key, siblingKeys, parentTitle, ctx);
      }
      return result;
    }

    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      return { info: this.generate(schema.additionalProperties, depth + 1, 'info', undefined, undefined, ctx) };
    }

    if (fieldName) {
      const cached = this.suggestionCache.get(buildFieldKey('object', fieldName, schema.description));
      if (cached && typeof cached === 'object') return cached as Record<string, unknown>;
    }

    return result;
  }
}
