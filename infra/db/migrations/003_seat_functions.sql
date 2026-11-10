-- Seat assign/revoke. The API goes through these so the rules, the lock and
-- the outbox event always run in one transaction.

CREATE FUNCTION assign_seat(p_licence_id uuid, p_user_id uuid, p_assigned_by uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_licence licences%ROWTYPE;
  v_used    integer;
  v_seat_id uuid;
BEGIN
  -- Row lock: concurrent assigns on this licence queue here, so the last seat can't be taken twice
  SELECT * INTO v_licence FROM licences WHERE id = p_licence_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'licence not found';
  END IF;

  IF NOT (v_licence.valid_from <= now() AND now() < v_licence.valid_to) THEN
    RAISE EXCEPTION 'licence is not active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = p_user_id AND org_id = v_licence.org_id
  ) THEN
    RAISE EXCEPTION 'user is not a member of this organisation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM seat_assignments
    WHERE licence_id = p_licence_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'user already has a seat on this licence';
  END IF;

  SELECT count(*) INTO v_used FROM seat_assignments WHERE licence_id = p_licence_id;
  IF v_used >= v_licence.seats THEN
    RAISE EXCEPTION 'no free seats on this licence';
  END IF;

  INSERT INTO seat_assignments (licence_id, user_id, assigned_by)
  VALUES (p_licence_id, p_user_id, p_assigned_by)
  RETURNING id INTO v_seat_id;

  -- Outbox event, same transaction as the seat
  INSERT INTO outbox (type, payload)
  SELECT 'SeatAssigned', jsonb_build_object(
    'seatId',      v_seat_id,
    'licenceId',   p_licence_id,
    'userSub',     u.idp_sub,
    'productCode', p.code
  )
  FROM users u, products p
  WHERE u.id = p_user_id AND p.id = v_licence.product_id;

  RETURN v_seat_id;
END;
$$;

-- Returns false if there was no seat to revoke
CREATE FUNCTION revoke_seat(p_licence_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM seat_assignments
  WHERE licence_id = p_licence_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO outbox (type, payload)
  SELECT 'SeatRevoked', jsonb_build_object(
    'licenceId',   p_licence_id,
    'userSub',     u.idp_sub,
    'productCode', p.code
  )
  FROM users u, licences l
  JOIN products p ON p.id = l.product_id
  WHERE u.id = p_user_id AND l.id = p_licence_id;

  RETURN true;
END;
$$;
