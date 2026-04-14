-- health_check 테이블에 마지막 ping 시각 컬럼 추가
-- 이 SQL을 Supabase SQL Editor에서 직접 실행하세요.

alter table public.health_check
  add column if not exists pinged_at timestamptz default now();

-- 기존 행(id=1) 초기화
update public.health_check set pinged_at = now() where id = 1;
