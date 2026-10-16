-- Storage v1.80.2 performs its RLS permission probe as the caller, then final
-- metadata INSERT/UPSERT as service_role without a user sub. The original
-- trigger incorrectly rejected this second step. Sources (official tag):
-- /src/storage/uploader.ts completeUpload; /src/internal/database/pg-connection.ts
-- asSuperUser; /src/internal/database/postgres/scope.ts buildScopeStatement.
-- No grants or RLS policies change. Both phases still enforce project ownership,
-- path/owner_id consistency and the same owner-scoped application quota.
create or replace function private.enforce_media_quota() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  service_context boolean:=coalesce(current_setting('role',true)='service_role',false);
  project_owner uuid;
  project_archived timestamptz;
  old_size bigint:=0;
  new_size bigint;
  size_text text;
begin
  if tg_op='UPDATE' and old.bucket_id='project-media' and
    (new.bucket_id is distinct from old.bucket_id or new.name is distinct from old.name) then
    raise exception using errcode='42501',message='MEDIA_LOCATION_IMMUTABLE';
  end if;
  if new.bucket_id is distinct from 'project-media' then return new; end if;
  if tg_op='UPDATE' and old.bucket_id is distinct from new.bucket_id then
    raise exception using errcode='42501',message='MEDIA_LOCATION_IMMUTABLE';
  end if;
  select owner_id,archived_at into project_owner,project_archived
    from public.projects where id=private.media_project(new.name);
  if project_owner is null or (storage.foldername(new.name))[1] is distinct from project_owner::text
    or new.owner_id is distinct from project_owner::text then
    raise exception using errcode='42501',message='MEDIA_ACCESS_DENIED';
  end if;
  -- role is PostgreSQL's checked SET ROLE context, not request.jwt.claim.role
  -- and not current_user (which is the SECURITY DEFINER's owner here).
  if not service_context and actor is distinct from project_owner then
    raise exception using errcode='42501',message='MEDIA_ACCESS_DENIED';
  end if;
  if project_archived is not null then raise exception using errcode='P0001',message='PROJECT_ARCHIVED'; end if;
  -- The rolled-back caller permission probe may have no final size yet. Its
  -- zero-size estimate does not replace the mandatory final service size check.
  if service_context and (new.metadata->>'size') is null then
    raise exception using errcode='22023',message='MEDIA_SIZE_REQUIRED';
  end if;
  size_text:=coalesce(new.metadata->>'size','0');
  if size_text !~ '^[0-9]{1,8}$' then raise exception using errcode='22023',message='MEDIA_SIZE_LIMIT'; end if;
  new_size:=size_text::bigint;
  if new_size>20971520 or (service_context and new_size<1) then raise exception using errcode='22023',message='MEDIA_SIZE_LIMIT'; end if;
  if tg_op='UPDATE' then old_size:=coalesce((old.metadata->>'size')::bigint,0); end if;
  perform private.lock_owner(project_owner);
  perform private.check_quota(project_owner,new_size-old_size);
  return new;
end $$;
revoke execute on function private.enforce_media_quota() from public,anon,authenticated;
