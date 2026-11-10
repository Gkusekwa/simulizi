import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Language } from '@prisma/client';

export class RegisterDto {
  @ApiProperty() @IsEmail() email!: string;

  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) @MaxLength(128) password!: string;

  @ApiProperty({ example: 'neemamushi', description: 'Unique @handle: 3-30 chars, a-z 0-9 _' })
  @Matches(/^[a-z0-9_]{3,30}$/)
  handle!: string;

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(60) displayName!: string;

  @ApiProperty({ description: 'Self-declared year of birth; must be 13 or older' })
  @IsInt()
  @Min(1900)
  @Max(2100)
  birthYear!: number;

  @ApiPropertyOptional({ enum: Language }) @IsOptional() @IsEnum(Language) uiLanguage?: Language;
}

export class LoginDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(1) password!: string;
}

export class RefreshDto {
  @ApiProperty() @IsString() @MinLength(10) refreshToken!: string;
}
