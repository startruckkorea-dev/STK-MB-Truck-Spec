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
- 사내 계정 로그인으로 사내 인원만 접근

---

## 기술 스택

| 영역 | 도구 |
|---|---|
| 프론트엔드 | React + Vite |
| 스타일 | Tailwind CSS |
| 인증 | Microsoft 365 (MSAL / Azure Entra ID) |
| 데이터 저장 | SharePoint Excel 워크북 (Microsoft Graph Workbook API) |
| 파일 파싱 | mammoth.js (.docx → JSON) |
| 배포 | Vercel |

> **이력:** 2026-05 이전에는 백엔드/DB/Auth 를 Supabase 로 사용했다. 현재는 Supabase 를
> 완전히 제거하고, 인증은 Microsoft 365, 데이터는 SharePoint Excel 로 이전했다.
> (Supabase 관련 코드·스키마·문서는 모두 폐기됨)

---

## 사용자 역할

| 역할 | 권한 |
|---|---|
| `sales` 영업직원 | 모델 목록 조회, 사양 상세(국문 표시), 비교 |
| `staff-b` 본사직원B | 위 + 영문 코드 열람 (기존 `staff` 와 동일) |
| `staff-a` 본사직원A | 위(B) + 숨김(`is_visible=false`) 모델 열람 + 코드 사전 **읽기 전용**(편집·삭제·엑셀열기·다시불러오기 불가, 모델 관리 불가) |
| `admin` 관리자(상품기획팀) | 위 전체 + 모델 등록/수정, 코드 사전 편집/관리 |

> 본사직원은 A/B 두 단계다. `Access_List` 의 H 컬럼에 `Staff-A`/`Staff-B`(또는 `본사직원A`/`본사직원B`)
> 로 표기한다. A/B 구분 없는 단독 `Staff`/`본사` 는 기존 호환을 위해 `staff-b` 로 본다.

- **로그인:** Microsoft 365 회사 계정 (MSAL 팝업). 회사 계정이면 누구나 로그인된다.
- **역할:** SharePoint `Access` 폴더의 접근권한 엑셀(`Access_List_*.xlsx`)로만 관리한다.
  앱 안에는 사용자/역할 편집 화면이 없다 — **엑셀을 직접 편집**해야 한다.
  - `G` 컬럼 = 이메일(키), `H` 컬럼 = 권한(`Admin`/`Staff-A`/`Staff-B`/`Sales`). 1행은 헤더.
  - 역할은 앱에서 클릭으로 바꿀 수 없다(전환 UI 없음). 상단 바에 현재 역할 배지만 표시.
- **부트스트랩:** 목록에 `admin` 이 한 명도 없으면 로그인한 사용자를 모두 `admin` 으로
  취급(최초 셋업/락아웃 방지). admin 이 한 명이라도 있으면 미등록 사용자는 `sales` 기본.
- ⚠️ 앱을 쓰려면 SharePoint 워크북 파일과 `Access` 파일의 **"읽기" 권한**이 필요하다
  (관리자는 데이터 워크북 "편집"). 규모 10~50명.

---

## 핵심 기능 명세

### 1. 로그인 (`/login`)
- Microsoft 365 계정으로 로그인 (MSAL 팝업)
- 로그인 후 역할(`Access` 엑셀)에 따라 네비게이션 메뉴·열람 범위 다르게 표시

### 2. 모델 목록 페이지 (`/models`)
- 등록된 모델 카드 그리드 표시 (MY별·차종별 그룹)
- 필터: 연식(model_year), 시리즈(Actros / Arocs / Atego)
- 검색: 모델 코드, 국문명 텍스트 검색
- 각 카드에서 [사양 상세 보기] / [비교 추가] 가능
- 비교 선택 시 하단 고정 바(compare bar) 표시, 최대 3개
- `sales`/`staff-b` 에게는 `is_visible=false` 모델 숨김 (admin·`staff-a` 는 전체)

### 3. 사양 상세 페이지 (`/models/:id`)
- 카테고리별 사양 테이블
- 각 행: 항목명(국문) / 영문 코드 / 번역된 값
- 외장 컬러 코드 → 컬러 스와치 + 국문명 표시

### 4. 모델 비교 페이지 (`/compare?ids=1,2,3`)
- 선택한 2~3개 모델 좌우 나란히 비교 테이블
- 값이 다른 항목 하이라이트, 동일 항목은 흐리게

