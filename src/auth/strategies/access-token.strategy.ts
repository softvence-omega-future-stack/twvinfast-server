import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

const JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'access_secret_fallback';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: JWT_ACCESS_SECRET,
    } as any);
  }

  validate(payload: any) {
    // This becomes req.user
    return {
      sub: payload.sub, // id (number)
      email: payload.email,
      role: payload.role,
    };
  }
}
