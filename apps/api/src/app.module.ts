import { Module } from "@nestjs/common";
import { DbModule } from "./db.module.js";

@Module({
  imports: [DbModule],
})
export class AppModule {}
