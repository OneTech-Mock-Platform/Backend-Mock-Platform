import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString({ message: 'Le jeton de réinitialisation doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le jeton de réinitialisation est requis' })
  resetToken!: string;

  @IsString({ message: 'Le nouveau mot de passe doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le nouveau mot de passe est requis' })
  @MinLength(6, { message: 'Le nouveau mot de passe doit contenir au moins 6 caractères' })
  newPassword!: string;
}