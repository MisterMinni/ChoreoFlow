-- Project invitations are application links, not Supabase Auth invitations.
-- No email is sent. Only the owner can list addresses, and no client can read
-- token hashes. Lock order for mutations: owner advisory lock, project, invite.
create table private.project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  role text not null check (role in ('reader','editor')),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '7 days'),
  check (accepted_at is null or revoked_at is null)
);
create index project_invitations_project_id_idx on private.project_invitations(project_id);
create index project_invitations_pending_idx on private.project_invitations(project_id,email,role,expires_at)
  where accepted_at is null and revoked_at is null;
create index project_invitations_accepted_by_idx on private.project_invitations(accepted_by) where accepted_by is not null;
alter table private.project_invitations enable row level security;
revoke all on private.project_invitations from public,anon,authenticated;
grant all on private.project_invitations to service_role;
create policy invitations_service_only on private.project_invitations for all to service_role using (true) with check (true);

-- Call only after locking the owner/project. Pending editor invitations reserve
-- seats, so a role promotion cannot take a seat promised by an existing link.
create function private.check_editor_capacity(p_project_id uuid,p_owner_id uuid,p_exclude_user uuid default null,p_exclude_invitation uuid default null) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not private.has_pro(p_owner_id) then raise exception using errcode='42501',message='PRO_REQUIRED'; end if;
  if (select count(*) from public.project_members where project_id=p_project_id and role='editor' and user_id is distinct from p_exclude_user)
    + (select count(*) from private.project_invitations where project_id=p_project_id and role='editor'
      and accepted_at is null and revoked_at is null and expires_at>now() and id is distinct from p_exclude_invitation) >= 4 then
    raise exception using errcode='P0001',message='EDITOR_LIMIT';
  end if;
end $$;
revoke execute on function private.check_editor_capacity(uuid,uuid,uuid,uuid) from public,anon,authenticated;

create function private.get_project_access(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); project public.projects; member_role text; pro boolean; editable boolean;
begin
  if actor is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into project from public.projects where id=p_project_id;
  if not found then raise exception using errcode='42501',message='PROJECT_ACCESS_DENIED'; end if;
  if project.owner_id=actor then member_role:='owner';
  else select role into member_role from public.project_members where project_id=p_project_id and user_id=actor;
  end if;
  if member_role is null then raise exception using errcode='42501',message='PROJECT_ACCESS_DENIED'; end if;
  pro:=private.has_pro(project.owner_id);
  editable:=project.archived_at is null and (
    (member_role='owner' and (pro or (select count(*) from public.projects where owner_id=actor and archived_at is null)<=3))
    or (member_role='editor' and pro));
  return jsonb_build_object('role',member_role,'can_edit',editable,'owner_id',project.owner_id,'owner_has_pro',pro);
end $$;

create function private.get_project_team(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); members jsonb; invitations jsonb;
begin
  if actor is null or not private.owns_project(p_project_id) then raise exception using errcode='42501',message='PROJECT_ACCESS_DENIED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',x.user_id,'email',x.email,'role',x.role) order by x.is_owner desc,x.email,x.user_id),'[]'::jsonb)
    into members from (
      select p.owner_id as user_id,u.email,'owner'::text as role,true as is_owner from public.projects p join auth.users u on u.id=p.owner_id where p.id=p_project_id
      union all
      select m.user_id,u.email,m.role,false from public.project_members m join auth.users u on u.id=m.user_id where m.project_id=p_project_id
    ) x;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'role',i.role,'expires_at',i.expires_at,'accepted_at',i.accepted_at,'revoked_at',i.revoked_at) order by i.created_at desc,i.id),'[]'::jsonb)
    into invitations from private.project_invitations i where i.project_id=p_project_id;
  return jsonb_build_object('members',members,'invitations',invitations);
end $$;

