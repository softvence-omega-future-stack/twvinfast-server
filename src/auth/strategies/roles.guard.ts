import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AppRole } from '../enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Roles required for this handler/class
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No role restriction → allow
    }

    // Get logged-in user from request (set by AuthGuard)
    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      throw new ForbiddenException('Access Denied: no role assigned');
    }

    // Prisma returns: user.role = { id, name, scope }
    const userRoleName = user.role.name; // 👈 The actual role string

    // Check if user's role matches required roles
    if (!requiredRoles.includes(userRoleName as AppRole)) {
      throw new ForbiddenException('Access Denied: insufficient role');
    }

    return true;
  }
}
