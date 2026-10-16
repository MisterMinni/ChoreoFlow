-- TEST project only. Simulates Storage's caller permission probe and its final
-- service_role metadata write without a user sub. No object bytes/API/email.
begin;
create function pg_temp.media_assert(value boolean,label text) returns void language plpgsql as $$
begin if value is not true then raise exception using errcode='XX000',message='FAIL: '||label; end if; end $$;
create function pg_temp.media_expect_error(statement text,expected_state text,expected_message text default null) returns void language plpgsql as $$
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
insert into auth.users(id,aud,role,email,email_confirmed_at) values
('81000000-0000-4000-8000-000000000001','authenticated','authenticated','media-owner@example.invalid',now()),
('81000000-0000-4000-8000-000000000002','authenticated','authenticated','media-outsider@example.invalid',now()),
('81000000-0000-4000-8000-000000000003','authenticated','authenticated','media-reader@example.invalid',now());
insert into public.projects(id,owner_id,title,snapshot) values
('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','Storage fixture','{"schemaVersion":1}');
insert into public.project_members(project_id,user_id,role) values
('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000003','reader');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
-- The actual permission probe is rolled back by Storage; null metadata is valid
-- here because backend streaming has not yet supplied final object metadata.
savepoint permission_probe;
insert into storage.objects(bucket_id,name,owner_id,metadata) values('project-media','81000000-0000-4000-8000-000000000001/82000000-0000-4000-8000-000000000001/test.wav','81000000-0000-4000-8000-000000000001',null);
rollback to permission_probe;
release permission_probe;

-- Match asSuperUser/setScope: PostgreSQL role changes and both sub sources clear.
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('request.jwt.claim.sub','',true);
insert into storage.objects(bucket_id,name,owner_id,metadata) values('project-media','81000000-0000-4000-8000-000000000001/82000000-0000-4000-8000-000000000001/test.wav','81000000-0000-4000-8000-000000000001','{"size":32044,"mimetype":"audio/wav"}');
update storage.objects set metadata='{"size":64044,"mimetype":"audio/wav"}' where bucket_id='project-media' and owner_id='81000000-0000-4000-8000-000000000001';
do $$ begin
  perform pg_temp.media_assert(auth.uid() is null and current_setting('role')='service_role','actual service role with no user subject');
  perform pg_temp.media_assert((select (metadata->>'size')::bigint=64044 from storage.objects where name='81000000-0000-4000-8000-000000000001/82000000-0000-4000-8000-000000000001/test.wav'),'final storage write and update');
  perform pg_temp.media_expect_error('insert into storage.objects(bucket_id,name,owner_id,metadata) values(''project-media'',''81000000-0000-4000-8000-000000000002/82000000-0000-4000-8000-000000000001/wrong-path.wav'',''81000000-0000-4000-8000-000000000001'',''{"size":10}'')','42501','MEDIA_ACCESS_DENIED');
  perform pg_temp.media_expect_error('insert into storage.objects(bucket_id,name,owner_id,metadata) values(''project-media'',''81000000-0000-4000-8000-000000000001/82000000-0000-4000-8000-000000000001/wrong-owner.wav'',''81000000-0000-4000-8000-000000000002'',''{"size":10}'')','42501','MEDIA_ACCESS_DENIED');
  perform pg_temp.media_expect_error('insert into storage.objects(bucket_id,name,metadata) values(''project-media'',''81000000-0000-4000-8000-000000000001/82000000-0000-4000-8000-000000000001/missing-owner.wav'',''{"size":10}'')','42501','MEDIA_ACCESS_DENIED');
  perform pg_temp.media_expect_error('insert into storage.objects(bucket_id,name,owner_id,metadata) values(''project-media'',''81000000-0000-4000-8000-000000000001/82000000-0000-4000-8000-000000000099/missing-project.wav'',''81000000-0000-4000-8000-000000000001'',''{"size":10}'')','42501','MEDIA_ACCESS_DENIED');
  perform pg_temp.media_expect_error('insert into storage.objects(bucket_id,name,owner_id,metadata) values(''project-media'',''81000000-0000-4000-8000-000000000001/82000000-0000-4000-8000-000000000001/missing-size.wav'',''81000000-0000-4000-8000-000000000001'',null)','22023','MEDIA_SIZE_REQUIRED');
  perform pg_temp.media_expect_error('update storage.objects set metadata=''{"size":20971521}'' where owner_id=''81000000-0000-4000-8000-000000000001''','22023','MEDIA_SIZE_LIMIT');
  perform pg_temp.media_expect_error('update storage.objects set metadata=''{"size":-1}'' where owner_id=''81000000-0000-4000-8000-000000000001''','22023','MEDIA_SIZE_LIMIT');
  perform pg_temp.media_expect_error('update storage.objects set metadata=''{"size":0}'' where owner_id=''81000000-0000-4000-8000-000000000001''','22023','MEDIA_SIZE_LIMIT');
  perform pg_temp.media_expect_error('update storage.objects set metadata=''{"size":"invalid"}'' where owner_id=''81000000-0000-4000-8000-000000000001''','22023','MEDIA_SIZE_LIMIT');
  perform pg_temp.media_expect_error('update storage.objects set name=name||''-moved'' where owner_id=''81000000-0000-4000-8000-000000000001''','42501','MEDIA_LOCATION_IMMUTABLE');
