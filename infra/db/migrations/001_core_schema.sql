-- Core schema: organisations, users, licences, seats, audit log and outbox.
-- The migration runner wraps this file in a transaction, so no BEGIN/COMMIT here.

CREATE TABLE organisations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  idp_sub    text        NOT NULL UNIQUE, -- Cognito "sub" claim
  email      text        NOT NULL UNIQUE,
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  org_id  uuid NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  role    text NOT NULL CHECK (role IN ('org_admin', 'member')),
  PRIMARY KEY (user_id, org_id)
);
-- The PK covers lookups by user_id; "users in an org" needs org_id.
CREATE INDEX memberships_org_id_idx ON memberships (org_id);

CREATE TABLE products (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE, -- e.g. REPAIR_INFO
  name text NOT NULL
);

CREATE TABLE licences (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        NOT NULL REFERENCES organisations (id),
  product_id uuid        NOT NULL REFERENCES products (id),
  seats      integer     NOT NULL CHECK (seats > 0),
  valid_from timestamptz NOT NULL,
  valid_to   timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to > valid_from)
);
CREATE INDEX licences_org_id_idx ON licences (org_id);
CREATE INDEX licences_product_id_idx ON licences (product_id);

CREATE TABLE seat_assignments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id  uuid        NOT NULL REFERENCES licences (id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid        REFERENCES users (id) ON DELETE SET NULL,
  UNIQUE (licence_id, user_id)
);
-- The unique constraint covers lookups by licence_id; "my seats" needs user_id.
CREATE INDEX seat_assignments_user_id_idx ON seat_assignments (user_id);

CREATE TABLE audit_log (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name text        NOT NULL,
  row_id     uuid        NOT NULL,
  action     text        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data   jsonb,      -- null on INSERT
  new_data   jsonb,      -- null on DELETE
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_row_idx ON audit_log (table_name, row_id, changed_at DESC);

CREATE TABLE outbox (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text        NOT NULL, -- SeatAssigned, SeatRevoked, UserInvited
  payload      jsonb       NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz -- null until the worker has published it
);
-- The worker only ever looks for unpublished rows, so index just those.
CREATE INDEX outbox_unpublished_idx ON outbox (created_at) WHERE published_at IS NULL;
