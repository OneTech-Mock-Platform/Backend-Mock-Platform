import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateScenarioDto {
  @IsInt()
  @Min(100)
  @Max(599)
  statusCode!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  endpointId!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  mockContent?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsInt()
  @Min(0)
  delayMs?: number;
}