-- TEST project only. Synthetic users/addresses, no Auth API or email sends.
-- Apply migrations first. All fixtures and temporary helpers roll back.
begin;
create function pg_temp.assert_true(value boolean,label text) returns void language plpgsql as $$
begin if value is not true then raise exception using errcode='XX000',message='FAIL: '||label; end if; end $$;
create function pg_temp.expect_error(statement text,expected_state text,expected_message text default null) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate<>expected_state or (expected_message is not null and sqlerrm<>expected_message) then
      raise exception using errcode='XX000',message='Unexpected error: '||sqlstate||' / '||sqlerrm;
    end if;
    return;
  end;
  raise exception using errcode='XX000',message='FAIL: expected rejection '||coalesce(expected_message,expected_state);
end $$;
create function pg_temp.actor(number integer) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims',jsonb_build_object('sub','71000000-0000-4000-8000-'||lpad(number::text,12,'0'),'role','authenticated')::text,true); end $$;
create temporary table invitation_fixture(label text primary key,payload jsonb not null);
grant all on invitation_fixture to authenticated;
insert into auth.users(id,aud,role,email,email_confirmed_at)
select ('71000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'authenticated','authenticated','invite-'||i||'@example.invalid',case when i=3 then null else now() end
from generate_series(1,12) i;
set local role authenticated;
select pg_temp.actor(1);
select public.create_project('Invitation fixture','{"schemaVersion":1,"name":"Invitation fixture"}','72000000-0000-4000-8000-000000000001');

do $$ declare result jsonb; team jsonb; begin
  result:=public.get_project_access('72000000-0000-4000-8000-000000000001');
  perform pg_temp.assert_true(result->>'role'='owner' and (result->>'can_edit')::boolean and not (result->>'owner_has_pro')::boolean,'free owner access');
  insert into invitation_fixture values ('reader',public.create_project_invitation('72000000-0000-4000-8000-000000000001','  INVITE-4@EXAMPLE.INVALID  ','reader'));
  result:=(select payload from invitation_fixture where label='reader');
  perform pg_temp.assert_true(result->>'token' ~ '^[0-9a-f]{64}$' and (result->>'expires_at')::timestamptz=now()+interval '7 days','256-bit token and 7-day expiry');
  team:=public.get_project_team('72000000-0000-4000-8000-000000000001');
  perform pg_temp.assert_true(jsonb_array_length(team->'members')=1 and team->'members'->0->>'role'='owner','owner included');
  perform pg_temp.assert_true(team->'invitations'->0->>'email'='invite-4@example.invalid' and not (team->'invitations'->0 ? 'token_hash') and not (team->'invitations'->0 ? 'token'),'normalized address and no token in owner list');
  perform pg_temp.expect_error('select * from private.project_invitations','42501');
  perform pg_temp.expect_error('insert into private.project_invitations(project_id,email,role,token_hash) values (''72000000-0000-4000-8000-000000000001'',''x@example.invalid'',''editor'',decode(repeat(''0'',64),''hex''))','42501');
  perform pg_temp.expect_error('select public.create_project_invitation(''72000000-0000-4000-8000-000000000001'',''invite-4@example.invalid'',''reader'')','P0001','INVITATION_PENDING');
  perform pg_temp.expect_error('select public.create_project_invitation(''72000000-0000-4000-8000-000000000001'',''invite-1@example.invalid'',''reader'')','22023','OWNER_IS_NOT_A_MEMBER');
  perform pg_temp.expect_error('select public.create_project_invitation(''72000000-0000-4000-8000-000000000001'',''invite-5@example.invalid'',''owner'')','22023','INVALID_MEMBER_ROLE');
  perform pg_temp.expect_error('select public.create_project_invitation(''72000000-0000-4000-8000-000000000001'',null,''reader'')','22023','INVALID_INVITATION_EMAIL');
  perform pg_temp.expect_error('select public.create_project_invitation(''72000000-0000-4000-8000-000000000001'',''bad address@example.invalid'',''reader'')','22023','INVALID_INVITATION_EMAIL');
  perform pg_temp.expect_error('select public.create_project_invitation(''72000000-0000-4000-8000-000000000001'',''invite-5@example.invalid'',''editor'')','42501','PRO_REQUIRED');
  perform pg_temp.expect_error('select public.set_project_member(''72000000-0000-4000-8000-000000000001'',''71000000-0000-4000-8000-000000000004'',''reader'')','P0001','MEMBER_NOT_FOUND');
  insert into invitation_fixture values ('unconfirmed',public.create_project_invitation('72000000-0000-4000-8000-000000000001','invite-3@example.invalid','reader'));
end $$;

select pg_temp.actor(2);
do $$ begin
  perform pg_temp.expect_error('select public.get_project_access(''72000000-0000-4000-8000-000000000001'')','42501','PROJECT_ACCESS_DENIED');
  perform pg_temp.expect_error('select public.get_project_team(''72000000-0000-4000-8000-000000000001'')','42501','PROJECT_ACCESS_DENIED');
  perform pg_temp.expect_error('select public.create_project_invitation(''72000000-0000-4000-8000-000000000001'',''invite-2@example.invalid'',''reader'')','42501','PROJECT_ACCESS_DENIED');
  perform pg_temp.expect_error(format('select public.accept_project_invitation(%L)',(select payload->>'token' from invitation_fixture where label='reader')),'42501','INVITATION_EMAIL_MISMATCH');
  -- User-editable metadata / JWT email cannot substitute for auth.users.email.
  perform set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated","email":"invite-4@example.invalid","user_metadata":{"email":"invite-4@example.invalid"}}',true);
  perform pg_temp.expect_error(format('select public.accept_project_invitation(%L)',(select payload->>'token' from invitation_fixture where label='reader')),'42501','INVITATION_EMAIL_MISMATCH');
  perform pg_temp.expect_error(format('select public.revoke_project_invitation(%L)',(select payload->>'id' from invitation_fixture where label='reader')),'42501','PROJECT_ACCESS_DENIED');
  perform pg_temp.expect_error('select public.accept_project_invitation(''not-a-token'')','42501','INVITATION_UNAVAILABLE');
  perform pg_temp.expect_error('select public.accept_project_invitation(repeat(''0'',64))','42501','INVITATION_UNAVAILABLE');
end $$;
select pg_temp.actor(3);
do $$ begin
  perform pg_temp.expect_error(format('select public.accept_project_invitation(%L)',(select payload->>'token' from invitation_fixture where label='unconfirmed')),'42501','EMAIL_CONFIRMATION_REQUIRED');
end $$;
select pg_temp.actor(4);
do $$ declare result jsonb; begin
  result:=public.accept_project_invitation((select payload->>'token' from invitation_fixture where label='reader'));
  perform pg_temp.assert_true(result->>'project_id'='72000000-0000-4000-8000-000000000001','accept reader project');
  result:=public.get_project_access('72000000-0000-4000-8000-000000000001');
  perform pg_temp.assert_true(result->>'role'='reader' and not (result->>'can_edit')::boolean,'reader cannot edit');
  perform pg_temp.assert_true((select count(*) from public.projects)=1,'reader can read draft');
  perform pg_temp.expect_error('select public.get_project_team(''72000000-0000-4000-8000-000000000001'')','42501','PROJECT_ACCESS_DENIED');
  perform pg_temp.expect_error('select * from private.project_invitations','42501');
  perform pg_temp.expect_error('select public.set_project_member(''72000000-0000-4000-8000-000000000001'',''71000000-0000-4000-8000-000000000004'',''editor'')','42501','PROJECT_ACCESS_DENIED');
  perform pg_temp.expect_error(format('select public.accept_project_invitation(%L)',(select payload->>'token' from invitation_fixture where label='reader')),'42501','INVITATION_UNAVAILABLE');
end $$;
select pg_temp.actor(1);
do $$ declare result jsonb; begin
  result:=public.get_project_team('72000000-0000-4000-8000-000000000001');
  perform pg_temp.assert_true(jsonb_array_length(result->'members')=2 and result->'invitations' @> '[{"email":"invite-4@example.invalid","role":"reader"}]','owner lists accepted member');
  perform pg_temp.expect_error('select public.create_project_invitation(''72000000-0000-4000-8000-000000000001'',''invite-4@example.invalid'',''reader'')','P0001','MEMBER_ALREADY_EXISTS');
  perform pg_temp.expect_error(format('select public.revoke_project_invitation(%L)',(select payload->>'id' from invitation_fixture where label='reader')),'P0001','INVITATION_ALREADY_ACCEPTED');
  insert into invitation_fixture values ('revoked',public.create_project_invitation('72000000-0000-4000-8000-000000000001','invite-5@example.invalid','reader'));
  perform public.revoke_project_invitation((select (payload->>'id')::uuid from invitation_fixture where label='revoked'));
  perform public.revoke_project_invitation((select (payload->>'id')::uuid from invitation_fixture where label='revoked'));
  insert into invitation_fixture values ('expired',public.create_project_invitation('72000000-0000-4000-8000-000000000001','invite-6@example.invalid','reader'));
end $$;
reset role;
update private.project_invitations set created_at=now()-interval '8 days',expires_at=now()-interval '1 day' where id=(select (payload->>'id')::uuid from invitation_fixture where label='expired');
do $$ begin
  perform pg_temp.assert_true((select octet_length(token_hash)=32 and token_hash=sha256(convert_to((select payload->>'token' from invitation_fixture where label='reader'),'UTF8')) from private.project_invitations where id=(select (payload->>'id')::uuid from invitation_fixture where label='reader')),'only correct SHA-256 hash stored');
  perform pg_temp.assert_true((select relrowsecurity from pg_class where oid='private.project_invitations'::regclass),'private table RLS enabled');
  perform pg_temp.expect_error('update private.project_invitations set expires_at=created_at+interval ''8 days''','23514');
end $$;
set local role authenticated;
select pg_temp.actor(5);
do $$ begin perform pg_temp.expect_error(format('select public.accept_project_invitation(%L)',(select payload->>'token' from invitation_fixture where label='revoked')),'42501','INVITATION_UNAVAILABLE'); end $$;
select pg_temp.actor(6);
do $$ begin perform pg_temp.expect_error(format('select public.accept_project_invitation(%L)',(select payload->>'token' from invitation_fixture where label='expired')),'42501','INVITATION_UNAVAILABLE'); end $$;

-- Active Pro is necessary at create, acceptance and role changes. Four pending
-- links reserve all slots; demotion/removal/revocation/expiry release a slot.
reset role;
insert into public.entitlements(user_id,plan,valid_until,verified_source) values('71000000-0000-4000-8000-000000000001','pro',now()+interval '1 day','test_fixture');
set local role authenticated;
select pg_temp.actor(1);
do $$ begin
  for i in 5..8 loop
    insert into invitation_fixture values ('editor-'||i,public.create_project_invitation('72000000-0000-4000-8000-000000000001','invite-'||i||'@example.invalid','editor'));
  end loop;
  perform pg_temp.expect_error('select public.create_project_invitation(''72000000-0000-4000-8000-000000000001'',''invite-9@example.invalid'',''editor'')','P0001','EDITOR_LIMIT');
  perform pg_temp.expect_error('select public.set_project_member(''72000000-0000-4000-8000-000000000001'',''71000000-0000-4000-8000-000000000004'',''editor'')','P0001','EDITOR_LIMIT');
end $$;
select pg_temp.actor(5);
do $$ declare result jsonb; begin
  perform public.accept_project_invitation((select payload->>'token' from invitation_fixture where label='editor-5'));
  result:=public.get_project_access('72000000-0000-4000-8000-000000000001');
  perform pg_temp.assert_true(result->>'role'='editor' and (result->>'can_edit')::boolean and (result->>'owner_has_pro')::boolean,'active Pro editor');
  perform pg_temp.expect_error('select public.get_project_team(''72000000-0000-4000-8000-000000000001'')','42501','PROJECT_ACCESS_DENIED');
end $$;
select pg_temp.actor(1);
do $$ begin
  perform public.set_project_member('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000005','reader');
  perform public.set_project_member('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000004','editor');
  perform pg_temp.expect_error('select public.set_project_member(''72000000-0000-4000-8000-000000000001'',''71000000-0000-4000-8000-000000000005'',''editor'')','P0001','EDITOR_LIMIT');
  perform public.revoke_project_invitation((select (payload->>'id')::uuid from invitation_fixture where label='editor-8'));
  perform public.set_project_member('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000005','editor');
  perform public.set_project_member('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000005','editor');
  perform pg_temp.expect_error('select public.create_project_invitation(''72000000-0000-4000-8000-000000000001'',''invite-9@example.invalid'',''editor'')','P0001','EDITOR_LIMIT');
end $$;
reset role;
update public.entitlements set valid_until=now()-interval '1 second' where user_id='71000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.actor(6);
do $$ begin perform pg_temp.expect_error(format('select public.accept_project_invitation(%L)',(select payload->>'token' from invitation_fixture where label='editor-6')),'42501','PRO_REQUIRED'); end $$;
select pg_temp.actor(5);
do $$ declare result jsonb; begin
  result:=public.get_project_access('72000000-0000-4000-8000-000000000001');
  perform pg_temp.assert_true(result->>'role'='editor' and not (result->>'can_edit')::boolean and not (result->>'owner_has_pro')::boolean,'Pro expiry removes effective edit access');
  perform pg_temp.expect_error('select public.save_project(''72000000-0000-4000-8000-000000000001'',1,gen_random_uuid(),''{"schemaVersion":1}'')','42501','PROJECT_WRITE_DENIED');
end $$;
select pg_temp.actor(1);
do $$ begin
  perform pg_temp.expect_error('select public.set_project_member(''72000000-0000-4000-8000-000000000001'',''71000000-0000-4000-8000-000000000005'',''editor'')','42501','PRO_REQUIRED');
  perform public.set_project_member('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000005','reader');
  insert into invitation_fixture values ('free-reader',public.create_project_invitation('72000000-0000-4000-8000-000000000001','invite-9@example.invalid','reader'));
end $$;
select pg_temp.actor(9);
do $$ begin perform public.accept_project_invitation((select payload->>'token' from invitation_fixture where label='free-reader')); end $$;

-- Restore Pro, prove pending expiry releases a slot, and acceptance cannot
-- bypass a full editor list even if privileged fixture data fills reserved seats.
reset role;
update public.entitlements set valid_until=now()+interval '1 day' where user_id='71000000-0000-4000-8000-000000000001';
update private.project_invitations set created_at=now()-interval '8 days',expires_at=now()-interval '1 day' where id=(select (payload->>'id')::uuid from invitation_fixture where label='editor-7');
set local role authenticated;
select pg_temp.actor(1);
do $$ begin
  perform public.set_project_member('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000005','editor');
  perform public.set_project_member('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000009','editor');
end $$;
reset role;
insert into public.project_members(project_id,user_id,role) values('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000010','editor');
set local role authenticated;
select pg_temp.actor(6);
do $$ begin perform pg_temp.expect_error(format('select public.accept_project_invitation(%L)',(select payload->>'token' from invitation_fixture where label='editor-6')),'P0001','EDITOR_LIMIT'); end $$;
select pg_temp.actor(1);
select public.set_project_member('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000010',null);
select pg_temp.actor(6);
do $$ begin perform public.accept_project_invitation((select payload->>'token' from invitation_fixture where label='editor-6')); end $$;

-- Accepted links never recreate removed members. Archived projects still allow
-- reads/removal, but no new acceptance and no edit indication.
select pg_temp.actor(1);
do $$ begin
  perform public.set_project_member('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000004',null);
  insert into invitation_fixture values ('archived',public.create_project_invitation('72000000-0000-4000-8000-000000000001','invite-11@example.invalid','reader'));
  perform public.archive_project('72000000-0000-4000-8000-000000000001',true);
  perform pg_temp.assert_true(not (public.get_project_access('72000000-0000-4000-8000-000000000001')->>'can_edit')::boolean,'archived owner not editable');
end $$;
select pg_temp.actor(4);
do $$ begin
  perform pg_temp.expect_error(format('select public.accept_project_invitation(%L)',(select payload->>'token' from invitation_fixture where label='reader')),'42501','INVITATION_UNAVAILABLE');
  perform pg_temp.expect_error('select public.get_project_access(''72000000-0000-4000-8000-000000000001'')','42501','PROJECT_ACCESS_DENIED');
end $$;
select pg_temp.actor(11);
do $$ begin perform pg_temp.expect_error(format('select public.accept_project_invitation(%L)',(select payload->>'token' from invitation_fixture where label='archived')),'P0001','PROJECT_ARCHIVED'); end $$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
  perform pg_temp.expect_error('select public.get_project_access(''72000000-0000-4000-8000-000000000001'')','42501');
  perform pg_temp.expect_error('select public.get_project_team(''72000000-0000-4000-8000-000000000001'')','42501');
  perform pg_temp.expect_error('select public.create_project_invitation(''72000000-0000-4000-8000-000000000001'',''invite-2@example.invalid'',''reader'')','42501');
  perform pg_temp.expect_error('select public.accept_project_invitation(repeat(''0'',64))','42501');
  perform pg_temp.expect_error('select public.revoke_project_invitation(''73000000-0000-4000-8000-000000000001'')','42501');
  perform pg_temp.expect_error('select * from private.project_invitations','42501');
end $$;
reset role;
rollback;
select 'PASS: invitation identity/privacy, owner-only team, roles, pending reservations, expiry/revoke/replay, Pro expiry, archive and anon checks; fixtures rolled back' as result;
