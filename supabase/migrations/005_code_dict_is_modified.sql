-- 수정된 코드 여부를 나타내는 Generated Column 추가
-- updated_at > created_at 이면 is_modified = true
ALTER TABLE code_dict
  ADD COLUMN IF NOT EXISTS is_modified BOOLEAN
    GENERATED ALWAYS AS (updated_at > created_at) STORED;

CREATE INDEX IF NOT EXISTS idx_dict_is_modified ON code_dict(is_modified);
