import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { type AuthUser, CurrentUser } from "../auth/auth.js";
import { CreateLicenceDto, CreateOrgDto } from "./orgs.dto.js";
import {
  type AuditEntry,
  type Licence,
  type Org,
  type OrgUser,
  OrgsService,
} from "./orgs.service.js";

@Controller("orgs")
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Post()
  createOrg(@CurrentUser() user: AuthUser, @Body() body: CreateOrgDto): Promise<Org> {
    return this.orgs.createOrg(user, body.name);
  }

  @Post(":orgId/licences")
  createLicence(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body() body: CreateLicenceDto,
  ): Promise<{ id: string }> {
    return this.orgs.createLicence(user, orgId, body);
  }

  @Get(":orgId/users")
  listUsers(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ): Promise<OrgUser[]> {
    return this.orgs.listUsers(user, orgId);
  }

  @Get(":orgId/licences")
  listLicences(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ): Promise<Licence[]> {
    return this.orgs.listLicences(user, orgId);
  }

  @Get(":orgId/audit")
  listAudit(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
  ): Promise<AuditEntry[]> {
    return this.orgs.listAudit(user, orgId);
  }
}
