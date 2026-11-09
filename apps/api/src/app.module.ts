import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./auth.js";
import { DbModule } from "./db.module.js";
import { MeController } from "./me.controller.js";
import { MeService } from "./me.service.js";

@Module({
  imports: [DbModule],
  controllers: [MeController],
  providers: [
    MeService,
    // Auth required on every route by default
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
