-- Development/test data only: never run against production.
-- Users, memberships and seats are added in Phase 2, once Cognito has created
-- the users and their sub values exist.
--
-- Fixed ids so scripts and tests can refer to rows directly.
-- The first digit says what the row is: 1 = organisation, 2 = product, 3 = licence.
-- ON CONFLICT (id) DO NOTHING makes the seed safe to run more than once.

INSERT INTO organisations (id, name) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Garage A'),
  ('10000000-0000-4000-8000-000000000002', 'Garage B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, code, name) VALUES
  ('20000000-0000-4000-8000-000000000001', 'REPAIR_INFO', 'RepairInfo'),
  ('20000000-0000-4000-8000-000000000002', 'SERVICE_BOOK', 'Service Book')
ON CONFLICT (id) DO NOTHING;

-- Dates are relative to now() so "active" and "expired" stay true whenever this runs.
INSERT INTO licences (id, org_id, product_id, seats, valid_from, valid_to) VALUES
  -- Garage A: REPAIR_INFO, 2 seats, active
  ('30000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001',
   2, now() - interval '1 month', now() + interval '1 year'),
  -- Garage B: REPAIR_INFO, 1 seat, expired
  ('30000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000002',
   '20000000-0000-4000-8000-000000000001',
   1, now() - interval '2 years', now() - interval '1 year')
ON CONFLICT (id) DO NOTHING;
