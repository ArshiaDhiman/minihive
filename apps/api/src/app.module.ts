import { Module, ValidationPipe } from "@nestjs/common";
import { APP_GUARD, APP_PIPE } from "@nestjs/core";
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
    AuthGuard,
    // Auth required on every route by default (useExisting so tests can swap AuthGuard)
    { provide: APP_GUARD, useExisting: AuthGuard },
    // Validate request bodies against their DTOs; reject unknown fields
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    },
  ],
})
export class AppModule {}
