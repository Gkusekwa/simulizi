import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export const RAW_RESPONSE = 'rawResponse';
/** Opt a handler out of the envelope (file downloads, rendered HTML). */
export const RawResponse = () => SetMetadata(RAW_RESPONSE, true);

export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Every successful response is { success, data, meta?, timestamp } -- the same
 * envelope familia and hazina use, so the web client and the Flutter app can
 * share one unwrapping layer. A paginated { data, page, pageSize, total }
 * result is lifted into meta.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiEnvelope<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiEnvelope<T> | T> {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE, [
      context.getHandler(),
      context.getClass(),
    ]);
    return next.handle().pipe(
      map((payload) => {
        if (raw || payload instanceof StreamableFile || Buffer.isBuffer(payload)) {
          return payload as T;
        }
        const timestamp = new Date().toISOString();
        if (
          payload &&
          typeof payload === 'object' &&
          'data' in payload &&
          'total' in payload &&
          'page' in payload
        ) {
          const { data, page, pageSize, total } = payload as Record<string, unknown>;
          return { success: true, data: data as T, meta: { page, pageSize, total }, timestamp };
        }
        return { success: true, data: payload as T, timestamp };
      }),
    );
  }
}