create function private.create_project_invitation(p_project_id uuid,p_email text,p_role text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); normalized_email text:=lower(btrim(p_email)); project public.projects; invite private.project_invitations; token text;
begin
  if actor is null or not private.owns_project(p_project_id) then raise exception using errcode='42501',message='PROJECT_ACCESS_DENIED'; end if;
  if p_role is null or p_role not in ('reader','editor') then raise exception using errcode='22023',message='INVALID_MEMBER_ROLE'; end if;
  if normalized_email is null or char_length(normalized_email) not between 3 and 254 or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception using errcode='22023',message='INVALID_INVITATION_EMAIL';
  end if;
  perform private.lock_owner(actor);
  select * into project from public.projects where id=p_project_id for update;
  if not found or project.owner_id<>actor then raise exception using errcode='42501',message='PROJECT_ACCESS_DENIED'; end if;
  if project.archived_at is not null then raise exception using errcode='P0001',message='PROJECT_ARCHIVED'; end if;
  if exists(select 1 from auth.users where id=actor and lower(btrim(email))=normalized_email) then
    raise exception using errcode='22023',message='OWNER_IS_NOT_A_MEMBER';
  end if;
  if exists(select 1 from public.project_members m join auth.users u on u.id=m.user_id where m.project_id=p_project_id and lower(btrim(u.email))=normalized_email) then
    raise exception using errcode='P0001',message='MEMBER_ALREADY_EXISTS';
  end if;
  if exists(select 1 from private.project_invitations where project_id=p_project_id and email=normalized_email and accepted_at is null and revoked_at is null and expires_at>now()) then
    raise exception using errcode='P0001',message='INVITATION_PENDING';
  end if;
  if p_role='editor' then perform private.check_editor_capacity(p_project_id,actor); end if;
  token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into private.project_invitations(project_id,email,role,token_hash)
    values(p_project_id,normalized_email,p_role,sha256(convert_to(token,'UTF8'))) returning * into invite;
  return jsonb_build_object('id',invite.id,'token',token,'expires_at',invite.expires_at);
end $$;

