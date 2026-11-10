import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContentRating, Language, PartKind, ReleasePlan, WorkAccess, WorkKind, WorkStatus } from '@prisma/client';

export class CreateWorkDto {
  @ApiPropertyOptional({ enum: WorkAccess, description: 'public | preview (first N parts free) | members (account required)' })
  @IsOptional()
  @IsEnum(WorkAccess)
  access?: WorkAccess;
  @ApiPropertyOptional({ description: 'Parts readable without an account when access = preview', default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  previewParts?: number;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) synopsis?: string;
  @ApiProperty({ enum: Language }) @IsEnum(Language) language!: Language;
  @ApiPropertyOptional({ enum: WorkKind, description: 'poem | poem_collection | book | book_collection' }) @IsOptional() @IsEnum(WorkKind) kind?: WorkKind;
  @ApiPropertyOptional({ type: [String], description: 'Volume (book) titles of a book_collection, in order' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  volumes?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) genre?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];
  @ApiPropertyOptional({ enum: ContentRating }) @IsOptional() @IsEnum(ContentRating) rating?: ContentRating;
}

export class UpdateWorkDto {
  @ApiPropertyOptional({ enum: WorkAccess }) @IsOptional() @IsEnum(WorkAccess) access?: WorkAccess;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(100) previewParts?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) synopsis?: string;
  @ApiPropertyOptional({ enum: Language }) @IsOptional() @IsEnum(Language) language?: Language;
  @ApiPropertyOptional({ enum: WorkKind, description: 'poem | poem_collection | book | book_collection' }) @IsOptional() @IsEnum(WorkKind) kind?: WorkKind;
  @ApiPropertyOptional({ type: [String], description: 'Volume (book) titles of a book_collection, in order' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  volumes?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) genre?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];
  @ApiPropertyOptional({ enum: ContentRating }) @IsOptional() @IsEnum(ContentRating) rating?: ContentRating;
  @ApiPropertyOptional({ enum: WorkStatus }) @IsOptional() @IsEnum(WorkStatus) status?: WorkStatus;
  @ApiPropertyOptional({ enum: ReleasePlan }) @IsOptional() @IsEnum(ReleasePlan) releasePlan?: ReleasePlan;
  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  releaseTime?: string;
  @ApiPropertyOptional({ type: [Number], description: '0=Sunday .. 6=Saturday' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  releaseWeekdays?: number[];
  @ApiPropertyOptional({ example: 'Africa/Dar_es_Salaam' }) @IsOptional() @IsString() @MaxLength(64) timezone?: string;
}

export class CreatePartDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @ApiPropertyOptional({ enum: PartKind }) @IsOptional() @IsEnum(PartKind) kind?: PartKind;
  @ApiPropertyOptional({ description: '1-based volume inside a book_collection' }) @IsOptional() @IsInt() @Min(1) @Max(50) volume?: number;
}

export class UpdatePartDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(160) title?: string;
  @ApiPropertyOptional({ enum: PartKind }) @IsOptional() @IsEnum(PartKind) kind?: PartKind;
  @ApiPropertyOptional({ description: '1-based volume inside a book_collection' }) @IsOptional() @IsInt() @Min(1) @Max(50) volume?: number;
}

export class AudioMetaDto {
  @ApiPropertyOptional({ description: 'Duration in seconds, if the uploader knows it' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24 * 3600)
  seconds?: number;
}

export class SaveDraftDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(160) title?: string;
  @ApiPropertyOptional({ description: 'ProseMirror JSON document (the working copy)' })
  @IsOptional()
  @IsObject()
  draftJson?: Record<string, unknown>;
  @ApiPropertyOptional({ description: 'Plain text alternative; converted to a document server side' })
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  text?: string;
}

export class MovePartDto {
  @ApiProperty({ description: '1-based position in the work' }) @IsInt() @Min(1) position!: number;
}
