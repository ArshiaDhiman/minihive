import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule);
app.enableCors({ origin: "http://localhost:5173" }); // web app only
// Validate request bodies against their DTOs; reject unknown fields
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
app.enableShutdownHooks();
await app.listen(process.env.PORT ?? 3000);
