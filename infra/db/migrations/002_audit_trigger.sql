-- Audit trigger: records every INSERT/UPDATE/DELETE on licences and
-- seat_assignments in audit_log, in the same transaction as the change.

CREATE FUNCTION audit_trigger() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, row_id, action, old_data, new_data)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, NULL, to_jsonb(NEW));

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, row_id, action, old_data, new_data)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW));

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, row_id, action, old_data, new_data)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD), NULL);
  END IF;

  -- The return value of an AFTER trigger is ignored.
  RETURN NULL;
END;
$$;

CREATE TRIGGER licences_audit
  AFTER INSERT OR UPDATE OR DELETE ON licences
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER seat_assignments_audit
  AFTER INSERT OR UPDATE OR DELETE ON seat_assignments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
