import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le nom est requis' })
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  name!: string;

  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email!: string;

  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
  password!: string;

  @IsString({ message: 'La confirmation du mot de passe doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'La confirmation du mot de passe est requise' })
  @MinLength(6, {
    message: 'La confirmation du mot de passe doit contenir au moins 6 caractères',
  })
  confirmPassword!: string;
}
