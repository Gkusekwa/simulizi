import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Language } from '@prisma/client';

export class UpdateMeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(60) displayName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) bio?: string;
  @ApiPropertyOptional({ enum: Language }) @IsOptional() @IsEnum(Language) uiLanguage?: Language;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() profilePublic?: boolean;
  @ApiPropertyOptional({ description: 'Opt in to Mature works (18+ only)' })
  @IsOptional()
  @IsBoolean()
  mature?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailOnRelease?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() pushOnRelease?: boolean;
  @ApiPropertyOptional({ description: 'Store my reads without any identifier (doc 16)' })
  @IsOptional()
  @IsBoolean()
  analyticsOptOut?: boolean;
}
