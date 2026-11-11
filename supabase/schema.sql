-- 캠퍼스 로비 통합 게시판 스키마
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여넣고 Run 하세요.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text unique not null check (char_length(nickname) between 2 and 16),
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.boards (
  id bigint generated always as identity primary key,
  slug text unique not null check (slug ~ '^[a-z0-9-]{2,20}$'),
  name text not null,
  description text not null default '',
  type text not null default 'list' check (type in ('list','gallery','qna')),
  write_role text not null default 'member' check (write_role in ('member','admin')),
  sort int not null default 100
);

create table if not exists public.posts (
  id bigint generated always as identity primary key,
  board_id bigint not null references public.boards(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  content text not null check (char_length(content) between 1 and 20000),
  image_url text not null default '',
  views int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_board_idx on public.posts(board_id, created_at desc);

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments(post_id, created_at);

create table if not exists public.likes (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (post_id, user_id)
);

-- 가입 시 프로필 자동 생성
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'nickname',''), split_part(new.email,'@',1)));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.increment_views(pid bigint) returns void
language sql security definer set search_path = public as $$
  update posts set views = views + 1 where id = pid;
$$;

-- 닉네임 중복 확인 (가입 전, 비로그인 상태에서 호출)
create or replace function public.nickname_taken(n text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where nickname = n);
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.boards   enable row level security;
alter table public.posts    enable row level security;
alter table public.comments enable row level security;
alter table public.likes    enable row level security;

create policy "profiles read"  on public.profiles for select using (true);
create policy "profiles update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- role 컬럼은 사용자가 직접 바꿀 수 없도록 닉네임만 수정 허용
revoke update on public.profiles from anon, authenticated;
grant update (nickname) on public.profiles to authenticated;

create policy "boards read"   on public.boards for select using (true);
create policy "boards admin insert" on public.boards for insert with check (public.is_admin());
create policy "boards admin update" on public.boards for update using (public.is_admin());
create policy "boards admin delete" on public.boards for delete using (public.is_admin());

create policy "posts read" on public.posts for select using (true);
create policy "posts insert" on public.posts for insert with check (
  author_id = auth.uid() and (
    public.is_admin() or exists (select 1 from public.boards b where b.id = board_id and b.write_role = 'member')
  )
);
create policy "posts update own" on public.posts for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "posts delete own or admin" on public.posts for delete using (author_id = auth.uid() or public.is_admin());
-- 조회수/작성자/게시판은 직접 수정 불가 (조회수는 increment_views 로만 증가)
revoke update on public.posts from anon, authenticated;
grant update (title, content, image_url, updated_at) on public.posts to authenticated;

create policy "comments read" on public.comments for select using (true);
create policy "comments insert" on public.comments for insert with check (author_id = auth.uid());
create policy "comments delete own or admin" on public.comments for delete using (author_id = auth.uid() or public.is_admin());

create policy "likes read" on public.likes for select using (true);
create policy "likes insert" on public.likes for insert with check (user_id = auth.uid());
create policy "likes delete" on public.likes for delete using (user_id = auth.uid());

-- 기본 게시판
insert into public.boards (slug, name, description, type, write_role, sort) values
  ('notice',  '공지사항',   '운영진이 전하는 소식',        'list',    'admin',  10),
  ('free',    '자유게시판', '자유롭게 이야기를 나눠요',    'list',    'member', 20),
  ('qna',     '질문답변',   '궁금한 것을 묻고 답해요',     'qna',     'member', 30),
  ('gallery', '갤러리',     '이미지를 공유하는 공간',      'gallery', 'member', 40),
  ('data',    '자료실',     '과제·강의 자료 공유',         'list',    'member', 50)
on conflict (slug) do nothing;

-- 관리자 지정: 가입 후 아래 문장을 본인 닉네임으로 실행하세요.
-- update public.profiles set role = 'admin' where nickname = '내닉네임';
