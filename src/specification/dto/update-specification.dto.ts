import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateSpecificationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  @IsIn(['yaml', 'yml', 'json'])
  format?: 'yaml' | 'yml' | 'json';

  @IsOptional()
  @IsString()
  content?: string;
}