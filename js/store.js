// 데이터 계층: Supabase 설정이 있으면 원격, 없으면 localStorage 데모 모드
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const fail = (m) => { throw new Error(m); };
const validUrl = (u) => !u || /^https?:\/\/\S+$/i.test(u) || /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(u);
const MAX_BYTES = 5 * 1024 * 1024;

// 첨부 이미지 검사 + 큰 이미지는 축소(JPEG)해서 용량을 줄인다. GIF 는 움직임 보존을 위해 그대로 둔다.
async function prepImage(file, maxSide) {
  if (!/^image\/(png|jpeg|gif|webp)$/.test(file?.type || '')) fail('PNG · JPG · GIF · WEBP 이미지만 첨부할 수 있습니다.');
  if (file.type !== 'image/gif') {
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
      if (k < 1 || file.size > 1024 * 1024) {
        const c = document.createElement('canvas');
        c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
        const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
        if (blob && blob.size < file.size) return blob;
      }
    } catch { /* 축소 실패 시 원본 사용 */ }
  }
  if (file.size > MAX_BYTES) fail('이미지는 5MB 이하만 첨부할 수 있습니다.');
  return file;
}
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

function checkPost({ title, content, image_url }) {
  if (!title?.trim()) fail('제목을 입력하세요.');
  if (!content?.trim()) fail('내용을 입력하세요.');
  if (!validUrl(image_url)) fail('첨부 이미지가 올바르지 않습니다.');
}
function checkSignUp({ email, password, nickname }) {
  if (!/^\S+@\S+\.\S+$/.test(email || '')) fail('이메일 형식이 올바르지 않습니다.');
  if ((password || '').length < 6) fail('비밀번호는 6자 이상이어야 합니다.');
  if (!/^\S{2,16}$/.test(nickname || '')) fail('닉네임은 공백 없이 2~16자여야 합니다.');
}
function checkNick(n) { if (!/^\S{2,16}$/.test(n || '')) fail('닉네임은 공백 없이 2~16자여야 합니다.'); }
function checkBoard({ slug, name }) {
  if (!/^[a-z0-9-]{2,20}$/.test(slug || '')) fail('주소(slug)는 영문 소문자·숫자·하이픈 2~20자입니다.');
  if (!name?.trim()) fail('게시판 이름을 입력하세요.');
}

