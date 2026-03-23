-- MB Trucks Korea — staff 역할 추가
-- profiles.role: 기존 'admin' | 'sales' → 'admin' | 'staff' | 'sales'
-- staff(본사직원): 코드 열람 가능, 관리자 페이지 접근 불가
-- sales(영업직원): 국문명만 표시, 코드 미노출

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'staff', 'sales'));
