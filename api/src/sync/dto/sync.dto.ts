import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class ProgressItemDto {
  @ApiProperty() @IsString() partId!: string;
  @ApiProperty() @IsInt() @Min(0) paragraphIndex!: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(1) fraction!: number;
  @ApiProperty() @IsBoolean() finished!: boolean;
  @ApiProperty({ description: 'When the device recorded it (ISO)' }) @IsDateString() updatedAt!: string;
}

export class ProgressBatchDto {
  @ApiProperty({ type: [ProgressItemDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ProgressItemDto)
  items!: ProgressItemDto[];
}

export class DeviceDto {
  @ApiProperty() @IsString() @MaxLength(512) token!: string;
  @ApiPropertyOptional({ default: 'android' }) @IsOptional() @IsString() @MaxLength(16) platform?: string;
}
