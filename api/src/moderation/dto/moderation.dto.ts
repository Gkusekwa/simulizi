import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportReason, ReportStatus, ReportTarget } from '@prisma/client';

export class ReportDto {
  @ApiProperty({ enum: ReportTarget }) @IsEnum(ReportTarget) target!: ReportTarget;
  @ApiProperty() @IsString() targetId!: string;
  @ApiProperty({ enum: ReportReason }) @IsEnum(ReportReason) reason!: ReportReason;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) details?: string;
}

export class ResolveDto {
  @ApiProperty({ enum: ['upheld', 'rejected'] }) @IsEnum(ReportStatus) status!: ReportStatus;
}
