-- Record who made each audited change. The API sets app.user_id with
-- set_config(..., true) inside its transaction; scripts and psql leave it unset.

ALTER TABLE audit_log ADD COLUMN changed_by uuid REFERENCES users (id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION audit_trigger() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  -- NULL if unset; '' once a SET LOCAL has ended in this session
  v_changed_by uuid := NULLIF(current_setting('app.user_id', true), '')::uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, row_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, NULL, to_jsonb(NEW), v_changed_by);

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, row_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW), v_changed_by);

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, row_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD), NULL, v_changed_by);
  END IF;

  RETURN NULL;
END;
$$;
