import { Injectable } from '@nestjs/common';

@Injectable()
export class MockDataService {

  generate(schema: any, depth = 0, fieldName?: string, siblingKeys?: string[], index = 0): unknown {
    if (!schema || depth > 6) return null;

    if (schema.example !== undefined) return schema.example;

    // Rotation dans la liste de valeurs autorisées plutôt que toujours le premier choix,
    // pour que les éléments d'un même tableau ne soient pas systématiquement identiques.
    if (schema.enum) return schema.enum[index % schema.enum.length];

    switch (schema.type) {
      case 'string':  return this.generateString(schema, fieldName, siblingKeys, index);
      case 'integer': return this.generateInteger(schema, index);
      case 'number':  return this.generateNumber(schema, index);
      case 'boolean': return index % 2 === 0;
      case 'array':   return this.generateArray(schema, depth);
      case 'object':  return this.generateObject(schema, depth, index);
      default:

        if (schema.properties) return this.generateObject(schema, depth, index);
        return null;
    }
  }

  private generateString(schema: any, fieldName?: string, siblingKeys?: string[], index = 0): string {
    const base = this.generateBaseString(schema, fieldName, siblingKeys);
    return index === 0 ? base : this.varyString(base, index);
  }

  private generateBaseString(schema: any, fieldName?: string, siblingKeys?: string[]): string {
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

    // Formats de date non-standards (ex: "DD-MM-YYYY" au lieu de "date") : générer une vraie date
    // respectant littéralement le patron demandé plutôt que de tomber en string_value.
    if (schema.format && this.looksLikeDateFormat(schema.format)) {
      return this.generateFromDatePattern(schema.format);
    }

    // Heuristiques rapides sur le nom du champ (volontairement simples, pas de génération contextuelle)
    if (fieldName) {
      // "message"/"reason" ne désignent une erreur que dans un objet de la forme error-item
      // (message + key + context en champs frères). Ailleurs (ex: RequestDetails.reason dans
      // une réponse 200), ce sont des champs métier neutres — ne pas y projeter un texte d'erreur.
      const looksLikeErrorItem = !!siblingKeys?.includes('key') && !!siblingKeys?.includes('context');
      if (/message|reason/i.test(fieldName)) {
        return looksLikeErrorItem
          ? 'Une erreur est survenue lors du traitement de la requête.'
          : 'Motif non renseigné.';
      }
      if (/description/i.test(fieldName)) return 'Description générée automatiquement pour ce mock.';
      if (/status/i.test(fieldName)) return 'ACTIVE';
      if (/name/i.test(fieldName)) return 'Nom Exemple';
      if (/key/i.test(fieldName)) return 'request.field';
      if (/code/i.test(fieldName)) return 'ERR_VALIDATION';
      if (/field/i.test(fieldName)) return 'champ_exemple';
      if (/info/i.test(fieldName)) return 'Information complémentaire.';
      if (/context/i.test(fieldName)) return 'Contexte non structuré.';
    }

    // Heuristique sur les valeurs possibles communes
    if (schema.minLength) return 'A'.repeat(schema.minLength);

    return 'string_value';
  }

  // Introduit une variation visible entre les éléments d'un même tableau (index > 0),
  // pour éviter que generateArray() ne produise des clones stricts.
  private varyString(value: string, index: number): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(value)) {
      const suffix = index.toString(16).padStart(4, '0');
      return value.slice(0, -4) + suffix;
    }
    return `${value} #${index + 1}`;
  }

  // Détecte les formats "faits maison" du type "DD-MM-YYYY", "DD/MM/YYYY", "YYYY.MM.DD"...
  private looksLikeDateFormat(format: string): boolean {
    return /^[DMY]{1,4}[-/.][DMY]{1,4}[-/.][DMY]{1,4}$/i.test(format);
  }

  // Génère une date fixe (15 juin 2024) formatée littéralement selon le patron demandé.
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

  private generateArray(schema: any, depth: number): unknown[] {
    if (!schema.items) return [];

    let count = 1;
    if (schema.minItems !== undefined) count = Math.max(count, schema.minItems);
    if (schema.maxItems !== undefined) count = Math.min(count, schema.maxItems);

    return Array.from({ length: count }, (_, i) => this.generate(schema.items, depth + 1, undefined, undefined, i));
  }

  private generateObject(schema: any, depth: number, index = 0): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (schema.properties) {
      const siblingKeys = Object.keys(schema.properties);
      for (const [key, prop] of Object.entries(schema.properties as Record<string, any>)) {
        result[key] = this.generate(prop, depth + 1, key, siblingKeys, index);
      }
      return result;
    }

    // Pas de "properties" défini mais un additionalProperties typé : éviter un objet vide systématique
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      return { info: this.generate(schema.additionalProperties, depth + 1, 'info', undefined, index) };
    }

    return result;
  }
}
