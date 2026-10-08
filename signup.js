const form = document.querySelector('#signupForm');
const msg = document.querySelector('#message');

const RESERVED_NAMES = new Set([
  'admin','administrator','root','login','logout','signup','register',
  'dashboard','profile','settings','support','help','api','www'
]);

function normalizeSiteName(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function validateSiteName(value) {
  if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(value)) {
    return '사이트 주소 이름은 영문 소문자, 숫자, 하이픈(-)만 사용해 3~30자로 입력해 주세요. 하이픈으로 시작하거나 끝낼 수 없습니다.';
  }
  if (RESERVED_NAMES.has(value)) {
    return '이 주소 이름은 사용할 수 없습니다. 다른 이름을 골라 주세요.';
  }
  return '';
}

function updateSignupPreview() {
  const value = normalizeSiteName(document.querySelector('#username').value);
  const base = location.href.replace(/signup\.html(?:\?.*)?$/, '');
  signupUrlPreview.textContent = value
    ? `${base}profile.html?u=${value}`
    : '주소 이름을 입력하면 내 소개 사이트 주소가 여기에 표시됩니다.';
}

document.querySelector('#username').addEventListener('input', (e) => {
  const normalized = normalizeSiteName(e.target.value);
  if (e.target.value !== normalized) e.target.value = normalized;
  updateSignupPreview();
});

updateSignupPreview();


form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.className = 'message';
  msg.textContent = '가입 처리 중...';

  const invite_code = document.querySelector('#inviteCode').value.trim().toUpperCase();
  const nickname = document.querySelector('#nickname').value.trim();
  const username = normalizeSiteName(document.querySelector('#username').value);
  const email = document.querySelector('#email').value.trim();
  const password = document.querySelector('#password').value;

  const usernameError = validateSiteName(username);
  if (usernameError) {
    msg.className = 'message error';
    msg.textContent = usernameError;
    return;
  }


  const { data: check, error: checkError } = await db.rpc('check_signup_inputs', {
    p_invite_code: invite_code,
    p_username: username
  });

  if (checkError) {
    msg.className = 'message error';
    msg.textContent = '가입 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    return;
  }

  if (!check?.ok) {
    msg.className = 'message error';
    msg.textContent = check?.message || '가입 정보를 다시 확인해 주세요.';
    return;
  }

  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: { invite_code, nickname, username }
    }
  });

  if (error) {
    msg.className = 'message error';
    const t = String(error.message || '');
    if (t.toLowerCase().includes('invite')) {
      msg.textContent = '초대 코드가 없거나, 이미 사용되었거나, 만료되었습니다.';
    } else if (t.toLowerCase().includes('username') || t.toLowerCase().includes('site_name')) {
      msg.textContent = '이미 사용 중이거나 사용할 수 없는 사이트 주소 이름입니다.';
    } else {
      msg.textContent = t;
    }
    return;
  }

  msg.className = 'message success';
  if (data.session) {
    msg.textContent = '가입 완료! 내 페이지로 이동합니다.';
    setTimeout(() => location.href = 'dashboard.html', 700);
  } else {
    msg.textContent = '가입 요청 완료! 이메일 인증이 켜져 있다면 메일함에서 인증 후 로그인해 주세요.';
  }
});