### 5. 관리자 — 모델 등록/편집 (`/admin/models/new`, `/admin/models/:id/edit`)
- 사양서(.docx) 가져오기 — 두 가지 경로:
  1. **로컬 PC 업로드:** 드래그 앤 드롭 또는 파일 선택
  2. **SharePoint 공유폴더에서 선택:** [SharePointPicker](src/components/admin/SharePointPicker.jsx)
     모달로 견적서 폴더(MY 연도 → 생산월 → 파일)를 탐색해 .docx 를 바로 선택
- 둘 다 mammoth.js로 파싱. 신규 등록 시 견적서 **파일명**에서 시리즈·모델 코드·축·캐빈을,
  SharePoint **폴더명**(`MY##`)에서 Model Year 를 자동 입력 (관리자가 확인·수정)
- 파싱된 영문 코드를 코드 사전(`code_dict` 시트)과 매핑해 미리보기
- **사양 미리보기 표에서 직접 편집** — 행 추가/수정/삭제/순서 이동:
  - **사내 코드(KR01~KR99):** 견적서에 없는 사양을 관리자가 직접 추가할 때 쓰는 코드.
    모달에서 다음 미사용 KR 코드가 자동 발급되며, 국문명·영문명·컬러를 입력하면
    `code_dict` 시트에 등록되고 이 모델의 사양 행으로 추가된다.
  - **기존 코드 사용:** 코드 사전에 이미 있는 코드를 이 모델에 추가.
  - ⚠️ 이 편집은 `code_dict`/`specs` 시트에만 반영된다. SharePoint 공유폴더의
    **견적서(.docx) 원본 파일은 변경하지 않는다.** 같은 모델에서 .docx 를 다시
    파싱해도 KR 코드로 추가한 행은 유지된다.
- 확인 후 저장 → `models` / `specs` / `model_notes` 시트에 기록

### 6. 관리자 — 코드 번역 사전 (`/admin/dict`)
- `code_dict` 시트 CRUD (영문 코드 ↔ 국문명, 분류, HEX 컬러, 숨김)
- 상단 패널에서 SharePoint Excel 파일 바로 열기 + [다시 불러오기]

### 7. 사용자 권한 관리 — 앱 화면 없음
- 역할은 SharePoint `Access` 폴더의 `Access_List_*.xlsx` 를 **직접 편집**해 관리한다
  (`G`=이메일, `H`=권한). 앱에는 사용자 관리 화면이 없다.
- [src/lib/accessList.js](src/lib/accessList.js) 가 이 파일을 읽어 로그인 사용자 역할을 정한다.

---

## 데이터 저장 구조 — SharePoint Excel 워크북

**위치:** SharePoint 사이트 `STK-PMM` > `Shared Documents` > `mbtruck-spec/Code/` 폴더 안의
`.xlsx` 파일 1개. 앱([src/lib/workbook.js](src/lib/workbook.js))이 그 폴더의 `.xlsx` 를
**자동 탐색**한다 (파일명 무관, 폴더에 `.xlsx` 는 하나만 둘 것).

워크북은 시트 4개. 각 시트 **1행 = 헤더, 2행부터 데이터**. 컬럼 **순서**가 중요하다
(앱이 위치 기준으로 읽음). 불리언은 `TRUE`/`FALSE`.

| 시트 | 컬럼 (순서대로) |
|---|---|
| `code_dict` | id, code, name_en, name_ko, category, hex_color, is_hidden |
| `models` | id, series, code, axle, cabin, code_desc, name_ko, model_year, production_month, badge, is_visible, sort_order |
| `specs` | id, model_id, category, spec_key, spec_value, label_ko, use_translate, is_color, is_hidden, sort_order |
| `model_notes` | id, model_id, label, content, sort_order |

> 역할 권한은 이 데이터 워크북이 아니라 별도의 `Access/Access_List_*.xlsx`(G=이메일, H=권한)로
> 관리한다. ([src/lib/accessList.js](src/lib/accessList.js)) (과거 `users` 시트는 더 이상 역할에 쓰이지 않음)

**관계:**
- `specs.model_id`, `model_notes.model_id` → `models.id`
- `specs.spec_value` → `code_dict` 의 코드 (문자열 매칭, 숫자 FK 아님)
- `id` 는 정수. 신규 행 삽입 시 `max(id)+1`.

