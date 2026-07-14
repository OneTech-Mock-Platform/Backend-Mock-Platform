import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
} from 'class-validator';

export class VerifyLoginDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  @IsNotEmpty({ message: 'L’adresse e-mail est requise' })
  email!: string;

  @IsString({ message: 'Le code de vérification doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le code de vérification est requis' })
  @Length(6, 6, { message: 'Le code de vérification doit contenir 6 chiffres' })
  otp!: string;
}
