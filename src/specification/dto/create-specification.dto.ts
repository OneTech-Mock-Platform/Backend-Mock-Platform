import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class CreateSpecificationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['yaml', 'yml', 'json'])
  format!: 'yaml' | 'yml' | 'json';

  @IsString()
  @IsNotEmpty()
  content!: string;
}