**code_dict 의 두 유형 (혼재):**
- 유형 A (대량 사전): `code` 열=영문 설명, `category` 열=MB 코드 (예: `A0A`)
- 유형 B (모델 사양 코드): `code` 열=MB 코드, `name_en`=영문 설명
- 번역 매칭은 [src/lib/codeIndex.js](src/lib/codeIndex.js) 가 `code`/`category` 양쪽을 보고 처리.

---

## 앱 데이터 계층

| 파일 | 역할 |
|---|---|
| [src/lib/msal.js](src/lib/msal.js) | MSAL 초기화, 로그인/로그아웃, Graph 토큰 획득 |
| [src/lib/graph.js](src/lib/graph.js) | Microsoft Graph REST 호출 (토큰 부착, 429/503 재시도) |
| [src/lib/workbook.js](src/lib/workbook.js) | 워크북 시트 읽기(usedRange)/쓰기(range PATCH·delete) |
| [src/lib/sourceFiles.js](src/lib/sourceFiles.js) | SharePoint 견적서(.docx) 원본 폴더 탐색·다운로드 |
| [src/lib/pictures.js](src/lib/pictures.js) | SharePoint 모델 사진 폴더 자동 매칭·조회(상세 화면 갤러리) |
| [src/lib/specImages.js](src/lib/specImages.js) | SharePoint `spec_picture` 폴더 조회 → 코드별 사양 이미지 인덱스(파일명=코드명 매칭) + 업로드/삭제. 상세 사양행 [보기] 버튼·코드사전 미리보기·편집 모달 업로드에 사용 |
| [src/lib/accessList.js](src/lib/accessList.js) | SharePoint `Access` 폴더 접근권한 엑셀(G=이메일, H=권한) 읽기 |
| [src/lib/codeIndex.js](src/lib/codeIndex.js) | `code_dict` → 코드 인덱스, 사양값 번역 매칭 |
| [src/contexts/DataContext.jsx](src/contexts/DataContext.jsx) | 로그인 후 데이터 4개 시트를 메모리에 1회 로드. 검색·필터·페이지네이션은 클라이언트에서 처리, 변경 시 Graph 로 즉시 반영 |
| [src/hooks/useAuth.jsx](src/hooks/useAuth.jsx) | MSAL 인증 + `Access` 엑셀 기반 역할 |
| [src/hooks/useDict.js](src/hooks/useDict.js), [src/hooks/useModels.js](src/hooks/useModels.js) | DataContext 캐시 기반 조회 훅 |

동시 편집은 소규모 팀 기준 last-write-wins. 단건 쓰기 전 해당 행을 재확인해 충돌을 완화한다.

---

## 디자인 시스템

라이트 테마. Tailwind 토큰은 [tailwind.config.js](tailwind.config.js) 참조.

**색상:**
- 배경: 흰색 / 회색 계열 (Tailwind `gray-*`)
- Accent (MB Blue): `#00ADEF` (`mb-blue`), hover `#0099d4` (`mb-blue-dark`)
- 비교 테이블 차이 항목 하이라이트: `rgba(0,173,239,0.06)` 배경

**폰트:**
- Display/헤더: `Barlow Condensed` (`font-barlow`)
- 본문: `Noto Sans KR` (`font-noto`)
- 코드값: `Roboto Mono` (`font-mono`)

**원칙:** 모바일 퍼스트 (영업직원 현장 사용 고려), 깔끔한 산업적 UI.

---

## 폴더 구조 (React + Vite)