/* ───────────── 데모 모드 (localStorage) ───────────── */
function makeLocal() {
  const KEY = 'cl_db', SKEY = 'cl_session';
  const now = () => new Date().toISOString();
  const seed = () => ({
    seq: 10,
    users: [{ id: 'system', email: '', pw: '', nickname: '운영팀', role: 'admin', created_at: now() }],
    boards: [
      { id: 1, slug: 'notice', name: '공지사항', description: '운영진이 전하는 소식', type: 'list', write_role: 'admin', sort: 10 },
      { id: 2, slug: 'free', name: '자유게시판', description: '자유롭게 이야기를 나눠요', type: 'list', write_role: 'member', sort: 20 },
      { id: 3, slug: 'qna', name: '질문답변', description: '궁금한 것을 묻고 답해요', type: 'qna', write_role: 'member', sort: 30 },
      { id: 4, slug: 'gallery', name: '갤러리', description: '이미지를 공유하는 공간', type: 'gallery', write_role: 'member', sort: 40 },
      { id: 5, slug: 'data', name: '자료실', description: '과제·강의 자료 공유', type: 'list', write_role: 'member', sort: 50 },
    ],
    posts: [{
      id: 1, board_id: 1, author_id: 'system', title: '캠퍼스 로비에 오신 것을 환영합니다',
      content: '통합 게시판이 열렸습니다.\n\n회원가입 후 각 게시판에서 글과 댓글을 남겨보세요.\n처음 가입한 회원이 관리자가 되어 게시판을 추가·삭제할 수 있습니다. (데모 모드)',
      image_url: '', views: 0, created_at: now(), updated_at: now(),
    }],
    comments: [], likes: [],
  });
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { db = seed(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* 저장 불가 환경 */ } };
  const hash = async (s) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  const pub = (u) => u && { id: u.id, email: u.email, nickname: u.nickname, role: u.role, created_at: u.created_at };
  const meRaw = () => { let id = null; try { id = localStorage.getItem(SKEY); } catch {} return db.users.find((u) => u.id === id) || null; };
  const need = () => meRaw() || fail('로그인이 필요합니다.');
  const needAdmin = () => { const u = need(); if (u.role !== 'admin') fail('관리자만 가능합니다.'); return u; };
  const row = (p) => {
    const b = db.boards.find((x) => x.id === p.board_id) || {};
    return {
      ...p, author_name: db.users.find((u) => u.id === p.author_id)?.nickname || '탈퇴회원',
      board_slug: b.slug, board_name: b.name,
      comment_count: db.comments.filter((c) => c.post_id === p.id).length,
      like_count: db.likes.filter((l) => l.post_id === p.id).length,
    };
  };

  return {
    mode: 'local',
    async currentUser() { return pub(meRaw()); },
    async signUp(f) {
      checkSignUp(f);
      if (db.users.some((u) => u.email === f.email)) fail('이미 가입된 이메일입니다.');
      if (db.users.some((u) => u.nickname === f.nickname)) fail('이미 사용 중인 닉네임입니다.');
      const u = { id: 'u' + (++db.seq), email: f.email, pw: await hash(f.password), nickname: f.nickname,
        role: db.users.length === 1 ? 'admin' : 'member', created_at: now() };
      db.users.push(u); save(); localStorage.setItem(SKEY, u.id);
      return { needsConfirm: false };
    },
    async signIn({ email, password }) {
      const pw = await hash(password || '');
      const u = db.users.find((x) => x.email === email && x.pw === pw && x.id !== 'system');
      if (!u) fail('이메일 또는 비밀번호가 올바르지 않습니다.');
      localStorage.setItem(SKEY, u.id);
    },
    async signOut() { localStorage.removeItem(SKEY); },
    async updateNickname(n) {
      const u = need(); n = (n || '').trim(); checkNick(n);
      if (n === u.nickname) return;
      if (db.users.some((x) => x.nickname === n)) fail('이미 사용 중인 닉네임입니다.');
      u.nickname = n; save();
    },
    async uploadImage(file) {
      need();
      const blob = await prepImage(file, 1000);
      if (blob.size > 1024 * 1024) fail('데모 모드에서는 1MB 이하 이미지만 첨부할 수 있습니다.');
      return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result); r.onerror = () => rej(new Error('이미지를 읽지 못했습니다.'));
        r.readAsDataURL(blob);
      });
    },
    async listBoards() { return [...db.boards].sort((a, b) => a.sort - b.sort); },
    async createBoard(f) {
      needAdmin(); checkBoard(f);
      if (db.boards.some((b) => b.slug === f.slug)) fail('이미 존재하는 주소입니다.');
      db.boards.push({ id: ++db.seq, slug: f.slug, name: f.name.trim(), description: f.description || '',
        type: f.type || 'list', write_role: f.write_role || 'member', sort: 100 + db.seq });
      save();
    },
    async deleteBoard(id) {
      needAdmin();
      const ids = db.posts.filter((p) => p.board_id === id).map((p) => p.id);
      db.posts = db.posts.filter((p) => p.board_id !== id);
      db.comments = db.comments.filter((c) => !ids.includes(c.post_id));
      db.likes = db.likes.filter((l) => !ids.includes(l.post_id));
      db.boards = db.boards.filter((b) => b.id !== id); save();
    },
    async listPosts({ boardId, q, authorId, page = 1, pageSize = 10 } = {}) {
      const s = (q || '').trim().toLowerCase();
      const all = db.posts.filter((p) => (!boardId || p.board_id === boardId) && (!authorId || p.author_id === authorId)
        && (!s || p.title.toLowerCase().includes(s) || p.content.toLowerCase().includes(s)))
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
      return { total: all.length, items: all.slice((page - 1) * pageSize, page * pageSize).map(row) };
    },
    async getPost(id, { view = true } = {}) {
      const p = db.posts.find((x) => x.id === id); if (!p) return null;
      if (view) { p.views++; save(); }
      const u = meRaw();
      return { ...row(p), liked: !!u && db.likes.some((l) => l.post_id === id && l.user_id === u.id) };
    },
    async createPost(boardId, f) {
      const u = need(); checkPost(f);
      const b = db.boards.find((x) => x.id === boardId) || fail('게시판이 없습니다.');
      if (b.write_role === 'admin' && u.role !== 'admin') fail('이 게시판은 관리자만 작성할 수 있습니다.');
      const p = { id: ++db.seq, board_id: boardId, author_id: u.id, title: f.title.trim(), content: f.content,
        image_url: f.image_url || '', views: 0, created_at: now(), updated_at: now() };
      db.posts.push(p); save(); return p.id;
    },
    async updatePost(id, f) {
      const u = need(); checkPost(f);
      const p = db.posts.find((x) => x.id === id) || fail('글이 없습니다.');
      if (p.author_id !== u.id) fail('본인 글만 수정할 수 있습니다.');
      Object.assign(p, { title: f.title.trim(), content: f.content, image_url: f.image_url || '', updated_at: now() }); save();
    },
    async deletePost(id) {
      const u = need(); const p = db.posts.find((x) => x.id === id) || fail('글이 없습니다.');
      if (p.author_id !== u.id && u.role !== 'admin') fail('삭제 권한이 없습니다.');
      db.posts = db.posts.filter((x) => x.id !== id);
      db.comments = db.comments.filter((c) => c.post_id !== id);
      db.likes = db.likes.filter((l) => l.post_id !== id); save();
    },
    async listComments(postId) {
      return db.comments.filter((c) => c.post_id === postId)
        .map((c) => ({ ...c, author_name: db.users.find((u) => u.id === c.author_id)?.nickname || '탈퇴회원' }));
    },
    async addComment(postId, content) {
      const u = need(); if (!content?.trim()) fail('댓글 내용을 입력하세요.');
      db.comments.push({ id: ++db.seq, post_id: postId, author_id: u.id, content: content.trim(), created_at: now() }); save();
    },
    async deleteComment(id) {
      const u = need(); const c = db.comments.find((x) => x.id === id); if (!c) return;
      if (c.author_id !== u.id && u.role !== 'admin') fail('삭제 권한이 없습니다.');
      db.comments = db.comments.filter((x) => x.id !== id); save();
    },
    async toggleLike(postId) {
      const u = need();
      const i = db.likes.findIndex((l) => l.post_id === postId && l.user_id === u.id);
      if (i >= 0) db.likes.splice(i, 1); else db.likes.push({ post_id: postId, user_id: u.id });
      save();
    },
    async stats() { return { posts: db.posts.length, comments: db.comments.length, members: db.users.length - 1 }; },
    async myStats(uid) {
      return { posts: db.posts.filter((p) => p.author_id === uid).length, comments: db.comments.filter((c) => c.author_id === uid).length };
    },
  };
}

