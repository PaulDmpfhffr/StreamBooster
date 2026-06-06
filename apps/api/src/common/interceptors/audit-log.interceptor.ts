import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, url, user } = req;
    const userId = user?.id ?? 'anonymous';

    return next.handle().pipe(
      tap(() => {
        this.logger.log(`[ADMIN] ${method} ${url} — user:${userId}`);
      }),
    );
  }
}
