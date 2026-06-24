import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
}