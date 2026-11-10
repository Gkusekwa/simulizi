import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ProgressDto {
  @ApiProperty() @IsInt() @Min(0) paragraphIndex!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(1) fraction?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() finished?: boolean;
}

export class RateDto {
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) stars!: number;
}

export class CommentDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(2000) body!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() parentId?: string;
}