end $$;
-- Quota still counts against the project owner even with no caller identity.
insert into storage.objects(bucket_id,name,owner_id,metadata)
select 'project-media','81000000-0000-4000-8000-000000000001/82000000-0000-4000-8000-000000000001/quota-'||n||'.wav','81000000-0000-4000-8000-000000000001','{"size":20971520}'::jsonb from generate_series(1,4) n;
do $$ begin
  perform pg_temp.media_expect_error('insert into storage.objects(bucket_id,name,owner_id,metadata) values(''project-media'',''81000000-0000-4000-8000-000000000001/82000000-0000-4000-8000-000000000001/quota-5.wav'',''81000000-0000-4000-8000-000000000001'',''{"size":20971520}'')','P0001','CLOUD_QUOTA_EXCEEDED');
end $$;
-- Shrinking an existing file stays possible after quota exhaustion.
update storage.objects set metadata='{"size":10}' where name='81000000-0000-4000-8000-000000000001/82000000-0000-4000-8000-000000000001/test.wav';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000002","role":"service_role"}',true);
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true);
do $$ begin
  perform pg_temp.media_assert((select count(*) from storage.objects where owner_id='81000000-0000-4000-8000-000000000001')=0,'unrelated account cannot read');
  perform pg_temp.media_expect_error('insert into storage.objects(bucket_id,name,owner_id,metadata) values(''project-media'',''81000000-0000-4000-8000-000000000001/82000000-0000-4000-8000-000000000001/spoof.wav'',''81000000-0000-4000-8000-000000000001'',''{"size":10}'')','42501','MEDIA_ACCESS_DENIED');
end $$;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$ begin
  perform pg_temp.media_expect_error('insert into storage.objects(bucket_id,name,owner_id,metadata) values(''project-media'',''81000000-0000-4000-8000-000000000001/82000000-0000-4000-8000-000000000001/spoof-empty.wav'',''81000000-0000-4000-8000-000000000001'',''{"size":10}'')','42501','MEDIA_ACCESS_DENIED');
end $$;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
  perform pg_temp.media_assert((select count(*) from storage.objects where owner_id='81000000-0000-4000-8000-000000000001')=5,'member can read');
  perform pg_temp.media_expect_error('insert into storage.objects(bucket_id,name,owner_id,metadata) values(''project-media'',''81000000-0000-4000-8000-000000000001/82000000-0000-4000-8000-000000000001/member-upload.wav'',''81000000-0000-4000-8000-000000000001'',''{"size":10}'')','42501','MEDIA_ACCESS_DENIED');
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
  perform pg_temp.media_expect_error('insert into storage.objects(bucket_id,name,owner_id,metadata) values(''project-media'',''81000000-0000-4000-8000-000000000001/82000000-0000-4000-8000-000000000001/anon.wav'',''81000000-0000-4000-8000-000000000001'',''{"size":10}'')','42501');
end $$;
reset role;
update public.projects set archived_at=now() where id='82000000-0000-4000-8000-000000000001';
set local role service_role;
do $$ begin
  perform pg_temp.media_expect_error('insert into storage.objects(bucket_id,name,owner_id,metadata) values(''project-media'',''81000000-0000-4000-8000-000000000001/82000000-0000-4000-8000-000000000001/archived.wav'',''81000000-0000-4000-8000-000000000001'',''{"size":10}'')','P0001','PROJECT_ARCHIVED');
end $$;
reset role;
rollback;
select 'PASS: Storage caller probe plus service completion, owner binding, size/quota, role-claim spoof denial, member reads and archive; fixtures rolled back' as result;
