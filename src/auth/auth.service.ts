import { Injectable } from '@nestjs/common';
import { UserService } from 'src/user/user.service';

@Injectable()
export class AuthService {
  constructor(private readonly UserService: UserService) {}
  userRegister() {
    const user = this.UserService.createUser();
    return user;
  }
}
