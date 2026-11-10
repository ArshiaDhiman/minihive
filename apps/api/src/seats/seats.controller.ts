import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { type AuthUser, CurrentUser } from "../auth/auth.js";
import { AssignSeatDto } from "./seats.dto.js";
import { SeatsService } from "./seats.service.js";

@Controller("licences/:licenceId/seats")
export class SeatsController {
  constructor(private readonly seats: SeatsService) {}

  @Post()
  assign(
    @CurrentUser() user: AuthUser,
    @Param("licenceId", ParseUUIDPipe) licenceId: string,
    @Body() body: AssignSeatDto,
  ): Promise<{ seatId: string }> {
    return this.seats.assign(user, licenceId, body.userId);
  }

  @Delete(":userId")
  @HttpCode(204)
  revoke(
    @CurrentUser() user: AuthUser,
    @Param("licenceId", ParseUUIDPipe) licenceId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.seats.revoke(user, licenceId, userId);
  }
}
