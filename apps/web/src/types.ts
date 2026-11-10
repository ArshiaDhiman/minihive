// Shapes of the API responses

export type OrgUser = { id: string; name: string; email: string; role: string };

export type Licence = {
  id: string;
  productCode: string;
  seats: number;
  used: number;
  validTo: string;
  active: boolean;
  holders: { userId: string; name: string }[];
};

export type AuditEntry = {
  id: string;
  tableName: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  oldData: Record<string, string> | null;
  newData: Record<string, string> | null;
  changedAt: string;
  changedBy: string | null;
};
