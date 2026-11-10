import { Controller, Get } from "@nestjs/common";
import { type AuthUser, CurrentUser } from "../auth/auth.js";
import { type Me, MeService } from "./me.service.js";

@Controller("me")
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  me(@CurrentUser() user: AuthUser): Promise<Me> {
    return this.meService.getMe(user);
  }
}
