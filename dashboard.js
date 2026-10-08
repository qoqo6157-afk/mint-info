const msg = document.querySelector('#message');
const profileForm = document.querySelector('#profileForm');
const nicknameInput = document.querySelector('#nickname');
const usernameInput = document.querySelector('#username');
const bioInput = document.querySelector('#bio');
const bgColorInput = document.querySelector('#bgColor');
const accentColorInput = document.querySelector('#accentColor');
const previewLink = document.querySelector('#previewLink');
const logoutBtn = document.querySelector('#logoutBtn');
const urlPreview = document.querySelector('#urlPreview');

let currentUser = null;
let currentUsername = '';

async function requireUser() {
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) {
    location.href = 'login.html';
    return null;
  }
  return user;
}

function siteBasePath() {
  const path = location.pathname;
  const marker = '/dashboard.html';
  const idx = path.lastIndexOf(marker);
  if (idx >= 0) return path.slice(0, idx + 1);
  return path.endsWith('/') ? path : path.replace(/[^/]+$/, '');
}

function publicProfileUrl(username) {
  return `${siteBasePath()}${encodeURIComponent(username)}`;
}

function updateUrlPreview() {
  if (!urlPreview) return;
  if (!currentUsername) {
    urlPreview.textContent = '사이트 주소 정보를 불러오는 중입니다.';
    return;
  }
  const absolute = new URL(publicProfileUrl(currentUsername), location.href).href;
  urlPreview.textContent = absolute;
}

async function loadProfile() {
  currentUser = await requireUser();
  if (!currentUser) return;

  const { data, error } = await db
    .from('profiles')
    .select('nickname, username, bio, theme')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (error) {
    msg.className = 'message error';
    msg.textContent = `프로필을 불러오지 못했습니다: ${error.message}`;
    return;
  }

  if (!data) {
    msg.className = 'message error';
    msg.textContent = '프로필 데이터가 없습니다. 관리자에게 문의해 주세요.';
    return;
  }

  currentUsername = data.username || '';
  nicknameInput.value = data.nickname || '';
  usernameInput.value = currentUsername;
  bioInput.value = data.bio || '';
  bgColorInput.value = data.theme?.background || '#eefcf8';
  accentColorInput.value = data.theme?.accent || '#6edfc7';

  if (currentUsername) {
    previewLink.href = publicProfileUrl(currentUsername);
    previewLink.removeAttribute('aria-disabled');
  } else {
    previewLink.href = '#';
    previewLink.setAttribute('aria-disabled', 'true');
  }

  updateUrlPreview();
}

profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!currentUser) return;

  msg.textContent = '저장 중...';
  msg.className = 'message';

  const payload = {
    nickname: nicknameInput.value.trim(),
    bio: bioInput.value.trim(),
    theme: {
      background: bgColorInput.value,
      accent: accentColorInput.value
    },
    updated_at: new Date().toISOString()
  };

  const { error } = await db
    .from('profiles')
    .update(payload)
    .eq('id', currentUser.id);

  if (error) {
    msg.className = 'message error';
    msg.textContent = `저장 실패: ${error.message}`;
    return;
  }

  msg.className = 'message success';
  msg.textContent = '저장했습니다.';
});

previewLink.addEventListener('click', (e) => {
  if (!currentUsername) {
    e.preventDefault();
    msg.className = 'message error';
    msg.textContent = '사이트 주소 정보를 아직 불러오지 못했습니다.';
  }
});

logoutBtn.addEventListener('click', async () => {
  await db.auth.signOut();
  location.href = 'index.html';
});

loadProfile();
