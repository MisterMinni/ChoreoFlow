-- Run only against the explicitly designated TEST project. Entire fixture rolls
-- back, including synthetic auth users. No emails, real users or billing calls.
begin;
insert into auth.users(id,aud,role,email) values
('10000000-0000-4000-8000-000000000001','authenticated','authenticated','cloud-owner@example.invalid'),
('10000000-0000-4000-8000-000000000002','authenticated','authenticated','cloud-outsider@example.invalid'),
('10000000-0000-4000-8000-000000000003','authenticated','authenticated','cloud-member@example.invalid');
update auth.users set email_confirmed_at=now() where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

do $$
declare result jsonb; snapshot jsonb:='{"schemaVersion":1,"id":"local-project","name":"First","notes":[{"id":"private","text":"PRIVATE"}],"audio":{"assets":[{"id":"audio","name":"Music","mimeType":"audio/wav","durationSeconds":1,"sizeBytes":100,"localUri":"file:///PRIVATE.wav"}],"clips":[]},"lifts":[{"id":"lift","name":"Lift","note":"PRIVATE","roles":[],"phases":[]}],"privateMetadata":"PRIVATE"}';
begin
  result:=public.create_project(repeat('A',200),snapshot,'20000000-0000-4000-8000-000000000001');
  if (result->>'revision')::int<>1 then raise exception 'FAIL initial revision'; end if;
  result:=public.create_project(repeat('A',200),snapshot,'20000000-0000-4000-8000-000000000001');
  if (result->>'revision')::int<>1 then raise exception 'FAIL create idempotency'; end if;
  begin
    perform public.create_project(repeat('A',201),'{"schemaVersion":1}','20000000-0000-4000-8000-000000000009');
    raise exception using errcode='XX000',message='FAIL oversized title';
  exception when check_violation then null; end;
  begin
    perform public.create_project('Invalid','{}','20000000-0000-4000-8000-000000000009');
    raise exception using errcode='XX000',message='FAIL missing schemaVersion accepted';
  exception when check_violation then null; end;
  begin
    perform public.create_project('Invalid','{"schemaVersion":"1"}','20000000-0000-4000-8000-000000000009');
    raise exception using errcode='XX000',message='FAIL string schemaVersion accepted';
  exception when check_violation then null; end;
  begin
    update public.projects set owner_id='10000000-0000-4000-8000-000000000002';
    raise exception using errcode='XX000',message='FAIL direct project write';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.entitlements(user_id,plan,valid_until,verified_source) values(auth.uid(),'pro',now()+interval '1 year','test_fixture');
    raise exception using errcode='XX000',message='FAIL client entitlement escalation';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_project('20000000-0000-4000-8000-000000000001',null,'30000000-0000-4000-8000-000000000009',snapshot);
    raise exception using errcode='XX000',message='FAIL null base revision';
  exception when serialization_failure then null; end;
  snapshot:=snapshot||'{"name":"Renamed"}';
  result:=public.save_project('20000000-0000-4000-8000-000000000001',1,'30000000-0000-4000-8000-000000000001',snapshot);
  if result->>'revision'<>'2' or (result->>'duplicate')::boolean then raise exception 'FAIL CAS save'; end if;
  if (select title from public.projects where id='20000000-0000-4000-8000-000000000001')<>'Renamed' then raise exception 'FAIL title synchronization'; end if;
  result:=public.save_project('20000000-0000-4000-8000-000000000001',1,'30000000-0000-4000-8000-000000000001',snapshot);
  if result->>'revision'<>'2' or not (result->>'duplicate')::boolean then raise exception 'FAIL save idempotency'; end if;
  begin
    perform public.save_project('20000000-0000-4000-8000-000000000001',1,'30000000-0000-4000-8000-000000000001',snapshot||'{"name":"Different"}');
    raise exception using errcode='XX000',message='FAIL command payload reuse';
  exception when raise_exception then if sqlerrm<>'COMMAND_ID_REUSED' then raise; end if; end;
  begin
    perform public.save_project('20000000-0000-4000-8000-000000000001',1,'30000000-0000-4000-8000-000000000002',snapshot);
    raise exception using errcode='XX000',message='FAIL stale write';
  exception when serialization_failure then null; end;
  perform public.create_project('Second','{"schemaVersion":1}','20000000-0000-4000-8000-000000000002');
  perform public.create_project('Third','{"schemaVersion":1}','20000000-0000-4000-8000-000000000003');
  begin
    perform public.create_project('Fourth','{"schemaVersion":1}','20000000-0000-4000-8000-000000000004');
    raise exception using errcode='XX000',message='FAIL free active project limit';
  exception when raise_exception then if sqlerrm<>'ACTIVE_PROJECT_LIMIT' then raise; end if; end;
  perform public.archive_project('20000000-0000-4000-8000-000000000003',true);
  perform public.create_project('Fourth','{"schemaVersion":1}','20000000-0000-4000-8000-000000000004');
  begin
    perform public.archive_project('20000000-0000-4000-8000-000000000003',false);
    raise exception using errcode='XX000',message='FAIL reactivation limit';
  exception when raise_exception then if sqlerrm<>'ACTIVE_PROJECT_LIMIT' then raise; end if; end;
  begin
    perform public.archive_project('20000000-0000-4000-8000-000000000003',null);
    raise exception using errcode='XX000',message='FAIL null archive flag';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.create_project_invitation('20000000-0000-4000-8000-000000000001','cloud-member@example.invalid','editor');
    raise exception using errcode='XX000',message='FAIL free editor invitation';
  exception when insufficient_privilege then null; end;
  result:=public.create_project_invitation('20000000-0000-4000-8000-000000000001','cloud-member@example.invalid','reader');
  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  perform public.accept_project_invitation(result->>'token');
  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  result:=public.publish_project('20000000-0000-4000-8000-000000000001',2,false);
  if result->'snapshot'->'notes'<>'[]'::jsonb or result->'snapshot'->'audio'<>'{"assets":[],"clips":[]}'::jsonb or result->'snapshot'->'lifts'->0->>'note'<>'' or result->'snapshot' ? 'privateMetadata' then raise exception 'FAIL public snapshot privacy'; end if;
  perform set_config('choreoflow.publication',result->>'id',true);
  result:=public.create_share_link((result->>'id')::uuid,now()+interval '1 day');
  perform set_config('choreoflow.link',result->>'id',true);
  perform set_config('choreoflow.token',result->>'token',true);
  result:=public.publish_project('20000000-0000-4000-8000-000000000001',2,true);
  if result::text like '%file://%' then raise exception 'FAIL local URI leaked'; end if;
  begin
    update public.project_publications set snapshot='{}';
    raise exception using errcode='XX000',message='FAIL mutable publication';
  exception when insufficient_privilege then null; end;
  perform public.save_project('20000000-0000-4000-8000-000000000001',2,'30000000-0000-4000-8000-000000000003',snapshot||'{"name":"Later draft"}');
  if (select p.snapshot->>'name' from public.project_publications p where p.id=current_setting('choreoflow.publication')::uuid)<>'Renamed' then raise exception 'FAIL publication changed with draft'; end if;
  perform public.save_cast('40000000-0000-4000-8000-000000000001',repeat('A',200),'{"schemaVersion":1,"people":[]}',0);
  perform public.save_cast('40000000-0000-4000-8000-000000000002','Cast 2','{"schemaVersion":1}',0);
  perform public.save_cast('40000000-0000-4000-8000-000000000003','Cast 3','{"schemaVersion":1}',0);
  begin
    perform public.save_cast('40000000-0000-4000-8000-000000000004','Cast 4','{"schemaVersion":1}',0);
    raise exception using errcode='XX000',message='FAIL cast limit';
  exception when raise_exception then if sqlerrm<>'CAST_LIMIT' then raise; end if; end;
  -- Metadata rows only; no external object is uploaded by this SQL test.
  insert into storage.objects(bucket_id,name,owner_id,metadata) values('project-media','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/a.wav','10000000-0000-4000-8000-000000000001','{"size":10}');
  update storage.objects set metadata='{"size":20}' where bucket_id='project-media';
  if (select count(*) from storage.objects where bucket_id='project-media')<>1 then raise exception 'FAIL own media read/upsert'; end if;
  begin
    insert into storage.objects(bucket_id,name,owner_id,metadata) values('project-media','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/oversize.wav','10000000-0000-4000-8000-000000000001','{"size":20971521}');
    raise exception using errcode='XX000',message='FAIL per-file size';
  exception when invalid_parameter_value then null; end;
  insert into storage.objects(bucket_id,name,owner_id,metadata) select 'project-media','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/quota-'||n||'.wav','10000000-0000-4000-8000-000000000001','{"size":20971520}'::jsonb from generate_series(1,4) n;
  begin
    insert into storage.objects(bucket_id,name,owner_id,metadata) values('project-media','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/quota-5.wav','10000000-0000-4000-8000-000000000001','{"size":20971520}');
    raise exception using errcode='XX000',message='FAIL total cloud quota';
  exception when raise_exception then if sqlerrm<>'CLOUD_QUOTA_EXCEEDED' then raise; end if; end;
