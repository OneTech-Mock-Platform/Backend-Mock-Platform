import { IsEmail, IsNotEmpty, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email!: string;

  @IsNotEmpty({ message: 'Le code de réinitialisation est requis' })
  @Length(6, 6, { message: 'Le code de réinitialisation doit contenir 6 chiffres' })
  otp!: string;
}