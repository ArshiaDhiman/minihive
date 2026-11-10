import { Type } from "class-transformer";
import { IsDate, IsInt, IsNotEmpty, IsString, Min } from "class-validator";
import type { NewLicence } from "./orgs.service.js";

export class CreateOrgDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class CreateLicenceDto implements NewLicence {
  @IsString()
  @IsNotEmpty()
  productCode!: string;

  @IsInt()
  @Min(1)
  seats!: number;

  @Type(() => Date)
  @IsDate()
  validFrom!: Date;

  @Type(() => Date)
  @IsDate()
  validTo!: Date;
}