end $$;

-- An unrelated authenticated user sees none of A's data.
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
  if (select count(*) from public.projects)<>0 or (select count(*) from public.casts)<>0 or (select count(*) from public.project_commands)<>0 or (select count(*) from public.project_publications)<>0 or (select count(*) from storage.objects where bucket_id='project-media')<>0 then raise exception 'FAIL cross-user SELECT'; end if;
  begin
    perform public.save_project('20000000-0000-4000-8000-000000000001',3,gen_random_uuid(),'{"schemaVersion":1}');
    raise exception using errcode='XX000',message='FAIL outsider write';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_project_member('20000000-0000-4000-8000-000000000001',auth.uid(),'editor');
    raise exception using errcode='XX000',message='FAIL membership escalation';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name,owner_id,metadata) values('project-media','10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000001/attack.wav','10000000-0000-4000-8000-000000000002','{"size":10}');
    raise exception using errcode='XX000',message='FAIL cross-user media write';
  exception when insufficient_privilege then null; end;
  if private.can_read_project(private.realtime_project('project:20000000-0000-4000-8000-000000000001')) then raise exception 'FAIL realtime access predicate'; end if;
end $$;

-- An invited reader may read but may neither write nor publish.
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
  if (select count(*) from public.projects)<>1 then raise exception 'FAIL reader visibility'; end if;
  begin
    perform public.save_project('20000000-0000-4000-8000-000000000001',3,gen_random_uuid(),'{"schemaVersion":1}');
    raise exception using errcode='XX000',message='FAIL reader write';
  exception when insufficient_privilege then null; end;
  begin
    perform public.publish_project('20000000-0000-4000-8000-000000000001',3,false);
    raise exception using errcode='XX000',message='FAIL reader publication';
  exception when insufficient_privilege then null; end;
