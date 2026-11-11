-- 이미지 첨부용 저장소. Supabase 대시보드 → SQL Editor 에서 실행하세요. (schema.sql 실행 후)
-- 공개 버킷: 누구나 볼 수 있고, 업로드는 로그인한 회원이 자기 폴더(회원 id)에만 가능합니다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880, array['image/png','image/jpeg','image/gif','image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "images upload own folder" on storage.objects;
create policy "images upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "images delete own folder" on storage.objects;
create policy "images delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

-- 삭제하려면 자기 파일을 조회할 수 있어야 합니다. (공개 주소로 보는 것은 이 정책과 무관하게 가능)
drop policy if exists "images read own folder" on storage.objects;
create policy "images read own folder" on storage.objects for select to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
