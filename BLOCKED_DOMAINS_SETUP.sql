-- mint info · BLOCKED SITE NAMES V1
-- 관리자에서 특정 사이트 주소 이름(예: mint123)을 차단/해제하는 기능입니다.
-- 기존 회원/초대코드/페이지 데이터는 삭제하지 않습니다.
-- Supabase > SQL Editor에서 이 파일 전체를 한 번 실행하세요.

create table if not exists public.blocked_site_names (
  name text primary key,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint blocked_site_names_format_chk
    check (
      name = lower(name)
      and name ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'
    )
);

alter table public.blocked_site_names enable row level security;

revoke all on table public.blocked_site_names from anon;
grant select, insert, delete on table public.blocked_site_names to authenticated;

drop policy if exists "admins can view blocked site names" on public.blocked_site_names;
create policy "admins can view blocked site names"
on public.blocked_site_names
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins can add blocked site names" on public.blocked_site_names;
create policy "admins can add blocked site names"
on public.blocked_site_names
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "admins can remove blocked site names" on public.blocked_site_names;
create policy "admins can remove blocked site names"
on public.blocked_site_names
for delete
to authenticated
using (public.is_admin());

-- 회원가입 화면에서 안전하게 차단 여부만 확인하는 공개 RPC.
create or replace function public.is_site_name_blocked(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.blocked_site_names b
    where b.name = lower(trim(coalesce(p_name,'')))
  );
$$;

revoke all on function public.is_site_name_blocked(text) from public;
grant execute on function public.is_site_name_blocked(text) to anon, authenticated;

-- 프론트 체크를 우회해도 실제 profiles INSERT 단계에서 한 번 더 차단합니다.
create or replace function public.reject_blocked_site_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.blocked_site_names b
    where b.name = lower(trim(coalesce(new.username,'')))
  ) then
    raise exception 'SITE_NAME_BLOCKED';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reject_blocked_site_name on public.profiles;
create trigger trg_reject_blocked_site_name
before insert or update of username
on public.profiles
for each row
execute function public.reject_blocked_site_name();

select 'blocked site names ready' as result;
