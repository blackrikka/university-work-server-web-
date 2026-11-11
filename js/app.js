import { store } from './store.js';

const $app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeImg = (u) => (/^https?:\/\/\S+$/i.test(u || '') || /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(u || '') ? u : '');
const fmt = (iso) => {
  const d = new Date(iso), n = new Date(), p = (x) => String(x).padStart(2, '0');
  return d.toDateString() === n.toDateString() ? `${p(d.getHours())}:${p(d.getMinutes())}`
    : `${d.getFullYear() === n.getFullYear() ? '' : d.getFullYear() + '.'}${p(d.getMonth() + 1)}.${p(d.getDate())}`;
};
const full = (iso) => new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  list: I('<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'),
  gallery: I('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>'),
  qna: I('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>'),
  notice: I('<path d="M4 10v4h3l6 4V6l-6 4H4zM17 9a4 4 0 0 1 0 6"/>'),
  all: I('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  post: I('<path d="M5 3h10l4 4v14H5z"/><path d="M9 12h6M9 16h6"/>'),
  chat: I('<path d="M4 5h16v11H9l-5 4z"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  heart: I('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>'),
  back: I('<path d="m14 5-7 7 7 7"/>'),
  home: I('<path d="m3 11 9-8 9 8M5 10v10h14V10"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'),
  eye: I('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
};
const boardIcon = (b) => (b.slug === 'notice' ? ICON.notice : ICON[b.type] || ICON.list);

const PAL = ['var(--blue)', 'var(--pink)', 'var(--mint)', 'var(--amber)', 'var(--violet)', 'var(--coral)'];
const ac = (boardId) => { const i = boards.findIndex((b) => b.id === boardId); return `--ac:${PAL[(i < 0 ? 0 : i) % PAL.length]}`; };
let me = null, boards = [];
const canWrite = (b) => !!me && (b.write_role === 'member' || me.role === 'admin');

function toast(msg, bad) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; t.setAttribute('role', 'status');
  document.body.append(t); setTimeout(() => t.remove(), 2800);
}
const go = (h) => { if (location.hash === h) render(); else location.hash = h; };

function parse() {
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  return { seg: path.split('/').filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(qs || '') };
}

/* ───── 공통 조각 ───── */
const sky = () => `<div class="sky" aria-hidden="true"><i class="halo"></i><i class="cloud c1"></i><i class="cloud c2"></i><i class="cloud c3"></i>
  <i class="tri t1"></i><i class="tri t2"></i><i class="grid"></i></div>`;

const userChip = () => me
  ? `<a class="pill link" href="#/me">${ICON.user}<b>${esc(me.nickname)}</b></a><button class="pill link" data-act="logout">로그아웃</button>`
  : `<a class="pill link" href="#/login">로그인</a><a class="pill link solid" href="#/signup">회원가입</a>`;

const shell = (title, sub, back, body, accent = '') => `${sky()}<div class="page" style="${accent}">
  <header class="topbar">
    <a class="back" href="${back}" aria-label="뒤로">${ICON.back}</a>
    <div class="ttl"><h1>${esc(title)}</h1>${sub ? `<span>${esc(sub)}</span>` : ''}</div>
    <div class="res">${userChip()}<a class="pill link ico" href="#/" aria-label="로비">${ICON.home}</a></div>
  </header>
  <main class="panel">${body}</main></div>`;

function pager(total, page, size, base) {
  const last = Math.max(1, Math.ceil(total / size)); if (last === 1) return '';
  const from = Math.max(1, Math.min(page - 2, last - 4)), to = Math.min(last, from + 4);
  let h = '';
  for (let i = from; i <= to; i++) h += `<a class="${i === page ? 'on' : ''}" href="${base(i)}">${i}</a>`;
  return `<nav class="pager" aria-label="페이지">${page > 1 ? `<a href="${base(page - 1)}">‹</a>` : ''}${h}${page < last ? `<a href="${base(page + 1)}">›</a>` : ''}</nav>`;
}

function postList(items, { showBoard, type }) {
  if (!items.length) return `<p class="empty">아직 글이 없습니다.</p>`;
  if (type === 'gallery') {
    return `<div class="gal">${items.map((p) => `<a class="card" href="#/p/${p.id}">
      <div class="thumb">${safeImg(p.image_url) ? `<img src="${esc(p.image_url)}" alt="" loading="lazy">` : ICON.gallery}</div>
      <b>${esc(p.title)}</b><small>${esc(p.author_name)} · ${fmt(p.created_at)}</small></a>`).join('')}</div>`;
  }
  return `<ul class="plist">${items.map((p) => `<li><a href="#/p/${p.id}">
    ${showBoard ? `<span class="tag" style="${ac(p.board_id)}">${esc(p.board_name)}</span>` : ''}
    ${type === 'qna' ? `<span class="tag ${p.comment_count ? 'done' : 'wait'}">${p.comment_count ? '답변완료' : '답변대기'}</span>` : ''}
    <span class="t">${esc(p.title)}${p.comment_count ? ` <em>[${p.comment_count}]</em>` : ''}</span>
    <span class="m">${esc(p.author_name)}</span><span class="m n">${ICON.eye}${p.views}</span>
    <span class="m n">${ICON.heart}${p.like_count}</span><span class="m d">${fmt(p.created_at)}</span></a></li>`).join('')}</ul>`;
}

/* ───── 화면 ───── */
async function vLobby() {
  const notice = boards.find((b) => b.slug === 'notice');
  const [st, nt, rc, ms] = await Promise.all([
    store.stats(),
    notice ? store.listPosts({ boardId: notice.id, pageSize: 3 }) : { items: [] },
    store.listPosts({ pageSize: 6 }),
    me ? store.myStats(me.id) : null,
  ]);
  const xp = ms ? ms.posts * 10 + ms.comments * 3 : 0, lv = 1 + Math.floor(xp / 30), pct = Math.round(((xp % 30) / 30) * 100);
  return `${sky()}<div class="lobby">
  <header class="hud-top">
    <a class="player" href="${me ? '#/me' : '#/login'}">
      <span class="lv"><small>Lv.</small>${me ? lv : '–'}</span>
      <span class="pinfo"><b>${me ? esc(me.nickname) : '게스트'}</b>
        <span class="exp"><i style="width:${me ? pct : 0}%"></i></span>
        <small>${me ? `EXP ${xp % 30} / 30${me.role === 'admin' ? ' · 관리자' : ''}` : '로그인하고 시작하기'}</small></span>
    </a>
    <div class="res">
      <span class="pill" title="전체 글">${ICON.post}<b>${st.posts}</b></span>
      <span class="pill" style="--ac:var(--pink)" title="전체 댓글">${ICON.chat}<b>${st.comments}</b></span>
      <span class="pill" style="--ac:var(--mint)" title="회원 수">${ICON.user}<b>${st.members}</b></span>
      ${me?.role === 'admin' ? `<a class="pill link ico" href="#/admin" aria-label="게시판 관리">${ICON.gear}</a>` : ''}
      ${me ? `<button class="pill link" data-act="logout">로그아웃</button>` : `<a class="pill link" href="#/login">로그인</a><a class="pill link solid" href="#/signup">회원가입</a>`}
    </div>
  </header>

  <div class="hud-mid">
    <section class="brand">
      <p class="kicker">INTEGRATED BOARD</p>
      <h1>CAMPUS<br><span>LOBBY</span></h1>
      <p class="lead">공지부터 질문, 갤러리까지 — 모든 게시판을 한 곳에서.</p>
      <form class="search" data-form="search"><input name="q" placeholder="통합 검색" aria-label="통합 검색"><button>검색</button></form>
      ${notice ? `<div class="notice"><h2>${ICON.notice}NOTICE<a href="#/b/notice">더보기</a></h2>
        ${nt.items.length ? nt.items.map((p) => `<a href="#/p/${p.id}"><span>${esc(p.title)}</span><time>${fmt(p.created_at)}</time></a>`).join('') : '<p class="empty sm">등록된 공지가 없습니다.</p>'}</div>` : ''}
    </section>

    <section class="feed">
      <h2><span>NEW</span> 최신글<a href="#/all">전체보기</a></h2>
      ${rc.items.length ? rc.items.map((p) => `<a class="row" href="#/p/${p.id}">
        <span class="tag" style="${ac(p.board_id)}">${esc(p.board_name)}</span><span class="t">${esc(p.title)}${p.comment_count ? ` <em>[${p.comment_count}]</em>` : ''}</span>
        <time>${fmt(p.created_at)}</time></a>`).join('') : '<p class="empty sm">첫 글을 남겨보세요.</p>'}
    </section>
  </div>

  <nav class="hud-bottom" aria-label="게시판">
    <div class="dock">${boards.map((b) => `<a class="dbtn" style="${ac(b.id)}" href="#/b/${esc(b.slug)}"><span>${boardIcon(b)}<b>${esc(b.name)}</b></span></a>`).join('')}</div>
    <a class="big" href="#/all"><span>${ICON.all}<b>전체 게시판</b><small>ALL BOARDS</small></span></a>
  </nav>
  ${store.mode === 'local' ? '<p class="demo">데모 모드 · 데이터가 이 브라우저에만 저장됩니다</p>' : ''}
</div>`;
}

async function vBoard(slug, q) {
  const all = slug === null, b = all ? null : boards.find((x) => x.slug === slug);
  if (!all && !b) return shell('게시판 없음', '', '#/', '<p class="empty">존재하지 않는 게시판입니다.</p>');
  const page = Math.max(1, +q.get('page') || 1), s = q.get('q') || '', size = b?.type === 'gallery' ? 12 : 10;
  const { items, total } = await store.listPosts({ boardId: b?.id, q: s, page, pageSize: size });
  const path = all ? '#/all' : `#/b/${slug}`;
  const base = (p) => `${path}?page=${p}${s ? `&q=${encodeURIComponent(s)}` : ''}`;
  return shell(all ? '전체 게시판' : b.name, all ? '모든 게시판의 글을 모아 봅니다' : b.description, '#/', `
    <div class="tabs"><a class="${all ? 'on' : ''}" href="#/all">전체</a>${boards.map((x) => `<a class="${x.slug === slug ? 'on' : ''}" style="${ac(x.id)}" href="#/b/${esc(x.slug)}">${esc(x.name)}</a>`).join('')}</div>
    <div class="bar">
      <form class="search" data-form="bsearch" data-path="${path}"><input name="q" value="${esc(s)}" placeholder="제목·내용 검색" aria-label="검색"><button>검색</button></form>
      <span class="count">총 <b>${total}</b>건${s ? ` · “${esc(s)}”` : ''}</span>
      ${b ? (canWrite(b) ? `<a class="btn" href="#/write/${esc(b.slug)}">글쓰기</a>`
        : `<span class="hint">${me ? '관리자 전용' : '<a href="#/login">로그인</a> 후 작성'}</span>`) : ''}
    </div>
    ${postList(items, { showBoard: all, type: b?.type })}
    ${pager(total, page, size, base)}`, b ? ac(b.id) : '');
}

async function vPost(id) {
  const p = await store.getPost(id);
  if (!p) return shell('글 없음', '', '#/', '<p class="empty">삭제되었거나 없는 글입니다.</p>');
  const cs = await store.listComments(id), b = boards.find((x) => x.id === p.board_id), qna = b?.type === 'qna';
  const mine = me && me.id === p.author_id, adm = me?.role === 'admin', img = safeImg(p.image_url);
  return shell(p.board_name || '게시글', '', `#/b/${p.board_slug}`, `
    <article class="post">
      <h2>${esc(p.title)}</h2>
      <p class="meta"><b>${esc(p.author_name)}</b><span>${full(p.created_at)}</span><span>${ICON.eye}${p.views}</span></p>
      ${img ? `<img class="pimg" src="${esc(img)}" alt="첨부 이미지">` : ''}
      <div class="body">${esc(p.content)}</div>
      <div class="acts">
        <button class="like ${p.liked ? 'on' : ''}" data-act="like" data-id="${p.id}" aria-pressed="${p.liked}">${ICON.heart}좋아요 <b>${p.like_count}</b></button>
        <span class="sp"></span>
        ${mine ? `<a class="btn ghost" href="#/edit/${p.id}">수정</a>` : ''}
        ${mine || adm ? `<button class="btn ghost danger" data-act="delpost" data-id="${p.id}" data-slug="${esc(p.board_slug)}">삭제</button>` : ''}
        <a class="btn ghost" href="#/b/${esc(p.board_slug)}">목록</a>
      </div>
    </article>
    <section class="cmts">
      <h3>${qna ? '답변' : '댓글'} <b>${cs.length}</b></h3>
      ${cs.map((c) => `<div class="cmt"><p><b>${esc(c.author_name)}</b><time>${full(c.created_at)}</time>
        ${me && (me.id === c.author_id || adm) ? `<button data-act="delcmt" data-id="${c.id}">삭제</button>` : ''}</p><div>${esc(c.content)}</div></div>`).join('')}
      ${me ? `<form class="cform" data-form="comment" data-id="${p.id}"><textarea name="content" rows="3" maxlength="2000" placeholder="${qna ? '답변' : '댓글'}을 입력하세요" required></textarea><button class="btn">등록</button></form>`
        : `<p class="hint"><a href="#/login">로그인</a> 후 ${qna ? '답변' : '댓글'}을 작성할 수 있습니다.</p>`}
    </section>`, ac(p.board_id));
}

async function vWrite(slug, editId) {
  let b, p = null;
  if (editId) {
    p = await store.getPost(editId, { view: false });
    if (!p || !me || p.author_id !== me.id) return shell('수정 불가', '', '#/', '<p class="empty">본인 글만 수정할 수 있습니다.</p>');
    b = boards.find((x) => x.id === p.board_id);
  } else b = boards.find((x) => x.slug === slug);
  if (!b) return shell('게시판 없음', '', '#/', '<p class="empty">존재하지 않는 게시판입니다.</p>');
  if (!me) { go('#/login'); return null; }
  if (!canWrite(b)) return shell(b.name, '', `#/b/${b.slug}`, '<p class="empty">이 게시판은 관리자만 작성할 수 있습니다.</p>');
  return shell(editId ? '글 수정' : '글쓰기', b.name, editId ? `#/p/${editId}` : `#/b/${b.slug}`, `
    <form class="form wide" data-form="post" data-board="${b.id}" data-edit="${editId || ''}">
      <label>제목<input name="title" maxlength="100" required value="${esc(p?.title)}"></label>
      <div class="attach"><label>이미지 첨부 <small>${b.type === 'gallery' ? '갤러리 썸네일로 표시됩니다' : '선택'} · PNG, JPG, GIF, WEBP · 5MB 이하</small>
        <input name="image" type="file" accept="image/png,image/jpeg,image/gif,image/webp"></label>
        <input name="image_url" type="hidden" value="${esc(safeImg(p?.image_url))}">
        <div class="preview"${safeImg(p?.image_url) ? '' : ' hidden'}><img src="${esc(safeImg(p?.image_url))}" alt="첨부 이미지 미리보기"><button type="button" class="btn ghost danger" data-act="rmimg">첨부 삭제</button></div>
      </div>
      <label>내용<textarea name="content" rows="12" maxlength="20000" required>${esc(p?.content)}</textarea></label>
      <div class="acts"><span class="sp"></span><a class="btn ghost" href="${editId ? `#/p/${editId}` : `#/b/${b.slug}`}">취소</a><button class="btn">${editId ? '수정 완료' : '등록'}</button></div>
    </form>`);
}

function vAuth(signup) {
  if (me) { go('#/'); return null; }
  return shell(signup ? '회원가입' : '로그인', signup ? '새 계정을 만듭니다' : '', '#/', `
    <form class="form" data-form="${signup ? 'signup' : 'login'}">
      <label>이메일<input name="email" type="email" autocomplete="email" required></label>
      ${signup ? '<label>닉네임 <small>2~16자, 공백 없이</small><input name="nickname" minlength="2" maxlength="16" autocomplete="nickname" required></label>' : ''}
      <label>비밀번호${signup ? ' <small>6자 이상</small>' : ''}<input name="password" type="password" minlength="6" autocomplete="${signup ? 'new-password' : 'current-password'}" required></label>
      ${signup ? '<label>비밀번호 확인<input name="password2" type="password" minlength="6" autocomplete="new-password" required></label>' : ''}
      <button class="btn block">${signup ? '가입하기' : '로그인'}</button>
      <p class="hint c">${signup ? '이미 계정이 있나요? <a href="#/login">로그인</a>' : '처음이신가요? <a href="#/signup">회원가입</a>'}</p>
    </form>`);
}

async function vMe(q) {
  if (!me) { go('#/login'); return null; }
  const page = Math.max(1, +q.get('page') || 1);
  const [ms, { items, total }] = await Promise.all([store.myStats(me.id), store.listPosts({ authorId: me.id, page })]);
  return shell('내 정보', '', '#/', `
    <div class="mecard"><span class="lv big"><small>Lv.</small>${1 + Math.floor((ms.posts * 10 + ms.comments * 3) / 30)}</span>
      <div><h2>${esc(me.nickname)}${me.role === 'admin' ? ' <span class="tag done">관리자</span>' : ''}</h2>
      <p>${esc(me.email)} · 가입 ${fmt(me.created_at)}</p><p>작성 글 <b>${ms.posts}</b> · 댓글 <b>${ms.comments}</b></p></div></div>
    <h3 class="sec">내가 쓴 글</h3>
    ${postList(items, { showBoard: true })}${pager(total, page, 10, (p) => `#/me?page=${p}`)}`);
}

function vAdmin() {
  if (me?.role !== 'admin') return shell('게시판 관리', '', '#/', '<p class="empty">관리자만 접근할 수 있습니다.</p>');
  return shell('게시판 관리', '게시판 추가 · 삭제', '#/', `
    <ul class="plist adm">${boards.map((b) => `<li><div><span class="tag">${{ list: '일반', gallery: '갤러리', qna: 'Q&A' }[b.type]}</span>
      <span class="t"><b>${esc(b.name)}</b> /${esc(b.slug)} — ${esc(b.description)}</span>
      <span class="m">${b.write_role === 'admin' ? '관리자만 작성' : '회원 작성'}</span>
      <button class="btn ghost danger" data-act="delboard" data-id="${b.id}" data-name="${esc(b.name)}">삭제</button></div></li>`).join('')}</ul>
    <h3 class="sec">새 게시판</h3>
    <form class="form wide grid2" data-form="board">
      <label>이름<input name="name" maxlength="20" required></label>
      <label>주소 <small>영문 소문자·숫자·-</small><input name="slug" pattern="[a-z0-9\\-]{2,20}" required></label>
      <label class="span">설명<input name="description" maxlength="60"></label>
      <label>형태<select name="type"><option value="list">일반 목록</option><option value="gallery">갤러리</option><option value="qna">Q&amp;A</option></select></label>
      <label>글쓰기 권한<select name="write_role"><option value="member">회원</option><option value="admin">관리자만</option></select></label>
      <div class="acts span"><span class="sp"></span><button class="btn">게시판 추가</button></div>
    </form>`);
}

/* ───── 라우터 ───── */
let token = 0;
async function render() {
  const my = ++token, { seg, q } = parse();
  try {
    [me, boards] = await Promise.all([store.currentUser(), store.listBoards()]);
    let html;
    switch (seg[0]) {
      case undefined: html = await vLobby(); break;
      case 'all': html = await vBoard(null, q); break;
      case 'b': html = await vBoard(seg[1], q); break;
      case 'p': html = await vPost(+seg[1]); break;
      case 'write': html = await vWrite(seg[1]); break;
      case 'edit': html = await vWrite(null, +seg[1]); break;
      case 'login': html = vAuth(false); break;
      case 'signup': html = vAuth(true); break;
      case 'me': html = await vMe(q); break;
      case 'admin': html = vAdmin(); break;
      default: html = shell('페이지 없음', '', '#/', '<p class="empty">없는 페이지입니다.</p>');
    }
    if (my !== token || html === null) return;
    $app.innerHTML = html; window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    if (my === token) $app.innerHTML = shell('오류', '', '#/', `<p class="empty">불러오지 못했습니다.<br>${esc(e.message)}</p>`);
  }
}

/* ───── 이벤트 ───── */
const FORMS = {
  async search(f) { const s = f.q.trim(); if (s) go(`#/all?q=${encodeURIComponent(s)}`); },
  async bsearch(f, el) { const s = f.q.trim(); go(el.dataset.path + (s ? `?q=${encodeURIComponent(s)}` : '')); },
  async login(f) { await store.signIn(f); toast('로그인되었습니다.'); go('#/'); },
  async signup(f) {
    if (f.password !== f.password2) throw new Error('비밀번호 확인이 일치하지 않습니다.');
    const r = await store.signUp(f);
    if (r.needsConfirm) { toast('인증 메일을 보냈습니다. 메일 확인 후 로그인하세요.'); go('#/login'); }
    else { toast(`${f.nickname}님, 환영합니다!`); go('#/'); }
  },
  async post(f, el) {
    const edit = +el.dataset.edit;
    if (f.image?.size) f.image_url = await store.uploadImage(f.image);
    delete f.image;
    if (edit) { await store.updatePost(edit, f); go(`#/p/${edit}`); }
    else go(`#/p/${await store.createPost(+el.dataset.board, f)}`);
  },
  async comment(f, el) { await store.addComment(+el.dataset.id, f.content); render(); },
  async board(f) { await store.createBoard(f); toast('게시판을 추가했습니다.'); render(); },
};
const ACTS = {
  async rmimg(d, el) {
    const box = el.closest('.attach');
    box.querySelector('[name=image]').value = ''; box.querySelector('[name=image_url]').value = '';
    box.querySelector('.preview').hidden = true;
  },
  async logout() { await store.signOut(); toast('로그아웃되었습니다.'); go('#/'); },
  async like(d) { if (!me) return go('#/login'); await store.toggleLike(+d.id); keepScroll(); },
  async delpost(d) { if (confirm('이 글을 삭제할까요?')) { await store.deletePost(+d.id); toast('삭제했습니다.'); go(`#/b/${d.slug}`); } },
  async delcmt(d) { if (confirm('댓글을 삭제할까요?')) { await store.deleteComment(+d.id); keepScroll(); } },
  async delboard(d) { if (confirm(`'${d.name}' 게시판과 모든 글을 삭제할까요?`)) { await store.deleteBoard(+d.id); toast('삭제했습니다.'); render(); } },
};
async function keepScroll() { const y = window.scrollY; await render(); window.scrollTo(0, y); }

document.addEventListener('submit', async (e) => {
  const el = e.target.closest('[data-form]'); if (!el) return;
  e.preventDefault();
  const btn = el.querySelector('button'); if (btn?.disabled) return;
  if (btn) btn.disabled = true;
  try { await FORMS[el.dataset.form](Object.fromEntries(new FormData(el)), el); }
  catch (err) { toast(err.message, true); }
  finally { if (btn) btn.disabled = false; }
});
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  try { await ACTS[el.dataset.act](el.dataset, el); } catch (err) { toast(err.message, true); }
});
document.addEventListener('change', (e) => {
  if (!e.target.matches('.attach [name=image]')) return;
  const box = e.target.closest('.attach'), file = e.target.files[0], pv = box.querySelector('.preview');
  if (!file) return;
  pv.querySelector('img').src = URL.createObjectURL(file); pv.hidden = false;
});
window.addEventListener('hashchange', render);
render();
