# MB Trucks Korea — 사양 뷰어 시스템 (Spec Viewer)

## 프로젝트 목적
메르세데스-벤츠 트럭 상품기획팀이 관리하는 모델 사양 정보를 영업직원들이
웹에서 쉽게 조회·비교할 수 있도록 하는 사내 전용 웹 애플리케이션.

기존 문제점:
- 사양 데이터가 영문 생산 코드 (.docx 워드 출력물)로만 존재
- 매번 수작업으로 엑셀에 국문 변환 후 PDF나 전화로 공유
- 연식별/모델별 비교가 불가능

해결 목표:
- 영문 코드 → 국문 자동 번역 표시
- 아이폰 모델 비교처럼 모델 간 사양 비교
- 계정별 로그인으로 사내 인원만 접근

---

## 기술 스택

| 영역 | 도구 |
|---|---|
| 프론트엔드 | React + Vite |
| 스타일 | Tailwind CSS |
| 백엔드/DB/Auth | Supabase |
| 파일 파싱 | mammoth.js (.docx → JSON) |
| 배포 | Vercel |

---

## 사용자 역할

| 역할 | 권한 |
|---|---|
| `sales` 영업직원 | 모델 목록 조회, 사양 상세, 비교 |
| `admin` 관리자(상품기획팀) | 위 전체 + 모델 등록/수정, 코드 사전 관리, 워드 파일 업로드 |

규모: 10~50명 (계정별 로그인, Supabase Auth 사용)

---

## 핵심 기능 명세

### 1. 로그인
- Supabase Auth (이메일 + 비밀번호)
- 역할(role)은 Supabase `profiles` 테이블에서 관리
- 로그인 후 role에 따라 네비게이션 메뉴 다르게 표시

### 2. 모델 목록 페이지 (`/models`)
- 등록된 모델 카드 그리드 표시
- 필터: 연식(year), 시리즈(Actros / Arocs / Atego)
- 검색: 모델 코드, 국문명 텍스트 검색
- 각 카드에서 [사양 상세 보기] / [비교 추가] 가능
- 비교 선택 시 하단 고정 바(compare bar) 표시, 최대 3개

### 3. 사양 상세 페이지 (`/models/:id`)
- 카테고리별 사양 테이블
- 각 행: 항목명(국문) / 영문 코드 / 번역된 값
- 외장 컬러 코드 → 컬러 스와치 + 국문명 표시
- 타이어 코드 → 규격 국문 표시

### 4. 모델 비교 페이지 (`/compare?ids=1,2,3`)
- 선택한 2~3개 모델 좌우 나란히 비교 테이블
- 값이 다른 항목 하이라이트 표시
- 동일 항목은 흐리게 표시 (차이점 강조)

### 5. 관리자 — 모델 등록 (`/admin/models/new`)
- 워드 파일(.docx) 업로드 → mammoth.js로 파싱
- 파싱된 영문 코드를 코드 사전(code_dict 테이블)과 매핑
- 매핑 확인 후 저장

### 6. 관리자 — 코드 번역 사전 (`/admin/dict`)
- 영문 코드 ↔ 국문명 CRUD
- 분류(엔진 / 변속기 / 타이어 / 외장 컬러 / 안전장비 등)
- 컬러 코드의 경우 HEX값 추가 입력

---

## 데이터베이스 스키마 (Supabase PostgreSQL)

```sql
-- 사용자 프로필 및 역할
create table profiles (
  id uuid references auth.users primary key,
  name text,
  role text check (role in ('admin', 'sales')) default 'sales',
  created_at timestamptz default now()
);

-- 모델 기본 정보
create table models (
  id serial primary key,
  series text not null,           -- 'Actros', 'Arocs', 'Atego'
  code text not null,             -- 생산 코드 예: 'P530LA'
  code_desc text,                 -- 코드 영문 설명
  name_ko text not null,          -- 국문 모델명
  year int not null,              -- 연식
  badge text,                     -- 'new' | 'updated' | null
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 사양 항목 (카테고리 + 키-값)
create table specs (
  id serial primary key,
  model_id int references models(id) on delete cascade,
  category text not null,         -- '엔진', '변속기', '타이어' 등
  spec_key text not null,         -- 영문 코드 키 예: 'ENG_CODE'
  spec_value text not null,       -- 값 예: 'OM471'
  label_ko text,                  -- 항목 국문명 예: '엔진 코드'
  use_translate boolean default false,  -- 코드 사전 번역 여부
  is_color boolean default false,       -- 컬러 코드 여부
  sort_order int default 0
);

-- 코드 번역 사전
-- ※ 원본 데이터: code/mb_codes_total_translated.xlsx (A=코드, B=영문, C=국문)
create table code_dict (
  id serial primary key,
  code text unique not null,      -- 'OM471', 'G211', '861' 등
  name_en text,                   -- 영문 설명 (Excel B열)
  name_ko text not null,          -- '직렬 6기통 디젤 (OM471)'
  category text,                  -- '엔진', '변속기', '외장 컬러' 등 (수동 입력)
  hex_color text,                 -- 컬러 코드일 경우 '#1a1a1a' (수동 입력)
  is_active boolean not null default true,  -- false = Excel에서 삭제된 코드 (소프트 삭제)
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);
```

---

## 디자인 시스템

기존 프로토타입(mb_truck_spec.html) 의 디자인 언어를 유지.

**색상:**
- Background: `#0a0c10`
- Panel: `#111318`
- Card: `#16191f`
- Border: `#252830`
- Accent Blue (MB): `#00ADEF`
- Text: `#e8eaf0`
- Muted: `#6b7280`

