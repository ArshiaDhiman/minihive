import { IsUUID } from "class-validator";

export class AssignSeatDto {
  @IsUUID()
  userId!: string;
}
