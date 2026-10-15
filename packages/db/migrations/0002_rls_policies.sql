-- Role Creation (Conditional)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'growthomic_app') THEN
    CREATE ROLE growthomic_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'growthomic_platform_admin') THEN
    CREATE ROLE growthomic_platform_admin NOLOGIN NOSUPERUSER;
  END IF;
END
$$;

-- App Role Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO growthomic_app;
-- audit_logs is append-only
REVOKE UPDATE, DELETE ON audit_logs FROM growthomic_app;

-- Platform Admin Grants
GRANT SELECT ON ALL TABLES IN SCHEMA public TO growthomic_platform_admin;

-- ENABLE RLS ON TENANT TABLES
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;

ALTER TABLE test_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_items FORCE ROW LEVEL SECURITY;


-- TENANT MEMBERSHIPS POLICIES
CREATE POLICY "tenant_memberships_select" ON tenant_memberships FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "tenant_memberships_write" ON tenant_memberships FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- AUDIT LOGS POLICIES
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "audit_logs_write" ON audit_logs FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
-- NO UPDATE/DELETE policy for audit_logs since it's revoked anyway

-- OUTBOX EVENTS POLICIES
CREATE POLICY "outbox_events_select" ON outbox_events FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "outbox_events_write" ON outbox_events FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- TEST ITEMS POLICIES
CREATE POLICY "test_items_select" ON test_items FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "test_items_write" ON test_items FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- USERS (Global - no RLS required for isolation, but if we need, we can add later)
-- TENANTS (Global - no RLS)
-- ROLES (Global/System + Custom - accessed via tenant_id filter)
-- PERMISSIONS (Global)
-- ROLE_PERMISSIONS (Global)
