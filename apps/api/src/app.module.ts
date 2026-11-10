import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./auth/auth.js";
import { DbModule } from "./db/db.module.js";
import { MeController } from "./me/me.controller.js";
import { MeService } from "./me/me.service.js";
import { OrgsController } from "./orgs/orgs.controller.js";
import { OrgsService } from "./orgs/orgs.service.js";
import { SeatsController } from "./seats/seats.controller.js";
import { SeatsService } from "./seats/seats.service.js";

@Module({
  imports: [DbModule],
  controllers: [MeController, OrgsController, SeatsController],
  providers: [
    MeService,
    OrgsService,
    SeatsService,
    // Auth required on every route by default
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
