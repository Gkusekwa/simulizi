import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
/** Route needs no bearer token. A valid token is still read if present. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