/* ───────────── Supabase 모드 ───────────── */
async function makeRemote() {
  // supabase-js 2.45.4 (js/vendor 에 포함된 UMD 빌드)
  await new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = new URL('./vendor/supabase.js', import.meta.url).href;
    sc.onload = res; sc.onerror = () => rej(new Error('Supabase 라이브러리를 불러오지 못했습니다.'));
    document.head.append(sc);
  });
  const { createClient } = window.supabase;
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const MSG = [
    [/invalid login credentials/i, '이메일 또는 비밀번호가 올바르지 않습니다.'],
    [/email not confirmed/i, '이메일 인증이 완료되지 않았습니다. 메일함을 확인하세요.'],
    [/already registered/i, '이미 가입된 이메일입니다.'],
    [/row-level security|permission denied/i, '권한이 없습니다.'],
    [/rate limit/i, '요청이 너무 많습니다. 잠시 후 다시 시도하세요.'],
    [/duplicate key/i, '이미 존재하는 값입니다.'],
  ];
  const ok = ({ data, error, count }) => {
    if (error) fail((MSG.find(([re]) => re.test(error.message)) || [])[1] || error.message);
    return count === undefined || count === null ? data : { data, count };
  };
  const uid = async () => (await sb.auth.getSession()).data.session?.user?.id || null;
  const need = async () => (await uid()) || fail('로그인이 필요합니다.');
  const POST = 'id,title,image_url,views,created_at,updated_at,board_id,author_id,author:profiles!posts_author_id_fkey(nickname),board:boards(slug,name),comments(count),likes(count)';
  const row = (r) => r && ({
    ...r, author_name: r.author?.nickname || '탈퇴회원', board_slug: r.board?.slug, board_name: r.board?.name,
    comment_count: r.comments?.[0]?.count ?? 0, like_count: r.likes?.[0]?.count ?? 0,
  });
  const cnt = async (q) => (await q).count || 0;
  const BUCKET = 'images', PUB = `/storage/v1/object/public/${BUCKET}/`;
  // 글에서 빠진 첨부 파일 정리 (본인 폴더만 지워지며, 실패해도 무시)
  const dropImage = async (url) => {
    const i = (url || '').indexOf(PUB); if (i < 0) return;
    try { await sb.storage.from(BUCKET).remove([decodeURIComponent(url.slice(i + PUB.length))]); } catch { /* 무시 */ }
  };
  const imageOf = async (id) => (await sb.from('posts').select('image_url').eq('id', id).maybeSingle()).data?.image_url || '';

  return {
    mode: 'supabase',
    async currentUser() {
      const u = (await sb.auth.getSession()).data.session?.user; if (!u) return null;
      const p = ok(await sb.from('profiles').select('*').eq('id', u.id).maybeSingle());
      return p ? { ...p, email: u.email } : null;
    },
    async signUp(f) {
      checkSignUp(f);
      if (ok(await sb.rpc('nickname_taken', { n: f.nickname }))) fail('이미 사용 중인 닉네임입니다.');
      const data = ok(await sb.auth.signUp({ email: f.email, password: f.password, options: { data: { nickname: f.nickname } } }));
      // 이메일 인증이 켜져 있고 이미 가입된 주소면 identities 가 빈 배열로 온다
      if (data.user && data.user.identities && data.user.identities.length === 0) fail('이미 가입된 이메일입니다.');
      return { needsConfirm: !data.session };
    },
    async signIn({ email, password }) { ok(await sb.auth.signInWithPassword({ email, password })); },
    async signOut() { await sb.auth.signOut(); },
    async updateNickname(n) {
      const u = await need(); n = (n || '').trim(); checkNick(n);
      const { data, error } = await sb.from('profiles').update({ nickname: n }).eq('id', u).select('id');
      if (error) fail(/duplicate key/i.test(error.message) ? '이미 사용 중인 닉네임입니다.' : error.message);
      if (!data?.length) fail('닉네임을 변경하지 못했습니다.');
    },
    async uploadImage(file) {
      const u = await need();
      const blob = await prepImage(file, 1600);
      const path = `${u}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT[blob.type] || 'jpg'}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
      if (error) fail(/bucket not found/i.test(error.message) ? '이미지 저장소가 없습니다. supabase/storage.sql 을 실행하세요.'
        : /row-level security|unauthorized/i.test(error.message) ? '이미지 업로드 권한이 없습니다.' : error.message);
      return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    },
    async listBoards() { return ok(await sb.from('boards').select('*').order('sort')); },
    async createBoard(f) {
      checkBoard(f);
      ok(await sb.from('boards').insert({ slug: f.slug, name: f.name.trim(), description: f.description || '',
        type: f.type || 'list', write_role: f.write_role || 'member', sort: 100 + (Date.now() / 1000 | 0) % 100000 }));
    },
    async deleteBoard(id) { ok(await sb.from('boards').delete().eq('id', id)); },
    async listPosts({ boardId, q, authorId, page = 1, pageSize = 10 } = {}) {
      let query = sb.from('posts').select(POST, { count: 'exact' }).order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (boardId) query = query.eq('board_id', boardId);
      if (authorId) query = query.eq('author_id', authorId);
      const s = (q || '').replace(/[,()%*\\"]/g, ' ').trim();
      if (s) query = query.or(`title.ilike.%${s}%,content.ilike.%${s}%`);
      const { data, count } = ok({ ...(await query) });
      return { total: count || 0, items: (data || []).map(row) };
    },
    async getPost(id, { view = true } = {}) {
      if (view) await sb.rpc('increment_views', { pid: id });
      const p = row(ok(await sb.from('posts').select(POST + ',content').eq('id', id).maybeSingle()));
      if (!p) return null;
      const u = await uid();
      p.liked = !!u && !!ok(await sb.from('likes').select('post_id').eq('post_id', id).eq('user_id', u).maybeSingle());
      return p;
    },
    async createPost(boardId, f) {
      const u = await need(); checkPost(f);
      return ok(await sb.from('posts').insert({ board_id: boardId, author_id: u, title: f.title.trim(), content: f.content,
        image_url: f.image_url || '' }).select('id').single()).id;
    },
    async updatePost(id, f) {
      await need(); checkPost(f);
      const old = await imageOf(id);
      ok(await sb.from('posts').update({ title: f.title.trim(), content: f.content, image_url: f.image_url || '',
        updated_at: new Date().toISOString() }).eq('id', id));
      if (old && old !== (f.image_url || '')) await dropImage(old);
    },
    async deletePost(id) { await need(); const old = await imageOf(id); ok(await sb.from('posts').delete().eq('id', id)); await dropImage(old); },
    async listComments(postId) {
      return ok(await sb.from('comments').select('*,author:profiles(nickname)').eq('post_id', postId).order('created_at'))
        .map((c) => ({ ...c, author_name: c.author?.nickname || '탈퇴회원' }));
    },
    async addComment(postId, content) {
      const u = await need(); if (!content?.trim()) fail('댓글 내용을 입력하세요.');
      ok(await sb.from('comments').insert({ post_id: postId, author_id: u, content: content.trim() }));
    },
    async deleteComment(id) { await need(); ok(await sb.from('comments').delete().eq('id', id)); },
    async toggleLike(postId) {
      const u = await need();
      const has = ok(await sb.from('likes').select('post_id').eq('post_id', postId).eq('user_id', u).maybeSingle());
      if (has) ok(await sb.from('likes').delete().eq('post_id', postId).eq('user_id', u));
      else ok(await sb.from('likes').insert({ post_id: postId, user_id: u }));
    },
    async stats() {
      const h = { count: 'exact', head: true };
      const [posts, comments, members] = await Promise.all([
        cnt(sb.from('posts').select('id', h)), cnt(sb.from('comments').select('id', h)), cnt(sb.from('profiles').select('id', h)),
      ]);
      return { posts, comments, members };
    },
    async myStats(id) {
      const h = { count: 'exact', head: true };
      const [posts, comments] = await Promise.all([
        cnt(sb.from('posts').select('id', h).eq('author_id', id)), cnt(sb.from('comments').select('id', h).eq('author_id', id)),
      ]);
      return { posts, comments };
    },
  };
}

export const store = SUPABASE_URL && SUPABASE_ANON_KEY ? await makeRemote() : makeLocal();
