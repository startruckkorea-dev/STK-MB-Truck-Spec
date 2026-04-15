-- 008_code_desc_unique.sql
-- code_desc(기타특징)가 다르면 같은 code+axle+cabin+model_year 조합도 등록 허용
-- 기존 unique 제약 → code_desc 포함 expression index로 교체

-- 기존 제약 제거
ALTER TABLE models DROP CONSTRAINT IF EXISTS models_code_axle_cabin_year_key;

-- code_desc가 NULL이면 빈 문자열로 처리해서 유니크 인덱스 적용
-- ex) (2863LS, 6x2, G5F, MY26, '') 과 (2863LS, 6x2, G5F, MY26, '챔피언스 에디션') 은 별개
CREATE UNIQUE INDEX IF NOT EXISTS models_code_axle_cabin_year_desc_key
  ON models (code, axle, cabin, model_year, COALESCE(code_desc, ''));
