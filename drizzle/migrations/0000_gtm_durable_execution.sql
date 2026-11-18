CREATE TABLE public.gtm_aggregates (
  session_id text NOT NULL, tenant text NOT NULL, version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (session_id, tenant));
CREATE TABLE public.gtm_events (
  id bigserial PRIMARY KEY, session_id text NOT NULL, tenant text NOT NULL, organization text NOT NULL,
  source text NOT NULL, stream text NOT NULL, revision int NOT NULL, occurred_time int NOT NULL, known_time int NOT NULL,
  payload jsonb NOT NULL, payload_hash text NOT NULL, registry_version bigint NOT NULL, origin text NOT NULL DEFAULT 'fixture',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, tenant, source, stream, revision, payload_hash));
CREATE TABLE public.gtm_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id text NOT NULL, tenant text NOT NULL, case_id text NOT NULL,
  key jsonb NOT NULL, proposal_id text NOT NULL, amount_cents bigint NOT NULL, currency text NOT NULL,
  proposal_digest text NOT NULL, decision_time int NOT NULL, approval jsonb NOT NULL, permission_ref text NOT NULL,
  proof_digest text NOT NULL, registry_version bigint NOT NULL, status text NOT NULL DEFAULT 'prepared',
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.gtm_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id text NOT NULL, tenant text NOT NULL, intent_id uuid NOT NULL,
  idempotency_key text NOT NULL, request_hash text NOT NULL, status text NOT NULL, reason text NOT NULL,
  dispatch_time int NOT NULL, observed_version bigint NOT NULL, effect_id uuid, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, tenant, idempotency_key));
CREATE TABLE public.gtm_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id text NOT NULL, tenant text NOT NULL,
  intent_id uuid NOT NULL UNIQUE, effect_key text NOT NULL UNIQUE, payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.gtm_payment_events (
  id bigserial PRIMARY KEY, session_id text NOT NULL, tenant text NOT NULL, receipt_id text NOT NULL, kind text NOT NULL,
  payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, tenant, receipt_id, kind));

GRANT ALL ON public.gtm_aggregates, public.gtm_events, public.gtm_intents, public.gtm_dispatches, public.gtm_effects, public.gtm_payment_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.gtm_events_id_seq, public.gtm_payment_events_id_seq TO service_role;
ALTER TABLE public.gtm_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtm_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtm_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtm_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtm_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtm_payment_events ENABLE ROW LEVEL SECURITY;

-- Append a trusted event under the aggregate lock; bumps version only on accepted mutation.
CREATE OR REPLACE FUNCTION public.gtm_append_event(
  p_session text, p_tenant text, p_org text, p_source text, p_stream text, p_revision int,
  p_occurred int, p_known int, p_payload jsonb, p_hash text, p_origin text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v bigint; dup boolean; conflict boolean;
BEGIN
  INSERT INTO gtm_aggregates(session_id, tenant) VALUES (p_session, p_tenant) ON CONFLICT DO NOTHING;
  SELECT version INTO v FROM gtm_aggregates WHERE session_id = p_session AND tenant = p_tenant FOR UPDATE;
  SELECT EXISTS (SELECT 1 FROM gtm_events WHERE session_id=p_session AND tenant=p_tenant AND source=p_source AND stream=p_stream AND revision=p_revision AND payload_hash=p_hash) INTO dup;
  IF dup THEN RETURN jsonb_build_object('status','duplicate','version',v); END IF;
  SELECT EXISTS (SELECT 1 FROM gtm_events WHERE session_id=p_session AND tenant=p_tenant AND source=p_source AND stream=p_stream AND revision=p_revision) INTO conflict;
  v := v + 1;
  UPDATE gtm_aggregates SET version = v WHERE session_id = p_session AND tenant = p_tenant;
  INSERT INTO gtm_events(session_id, tenant, organization, source, stream, revision, occurred_time, known_time, payload, payload_hash, registry_version, origin)
  VALUES (p_session, p_tenant, p_org, p_source, p_stream, p_revision, p_occurred, p_known, p_payload, p_hash, v, p_origin);
  RETURN jsonb_build_object('status', CASE WHEN conflict THEN 'conflict' ELSE 'accepted' END, 'version', v);
END $$;

-- Compare-and-set commit: aggregate lock, version check, idempotency, one effect per intent.
CREATE OR REPLACE FUNCTION public.gtm_commit_dispatch(
  p_session text, p_tenant text, p_intent uuid, p_idem text, p_request_hash text, p_expected_version bigint,
  p_dispatch_time int, p_status text, p_reason text, p_effect_key text, p_effect jsonb, p_fail_before_commit boolean)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v bigint; d gtm_dispatches%ROWTYPE; e_id uuid;
BEGIN
  INSERT INTO gtm_aggregates(session_id, tenant) VALUES (p_session, p_tenant) ON CONFLICT DO NOTHING;
  SELECT version INTO v FROM gtm_aggregates WHERE session_id = p_session AND tenant = p_tenant FOR UPDATE;
  SELECT * INTO d FROM gtm_dispatches WHERE session_id=p_session AND tenant=p_tenant AND idempotency_key=p_idem;
  IF FOUND THEN
    IF d.request_hash <> p_request_hash THEN RETURN jsonb_build_object('outcome','idempotency_conflict'); END IF;
    RETURN jsonb_build_object('outcome','replayed','status',d.status,'reason',d.reason,'effect_id',d.effect_id,'dispatch_id',d.id);
  END IF;
  IF v <> p_expected_version THEN RETURN jsonb_build_object('outcome','stale_version','version',v); END IF;
  IF p_status = 'committed' THEN
    SELECT id INTO e_id FROM gtm_effects WHERE intent_id = p_intent;
    IF FOUND THEN RETURN jsonb_build_object('outcome','already_committed','effect_id',e_id); END IF;
    INSERT INTO gtm_effects(session_id, tenant, intent_id, effect_key, payload) VALUES (p_session, p_tenant, p_intent, p_effect_key, p_effect) RETURNING id INTO e_id;
    UPDATE gtm_intents SET status = 'committed' WHERE id = p_intent;
  ELSE
    UPDATE gtm_intents SET status = 'failed' WHERE id = p_intent AND status = 'prepared';
  END IF;
  INSERT INTO gtm_dispatches(session_id, tenant, intent_id, idempotency_key, request_hash, status, reason, dispatch_time, observed_version, effect_id)
  VALUES (p_session, p_tenant, p_intent, p_idem, p_request_hash, p_status, p_reason, p_dispatch_time, v, e_id) RETURNING * INTO d;
  IF p_fail_before_commit THEN RAISE EXCEPTION 'injected_failure_before_commit'; END IF;
  RETURN jsonb_build_object('outcome','written','status',d.status,'reason',d.reason,'effect_id',e_id,'dispatch_id',d.id);
END $$;

REVOKE ALL ON FUNCTION public.gtm_append_event(text,text,text,text,text,int,int,int,jsonb,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gtm_commit_dispatch(text,text,uuid,text,text,bigint,int,text,text,text,jsonb,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gtm_append_event(text,text,text,text,text,int,int,int,jsonb,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gtm_commit_dispatch(text,text,uuid,text,text,bigint,int,text,text,text,jsonb,boolean) TO service_role;