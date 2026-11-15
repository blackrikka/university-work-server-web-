# 캠퍼스 로비 통합 게시판 — 개발 기록

이 문서는 프로젝트의 구조, 구현된 게시판 기능, 개발 과정의 프롬프트와 에이전트 응답을 정리한 자료입니다.

- 저장소: `blackrikka/university-work-server-web-`
- 작업 브랜치: `claude/quirky-hamilton-halfd7`
- 배포 주소(예정): `https://campus-lobby.kro.kr` (DNS 연결 진행 중, 아래 [9장](#9-배포와-도메인-연결-기록) 참고)

---

## 1. 프로젝트 개요

GitHub Pages로 호스팅하고 Supabase(무료 티어)를 데이터 서버로 쓰는 다중 게시판 사이트입니다.
빌드 과정이 없는 순수 HTML/CSS/JS 정적 사이트이며, 브라우저에서 ES 모듈로 직접 실행됩니다.

| 항목 | 내용 |
| --- | --- |
| 프런트엔드 | HTML, CSS, JavaScript (ES 모듈, 빌드 도구 없음) |
| 백엔드 | Supabase (PostgreSQL, 인증, 스토리지) |
| 클라이언트 라이브러리 | supabase-js 2.45.4 (`js/vendor/`에 번들) |
| 호스팅 | GitHub Pages (GitHub Actions 배포) |
| 글꼴 | Google Fonts `Nanum Gothic Coding` |

---

## 2. 디렉터리 구조

```
index.html            진입점 (스크립트·스타일 로드, ?v= 로 캐시 무효화)
css/style.css         스타일 (녹색 단색 CRT 테마)
js/config.js          Supabase URL·anon 키 설정
js/store.js           데이터 계층: Supabase 어댑터 / 데모(localStorage) 어댑터
js/app.js             해시 라우터와 화면 렌더링
js/vendor/            supabase-js 번들
supabase/schema.sql   테이블, 트리거, RLS 정책, 기본 게시판
supabase/storage.sql  이미지 첨부용 버킷과 업로드 정책
.github/workflows/pages.yml  GitHub Pages 배포 워크플로
```

---

## 3. 실행 모드

`js/store.js`가 `js/config.js` 값을 보고 어댑터를 고릅니다.

| 모드 | 조건 | 저장 위치 | 특징 |
| --- | --- | --- | --- |
| 데모 | `config.js` 값이 비어 있음 | 브라우저 localStorage (`cl_db`) | 본인만 보임, 첫 가입자가 관리자 |
| Supabase | `config.js`에 URL·anon 키 입력 | Supabase DB와 스토리지 | 모든 방문자가 데이터 공유 |

데이터 계층은 같은 메서드 이름(`signUp`, `listPosts`, `createPost` 등)을 두 어댑터가 공유하므로, 화면 코드(`app.js`)는 모드를 신경 쓰지 않습니다.

---

## 4. 구현된 기능

### 4.1 회원

- 이메일·비밀번호 회원가입, 로그인, 로그아웃
- 가입 시 닉네임 입력(공백 없이 2~16자, 중복 불가)
- 닉네임 변경 (내 정보 화면)
- 가입 시 `profiles` 행을 자동 생성하는 DB 트리거 (`handle_new_user`)
- Supabase 모드에서 이메일 인증 메일 발송 지원 (설정에 따라 선택)

### 4.2 게시판

- 기본 게시판 5종 (`schema.sql`에서 생성)

| 주소 | 이름 | 형태 | 작성 권한 |
| --- | --- | --- | --- |
| `notice` | 공지사항 | 목록 | 관리자 |
| `free` | 자유게시판 | 목록 | 회원 |
| `qna` | 질문답변 | Q&A | 회원 |
| `gallery` | 갤러리 | 카드(이미지) | 회원 |
| `data` | 자료실 | 목록 | 회원 |

- 게시판 형태 3종: 목록(`list`), 갤러리(`gallery`), Q&A(`qna`)
- 게시판별 작성 권한: 회원 또는 관리자만
- 관리자는 게시판을 추가하고 삭제할 수 있음 (`게시판 관리` 화면)
- 게시판 삭제 시 그 안의 글, 댓글, 좋아요가 함께 삭제됨 (`on delete cascade`)

### 4.3 글과 댓글

- 글 작성, 수정, 삭제 (수정은 본인 글만, 삭제는 본인 또는 관리자)
- 제목 1~100자, 내용 1~20,000자
- 이미지 첨부 (PNG·JPG·GIF·WEBP)
- 댓글 작성과 삭제 (내용 1~2,000자)
- 좋아요 토글 (회원당 글 하나에 한 번)
- 조회수 (상세 화면에 들어갈 때 증가, `increment_views` 함수로만 변경 가능)

### 4.4 목록과 검색

- 페이지네이션 (페이지당 10개)
- 게시판 내 검색 (제목·내용)
- 전체 게시판 보기(`#/all`)와 통합 검색(`#/all?q=…`)
- 내 글 보기 (`#/me`)

### 4.5 로비 화면

- 플레이어 카드: 닉네임과 작성한 글·댓글 수
- 통계: 전체 글 수, 댓글 수, 회원 수
- 공지 목록 (최신 공지 3개)
- 최신글 목록
- 게시판 독(dock): 게시판별 바로가기 버튼
- 게시판마다 고유 색(accent) 지정

### 4.6 이미지 처리 (`store.js`의 `prepImage`)

- 허용 형식 검사 (PNG·JPG·GIF·WEBP)
- 긴 변 기준으로 축소: Supabase 모드 최대 1,600px, 데모 모드 최대 1,000px. 1MB를 넘으면 JPEG 85%로 재압축
- GIF는 움직임을 보존하려고 원본 그대로 둠
- 원본이 5MB를 넘으면 거부
- 데모 모드는 1MB 이하만 허용 (localStorage 용량 한계)
- Supabase 모드는 `images` 공개 버킷에 저장 후 공개 URL 사용
- 글을 수정하거나 삭제하면 이전 이미지 파일도 스토리지에서 삭제

### 4.7 관리자 기능

- 첫 가입자는 데모 모드에서 자동 관리자
- Supabase 모드는 SQL로 지정: `update public.profiles set role = 'admin' where nickname = '내닉네임';`
- 관리자 권한: 게시판 추가·삭제, 모든 글·댓글 삭제, 관리자 전용 게시판에 글 작성

### 4.8 화면 테마

- 브라운관(CRT) 녹색 단색 모니터 풍 디자인
- 모바일 화면 대응 (반응형 CSS)

---

## 5. 데이터베이스 설계 (`supabase/schema.sql`)

| 테이블 | 주요 컬럼 | 설명 |
| --- | --- | --- |
| `profiles` | `id`(auth.users 참조), `nickname`, `role` | 회원 프로필. `role`은 `member` 또는 `admin` |
| `boards` | `slug`, `name`, `description`, `type`, `write_role`, `sort` | 게시판 설정 |
| `posts` | `board_id`, `author_id`, `title`, `content`, `image_url`, `views` | 글 |
| `comments` | `post_id`, `author_id`, `content` | 댓글 |
| `likes` | `(post_id, user_id)` 복합 기본키 | 좋아요 |

### 보안 정책 (RLS)

- 모든 테이블에 Row Level Security 적용
- 누구나 읽기 가능, 쓰기는 로그인한 본인 데이터로만 가능
- `profiles`는 `nickname`만 본인이 수정 가능 (`role` 변경 차단)
- `posts`는 `title`, `content`, `image_url`, `updated_at`만 수정 가능 (조회수와 작성자 변경 차단)
- 관리자 여부는 `is_admin()` 함수(security definer)로 판단
- `service_role` 키는 사용하지 않음. 프런트엔드에는 공개 가능한 anon 키만 둠

### 스토리지 정책 (`supabase/storage.sql`)

- `images` 버킷은 공개 읽기
- 업로드와 삭제는 로그인한 회원이 자기 user id 폴더에만 가능
- 파일 크기 5MB, 허용 MIME 타입 4종으로 제한

---

## 6. 프런트엔드 구현 메모

- **해시 라우터**: `#/`, `#/b/:slug`, `#/p/:id`, `#/write/:slug`, `#/edit/:id`, `#/login`, `#/signup`, `#/me`, `#/admin`, `#/all`
- **렌더링 토큰**: 비동기 렌더링 중 다른 화면으로 이동하면 이전 결과를 버림 (`my === token` 검사)
- **XSS 방지**: 사용자 입력은 `esc()`로 이스케이프한 뒤 HTML에 넣음
- **캐시 무효화**: 배포 워크플로가 `?v=dev`를 커밋 해시 8자리로 바꿈 (`sed`), 브라우저가 예전 파일을 쓰지 않도록 함
- **supabase-js 번들**: CDN 대신 `js/vendor/`에 넣어 외부 스크립트 의존 제거 (커밋 `d680816`)

---

## 7. 배포

- `.github/workflows/pages.yml`: `main`과 `claude/quirky-brown-dqrob9` 브랜치 push, 또는 수동 실행으로 배포
- 현재 작업 브랜치(`claude/quirky-hamilton-halfd7`)는 배포 대상이 아님. 배포하려면 `main`에 병합 필요
- 저장소 설정: **Settings → Pages → Source**를 **GitHub Actions**로 설정

### 로컬 실행

```bash
python3 -m http.server 8000
```

ES 모듈을 쓰므로 `index.html`을 직접 열면 동작하지 않습니다.

---

## 8. 커밋 기록 (주요)

| 커밋 | 날짜 | 내용 |
| --- | --- | --- |
| `bfd6617` | 2026-11-11 | 통합 다중 게시판, 회원가입, 로비 화면 추가 |
| `6b132e7`, `e3f8c52` | 2026-11-11 | `config.js` 설정 갱신 |
| `5e7af66` | 2026-11-11 | 설정에서 비밀 키 제거, Supabase URL 수정 |
| `d680816` | 2026-11-11 | 게시글 조회 쿼리 수정, supabase-js 로컬 번들 |
| `b1c1a27` | 2026-11-11 | 녹색 CRT 테마와 게시판별 색 적용 |
| `b9919d3` | 2026-11-11 | Pages 배포 대상 브랜치에 기본 브랜치 추가 |
| `4fb0614` | 2026-11-11 | 이미지를 URL 입력 대신 파일 업로드로 첨부 |
| `4e30b2d` | 2026-11-11 | 내 정보 화면에서 닉네임 변경 |
| `3fe7766` | 2026-11-11 | 배포 시 자산 주소에 커밋 해시 부여 |

---

## 9. 배포와 도메인 연결 기록

### 목표

내도메인.한국(`kro.kr` 하위)에서 받은 `campus-lobby.kro.kr`을 GitHub Pages 사이트에 연결.

### 진행 상황

1. GitHub **Settings → Pages → Custom domain**에 `campus-lobby.kro.kr` 입력 후 Save
2. GitHub 화면에 `DNS check unsuccessful`, `Domain's DNS record could not be retrieved (InvalidDNSError)` 표시
   - 의미: GitHub가 이 이름의 DNS 레코드(CNAME 또는 A)를 찾지 못함
3. 샌드박스에서 DNS 조회를 시도했으나 이 환경에서는 외부 DNS 조회가 되지 않아 실제 레코드 상태를 확인하지 못함 (`blackrikka.github.io`도 조회되지 않음)

### 필요한 DNS 설정

| 방식 | 종류 | 호스트 | 값 |
| --- | --- | --- | --- |
| 기본 | CNAME | `campus-lobby` | `blackrikka.github.io` |
| CNAME 불가 시 | A (4개) | `campus-lobby` | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |

### 연결 후 해야 할 일

- GitHub에서 **Check again** 후 **Enforce HTTPS** 활성화
- Supabase **Authentication → URL Configuration**
  - Site URL: `https://campus-lobby.kro.kr`
  - Redirect URLs: `https://campus-lobby.kro.kr/**`
- (선택) 저장소 루트에 `CNAME` 파일 추가. 내용은 `campus-lobby.kro.kr` 한 줄

### 확인되지 않은 사항

- 내도메인.한국 DNS 관리 화면의 실제 레코드 상태 (사용자 확인 필요)
- `kro.kr` 이름의 신청·승인 상태
- 서비스가 서브도메인 CNAME을 허용하는지 여부

---

## 10. 개발 대화 기록 (도메인 연결 세션)

이 섹션은 이 세션에서 나눈 사용자 요청과 에이전트 응답을 요약한 기록입니다. 에이전트가 내부적으로 한 추론 과정은 포함하지 않았습니다.

### 10.1 사용자 요청과 에이전트 응답

**[1] 요청**
> 내도메인.한국 이라는 사이트에서 도메인을 얻었어. 이걸 이 사이트에 연결하고싶은데...

**응답 요약**
- 사이트가 GitHub Pages 정적 사이트이므로 GitHub 설정, 내도메인.한국 DNS 설정, Supabase 주소 설정 세 곳을 맞추면 된다고 설명
- 루트 도메인과 서브도메인 중 어떤 형태인지 물어봄
- 루트 도메인용 A 레코드 4개, 서브도메인용 CNAME 레코드 절차를 안내
- 배포 브랜치가 `main`과 `claude/quirky-brown-dqrob9`만 대상이라는 점을 알려줌

**[2] 요청**
> 도메인은 campus-lobby.kro.kr 이거야

**응답 요약**
- 서브도메인이므로 CNAME 레코드 하나면 됨: 호스트 `campus-lobby`, 값 `blackrikka.github.io`
- 샌드박스에서 DNS 조회를 시도했으나 `dig`가 없고 DNS-over-HTTPS도 프록시에서 차단되어 확인 불가
- GitHub Pages 등록, Enforce HTTPS, Supabase Site URL과 Redirect URLs 설정 절차 안내
- `CNAME` 파일 추가를 제안했고, 커밋과 푸시는 요청 시에만 하겠다고 명시

**[3] 요청**
> DNS check unsuccessful

**응답 요약**
- 레코드가 잘못 입력됐거나, 서비스가 CNAME을 허용하지 않거나, 전파 중일 수 있다고 설명
- 호스트 이름을 `campus-lobby.kro.kr` 전체로 넣으면 `campus-lobby.kro.kr.kro.kr`이 되는 점을 주의하라고 안내
- whatsmydns.net으로 전파 확인, A 레코드 대안 제시
- 내도메인.한국 화면과 GitHub 오류 문구를 보내 달라고 요청

**[4] 요청 (스크린샷 첨부)**
> 스크린샷: GitHub Custom domain 화면, `campus-lobby.kro.kr` 입력, `DNS check unsuccessful`, `campus-lobby.kro.kr is improperly configured — Domain's DNS record could not be retrieved (InvalidDNSError)`

**응답 요약**
- 잘못된 값이 아니라 레코드를 전혀 찾지 못한 상태라고 해석
- 원인 세 가지 제시: 공개 DNS에 레코드가 없음, 서비스가 CNAME을 거부함, 아직 전파 또는 승인 대기 중
- 확인 순서: whatsmydns 조회 → 내도메인.한국 레코드 목록과 `kro.kr` 신청 상태 확인 → 필요 시 A 레코드로 변경
- 내도메인.한국 DNS 화면과 `kro.kr` 도메인 목록 캡처를 요청

**[5] 요청**
> 개발과 관련된 설명, 구현된 게시판 기능, 사용한 프롬프트와 에이전트의 응답 등 관련 자료를 관련성 있는 정보들을 다른 markdown파일로 작성

**응답**: 이 파일(`docs/DEVELOPMENT.md`)을 작성함.

### 10.2 이전 개발 세션에 대하여

이 세션에서는 사이트 구현 자체를 하지 않았고, 구현 기록은 저장소의 커밋 이력(9장)과 코드를 근거로 정리했습니다. 사이트를 처음 만들 때 사용한 프롬프트와 에이전트 응답은 이 세션 기록에 없으므로 이 문서에 포함하지 않았습니다. 해당 자료가 있다면 아래 형식으로 추가하면 됩니다.

```markdown
### [날짜] 요청
> 프롬프트 원문

**응답 요약**
- ...
```

---

## 11. 알려진 한계와 향후 과제

- 데모 모드는 브라우저별로 데이터가 따로 저장되므로 여러 사람이 함께 쓸 수 없음 → Supabase 모드 사용
- 데모 모드 이미지는 1MB 이하로 제한됨
- 검색은 `ilike %…%` 패턴 매칭이라 글이 많아지면 느려질 수 있음 (전문 검색 미사용)
- 이메일 인증 메일의 링크는 Supabase Site URL 설정에 따라 달라짐 (9장 참고)
- 관리자 지정은 SQL로만 가능함 (화면에서 관리자 권한을 주는 기능 없음)
- 댓글에는 대댓글과 수정 기능이 없음
- 테스트 코드와 자동 검증 절차가 없음
