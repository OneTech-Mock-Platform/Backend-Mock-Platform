import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateScenarioDto {
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(599)
  statusCode?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  endpointId?: string;
}