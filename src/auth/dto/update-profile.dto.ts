import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Le nouveau mot de passe doit être une chaîne de caractères' })
  @MinLength(6, { message: 'Le nouveau mot de passe doit contenir au moins 6 caractères' })
  newPassword?: string;
}