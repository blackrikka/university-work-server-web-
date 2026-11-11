# CAMPUS LOBBY — 통합 게시판

GitHub Pages로 호스팅하고 Supabase(무료)를 데이터 서버로 쓰는 복합 다중 게시판입니다.
빌드 과정이 없는 순수 HTML/CSS/JS 정적 사이트입니다.

## 기능

- 이메일·비밀번호 회원가입 / 로그인 / 로그아웃
- 다중 게시판: 일반 목록 · 갤러리 · Q&A 형태, 게시판별 글쓰기 권한(회원 / 관리자만)
- 전체 게시판(통합 보기)과 통합 검색, 게시판 내 검색, 페이지네이션
- 글 작성·수정·삭제, 이미지 파일 첨부, 댓글, 좋아요, 조회수
- 관리자: 게시판 추가·삭제, 모든 글·댓글 삭제
- 로비 화면: 플레이어 카드(레벨·EXP), 통계, 공지, 최신글, 게시판 독
- 브라운관(CRT) 녹색 단색 모니터 풍 테마

## 실행 모드

| 모드 | 조건 | 저장 위치 |
| --- | --- | --- |
| 데모 | `js/config.js` 값이 비어 있음 | 브라우저 localStorage (본인만 보임, 첫 가입자가 관리자) |
| Supabase | `js/config.js`에 URL·anon 키 입력 | Supabase DB (모든 방문자 공유) |

## Supabase 연결 (실제 회원가입)

1. <https://supabase.com> 에서 프로젝트를 만듭니다.
2. **SQL Editor**에 `supabase/schema.sql` 전체를 붙여넣고 실행합니다.
   이어서 `supabase/storage.sql`도 실행합니다(이미지 첨부용 저장소).
3. **Project Settings → API**에서 `Project URL`과 `anon public` 키를 복사해 `js/config.js`에 넣습니다.
   (`service_role` 키는 절대 넣지 마세요.)
4. 사이트에서 회원가입한 뒤, SQL Editor에서 본인을 관리자로 지정합니다.
   ```sql
   update public.profiles set role = 'admin' where nickname = '내닉네임';
   ```
5. 기본값은 가입 시 이메일 인증이 필요합니다. 끄려면 **Authentication → Sign In / Providers → Email → Confirm email**을 해제하세요.
   켜 둘 경우 **Authentication → URL Configuration → Site URL**을 Pages 주소로 바꿔야 인증 링크가 사이트로 돌아옵니다.

## GitHub Pages 배포

1. 저장소 **Settings → Pages → Source**를 **GitHub Actions**로 설정합니다.
2. `main` 브랜치에 push하면 `.github/workflows/pages.yml`이 자동 배포합니다.

## 로컬 실행

```bash
python3 -m http.server 8000
```

브라우저에서 <http://localhost:8000> 을 엽니다. (ES 모듈을 쓰므로 파일을 직접 열면 동작하지 않습니다.)

## 구조

```
index.html            진입점
css/style.css         스타일
js/config.js          Supabase 설정
js/store.js           데이터 계층 (Supabase / 데모 어댑터)
js/app.js             라우터와 화면
supabase/schema.sql   테이블 · RLS 정책 · 기본 게시판
supabase/storage.sql  이미지 첨부 저장소(버킷) · 업로드 정책
```
