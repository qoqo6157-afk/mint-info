-- mint info 업그레이드:
-- 회원가입 단계에서 사이트 주소 이름(username)을 필수로 받고,
-- 영문 소문자 + 숫자만 허용하며 중복/예약어를 차단합니다.
--
-- 기존 setup.sql을 이미 실행한 프로젝트라면 이 파일만 SQL Editor에서 1회 실행하세요.

create or replace function public.handle_invited_signup()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invite text;
  v_nickname text;
  v_kind text;
  v_username text;
begin
  v_invite := upper(trim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  v_nickname := trim(coalesce(new.raw_user_meta_data ->> 'nickname', 'new user'));
  v_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));

  if v_invite = '' then
    raise exception 'INVITE_CODE_REQUIRED';
  end if;

  -- 사이트 주소 이름 규칙:
  -- 3~30자 / 영문 소문자, 숫자, 하이픈(-) 허용
  -- 하이픈으로 시작하거나 끝나는 것은 금지 / 공백, 한글, 대문자, 기타 특수문자 금지
  if v_username !~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$' then
    raise exception 'INVALID_SITE_NAME';
  end if;

  if v_username = any(array[
    'admin','administrator','root','login','logout','signup','register',
    'dashboard','profile','settings','support','help','api','www',
    'mint','mintinfo'
  ]) then
    raise exception 'RESERVED_SITE_NAME';
  end if;

  if exists (
    select 1 from public.profiles p where p.username = v_username
  ) then
    raise exception 'SITE_NAME_ALREADY_TAKEN';
  end if;

  -- 유효한 초대 코드 1회 사용 처리
  update public.invite_codes
     set used_at = now(),
         used_by = new.id
   where code = v_invite
     and used_at is null
     and (expires_at is null or expires_at > now())
  returning kind into v_kind;

  if v_kind is null then
    raise exception 'INVALID_OR_USED_INVITE_CODE';
  end if;

  insert into public.profiles(id, nickname, username)
  values (
    new.id,
    case when v_nickname = '' then 'new user' else left(v_nickname, 30) end,
    v_username
  );

  if v_kind = 'bootstrap_admin' then
    insert into public.admins(user_id) values (new.id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;
