-- 모델 코드를 3개 필드로 분리: code(기본 모델코드), axle(축), cabin(캐빈)
-- 기존 unique(code, model_year) → unique(code, axle, cabin, model_year)

ALTER TABLE models
  ADD COLUMN IF NOT EXISTS axle  TEXT,
  ADD COLUMN IF NOT EXISTS cabin TEXT;

-- 기존 유니크 제약 제거 후 새 제약 추가
ALTER TABLE models DROP CONSTRAINT IF EXISTS models_code_model_year_key;
ALTER TABLE models ADD CONSTRAINT models_code_axle_cabin_year_key
  UNIQUE (code, axle, cabin, model_year);

-- 필터 성능용 인덱스
CREATE INDEX IF NOT EXISTS idx_models_axle  ON models(axle);
CREATE INDEX IF NOT EXISTS idx_models_cabin ON models(cabin);