```
mb-truck-spec/
├── CLAUDE.md                  ← 이 파일
├── scripts/
│   ├── export-to-xlsx.mjs     ← (1회성·과거) Supabase → xlsx 추출 스크립트
│   └── debug-docx.mjs         ← .docx 파싱 디버그용
├── public/
├── src/
│   ├── main.jsx               ← Auth → Data → SpecLang Provider 순 래핑
│   ├── App.jsx                ← 라우팅, RequireAuth / RequireAdmin 가드
│   ├── lib/
│   │   ├── msal.js            ← Microsoft 365 인증
│   │   ├── graph.js           ← Microsoft Graph REST 헬퍼
│   │   ├── workbook.js        ← SharePoint Excel 워크북 액세스
│   │   ├── sourceFiles.js     ← SharePoint 견적서(.docx) 폴더 탐색
│   │   ├── accessList.js      ← SharePoint Access 폴더 접근권한 엑셀 읽기
│   │   ├── codeIndex.js       ← 코드 사전 매칭 유틸
│   │   ├── parser.js          ← .docx 파싱 (mammoth) + 파일명 기본정보 추출
│   │   └── export.js          ← 사양 Excel/PDF 내보내기
│   ├── contexts/
│   │   └── DataContext.jsx    ← SharePoint 데이터 캐시 + 변경 API
│   ├── components/
│   │   ├── ui/                ← Button, Badge, Toggle, LangToggle
│   │   ├── admin/ExcelImport.jsx     ← SharePoint Excel 열기 + 다시 불러오기 패널
│   │   ├── admin/SharePointPicker.jsx ← 견적서 .docx 공유폴더 탐색 모달
│   │   ├── Layout.jsx, ModelCard.jsx, SpecTable.jsx,
│   │   ├── CompareTable.jsx, CompareBar.jsx, ColorSwatch.jsx
│   ├── pages/
│   │   ├── Login.jsx, Models.jsx, ModelDetail.jsx, Compare.jsx
│   │   └── admin/AdminModels.jsx, AdminModelEdit.jsx, AdminDict.jsx
│   ├── hooks/
│   │   ├── useAuth.jsx, useModels.js, useDict.js, useSpecLang.jsx
│   └── styles/index.css
├── .env.local                 ← 선택적 환경변수 (아래 참조, 커밋 금지)
├── vite.config.js
└── package.json
```

---

## 개발 / 배포

```bash
npm install
npm run dev          # 로컬 개발 — http://localhost:3000
npm run build        # 프로덕션 빌드 (dist/)
npx vercel deploy --prod --yes   # 운영 배포 → mbtruck-spec.startruckkorea.com
```

- ⚠️ **로컬 개발 시:** Azure 앱 등록 > 인증 > SPA 플랫폼에 `http://localhost:3000` 리디렉션
  URI 가 등록돼 있어야 로컬에서 Microsoft 로그인이 된다 (없으면 `AADSTS50011` 오류).
- `npm run export-codes` — (1회성·과거) Supabase 데이터를 xlsx 로 추출하던 스크립트.
  마이그레이션 완료 후에는 불필요.

---

## 환경변수 (.env.local)

모두 **선택 사항**이다. 미설정 시 코드의 기본값을 사용한다 (공개 SPA 식별자·경로이며 비밀값 아님).

```
# Microsoft 365 / MSAL — 미설정 시 msal.js 기본값
VITE_MSAL_CLIENT_ID=...
VITE_MSAL_TENANT_ID=...

# SharePoint 위치 — 미설정 시 workbook.js / sourceFiles.js / accessList.js 기본값
VITE_SP_HOSTNAME=startruckkorea.sharepoint.com
VITE_SP_SITE_PATH=/sites/STK-PMM
VITE_SP_FOLDER_PATH=mbtruck-spec/Code          # 데이터 워크북(.xlsx) 폴더
VITE_SP_QUOTATION_PATH=mbtruck-spec/Quotation  # 견적서(.docx) 원본 폴더
VITE_SP_PICTURES_PATH=mbtruck-spec/Pictures    # 모델 사진 원본 폴더
VITE_SP_SPEC_PICTURES_PATH=mbtruck-spec/spec_picture  # 사양 코드별 이미지 폴더(파일명=코드명)
VITE_SP_ACCESS_PATH=mbtruck-spec/Access        # 접근권한 엑셀(Access_List_*.xlsx) 폴더

# 앱 타이틀
VITE_APP_TITLE=...
```

---

## SharePoint / Azure 설정

**Azure Entra ID — SPA 앱 등록:**
- Client ID: `9b247088-5afb-4622-9c5e-b5f27142761d`
- Tenant ID: `19cab1f5-21f4-44df-8ac6-96d6ca595203`
- 위임 권한(관리자 동의 완료): `User.Read`, `Sites.ReadWrite.All`, `Files.ReadWrite.All`, `Mail.Send`
- 리디렉션 URI(SPA): `https://mbtruck-spec.startruckkorea.com` (로컬 테스트 시 `http://localhost:3000` 추가)

