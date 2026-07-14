import { IsEmail, IsNotEmpty } from 'class-validator';

export class LoginUserDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email!: string;

  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  password!: string;
}