# 메르세데스-벤츠 트럭 사양 소개 — 시스템 설계서

> **문서 버전:** v2.0  
> **최종 수정:** 2026-02-26  
> **작성:** 상품기획팀  
> **사이트 제목:** 메르세데스-벤츠 트럭 사양 소개

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [사용자 및 역할 정의](#2-사용자-및-역할-정의)
3. [기술 스택](#3-기술-스택)
4. [시스템 아키텍처](#4-시스템-아키텍처)
5. [핵심 데이터 파이프라인](#5-핵심-데이터-파이프라인)
6. [화면별 기능 명세](#6-화면별-기능-명세)
7. [데이터베이스 스키마](#7-데이터베이스-스키마)
8. [코드 표시/숨김 관리 체계](#8-코드-표시숨김-관리-체계)
9. [인증 및 권한 (Auth & RLS)](#9-인증-및-권한)
10. [디자인 시스템](#10-디자인-시스템)
11. [프로젝트 폴더 구조](#11-프로젝트-폴더-구조)
12. [개발 단계별 구현 가이드](#12-개발-단계별-구현-가이드)
13. [배포 및 환경 설정](#13-배포-및-환경-설정)
14. [향후 확장 계획](#14-향후-확장-계획)

---

## 1. 프로젝트 개요

### 1.1 배경

메르세데스-벤츠 트럭 코리아 상품기획팀은 모델별 사양 데이터를 **영문 생산 코드(.docx 워드 파일)** 형태로 관리하고 있다. 영업직원이 고객에게 사양을 안내하려면 매번 수작업으로 엑셀에 국문 변환 후 PDF나 전화로 공유해야 하며, 연식별·모델별 비교가 불가능하다.

### 1.2 해결 목표

| 현재 문제 | 해결 방안 |
|---|---|
| 영문 생산 코드만 존재 | .docx에서 코드 추출 → `mb_code_total_translated` 엑셀 C열 참조 → 국문 자동 변환 |
| 수작업 엑셀 변환·공유 | 웹에서 실시간 조회, 모바일 대응 |
| 모델 간 비교 불가 | 최대 3개 모델 동시 비교 UI |
| 접근 제한 없음 | 계정별 로그인 + 모델 숨기기 기능 |
| 불필요한 코드까지 노출 | 코드별 표시/숨김 관리 체계 |

### 1.3 핵심 가치

- **즉시성:** 현장에서 스마트폰으로 바로 사양 조회
- **정확성:** 마스터 엑셀(`mb_code_total_translated`) 기반 일관된 국문 번역
- **비교 용이성:** 최대 3개 모델 동시 비교, 차이 항목 하이라이트
- **관리 편의성:** 불필요 코드 숨김, 모델별 공개/비공개 제어

---

## 2. 사용자 및 역할 정의

### 2.1 역할별 권한 매트릭스

| 기능 | `sales` 영업직원 | `admin` 관리자(상품기획팀) |
|---|:---:|:---:|
| 공개 모델 목록 조회 | ✅ | ✅ |
| 사양 상세 보기 | ✅ | ✅ |
| 모델 비교 (최대 3개) | ✅ | ✅ |
| 숨겨진 모델 보기 | ❌ | ✅ |
| 모델 공개/숨기기 전환 | ❌ | ✅ |
| .docx 파일 업로드·파싱 | ❌ | ✅ |
| 모델 등록/수정/삭제 | ❌ | ✅ |
| 코드 번역 사전 관리 | ❌ | ✅ |
| 코드 표시/숨김 관리 | ❌ | ✅ |
| 사용자 관리 | ❌ | ✅ |

### 2.2 사용 규모 및 환경

- 예상 사용자: 10~50명
- 인증 방식: Supabase Auth (이메일 + 비밀번호)
- 주 사용 환경: 모바일 브라우저 (영업직원 현장), 데스크탑 (관리자)

---

## 3. 기술 스택

| 영역 | 도구 | 선정 이유 |
|---|---|---|
| 프론트엔드 | React 18 + Vite | 빠른 빌드, 모듈 HMR |
| 라우팅 | React Router v6 | SPA 라우팅 표준 |
| 스타일 | Tailwind CSS | 유틸리티 기반, 화이트 테마 커스텀 용이 |
| 백엔드/DB | Supabase (PostgreSQL) | Auth·DB·Storage 통합, 무료 티어 |
| 인증 | Supabase Auth | 이메일/비밀번호, RLS 연동 |
| 파일 파싱 | mammoth.js | .docx → HTML/텍스트 변환 (브라우저 내 처리) |
| 엑셀 읽기 | SheetJS (xlsx) | mb_code_total_translated 엑셀 파싱 |
| 배포 | Vercel | Git 연동 자동 배포 |
| 상태관리 | React Context + useState | 소규모 앱에 적합 |

---

## 4. 시스템 아키텍처

```
┌───────────────────────────────────────────────────┐
│               사용자 (브라우저)                       │
│          모바일 / 데스크탑 웹 브라우저                   │
└─────────────────────┬─────────────────────────────┘
                      │ HTTPS
                      ▼
┌───────────────────────────────────────────────────┐
│            Vercel (프론트엔드 호스팅)                  │
│            React + Vite 빌드 결과물                    │
│            정적 자산: MB 로고                          │
└─────────────────────┬─────────────────────────────┘
                      │ Supabase JS SDK
                      ▼
┌───────────────────────────────────────────────────┐
│                 Supabase 백엔드                      │
│   ┌────────┐  ┌──────────┐  ┌─────────┐           │
│   │  Auth  │  │ Database │  │ Storage │           │
│   │ (인증)  │  │(PostgreSQL)│ │(원본파일)│           │
│   └────────┘  └──────────┘  └─────────┘           │
│                     │                              │
│              ┌──────┴──────┐                        │
│              │     RLS     │                        │
│              │(행 수준 보안) │                        │
│              └─────────────┘                        │
└───────────────────────────────────────────────────┘
```

---

## 5. 핵심 데이터 파이프라인

이 시스템의 핵심은 **영문 .docx → 코드 추출 → 엑셀 국문 매핑 → 사이트 표시**이다.

### 5.1 전체 흐름

```
[1. 영문 .docx 사양서]
        │
        ▼  mammoth.js (브라우저 내 파싱)
[2. 영문 코드만 추출]
        │   예: "OM471", "G211-12", "M10x22.5"
        │
        ▼  mb_code_total_translated 엑셀 C열 참조
[3. 국문 번역 매핑]
        │   "OM471" → "직렬 6기통 디젤 (OM471)"
        │
        ▼  관리자가 매핑 결과 확인
[4. 표시/숨김 결정]
        │   불필요 코드 → hidden 처리
        │
        ▼  Supabase DB 저장
[5. 사이트에 국문으로 표시]
```

### 5.2 .docx 코드 추출 규칙

- .docx 파일 내 테이블/목록에서 **코드 값만 추출** (설명 텍스트는 무시)
- 코드 패턴 예시: `OM471`, `G211-12`, `6861`, `315/80R22.5`
- **Model Year 코드 인식:** 코드 중 `model year` 또는 `MY`로 시작하는 항목의 뒷자리를 읽어 연식 자동 유추
  - 예: `MY26` → 2026년식 → 사이트에서 **"MY26"** 형태로 표기
  - 예: `Model Year 2025` → **"MY25"**

### 5.3 엑셀 번역 매핑 구조

**마스터 파일:** `mb_code_total_translated.xlsx` (지정 컴퓨터 폴더에 위치)

| 열 | 용도 | 예시 |
|---|---|---|
| A열 | 카테고리 | 엔진, 변속기, 외장 컬러 |
| B열 | 영문 코드 | OM471, G211-12, 6861 |
| **C열** | **국문 번역 (사이트 표시용)** | 직렬 6기통 디젤 (OM471) |
| D열 | 표시 여부 (`Y`/`N`) | Y = 표시, N = 숨김 |
| E열 | HEX 컬러 (선택) | #1a1a1a |

> D열(표시 여부)은 엑셀에서도, 사이트 관리자 화면에서도 관리 가능. DB가 마스터로 우선.

### 5.4 Model Year 표기 규칙

| 원본 코드 | 유추 연식 | 사이트 표기 |
|---|---|---|
| `MY26` | 2026 | MY26 |
| `Model Year 2025` | 2025 | MY25 |
| `MY24 facelift` | 2024 | MY24 |

- 모델 카드와 필터에서 **"MY26"** 형태로 일관 표기
- 관리자가 수동으로 연식을 수정할 수 있음

---

## 6. 화면별 기능 명세

### 6.1 로그인 (`/login`)

| 항목 | 내용 |
|---|---|
| 상단 로고 | MB_Star_Logo_black.png 표시 |
| 사이트 제목 | "메르세데스-벤츠 트럭 사양 소개" |
| 인증 방식 | Supabase Auth (이메일 + 비밀번호) |
| 역할 판별 | 로그인 후 `profiles` 테이블에서 role 조회 |
| 리다이렉트 | `admin` → `/admin/models`, `sales` → `/models` |
| 에러 처리 | 잘못된 자격증명, 네트워크 오류 시 인라인 에러 메시지 |

### 6.2 모델 목록 (`/models`)

**레이아웃:** 흰색 배경, 카드 그리드 (모바일 1열, 태블릿 2열, 데스크탑 3열)

**필터 및 검색:**
- Model Year 드롭다운 (MY26, MY25, MY24 ...)
- 시리즈 탭: Actros / Arocs / Atego / 전체
- 텍스트 검색: 모델 코드, 국문명

**카드 구성요소:**
- 시리즈 배지 (Actros / Arocs / Atego)
- 모델 국문명 + 영문 코드
- Model Year 표기 (예: MY26)
- 상태 배지: `new`(신규) / `updated`(변경)
- 액션 버튼: [사양 상세] / [비교 추가 ☑]

**모델 숨기기 (admin 전용):**
- `sales` 역할: 숨겨진(`is_visible = false`) 모델은 목록에 아예 미표시
- `admin` 역할: 숨겨진 모델도 표시되되, 반투명 + "숨김" 배지
- admin은 카드에서 👁 아이콘으로 공개/숨기기 즉시 전환

**비교 바 (Compare Bar):**
- 하단 고정, 모델 선택 시 슬라이드업
- 최대 3개, 선택된 모델 칩 + 개별 제거
- [비교하기] 버튼 → `/compare` 이동
- 0개 선택 시 자동 숨김

### 6.3 사양 상세 (`/models/:id`)

**구조:**
- 상단: 모델 기본 정보 헤더 (시리즈, 코드, 국문명, MY표기)
- 하단: 카테고리별 접이식(accordion) 사양 테이블

**사양 테이블:**

| 열 | 내용 | 예시 |
|---|---|---|
| 항목명 | 국문 카테고리명 | 엔진 |
| 사양 내용 | code_dict의 국문 번역값 | 직렬 6기통 디젤 (OM471) |

> **영문 코드는 사이트에 표시하지 않음. 국문 번역값만 표시.**
> 번역이 없는 경우(미매핑) → "번역 미등록" 표시 + admin에게만 원본 코드 노출

**특수 처리:**
- `is_color = true` → 컬러 스와치(원형 색상) + 국문 컬러명
- `is_hidden = true` → 사이트에서 비표시 (admin 화면에서는 회색 처리)

### 6.4 모델 비교 (`/compare?ids=1,2,3`)

**레이아웃:** 좌우 나란히 비교 테이블 (2~3개 모델)

**동작 규칙:**
- 동일 값 행: 텍스트 `opacity: 0.4` (흐리게)
- 상이 값 행: 배경 `rgba(0, 173, 239, 0.10)` 하이라이트
- 카테고리별 그룹핑 유지
- 모바일: 가로 스크롤 또는 카드형 전환
- 숨겨진 코드(`is_hidden = true`)는 비교에서도 제외

**비교 기준:**
- 동일 `category` + `spec_key` 기준 행 매칭
- 한 모델에만 존재 → 다른 모델 셀에 "—" 표시

### 6.5 관리자 — 모델 등록 (`/admin/models/new`)

**업로드·파싱 플로우:**

```
[1] .docx 파일 선택 (드래그앤드롭 또는 파일 선택)
         │
         ▼
[2] mammoth.js 브라우저 내 파싱
         │
         ▼
[3] 영문 코드만 자동 추출
    └─ "model year" 코드 감지 → MY표기 자동 생성
         │
         ▼
[4] code_dict 매핑 미리보기
    ├─ 매핑 완료: ✅ 국문 번역 표시
    ├─ 미매핑:   ⚠️ 경고 + 즉석 번역 등록 유도
    └─ 숨김 코드: 회색 처리
         │
         ▼
[5] 기본 정보 입력/확인
    ├─ 시리즈 (Actros / Arocs / Atego)
    ├─ 국문명
    ├─ Model Year (자동 유추값 확인/수정)
    └─ 공개 여부 (is_visible)
         │
         ▼
[6] 저장 → models + specs 테이블 INSERT
```

**기존 모델 수정:** `/admin/models/:id/edit` — 동일 플로우, UPDATE

### 6.6 관리자 — 코드 번역 사전 (`/admin/dict`)

**데이터 소스:** `mb_code_total_translated.xlsx` 엑셀을 초기 임포트 후, 사이트에서 CRUD

| 동작 | 설명 |
|---|---|
| 조회 | 카테고리별 필터 + 검색, 페이지네이션 |
| 등록 | 영문 코드, 국문명(C열), 카테고리, 표시 여부. 컬러는 HEX 추가 |
| 수정 | 인라인 편집 또는 모달 |
| 삭제 | 참조 중인 specs가 있으면 경고 |
| 숨김 토글 | `is_hidden` 토글 — 전체 모델에서 해당 코드 일괄 숨김 |
| 엑셀 재임포트 | 최신 엑셀 업로드 → 기존 데이터와 diff 표시 → 선택 반영 |

**카테고리 목록:** 엔진, 변속기, 차축, 서스펜션, 타이어/휠, 캡, 외장 컬러, 내장, 안전장비, 편의장비, 기타

### 6.7 관리자 — 사용자 관리 (`/admin/users`)

- profiles 테이블 기반 사용자 목록
- 역할(role) 변경: sales ↔ admin
- 계정 활성/비활성 토글

---

## 7. 데이터베이스 스키마

### 7.1 ERD 관계도

```
profiles ──────────────────────────────────────
  id (PK, FK → auth.users)
  name, role, is_active, created_at

models ────────────── specs (1:N)
  id (PK)               id (PK)
  series                 model_id (FK)
  code, code_desc        category
  name_ko                spec_key, spec_value
  model_year (text)      label_ko
  badge                  use_translate, is_color
  is_visible ★           is_hidden ★
  created_at             sort_order
  updated_at

code_dict ─────────── (논리적 참조: specs.spec_value → code_dict.code)
  id (PK)
  code (UNIQUE)
  name_ko                ← 엑셀 C열
  category               ← 엑셀 A열
  hex_color
  is_hidden ★            ← 엑셀 D열
  created_at, updated_at
```

> ★ = 이번 설계에서 신규 추가된 핵심 컬럼

### 7.2 테이블 정의

```sql
-- ======================================
-- 1. 사용자 프로필 및 역할
-- ======================================
CREATE TABLE profiles (
  id          UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin','sales')) DEFAULT 'sales',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_profiles_role ON profiles(role);

-- ======================================
-- 2. 모델 기본 정보
-- ======================================
CREATE TABLE models (
  id          SERIAL PRIMARY KEY,
  series      TEXT NOT NULL CHECK (series IN ('Actros','Arocs','Atego')),
  code        TEXT NOT NULL,
  code_desc   TEXT,
  name_ko     TEXT NOT NULL,
  model_year  TEXT NOT NULL,          -- 'MY26' 형태
  badge       TEXT CHECK (badge IN ('new','updated')),
  is_visible  BOOLEAN DEFAULT TRUE,   -- ★ false=영업직원에게 숨김
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(code, model_year)
);
CREATE INDEX idx_models_series ON models(series);
CREATE INDEX idx_models_year   ON models(model_year);
CREATE INDEX idx_models_visible ON models(is_visible);

-- ======================================
-- 3. 사양 항목
-- ======================================
CREATE TABLE specs (
  id            SERIAL PRIMARY KEY,
  model_id      INT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  spec_key      TEXT NOT NULL,
  spec_value    TEXT NOT NULL,
  label_ko      TEXT,
  use_translate BOOLEAN DEFAULT TRUE,
  is_color      BOOLEAN DEFAULT FALSE,
  is_hidden     BOOLEAN DEFAULT FALSE,  -- ★ 개별 사양 숨김
  sort_order    INT DEFAULT 0,
  UNIQUE(model_id, spec_key)
);
CREATE INDEX idx_specs_model  ON specs(model_id);
CREATE INDEX idx_specs_hidden ON specs(is_hidden);

-- ======================================
-- 4. 코드 번역 사전 (엑셀 기반)
-- ======================================
CREATE TABLE code_dict (
  id          SERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,       -- 엑셀 B열
  name_ko     TEXT NOT NULL,              -- 엑셀 C열
  category    TEXT,                        -- 엑셀 A열
  hex_color   TEXT CHECK (
    hex_color ~ '^#[0-9a-fA-F]{6}$' OR hex_color IS NULL
  ),
  is_hidden   BOOLEAN DEFAULT FALSE,      -- ★ 엑셀 D열 / 사이트 관리
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_dict_code     ON code_dict(code);
CREATE INDEX idx_dict_category ON code_dict(category);
CREATE INDEX idx_dict_hidden   ON code_dict(is_hidden);

-- ======================================
-- 5. updated_at 자동 갱신
-- ======================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_models    BEFORE UPDATE ON models    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles  BEFORE UPDATE ON profiles  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_code_dict BEFORE UPDATE ON code_dict FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 7.3 샘플 데이터

```sql
INSERT INTO code_dict (code, name_ko, category, is_hidden) VALUES
  ('OM471',   '직렬 6기통 디젤 (OM471)',      '엔진',   FALSE),
  ('G211-12', '파워시프트 12단 자동',          '변속기', FALSE),
  ('X100',    '내부 관리용 코드',              '기타',   TRUE);

INSERT INTO code_dict (code, name_ko, category, hex_color, is_hidden) VALUES
  ('6861', '코스믹 블랙 메탈릭', '외장 컬러', '#1a1a1a', FALSE),
  ('9147', '아틱 화이트',       '외장 컬러', '#f5f5f0', FALSE);

INSERT INTO models (series, code, name_ko, model_year, badge, is_visible) VALUES
  ('Actros', 'L2653LS/33', '악트로스 2653 LS', 'MY26', 'new',  TRUE),
  ('Arocs',  'K3258K/44',  '아록스 3258 K',    'MY26', NULL,   TRUE),
  ('Actros', 'L2548LS/33', '악트로스 2548 LS', 'MY25', NULL,   FALSE);
```

---

## 8. 코드 표시/숨김 관리 체계

### 8.1 3단계 숨김 레벨

| 레벨 | 대상 | DB 컬럼 | 효과 | 관리 위치 |
|---|---|---|---|---|
| 모델 숨김 | 모델 전체 | `models.is_visible` | sales에게 모델 완전 비표시 | 관리자 화면 |
| 코드 전역 숨김 | 사전 항목 | `code_dict.is_hidden` | 모든 모델에서 해당 코드 비표시 | 엑셀 D열 또는 관리자 화면 |
| 코드 개별 숨김 | 특정 사양 | `specs.is_hidden` | 해당 모델의 해당 코드만 비표시 | 모델 편집 화면 |

### 8.2 숨김 판정 로직

```
사양 항목 표시 여부:

1. models.is_visible = FALSE AND user.role = 'sales'
   → 모델 자체 목록 제외 (사양 접근 불가)

2. code_dict.is_hidden = TRUE
   → 해당 코드의 모든 사양 행 비표시

3. specs.is_hidden = TRUE
   → 해당 모델의 해당 사양 행만 비표시

※ admin은 숨김 항목을 회색으로 확인 가능
```

### 8.3 엑셀 ↔ DB 동기화

- **임포트:** 엑셀 업로드 시 D열(Y/N) → `code_dict.is_hidden` 반영
- **익스포트:** DB 현재 상태를 엑셀 D열에 반영하여 다운로드
- **우선순위:** DB가 마스터. 엑셀은 초기 임포트 및 일괄 관리용 보조

---

## 9. 인증 및 권한

### 9.1 인증 흐름

```
[로그인 폼]  →  supabase.auth.signInWithPassword()
                    │
                    ▼
              [profiles에서 role 조회]
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
     role='admin'        role='sales'
     → /admin/models     → /models
```

### 9.2 라우트 가드

| 라우트 | 접근 조건 |
|---|---|
| `/login` | 비인증만 |
| `/models`, `/models/:id`, `/compare` | 인증 사용자 |
| `/admin/*` | admin만 |

### 9.3 Row Level Security (RLS)

```sql
ALTER TABLE profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE models    ENABLE ROW LEVEL SECURITY;
ALTER TABLE specs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_dict ENABLE ROW LEVEL SECURITY;

-- models: sales는 공개 모델만, admin은 전체
CREATE POLICY "models_select" ON models FOR SELECT
  USING (
    is_visible = TRUE
    OR EXISTS (SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin')
  );
CREATE POLICY "models_modify" ON models FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin'));

-- specs / code_dict: 인증 사용자 조회, admin만 수정
CREATE POLICY "specs_select" ON specs FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "specs_modify" ON specs FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin'));

CREATE POLICY "dict_select" ON code_dict FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "dict_modify" ON code_dict FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin'));

-- profiles: 본인 + admin 전체
CREATE POLICY "profiles_own" ON profiles FOR SELECT
  USING (auth.uid() = id);
CREATE POLICY "profiles_admin" ON profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin'));
```

---

## 10. 디자인 시스템

### 10.1 컬러 팔레트 (화이트 테마)

| 용도 | HEX | Tailwind |
|---|---|---|
| 배경 | `#FFFFFF` | `bg-white` |
| 카드/패널 | `#F9FAFB` | `bg-gray-50` |
| 테두리 | `#E5E7EB` | `border-gray-200` |
| 텍스트 | `#111827` | `text-gray-900` |
| 보조 텍스트 | `#6B7280` | `text-gray-500` |
| 액센트 (MB Blue) | `#00ADEF` | 커스텀 |
| 성공 | `#22C55E` | `text-green-500` |
| 경고 | `#F59E0B` | `text-amber-500` |
| 에러 | `#EF4444` | `text-red-500` |
| 비교 하이라이트 | `rgba(0,173,239,0.10)` | 커스텀 |
| 숨김 (admin) | `opacity: 0.5` | `opacity-50` |

### 10.2 로고 및 브랜딩

- **로고:** `MB_Star_Logo_black.png` (첨부 파일)
- **배치:** 로그인 상단 중앙, 네비게이션 바 좌측
- **사이트 제목:** "메르세데스-벤츠 트럭 사양 소개"

### 10.3 타이포그래피

| 용도 | 폰트 | 굵기 |
|---|---|---|
| 타이틀/헤더 | `Barlow Condensed` | 600, 700 |
| 국문 본문 | `Noto Sans KR` | 400, 500, 700 |
| 코드/값 | `Roboto Mono` | 400 |

### 10.4 컴포넌트 원칙

- 클린 화이트 UI + 검정 텍스트 + MB 블루 포인트
- 모바일 퍼스트, 터치 타겟 최소 44px
- 카드: `shadow-sm` + `border-gray-200`
- 반응형: 모바일 1열 → 태블릿 2열 → 데스크탑 3열

---

## 11. 프로젝트 폴더 구조

```
mb-truck-spec/
├── CLAUDE.md
├── public/
│   ├── MB_Star_Logo_black.png
│   └── favicon.ico
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── lib/
│   │   ├── supabase.js
│   │   ├── parser.js          ← .docx 파싱 + 코드 추출
│   │   └── excelImport.js     ← 엑셀 임포트 (SheetJS)
│   ├── components/
│   │   ├── ui/ (Button, Table, Badge, Toggle)
│   │   ├── Layout.jsx         ← 로고 + 네비게이션
│   │   ├── ModelCard.jsx
│   │   ├── SpecTable.jsx
│   │   ├── CompareTable.jsx
│   │   ├── CompareBar.jsx
│   │   └── ColorSwatch.jsx
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Models.jsx
│   │   ├── ModelDetail.jsx
│   │   ├── Compare.jsx
│   │   └── admin/
│   │       ├── AdminModels.jsx
│   │       ├── AdminModelEdit.jsx
│   │       ├── AdminDict.jsx
│   │       └── AdminUsers.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useModels.js
│   │   └── useDict.js
│   └── styles/
│       └── index.css
├── .env.local
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## 12. 개발 단계별 구현 가이드

| 단계 | 내용 | 산출물 |
|---|---|---|
| Step 1 | 프로젝트 초기화 (React+Vite+Tailwind+Supabase) | 빌드 환경, 로고 배치 |
| Step 2 | DB 스키마 + RLS 적용 | SQL migration, 샘플 데이터 |
| Step 3 | 엑셀 초기 임포트 (mb_code_total_translated → code_dict) | excelImport.js |
| Step 4 | 인증 (로그인 + useAuth + 라우트 가드) | Login.jsx, useAuth.js |
| Step 5 | 모델 목록 + 상세 (화이트 테마, 숨김 처리) | Models.jsx, ModelDetail.jsx |
| Step 6 | 비교 기능 (하이라이트, 숨김 코드 제외) | CompareBar, Compare.jsx |
| Step 7 | 관리자: 모델 등록 (.docx→코드추출→매핑→MY유추) | AdminModelEdit.jsx |
| Step 8 | 관리자: 코드 사전 + 엑셀 관리 + 사용자 관리 | AdminDict, AdminUsers |

---

## 13. 배포 및 환경 설정

### 환경변수 (`.env.local`)

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_TITLE=메르세데스-벤츠 트럭 사양 소개
```

### Vercel 배포

- GitHub 연결 → 자동 빌드·배포
- 환경변수 Vercel 대시보드 등록
- 커스텀 도메인 연결 (선택)

---

## 14. 향후 확장 계획

| Phase | 기능 | 설명 |
|---|---|---|
| 2 | PDF 내보내기 | 사양을 PDF로 다운로드 (고객 공유용) |
| 2 | 사양 변경 이력 | 모델별 변경 로그 추적 |
| 3 | 가격 정보 연동 | 사양 + 가격 통합 조회 |
| 4 | PWA / 모바일 앱 | 오프라인 사양 조회 |

---

## 부록: 마스터 엑셀 사양

**파일명:** `mb_code_total_translated.xlsx`

| 열 | 헤더 | 내용 | 예시 |
|---|---|---|---|
| A | 카테고리 | 분류명 | 엔진 |
| B | 영문 코드 | 원본 코드 | OM471 |
| C | 국문 번역 | 사이트 표시값 | 직렬 6기통 디젤 (OM471) |
| D | 표시 여부 | Y=표시, N=숨김 | Y |
| E | HEX (선택) | 컬러 코드일 경우 | #1a1a1a |
