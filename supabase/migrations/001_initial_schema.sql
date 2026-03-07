-- MB Trucks Korea 사양 뷰어 — 초기 스키마 v2
-- CLAUDE_v2.md 기반
-- Supabase SQL Editor에서 실행

-- ======================================
-- 1. 사용자 프로필 및 역할
-- ======================================
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL CHECK (role IN ('admin', 'sales')) DEFAULT 'sales',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ======================================
-- 2. 모델 기본 정보
-- ======================================
CREATE TABLE IF NOT EXISTS models (
  id          SERIAL PRIMARY KEY,
  series      TEXT NOT NULL CHECK (series IN ('Actros', 'Arocs', 'Atego')),
  code        TEXT NOT NULL,
  code_desc   TEXT,
  name_ko     TEXT NOT NULL,
  model_year  TEXT NOT NULL,             -- 'MY26' 형태
  badge       TEXT CHECK (badge IN ('new', 'updated')),
  is_visible  BOOLEAN DEFAULT TRUE,      -- false = 영업직원에게 숨김
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(code, model_year)
);
CREATE INDEX IF NOT EXISTS idx_models_series  ON models(series);
CREATE INDEX IF NOT EXISTS idx_models_year    ON models(model_year);
CREATE INDEX IF NOT EXISTS idx_models_visible ON models(is_visible);

-- ======================================
-- 3. 사양 항목
-- ======================================
CREATE TABLE IF NOT EXISTS specs (
  id            SERIAL PRIMARY KEY,
  model_id      INT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  spec_key      TEXT NOT NULL,           -- 영문 라벨/키 (비교 매칭용)
  spec_value    TEXT NOT NULL,           -- 코드값 (code_dict 참조)
  label_ko      TEXT,                    -- 항목 국문명 (직접 입력)
  use_translate BOOLEAN DEFAULT TRUE,    -- code_dict 번역 사용 여부
  is_color      BOOLEAN DEFAULT FALSE,   -- 컬러 코드 여부
  is_hidden     BOOLEAN DEFAULT FALSE,   -- 해당 사양 항목 숨김 (개별)
  sort_order    INT DEFAULT 0,
  UNIQUE(model_id, spec_key)
);
CREATE INDEX IF NOT EXISTS idx_specs_model  ON specs(model_id);
CREATE INDEX IF NOT EXISTS idx_specs_hidden ON specs(is_hidden);

-- ======================================
-- 4. 코드 번역 사전 (엑셀 기반)
-- ======================================
-- 마스터 파일: code/mb_codes_total_translated.xlsx
-- A열=카테고리, B열=영문코드, C열=국문번역, D열=Y/N, E열=HEX
CREATE TABLE IF NOT EXISTS code_dict (
  id          SERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,      -- 엑셀 B열
  name_en     TEXT,                      -- 영문 설명 (선택)
  name_ko     TEXT NOT NULL,             -- 엑셀 C열 (사이트 표시값)
  category    TEXT,                      -- 엑셀 A열
  hex_color   TEXT CHECK (
    hex_color ~ '^#[0-9a-fA-F]{6}$' OR hex_color IS NULL
  ),                                     -- 엑셀 E열
  is_hidden   BOOLEAN DEFAULT FALSE,     -- 엑셀 D열 N=숨김 / 관리자 화면 토글
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dict_code     ON code_dict(code);
CREATE INDEX IF NOT EXISTS idx_dict_category ON code_dict(category);
CREATE INDEX IF NOT EXISTS idx_dict_hidden   ON code_dict(is_hidden);

-- ======================================
-- 5. updated_at 자동 갱신 트리거
-- ======================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_models
  BEFORE UPDATE ON models FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_profiles
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_code_dict
  BEFORE UPDATE ON code_dict FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ======================================
-- 6. 신규 사용자 → profiles 자동 생성
-- ======================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
