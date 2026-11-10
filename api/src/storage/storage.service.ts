import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream } from 'node:fs';

/**
 * Object storage for media (audio narration, later covers) in the shared
 * RustFS bucket `simulizi` (nasinfra; S3 alias `minio`). Uploads go through the
 * internal endpoint; readers get short-lived presigned URLs signed for the
 * public endpoint (storage.tzcom.cloud), so the API never streams audio itself.
 * With no S3_ACCESS_KEY the service is off and media endpoints answer 503.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly internal?: S3Client;
  private readonly external?: S3Client;
  readonly bucket = process.env.S3_BUCKET ?? 'simulizi';
  readonly enabled: boolean;

  constructor() {
    const key = process.env.S3_ACCESS_KEY;
    const secret = process.env.S3_SECRET_KEY;
    this.enabled = !!(key && secret);
    if (!this.enabled) return;
    const credentials = { accessKeyId: key!, secretAccessKey: secret! };
    const region = process.env.S3_REGION ?? 'us-east-1';
    const url = (host: string, port: string, ssl: boolean) => `${ssl ? 'https' : 'http'}://${host}${(ssl && port === '443') || (!ssl && port === '80') ? '' : `:${port}`}`;
    this.internal = new S3Client({
      region,
      credentials,
      forcePathStyle: true,
      endpoint: url(process.env.S3_ENDPOINT ?? 'minio', process.env.S3_PORT ?? '9000', process.env.S3_USE_SSL === 'true'),
    });
    this.external = new S3Client({
      region,
      credentials,
      forcePathStyle: true,
      endpoint: url(process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT ?? 'minio', process.env.S3_PUBLIC_PORT ?? process.env.S3_PORT ?? '9000', (process.env.S3_PUBLIC_USE_SSL ?? process.env.S3_USE_SSL) === 'true'),
    });
  }

  async onModuleInit() {
    if (!this.internal) {
      this.logger.warn('S3 not configured (S3_ACCESS_KEY/S3_SECRET_KEY): audio uploads are disabled');
      return;
    }
    try {
      await this.internal.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.internal.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`created bucket ${this.bucket}`);
      } catch (e) {
        this.logger.error(`bucket ${this.bucket} unavailable: ${(e as Error).message}`);
      }
    }
  }

  private client(): S3Client {
    if (!this.internal) throw new ServiceUnavailableException('Media storage is not configured');
    return this.internal;
  }

  /** Stream a file from disk into the bucket (multipart for anything large). */
  async putFile(key: string, path: string, contentType: string): Promise<void> {
    const upload = new Upload({
      client: this.client(),
      params: { Bucket: this.bucket, Key: key, Body: createReadStream(path), ContentType: contentType },
      queueSize: 2,
      partSize: 8 * 1024 * 1024,
    });
    await upload.done();
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (e) {
      this.logger.warn(`delete ${key}: ${(e as Error).message}`);
    }
  }

  /** A GET URL on the public endpoint, valid for `seconds`. */
  async presignGet(key: string, contentType?: string, seconds = 3600): Promise<string> {
    if (!this.external) throw new ServiceUnavailableException('Media storage is not configured');
    return getSignedUrl(this.external, new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentType: contentType }), { expiresIn: seconds });
  }
}
