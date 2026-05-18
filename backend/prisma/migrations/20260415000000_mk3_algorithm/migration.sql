-- MK3 알고리즘 마이그레이션
-- UserWeight: AHP 가중치 → GTT 계수 (alpha/beta/gamma/tMax)
-- DongScore: 정규화 서브스코어 → 원시 시간 컴포넌트
-- ScoreSnapshot: GTT 필드 추가, finalScore 옵셔널화

-- ────────────────────────────────────────────
-- UserWeight 재설계
-- ────────────────────────────────────────────
ALTER TABLE "UserWeight"
  ADD COLUMN "alpha" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
  ADD COLUMN "beta"  DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  ADD COLUMN "gamma" DOUBLE PRECISION NOT NULL DEFAULT 13.0,
  ADD COLUMN "tMax"  INTEGER          NOT NULL DEFAULT 0;

ALTER TABLE "UserWeight"
  DROP COLUMN IF EXISTS "time",
  DROP COLUMN IF EXISTS "transfer",
  DROP COLUMN IF EXISTS "walk",
  DROP COLUMN IF EXISTS "wait",
  DROP COLUMN IF EXISTS "access",
  DROP COLUMN IF EXISTS "cr";

-- ────────────────────────────────────────────
-- DongScore 재설계
-- 기존 데이터는 MK3와 구조 불일치 → 전체 삭제 후 재축적
-- ────────────────────────────────────────────
DELETE FROM "DongScore";

ALTER TABLE "DongScore"
  ADD COLUMN "tInvehicle"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "tWalk"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "tWait"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "nTransfer"   INTEGER          NOT NULL DEFAULT 0,
  ADD COLUMN "hasLowFloor" BOOLEAN          NOT NULL DEFAULT false;

ALTER TABLE "DongScore"
  DROP COLUMN IF EXISTS "sTime",
  DROP COLUMN IF EXISTS "sTransfer",
  DROP COLUMN IF EXISTS "sWalk",
  DROP COLUMN IF EXISTS "sWait",
  DROP COLUMN IF EXISTS "sAccess";

-- ────────────────────────────────────────────
-- ScoreSnapshot: GTT 필드 추가 + finalScore 옵셔널
-- ────────────────────────────────────────────
ALTER TABLE "ScoreSnapshot"
  ALTER COLUMN "finalScore" DROP NOT NULL;

ALTER TABLE "ScoreSnapshot"
  ADD COLUMN IF NOT EXISTS "gtt"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "grade" TEXT,
  ADD COLUMN IF NOT EXISTS "alpha" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "beta"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "gamma" DOUBLE PRECISION;
