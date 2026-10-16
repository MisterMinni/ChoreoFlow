-- ChoreoFlow test-environment foundation. No billing or production credentials.
-- Application writes go through identity-checked, atomic RPCs. The exposed
-- wrappers are SECURITY INVOKER; privileged implementations stay in private.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated;
alter default privileges in schema private revoke execute on functions from public;

create table public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  valid_until timestamptz,
  verified_source text not null check (verified_source in ('apple_production', 'apple_sandbox', 'test_fixture')),
  updated_at timestamptz not null default now(),
  check (plan = 'free' or valid_until is not null)
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  schema_version integer not null default 1 check (schema_version = 1),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and coalesce(snapshot->'schemaVersion' = '1'::jsonb,false) and octet_length(snapshot::text) <= 4194304),
  revision bigint not null default 1 check (revision > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_id_idx on public.projects(owner_id);
create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('reader','editor')),
  created_at timestamptz not null default now(),
  primary key (project_id,user_id)
);
create index project_members_user_id_idx on public.project_members(user_id,project_id);
create table public.project_commands (
  project_id uuid not null references public.projects(id) on delete cascade,
  command_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  base_revision bigint not null,
  result_revision bigint not null,
  payload_hash bytea not null,
  created_at timestamptz not null default now(),
  primary key (project_id,command_id)
);
create index project_commands_actor_id_idx on public.project_commands(actor_id);
create table public.project_publications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_revision bigint not null,
  snapshot jsonb not null,
  includes_media boolean not null default false,
  created_at timestamptz not null default now()
);
create index project_publications_project_id_idx on public.project_publications(project_id);
create table public.project_share_links (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.project_publications(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index project_share_links_publication_id_idx on public.project_share_links(publication_id);
create table public.casts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and coalesce(snapshot->'schemaVersion' = '1'::jsonb,false) and octet_length(snapshot::text) <= 1048576),
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index casts_owner_id_idx on public.casts(owner_id);

alter table public.entitlements enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_commands enable row level security;
alter table public.project_publications enable row level security;
alter table public.project_share_links enable row level security;
alter table public.casts enable row level security;
revoke all on public.entitlements,public.projects,public.project_members,public.project_commands,public.project_publications,public.project_share_links,public.casts from public,anon,authenticated;
grant select on public.entitlements,public.projects,public.project_members,public.project_commands,public.project_publications,public.casts to authenticated;
-- Link hashes have no client SELECT privilege, even for the owner.
grant all on public.entitlements,public.projects,public.project_members,public.project_commands,public.project_publications,public.project_share_links,public.casts to service_role;

create function private.has_pro(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.entitlements where user_id=p_user and plan='pro' and valid_until>now());
$$;
create function private.can_read_project(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists(
    select 1 from public.projects p where p.id=p_project and
    (p.owner_id=(select auth.uid()) or exists(select 1 from public.project_members m where m.project_id=p.id and m.user_id=(select auth.uid())))
  );
$$;
create function private.owns_project(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists(select 1 from public.projects where id=p_project and owner_id=(select auth.uid()));
$$;
grant execute on function private.can_read_project(uuid),private.owns_project(uuid) to authenticated;
create policy projects_read on public.projects for select to authenticated using (private.can_read_project(id));
create policy members_read on public.project_members for select to authenticated using (user_id=(select auth.uid()) or private.owns_project(project_id));
create policy commands_read on public.project_commands for select to authenticated using (private.can_read_project(project_id));
create policy publications_read on public.project_publications for select to authenticated using (private.can_read_project(project_id));
create policy casts_read on public.casts for select to authenticated using (owner_id=(select auth.uid()));
create policy entitlement_read on public.entitlements for select to authenticated using (user_id=(select auth.uid()));
create policy share_links_service_only on public.project_share_links for all to service_role using (true) with check (true);

-- One advisory lock per owner serializes quota/project-count checks across all
-- mutations, including uploads. Call before acquiring a project row lock.
create function private.lock_owner(p_user uuid) returns void
language sql volatile set search_path = '' as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text, 485711));
$$;
create function private.cloud_bytes(p_user uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(octet_length(snapshot::text)) from public.projects where owner_id=p_user),0)
       + coalesce((select sum(octet_length(snapshot::text)) from public.casts where owner_id=p_user),0)
       + coalesce((select sum(octet_length(x.snapshot::text)) from public.project_publications x join public.projects p on p.id=x.project_id where p.owner_id=p_user),0)
       + coalesce((select sum(coalesce((metadata->>'size')::bigint,0)) from storage.objects where bucket_id='project-media' and (storage.foldername(name))[1]=p_user::text),0);
