-- Spec 1.5: per-item gate stamp. Every story that passes the QC gate is stamped
-- with qc_passed_at. The nightly sweep asserts recently published stories carry
-- it — an un-stamped publish means a story reached the feed without passing the
-- gate (a bypassed gate), which is a defect to flag. Distinct from qc_swept_at
-- (when the reconciliation sweep last re-checked it).
alter table stories add column if not exists qc_passed_at timestamptz null;
