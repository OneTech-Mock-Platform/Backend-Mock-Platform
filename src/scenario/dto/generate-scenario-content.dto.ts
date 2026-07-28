import { IsInt, IsString, Max, Min } from 'class-validator';

export class GenerateScenarioContentDto {
  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsInt()
  @Min(100)
  @Max(599)
  statusCode!: number;
}
