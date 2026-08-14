-- Reference data for the College / Department dropdowns.
--
-- These live in the BACKEND database (gateways2026_backend), not in this repo's
-- local seed — the app reads them from `GET /api/v1/reference/colleges` and
-- `/departments`. `db:push` creates the tables but inserts nothing, so without
-- this the dropdowns render empty with no error to explain why.
--
-- Run against whichever environment you are setting up:
--
--   docker exec -i gateways2026_local_mysql \
--     mysql -uroot -proot_password gateways2026_db < scripts/seed-reference.sql
--
-- Safe to re-run: every row is an upsert keyed on a stable id, so this can be
-- applied again after a `db:push` without duplicating anything or disturbing
-- rows that already point at a college.

-- ── Colleges ────────────────────────────────────────────────────────────────
-- Ten Bengaluru institutions, CHRIST first as the host university, plus an
-- "Other" escape hatch: a national fest takes entries from outside the city and
-- a fixed list with no fallback silently blocks those registrations.

INSERT INTO colleges (id, name, active) VALUES
  ('col-christ', 'CHRIST (Deemed to be University)',              1),
  ('col-rvce',   'RV College of Engineering',                     1),
  ('col-pes',    'PES University',                                1),
  ('col-bmsce',  'BMS College of Engineering',                    1),
  ('col-msrit',  'MS Ramaiah Institute of Technology',            1),
  ('col-dsce',   'Dayananda Sagar College of Engineering',        1),
  ('col-nmit',   'Nitte Meenakshi Institute of Technology',       1),
  ('col-sjc',    'St. Joseph''s University',                      1),
  ('col-cmrit',  'CMR Institute of Technology',                   1),
  ('col-nie',    'The National Institute of Engineering',         1),
  ('col-other',  'Other',                                         1)
ON DUPLICATE KEY UPDATE name = VALUES(name), active = VALUES(active);

-- ── Departments ─────────────────────────────────────────────────────────────
-- `college_id` is NULL on purpose: these are offered by every institution, so
-- scoping each one to a college would mean 11 near-identical copies and a
-- dropdown that empties itself whenever someone picks "Other". The backend's
-- `listDepartments(db, collegeId)` filter still works — a NULL row is simply
-- valid everywhere.

INSERT INTO departments (id, college_id, name, active) VALUES
  ('dep-cse',    NULL, 'Computer Science',              1),
  ('dep-ise',    NULL, 'Information Science',           1),
  ('dep-aiml',   NULL, 'AI & Machine Learning',         1),
  ('dep-ece',    NULL, 'Electronics & Communication',   1),
  ('dep-eee',    NULL, 'Electrical & Electronics',      1),
  ('dep-mech',   NULL, 'Mechanical',                    1),
  ('dep-civil',  NULL, 'Civil',                         1),
  ('dep-bca',    NULL, 'Computer Applications (BCA/MCA)', 1),
  ('dep-bba',    NULL, 'Business Administration',       1),
  ('dep-design', NULL, 'Design',                        1),
  ('dep-other',  NULL, 'Other',                         1)
ON DUPLICATE KEY UPDATE name = VALUES(name), active = VALUES(active);
