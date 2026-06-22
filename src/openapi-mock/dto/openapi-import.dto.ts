export class OpenApiImportDto {
  fileName!: string;

  format!: 'yaml' | 'yml' | 'json';

  content!: string;
}