$$;
create function private.check_quota(p_user uuid,p_delta bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare max_bytes bigint := case when private.has_pro(p_user) then 1073741824 else 104857600 end;
begin
  if p_delta > 0 and private.cloud_bytes(p_user)+p_delta > max_bytes then
    raise exception using errcode='P0001',message='CLOUD_QUOTA_EXCEEDED';
  end if;
end $$;
create function private.create_project(p_title text,p_snapshot jsonb,p_project_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result public.projects;
begin
  if actor is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  perform private.lock_owner(actor);
  select * into result from public.projects where id=p_project_id;
  if found then
    if result.owner_id<>actor then raise exception using errcode='42501',message='PROJECT_ACCESS_DENIED'; end if;
    if result.snapshot is distinct from p_snapshot or result.title is distinct from btrim(p_title) then raise exception using errcode='P0001',message='CREATE_ID_REUSED'; end if;
    return to_jsonb(result);
  end if;
  if not private.has_pro(actor) and (select count(*) from public.projects where owner_id=actor and archived_at is null)>=3 then
    raise exception using errcode='P0001',message='ACTIVE_PROJECT_LIMIT';
  end if;
  perform private.check_quota(actor,octet_length(p_snapshot::text));
  insert into public.projects(id,owner_id,title,snapshot) values(p_project_id,actor,btrim(p_title),p_snapshot) returning * into result;
  return to_jsonb(result);
end $$;
create function private.save_project(p_project_id uuid,p_base_revision bigint,p_command_id uuid,p_snapshot jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); project public.projects; command public.project_commands; digest bytea := sha256(convert_to(p_snapshot::text,'UTF8'));
begin
  if actor is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into project from public.projects where id=p_project_id;
  if not found or not private.can_read_project(p_project_id) then raise exception using errcode='42501',message='PROJECT_ACCESS_DENIED'; end if;
  perform private.lock_owner(project.owner_id);
  select * into project from public.projects where id=p_project_id for update;
  if project.owner_id<>actor and not (private.has_pro(project.owner_id) and exists(select 1 from public.project_members where project_id=p_project_id and user_id=actor and role='editor')) then
    raise exception using errcode='42501',message='PROJECT_WRITE_DENIED';
  end if;
  select * into command from public.project_commands where project_id=p_project_id and command_id=p_command_id;
  if found then
    if command.actor_id is distinct from actor or command.base_revision is distinct from p_base_revision or command.payload_hash is distinct from digest then
      raise exception using errcode='P0001',message='COMMAND_ID_REUSED';
    end if;
    return jsonb_build_object('project_id',p_project_id,'revision',command.result_revision,'duplicate',true);
  end if;
  if project.archived_at is not null then raise exception using errcode='P0001',message='PROJECT_ARCHIVED'; end if;
  if not private.has_pro(project.owner_id) and (select count(*) from public.projects where owner_id=project.owner_id and archived_at is null)>3 then raise exception using errcode='P0001',message='SELECT_ACTIVE_PROJECTS'; end if;
  if project.revision is distinct from p_base_revision then raise exception using errcode='40001',message='REVISION_CONFLICT'; end if;
  perform private.check_quota(project.owner_id,octet_length(p_snapshot::text)-octet_length(project.snapshot::text));
  update public.projects set snapshot=p_snapshot,title=coalesce(nullif(btrim(p_snapshot->>'name'),''),title),revision=revision+1,updated_at=now() where id=p_project_id returning * into project;
  insert into public.project_commands(project_id,command_id,actor_id,base_revision,result_revision,payload_hash)
  values(p_project_id,p_command_id,actor,p_base_revision,project.revision,digest);
  return jsonb_build_object('project_id',p_project_id,'revision',project.revision,'duplicate',false);
end $$;
create function private.archive_project(p_project_id uuid,p_archived boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); project public.projects;
begin
  if actor is null or not private.owns_project(p_project_id) then raise exception using errcode='42501',message='PROJECT_ACCESS_DENIED'; end if;
  if p_archived is null then raise exception using errcode='22023',message='ARCHIVED_FLAG_REQUIRED'; end if;
  perform private.lock_owner(actor);
  select * into project from public.projects where id=p_project_id for update;
  if not p_archived and project.archived_at is not null and not private.has_pro(actor) and (select count(*) from public.projects where owner_id=actor and archived_at is null)>=3 then
    raise exception using errcode='P0001',message='ACTIVE_PROJECT_LIMIT';
  end if;
  update public.projects set archived_at=case when p_archived then now() else null end,updated_at=now() where id=p_project_id returning * into project;
  return to_jsonb(project);
end $$;
create function private.set_project_member(p_project_id uuid,p_user_id uuid,p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not private.owns_project(p_project_id) then raise exception using errcode='42501',message='PROJECT_ACCESS_DENIED'; end if;
  perform private.lock_owner(actor);
  perform 1 from public.projects where id=p_project_id for update;
  if p_user_id=actor then raise exception using errcode='22023',message='OWNER_IS_NOT_A_MEMBER'; end if;
  if p_role is null then delete from public.project_members where project_id=p_project_id and user_id=p_user_id; return; end if;
  if p_role='editor' then
    if not private.has_pro(actor) then raise exception using errcode='42501',message='PRO_REQUIRED'; end if;
    if (select count(*) from public.project_members where project_id=p_project_id and role='editor' and user_id<>p_user_id)>=4 then
      raise exception using errcode='P0001',message='EDITOR_LIMIT';
    end if;
  end if;
  insert into public.project_members(project_id,user_id,role) values(p_project_id,p_user_id,p_role)
  on conflict(project_id,user_id) do update set role=excluded.role;
end $$;
create function private.save_cast(p_cast_id uuid,p_title text,p_snapshot jsonb,p_base_revision bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); result public.casts;
begin
  if actor is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  perform private.lock_owner(actor);
  select * into result from public.casts where id=p_cast_id for update;
  if found then
    if result.owner_id<>actor then raise exception using errcode='42501',message='CAST_ACCESS_DENIED'; end if;
    if result.revision is distinct from p_base_revision then raise exception using errcode='40001',message='REVISION_CONFLICT'; end if;
    perform private.check_quota(actor,octet_length(p_snapshot::text)-octet_length(result.snapshot::text));
    update public.casts set title=btrim(p_title),snapshot=p_snapshot,revision=revision+1,updated_at=now() where id=p_cast_id returning * into result;
  else
    if p_base_revision is distinct from 0 then raise exception using errcode='40001',message='REVISION_CONFLICT'; end if;
    if not private.has_pro(actor) and (select count(*) from public.casts where owner_id=actor)>=3 then raise exception using errcode='P0001',message='CAST_LIMIT'; end if;
    perform private.check_quota(actor,octet_length(p_snapshot::text));
    insert into public.casts(id,owner_id,title,snapshot) values(p_cast_id,actor,btrim(p_title),p_snapshot) returning * into result;
  end if;
  return to_jsonb(result);
end $$;

-- A share never exposes draft notes or membership data. Media is stripped by
-- default and may be explicitly included by the owner at publication time.
create function private.viewer_snapshot(p_value jsonb,p_include_media boolean,p_context text default 'root') returns jsonb
language plpgsql immutable set search_path = '' as $$
declare result jsonb; item record; allowed text[];
begin
  if p_context='notes' then return '[]'::jsonb; end if;
  if p_context='note' then return '""'::jsonb; end if;
  if p_context='audio' and not p_include_media then return '{"assets":[],"clips":[]}'::jsonb; end if;
  if jsonb_typeof(p_value)='object' then
    -- Explicit v1 field allowlist. ID-keyed maps are handled separately, so
    -- unknown draft metadata never becomes public by accident.
    allowed:=case p_context
      when 'root' then array['schemaVersion','id','name','revision','createdAt','updatedAt','stage','people','groups','formations','transitions','tempo','audio','props','lifts','notes','markers']
      when 'stage' then array['width','depth','gridSize']
      when 'people' then array['id','name','label','color','radius']
      when 'groups' then array['id','name','personIds','color']
      when 'formations' then array['id','name','holdSeconds','positions','facing']
      when 'transitions' then array['id','fromFormationId','toFormationId','durationSeconds','motions']
      when 'motions' then array['id','type','personId','path','facing','delaySeconds','durationSeconds','easing','personIds','pivot','angleDegrees','translation','scale','fanDegrees','staggerSeconds','rotateFacing']
      when 'path' then array['type','control','control1','control2','points']
      when 'facing' then array['type','degrees','fromDegrees','angleDegrees']
      when 'tempo' then array['countOffsetSeconds','marks']
      when 'marks' then array['id','timeSeconds','bpm']
      when 'audio' then array['assets','clips']
      when 'assets' then array['id','name','mimeType','durationSeconds','sizeBytes']
      when 'clips' then array['id','assetId','startSeconds','trimStartSeconds','trimEndSeconds','fadeInSeconds','fadeOutSeconds','volume']
      when 'props' then array['id','name','position','size','rotationDegrees','startSeconds','endSeconds']
      when 'lifts' then array['id','name','roles','phases','note']
      when 'roles' then array['personId','role']
      when 'phases' then array['id','type','startSeconds','endSeconds','heights','contacts']
      when 'contacts' then array['personA','personB']
      when 'markers' then array['id','name','timeSeconds']
      when 'scale' then array['x','y']
      else array['x','y','z'] end;
    result:='{}'::jsonb;
    for item in select key,value from jsonb_each(p_value) loop
      if p_context='positions' then
        result:=result||jsonb_build_object(item.key,private.viewer_snapshot(item.value,p_include_media,'vector'));
      elsif p_context in ('heights','staggerSeconds') or (p_context='facing' and not p_value ? 'type') then
        if jsonb_typeof(item.value)='number' then result:=result||jsonb_build_object(item.key,item.value); end if;
      elsif item.key=any(allowed) then
        result:=result||jsonb_build_object(item.key,private.viewer_snapshot(item.value,p_include_media,item.key));
      end if;
    end loop;
    if p_context='root' then
      result:=result||'{"notes":[]}'::jsonb;
      if not p_include_media then result:=result||'{"audio":{"assets":[],"clips":[]}}'::jsonb; end if;
    end if;
    return result;
  elsif jsonb_typeof(p_value)='array' then
    select coalesce(jsonb_agg(private.viewer_snapshot(value,p_include_media,p_context) order by ord),'[]'::jsonb) into result from jsonb_array_elements(p_value) with ordinality a(value,ord);
    return result;
  end if;
  return p_value;
end $$;
create function private.publish_project(p_project_id uuid,p_base_revision bigint,p_include_media boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); project public.projects; result public.project_publications; published jsonb;
begin
  if actor is null or not private.owns_project(p_project_id) then raise exception using errcode='42501',message='PROJECT_ACCESS_DENIED'; end if;
  perform private.lock_owner(actor);
  select * into project from public.projects where id=p_project_id for update;
  if project.revision is distinct from p_base_revision then raise exception using errcode='40001',message='REVISION_CONFLICT'; end if;
  published:=private.viewer_snapshot(project.snapshot,p_include_media);
  perform private.check_quota(actor,octet_length(published::text));
  insert into public.project_publications(project_id,source_revision,snapshot,includes_media) values(p_project_id,project.revision,published,p_include_media) returning * into result;
  return to_jsonb(result);
end $$;
create function private.create_share_link(p_publication_id uuid,p_expires_at timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); token text:=encode(extensions.gen_random_bytes(32),'hex'); result public.project_share_links;
begin
  if actor is null or not exists(select 1 from public.project_publications x where x.id=p_publication_id and private.owns_project(x.project_id)) then raise exception using errcode='42501',message='PROJECT_ACCESS_DENIED'; end if;
  if p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '365 days' then raise exception using errcode='22023',message='INVALID_LINK_EXPIRY'; end if;
  insert into public.project_share_links(publication_id,token_hash,expires_at) values(p_publication_id,sha256(convert_to(token,'UTF8')),p_expires_at) returning * into result;
  return jsonb_build_object('id',result.id,'token',token,'expires_at',result.expires_at,'publication_id',p_publication_id);
end $$;
create function private.revoke_share_link(p_link_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  update public.project_share_links l set revoked_at=now() from public.project_publications x
  where l.id=p_link_id and x.id=l.publication_id and private.owns_project(x.project_id);
  if not found then raise exception using errcode='42501',message='LINK_ACCESS_DENIED'; end if;
end $$;
-- Anonymous access is intentional here: the random 256-bit token IS the
-- authorization capability. No other function accepts anonymous callers.
create function private.read_share(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_token is null or p_token!~'^[0-9a-f]{64}$' then return null; end if;
  select jsonb_build_object('id',x.id,'source_revision',x.source_revision,'snapshot',x.snapshot,'includes_media',x.includes_media,'created_at',x.created_at)
  into result from public.project_share_links l join public.project_publications x on x.id=l.publication_id
  where l.token_hash=sha256(convert_to(p_token,'UTF8')) and l.revoked_at is null and l.expires_at>now();
  return result;
end $$;

create function public.create_project(p_title text,p_snapshot jsonb,p_project_id uuid default gen_random_uuid()) returns jsonb language sql security invoker set search_path='' as $$ select private.create_project(p_title,p_snapshot,p_project_id); $$;
create function public.save_project(p_project_id uuid,p_base_revision bigint,p_command_id uuid,p_snapshot jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.save_project(p_project_id,p_base_revision,p_command_id,p_snapshot); $$;
create function public.archive_project(p_project_id uuid,p_archived boolean) returns jsonb language sql security invoker set search_path='' as $$ select private.archive_project(p_project_id,p_archived); $$;
create function public.set_project_member(p_project_id uuid,p_user_id uuid,p_role text) returns void language sql security invoker set search_path='' as $$ select private.set_project_member(p_project_id,p_user_id,p_role); $$;
create function public.save_cast(p_cast_id uuid,p_title text,p_snapshot jsonb,p_base_revision bigint default 0) returns jsonb language sql security invoker set search_path='' as $$ select private.save_cast(p_cast_id,p_title,p_snapshot,p_base_revision); $$;
create function public.publish_project(p_project_id uuid,p_base_revision bigint,p_include_media boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select private.publish_project(p_project_id,p_base_revision,p_include_media); $$;
create function public.create_share_link(p_publication_id uuid,p_expires_at timestamptz default now()+interval '30 days') returns jsonb language sql security invoker set search_path='' as $$ select private.create_share_link(p_publication_id,p_expires_at); $$;
create function public.revoke_share_link(p_link_id uuid) returns void language sql security invoker set search_path='' as $$ select private.revoke_share_link(p_link_id); $$;
create function public.read_share(p_token text) returns jsonb language sql stable security invoker set search_path='' as $$ select private.read_share(p_token); $$;

revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.can_read_project(uuid),private.owns_project(uuid),private.create_project(text,jsonb,uuid),private.save_project(uuid,bigint,uuid,jsonb),private.archive_project(uuid,boolean),private.set_project_member(uuid,uuid,text),private.save_cast(uuid,text,jsonb,bigint),private.publish_project(uuid,bigint,boolean),private.create_share_link(uuid,timestamptz),private.revoke_share_link(uuid) to authenticated;
grant execute on function private.read_share(text) to anon,authenticated;
revoke execute on function public.create_project(text,jsonb,uuid),public.save_project(uuid,bigint,uuid,jsonb),public.archive_project(uuid,boolean),public.set_project_member(uuid,uuid,text),public.save_cast(uuid,text,jsonb,bigint),public.publish_project(uuid,bigint,boolean),public.create_share_link(uuid,timestamptz),public.revoke_share_link(uuid),public.read_share(text) from public,anon,authenticated;
grant execute on function public.create_project(text,jsonb,uuid),public.save_project(uuid,bigint,uuid,jsonb),public.archive_project(uuid,boolean),public.set_project_member(uuid,uuid,text),public.save_cast(uuid,text,jsonb,bigint),public.publish_project(uuid,bigint,boolean),public.create_share_link(uuid,timestamptz),public.revoke_share_link(uuid) to authenticated;
grant execute on function public.read_share(text) to anon,authenticated;
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('project-media','project-media',false,20971520,array['audio/mpeg','audio/mp4','audio/aac','audio/wav','audio/x-wav','audio/ogg','audio/flac','audio/x-m4a']);
create function private.media_project(p_name text) returns uuid language plpgsql immutable set search_path='' as $$
begin
  return ((storage.foldername(p_name))[2])::uuid;
exception when invalid_text_representation then return null;
end $$;
revoke execute on function private.media_project(text) from public;
grant execute on function private.media_project(text) to authenticated;
create policy project_media_read on storage.objects for select to authenticated using(bucket_id='project-media' and private.can_read_project(private.media_project(name)));
create policy project_media_insert on storage.objects for insert to authenticated with check(bucket_id='project-media' and (storage.foldername(name))[1]=(select auth.uid())::text and private.owns_project(private.media_project(name)));
create policy project_media_update on storage.objects for update to authenticated using(bucket_id='project-media' and (storage.foldername(name))[1]=(select auth.uid())::text and private.owns_project(private.media_project(name))) with check(bucket_id='project-media' and (storage.foldername(name))[1]=(select auth.uid())::text and private.owns_project(private.media_project(name)));
create policy project_media_delete on storage.objects for delete to authenticated using(bucket_id='project-media' and (storage.foldername(name))[1]=(select auth.uid())::text and private.owns_project(private.media_project(name)));
create function private.enforce_media_quota() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); old_size bigint:=0; new_size bigint;
begin
  if new.bucket_id<>'project-media' then return new; end if;
  if actor is null or (storage.foldername(new.name))[1]<>actor::text or not private.owns_project(private.media_project(new.name)) then raise exception using errcode='42501',message='MEDIA_ACCESS_DENIED'; end if;
  if tg_op='UPDATE' then old_size:=coalesce((old.metadata->>'size')::bigint,0); end if;
  new_size:=coalesce((new.metadata->>'size')::bigint,0);
  if new_size<0 or new_size>20971520 then raise exception using errcode='22023',message='MEDIA_SIZE_LIMIT'; end if;
  perform private.lock_owner(actor);
  perform private.check_quota(actor,new_size-old_size);
  return new;
end $$;
revoke execute on function private.enforce_media_quota() from public,anon,authenticated;
create trigger choreoflow_media_quota before insert or update on storage.objects for each row execute function private.enforce_media_quota();

-- Only project members may subscribe or broadcast to project:<uuid> channels.
create function private.realtime_project(p_topic text) returns uuid language plpgsql immutable set search_path='' as $$
begin
  if p_topic !~ '^project:[0-9a-fA-F-]{36}$' then return null; end if;
  return substring(p_topic from 9)::uuid;
exception when invalid_text_representation then return null;
end $$;
revoke execute on function private.realtime_project(text) from public;
grant execute on function private.realtime_project(text) to authenticated;
create policy project_realtime_read on realtime.messages for select to authenticated using(private.can_read_project(private.realtime_project((select realtime.topic()))));
create policy project_realtime_send on realtime.messages for insert to authenticated with check(private.can_read_project(private.realtime_project((select realtime.topic()))));