create function private.accept_project_invitation(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_email text; invite private.project_invitations; project public.projects;
begin
  if actor is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select lower(btrim(email)) into actor_email from auth.users where id=actor and email_confirmed_at is not null and email is not null;
  if actor_email is null then raise exception using errcode='42501',message='EMAIL_CONFIRMATION_REQUIRED'; end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception using errcode='42501',message='INVITATION_UNAVAILABLE'; end if;
  select * into invite from private.project_invitations where token_hash=sha256(convert_to(p_token,'UTF8'));
  if not found then raise exception using errcode='42501',message='INVITATION_UNAVAILABLE'; end if;
  select * into project from public.projects where id=invite.project_id;
  if not found then raise exception using errcode='42501',message='INVITATION_UNAVAILABLE'; end if;
  perform private.lock_owner(project.owner_id);
  select * into project from public.projects where id=invite.project_id for update;
  select * into invite from private.project_invitations where id=invite.id for update;
  if invite.id is null or project.id is null or invite.accepted_at is not null or invite.revoked_at is not null or invite.expires_at<=now() then
    raise exception using errcode='42501',message='INVITATION_UNAVAILABLE';
  end if;
  -- Read after the project lock and keep this confirmed address stable until
  -- membership commits; concurrent Auth email changes must wait for this row.
  select lower(btrim(email)) into actor_email from auth.users where id=actor and email_confirmed_at is not null and email is not null for share;
  if actor_email is null then raise exception using errcode='42501',message='EMAIL_CONFIRMATION_REQUIRED'; end if;
  if actor_email<>invite.email then raise exception using errcode='42501',message='INVITATION_EMAIL_MISMATCH'; end if;
  if project.archived_at is not null then raise exception using errcode='P0001',message='PROJECT_ARCHIVED'; end if;
  if project.owner_id=actor then raise exception using errcode='22023',message='OWNER_IS_NOT_A_MEMBER'; end if;
  if exists(select 1 from public.project_members where project_id=project.id and user_id=actor) then
    raise exception using errcode='P0001',message='MEMBER_ALREADY_EXISTS';
  end if;
  if invite.role='editor' then perform private.check_editor_capacity(project.id,project.owner_id,actor,invite.id); end if;
  insert into public.project_members(project_id,user_id,role) values(project.id,actor,invite.role);
  update private.project_invitations set accepted_at=now(),accepted_by=actor where id=invite.id;
  return jsonb_build_object('project_id',project.id);
end $$;

create function private.revoke_project_invitation(p_invitation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); invite private.project_invitations;
begin
  if actor is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into invite from private.project_invitations where id=p_invitation_id;
  if not found or not private.owns_project(invite.project_id) then raise exception using errcode='42501',message='PROJECT_ACCESS_DENIED'; end if;
  perform private.lock_owner(actor);
  perform 1 from public.projects where id=invite.project_id and owner_id=actor for update;
  if not found then raise exception using errcode='42501',message='PROJECT_ACCESS_DENIED'; end if;
  select * into invite from private.project_invitations where id=p_invitation_id for update;
  if not found then raise exception using errcode='42501',message='PROJECT_ACCESS_DENIED'; end if;
  if invite.accepted_at is not null then raise exception using errcode='P0001',message='INVITATION_ALREADY_ACCEPTED'; end if;
  update private.project_invitations set revoked_at=coalesce(revoked_at,now()) where id=p_invitation_id;
end $$;

-- New members must accept the email-bound link. This endpoint now changes or
-- removes existing members only; it cannot bypass the invitation workflow.
create or replace function private.set_project_member(p_project_id uuid,p_user_id uuid,p_role text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not private.owns_project(p_project_id) then raise exception using errcode='42501',message='PROJECT_ACCESS_DENIED'; end if;
  if p_user_id is null then raise exception using errcode='22023',message='MEMBER_ID_REQUIRED'; end if;
  if p_user_id=actor then raise exception using errcode='22023',message='OWNER_IS_NOT_A_MEMBER'; end if;
  if p_role is not null and p_role not in ('reader','editor') then raise exception using errcode='22023',message='INVALID_MEMBER_ROLE'; end if;
  perform private.lock_owner(actor);
  perform 1 from public.projects where id=p_project_id and owner_id=actor for update;
  if not found then raise exception using errcode='42501',message='PROJECT_ACCESS_DENIED'; end if;
  if p_role is null then delete from public.project_members where project_id=p_project_id and user_id=p_user_id; return; end if;
  if not exists(select 1 from public.project_members where project_id=p_project_id and user_id=p_user_id) then
    raise exception using errcode='P0001',message='MEMBER_NOT_FOUND';
  end if;
  if p_role='editor' then perform private.check_editor_capacity(p_project_id,actor,p_user_id); end if;
  update public.project_members set role=p_role where project_id=p_project_id and user_id=p_user_id;
end $$;

create function public.get_project_access(p_project_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select private.get_project_access(p_project_id); $$;
create function public.get_project_team(p_project_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select private.get_project_team(p_project_id); $$;
create function public.create_project_invitation(p_project_id uuid,p_email text,p_role text) returns jsonb language sql security invoker set search_path='' as $$ select private.create_project_invitation(p_project_id,p_email,p_role); $$;
create function public.accept_project_invitation(p_token text) returns jsonb language sql security invoker set search_path='' as $$ select private.accept_project_invitation(p_token); $$;
create function public.revoke_project_invitation(p_invitation_id uuid) returns void language sql security invoker set search_path='' as $$ select private.revoke_project_invitation(p_invitation_id); $$;

revoke execute on function private.get_project_access(uuid),private.get_project_team(uuid),private.create_project_invitation(uuid,text,text),private.accept_project_invitation(text),private.revoke_project_invitation(uuid),private.set_project_member(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.get_project_access(uuid),private.get_project_team(uuid),private.create_project_invitation(uuid,text,text),private.accept_project_invitation(text),private.revoke_project_invitation(uuid),private.set_project_member(uuid,uuid,text) to authenticated;
revoke execute on function public.get_project_access(uuid),public.get_project_team(uuid),public.create_project_invitation(uuid,text,text),public.accept_project_invitation(text),public.revoke_project_invitation(uuid) from public,anon,authenticated;
grant execute on function public.get_project_access(uuid),public.get_project_team(uuid),public.create_project_invitation(uuid,text,text),public.accept_project_invitation(text),public.revoke_project_invitation(uuid) to authenticated;

-- Match the locally supported audio MIME type; the bucket stays private and
-- server-side size limits remain unchanged. This is not byte-content scanning.
update storage.buckets set allowed_mime_types=array_append(allowed_mime_types,'audio/aiff')
where id='project-media' and not ('audio/aiff'=any(allowed_mime_types));
