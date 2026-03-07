-- RLS (Row Level Security) 정책 v2
-- CLAUDE_v2.md 기반
-- 주의: profiles 자기참조 재귀 방지를 위해 get_my_role() SECURITY DEFINER 함수 사용

ALTER TABLE profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE models    ENABLE ROW LEVEL SECURITY;
ALTER TABLE specs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_dict ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 헬퍼 함수: RLS 재귀 방지
-- SECURITY DEFINER → RLS 우회하여 profiles 직접 조회
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- profiles
-- ============================================================
-- 본인 조회
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- admin은 전체 조회
CREATE POLICY "profiles_admin_select"
  ON profiles FOR SELECT
  USING (get_my_role() = 'admin');

-- 본인 업데이트 (이름 등)
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- admin은 전체 수정 (역할 변경 등)
CREATE POLICY "profiles_admin_all"
  ON profiles FOR ALL
  USING (get_my_role() = 'admin');

-- ============================================================
-- models
-- ============================================================
-- sales: is_visible=true 모델만, admin: 전체
CREATE POLICY "models_select"
  ON models FOR SELECT
  USING (
    is_visible = TRUE
    OR get_my_role() = 'admin'
  );

-- admin만 등록/수정/삭제
CREATE POLICY "models_admin_write"
  ON models FOR ALL
  USING (get_my_role() = 'admin');

-- ============================================================
-- specs
-- ============================================================
-- 인증 사용자 모두 조회 가능
CREATE POLICY "specs_select"
  ON specs FOR SELECT
  USING (auth.role() = 'authenticated');

-- admin만 수정
CREATE POLICY "specs_admin_write"
  ON specs FOR ALL
  USING (get_my_role() = 'admin');

-- ============================================================
-- code_dict
-- ============================================================
-- 인증 사용자 모두 조회 (번역 참조용)
CREATE POLICY "dict_select"
  ON code_dict FOR SELECT
  USING (auth.role() = 'authenticated');

-- admin만 수정
CREATE POLICY "dict_admin_write"
  ON code_dict FOR ALL
  USING (get_my_role() = 'admin');
