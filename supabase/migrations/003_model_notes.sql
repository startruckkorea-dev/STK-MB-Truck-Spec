-- 003_model_notes.sql
-- 모델 보충 설명 노트 — 코드 사전에 없는 사양 정보 (예: 엔진 토크, 변속기 단수)

-- ======================================
-- 테이블 생성
-- ======================================
CREATE TABLE IF NOT EXISTS model_notes (
  id          SERIAL PRIMARY KEY,
  model_id    INT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,          -- 항목명. 예: '엔진 토크'
  content     TEXT NOT NULL,          -- 값.   예: '1700 Nm @ 1100-1400 rpm'
  sort_order  INT NOT NULL DEFAULT 0, -- 표시 순서 (낮을수록 먼저 표시)
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_notes_model ON model_notes(model_id);
CREATE INDEX IF NOT EXISTS idx_model_notes_order ON model_notes(model_id, sort_order);

-- ======================================
-- updated_at 자동 갱신 트리거
-- (001_initial_schema.sql의 update_updated_at() 함수 재사용)
-- ======================================
CREATE OR REPLACE TRIGGER trg_model_notes
  BEFORE UPDATE ON model_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ======================================
-- RLS 활성화 및 정책
-- (specs 테이블 패턴과 동일)
-- ======================================
ALTER TABLE model_notes ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자 전체 조회 가능
CREATE POLICY "model_notes_select"
  ON model_notes FOR SELECT
  USING (auth.role() = 'authenticated');

-- admin만 CUD
CREATE POLICY "model_notes_admin_write"
  ON model_notes FOR ALL
  USING (get_my_role() = 'admin');