**SharePoint:**
- 사이트: `https://startruckkorea.sharepoint.com/sites/STK-PMM/`
- 데이터 워크북 폴더: `Shared Documents/mbtruck-spec/Code/`
- 접근권한 엑셀 폴더: `Shared Documents/mbtruck-spec/Access/` (`Access_List_*.xlsx`, G=이메일·H=권한)
- 견적서(.docx) 원본 폴더: `Shared Documents/mbtruck-spec/Quotation/`
  - 하위를 MY 연도(`MY26`, `MY27` …) → 생산월(`2026-04` …) 폴더로 구분.
  - 모델 등록 시 이 폴더를 탐색해 .docx 를 바로 선택한다 (앱이 폴더명 무관하게
    트리로 탐색하므로 명명 규칙은 자유, 단 `MY##` 폴더명은 Model Year 자동 입력에 쓰임).
- 모델 사진 폴더: `Shared Documents/mbtruck-spec/Pictures/`
  - 하위를 MY 연도(`MY26` …) → **모델명** 폴더로 구분 (`MY26/Actros 2863LS 6x2 G5F`).
  - 모델명 폴더는 상세 헤더 표기(`시리즈 코드 축 캐빈`)와 **정확히 일치**해야 자동 매칭된다.
  - **이름은 같지만 부가설명(`code_desc`)이 다른 변형 모델**(예: 챔피언 에디션, 색상 차이)은
    폴더명 뒤에 부가설명을 붙여 구분한다: `MY26/Actros 2863LS 6x2 G5F 챔피언 에디션`.
    앱은 `모델명 + 부가설명` 폴더를 먼저 찾고, 없으면 `모델명` 기본 폴더로 폴백한다.
    (사진 없을 때 갤러리에 권장 폴더명이 표시되니 그대로 만들면 된다.)
  - 상세 화면 [📷 사진] 버튼이 이 폴더를 조회해 갤러리로 보여준다 (sales 포함 전체 열람).
    별도 연결/등록 작업 없이 폴더에 이미지를 넣기만 하면 된다. ([src/lib/pictures.js])
- 사양 코드별 이미지 폴더: `Shared Documents/mbtruck-spec/spec_picture/` (평면 폴더)
  - **파일명 = 코드명** 규칙으로 자동 매칭 (`A0A.jpg`, `w68k96 80.png` … 대소문자·확장자 무관).
  - 사양 상세 각 행에서, 해당 코드의 이미지가 폴더에 있으면 값 오른쪽에 [🖼 보기] 버튼이
    뜨고 클릭 시 확대 표시된다 (sales 포함 전체 열람, **출력·Excel·PDF 에는 미포함**).
  - 코드사전(`/admin/dict`)에 코드별 이미지 유무 표시·미리보기가 있고, **코드 편집 모달에서
    이미지 파일을 직접 선택해 업로드/교체/삭제**할 수 있다(파일명을 `코드명.확장자` 로 폴더에
    저장). 폴더에 직접 넣어도 되며, 그 경우 상단 [이미지 다시 불러오기]로 반영.
    ([src/lib/specImages.js] — `uploadSpecImage`/`deleteSpecImageByName`)
- 앱 사용자는 이 파일 "읽기" 권한, 관리자는 "편집" 권한 필요.

---

## 코드 번역 사전 운영 가이드

**원본(source of truth):** SharePoint 워크북의 `code_dict` 시트.

**업데이트 방법 두 가지:**
1. **앱에서:** `/admin/dict` 에서 개별 코드 추가/수정/삭제.
2. **Excel 직접 편집:** SharePoint 에서 워크북 파일을 열어 `code_dict` 시트를 편집·저장 →
   앱 `/admin/dict` 상단의 **[다시 불러오기]** 버튼 → 반영.

**주의:** code 가 사전에서 사라지면, 그 코드를 참조하는 모델 사양은 "번역 미등록" 으로
표시된다. `/admin/dict` 의 "모델 사용 코드" 탭에서 미등록 코드를 확인할 수 있다.

---

## 참고: 기존 프로토타입

초기 디자인 레퍼런스로 `mb_truck_spec.html` 프로토타입이 있었다. 현재 앱은 라이트 테마로
발전했으므로, 디자인은 위 "디자인 시스템" 섹션과 실제 컴포넌트를 기준으로 한다.
