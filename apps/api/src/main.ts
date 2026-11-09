import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule);
app.enableCors({ origin: "http://localhost:5173" }); // web app only
app.enableShutdownHooks();
await app.listen(process.env.PORT ?? 3000);