**폰트:**
- Display/헤더: `Barlow Condensed` (영문 코드, 타이틀)
- 본문: `Noto Sans KR` (국문)
- 코드값: `Roboto Mono`

**컴포넌트 원칙:**
- 다크 산업적 UI (메르세데스-벤츠 트럭 브랜드에 맞게)
- 모바일 퍼스트 (영업직원 현장 사용 고려)
- 비교 테이블에서 차이 항목은 `rgba(0,173,239,0.12)` 배경 하이라이트

---

## 폴더 구조 (React + Vite)

```
mb-truck-spec/
├── CLAUDE.md                  ← 이 파일
├── code/
│   └── mb_codes_total_translated.xlsx  ← 코드 번역 원본 (A=코드, B=영문, C=국문)
├── scripts/
│   └── sync-codes.mjs         ← Excel → Supabase 초기 데이터 로딩 스크립트
├── supabase/
│   └── migrations/            ← Supabase SQL 마이그레이션 파일들
├── public/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── lib/
│   │   ├── supabase.js        ← Supabase 클라이언트
│   │   └── parser.js          ← .docx 파싱 로직 (mammoth)
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.jsx
│   │   │   ├── Table.jsx
│   │   │   └── Badge.jsx
│   │   ├── admin/
│   │   │   └── ExcelImport.jsx  ← 엑셀 가져오기 컴포넌트 (AdminDict에서 사용)
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
│   │       └── AdminDict.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   └── useModels.js
│   └── styles/
│       └── index.css
├── .env.local                 ← VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY
├── .gitignore
├── vite.config.js
└── package.json
```

---

## Claude Code 시작 명령어 (순서대로 실행)

프로젝트 폴더에서 Claude Code를 열고 아래 프롬프트를 순서대로 사용:

### Step 1 — 프로젝트 초기화
```
CLAUDE.md를 읽고 전체 프로젝트 구조를 이해해줘.
그 다음 React + Vite + Tailwind CSS 프로젝트를 세팅하고,
Supabase 클라이언트 연결까지 해줘.
패키지: @supabase/supabase-js, mammoth, react-router-dom, xlsx
```

### Step 2 — DB 스키마 적용
```
CLAUDE.md의 데이터베이스 스키마를 Supabase SQL Editor에 적용할
migration 파일을 만들어줘. (supabase/migrations/ 폴더에)
```

### Step 3 — 인증 구현
```
Supabase Auth를 이용한 로그인 페이지와
useAuth 훅을 만들어줘.
로그인 후 role이 admin이면 /admin, sales면 /models로 리다이렉트.
```

### Step 4 — 모델 목록 + 상세
```
Models.jsx와 ModelDetail.jsx를 만들어줘.
Supabase에서 models + specs 테이블을 조인해서 데이터를 불러오고
code_dict 테이블로 영문 코드를 국문으로 번역해 표시해.
디자인은 CLAUDE.md의 디자인 시스템을 따라줘.
```

### Step 5 — 비교 기능
```
CompareBar.jsx와 Compare.jsx를 만들어줘.
최대 3개 모델을 선택해 좌우로 비교하고
값이 다른 항목은 파란색 배경으로 하이라이트해줘.
```

### Step 6 — 관리자 기능
```
AdminDict.jsx: code_dict 테이블 CRUD UI
  - 상단에 ExcelImport 컴포넌트 배치 (엑셀 가져오기)
  - 코드 목록은 is_active=true 필터링
  - 수동 개별 코드 추가/수정/삭제도 지원
AdminModels.jsx: .docx 파일 업로드 → mammoth로 파싱 →
  영문 코드 자동 인식 → 사용자가 확인 후 저장하는 플로우 구현
ExcelImport.jsx: src/components/admin/ExcelImport.jsx 참고
```

---

## 참고: 기존 프로토타입

`mb_truck_spec.html` 파일이 있다면 참고용 디자인 레퍼런스로 사용.
(로그인, 모델 카드, 사양 테이블, 비교 UI의 디자인 언어 유지)

---

## 환경변수 (.env.local)

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# 초기 데이터 로딩 스크립트 전용 (서버사이드용, 절대 커밋 금지)
# Supabase Dashboard > Settings > API > service_role key
SUPABASE_SERVICE_KEY=your-service-role-key
```

Supabase 프로젝트는 https://supabase.com 에서 무료로 생성 가능.

---

## 코드 번역 사전 운영 가이드

### 데이터 원본
`code/mb_codes_total_translated.xlsx` 가 단일 번역 원본(source of truth).
- A열: 코드 (예: A0A, OM471)
- B열: 영문 설명
- C열: 국문 번역
- 시트명: `mb_codes_translated`

### 최초 데이터 로딩 (개발자 1회)
```bash
# 1. .env.local에 SUPABASE_SERVICE_KEY 추가
# 2. 스크립트 실행
npm run sync-codes
# 3. Supabase Table Editor에서 code_dict 4,000+ 행 확인
```

### 이후 업데이트 (관리자, GUI 방식)
1. Excel 파일 수정 후 저장
2. 앱 접속 → 코드 사전 관리 (`/admin/dict`)
3. **엑셀 가져오기** 버튼 클릭 → 파일 선택
4. 미리보기 확인 (신규 / 수정 / 비활성화 건수)
5. **가져오기 확인** 클릭 → 완료

### 소프트 삭제 원칙
Excel에서 코드를 삭제해도 DB에서 실제 삭제하지 않고 `is_active=false` 처리.
이유: 기존 사양 데이터(specs 테이블)의 번역 참조가 깨지지 않도록.
비활성 코드는 AdminDict 하단 "비활성화된 코드" 섹션에서 확인 가능.
