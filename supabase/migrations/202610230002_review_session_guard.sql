-- Record decisions using the session-aware actor helper.
create or replace function public.review_professional(p_id uuid,p_status text,p_note text default '',p_expected_reviewed_at timestamptz default null)
returns void language plpgsql security definer set search_path='' as $$
declare previous timestamptz; stamp timestamptz:=clock_timestamp();
begin
 if not public.is_banner_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_status is null or p_status not in ('approved','rejected') or p_note is null or length(p_note)>1000 then raise exception 'Invalid review'; end if;
 perform 1 from public.professionals where id=p_id for update;
 if not found then raise exception 'Professional not found'; end if;
 select reviewed_at into previous from private.professional_reviews where professional_id=p_id;
 if previous is distinct from p_expected_reviewed_at then raise exception 'This profile was reviewed by another admin. Refresh and try again.'; end if;
 insert into private.professional_reviews(professional_id,status,reviewed_by,reviewed_at,note) values(p_id,p_status,private.current_user_id(),stamp,trim(p_note))
 on conflict(professional_id) do update set status=excluded.status,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,note=excluded.note;
 insert into private.professional_review_history(professional_id,status,reviewed_by,reviewed_at,note) values(p_id,p_status,private.current_user_id(),stamp,trim(p_note));
 update public.professionals set verified_at=case when p_status='approved' then stamp else null end where id=p_id;
end;$$;