end $$;

-- Only a privileged verifier can grant Pro; no client bypass is installed.
reset role;
insert into public.entitlements(user_id,plan,valid_until,verified_source) values('10000000-0000-4000-8000-000000000001','pro',now()+interval '1 day','test_fixture');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.set_project_member('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','editor');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
  if (public.save_project('20000000-0000-4000-8000-000000000001',3,'30000000-0000-4000-8000-000000000004','{"schemaVersion":1,"name":"Team change"}')->>'revision')::int<>4 then raise exception 'FAIL editor CAS'; end if;
  if (select count(*) from public.entitlements)<>0 then raise exception 'FAIL other entitlement visibility'; end if;
end $$;
reset role;
update public.entitlements set valid_until=now()-interval '1 second' where user_id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
  begin
    perform public.save_project('20000000-0000-4000-8000-000000000001',4,gen_random_uuid(),'{"schemaVersion":1}');
    raise exception using errcode='XX000',message='FAIL editor after Pro expiry';
  exception when insufficient_privilege then null; end;
end $$;

-- Anonymous capability returns only the immutable publication, no drafts.
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ declare shared jsonb; begin
  shared:=public.read_share(current_setting('choreoflow.token'));
  if shared->'snapshot'->>'name'<>'Renamed' or shared ? 'project_id' or shared->'snapshot' ? 'privateMetadata' then raise exception 'FAIL anonymous snapshot scope'; end if;
  if public.read_share(repeat('0',64)) is not null then raise exception 'FAIL invalid capability'; end if;
  begin
    perform 1 from public.projects;
    raise exception using errcode='XX000',message='FAIL anon projects privilege';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.project_share_links;
    raise exception using errcode='XX000',message='FAIL hash table exposure';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.revoke_share_link(current_setting('choreoflow.link')::uuid);
set local role anon;
do $$ begin
  if public.read_share(current_setting('choreoflow.token')) is not null then raise exception 'FAIL revoked capability'; end if;
end $$;
reset role;
rollback;
select 'PASS: isolation, CAS/idempotency, quotas, memberships, publication privacy/immutability, token revocation; fixtures rolled back' as result;
