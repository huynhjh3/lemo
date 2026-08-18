-- 036: ai_generations — logs every AI-drafted message/briefing so the tool
-- can "learn your team's voice" over time. There's no real model training
-- here (this calls the Claude API, not a custom-trained model) — instead,
-- generate-ai-content (the Edge Function) feeds a rep's own past edited
-- drafts of the same type back into the prompt as few-shot examples, so
-- phrasing drifts toward how that person actually writes rather than a
-- generic AI voice.
--
-- generated_text is what the model first produced; edited_text is filled
-- in only once a human actually tweaks/uses it (see aiGenerations.js) —
-- that's the deliberate signal of "this example is worth learning from,"
-- as opposed to raw untouched output nobody vetted.
--
-- 'briefing' extends the same type set communications_log already uses
-- (migration 030) — a briefing isn't a communication type itself, but
-- reusing the vocabulary keeps one enum instead of two.

create table ai_generations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  type text not null check (type in ('briefing','cold_call','follow_up','meeting','email','text_message','other')),
  generated_text text not null,
  edited_text text,
  author_id uuid references profiles(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index ai_generations_author_type_idx on ai_generations(author_id, type, created_at desc);
create index ai_generations_company_id_idx on ai_generations(company_id);

alter table ai_generations enable row level security;

-- Author-or-owner visibility, same shape as notes/pre_install_checklists —
-- a rep's drafts (and the voice examples derived from them) are theirs,
-- with Owner able to see everything for oversight.
create policy ai_generations_select on ai_generations for select to authenticated
  using ((select my_role()) = 'owner' or author_id = auth.uid());

-- The exists() runs as the invoking user, so it's automatically scoped by
-- companies' own RLS — you can only generate about a company you can
-- already see, with no role-specific branching needed here.
create policy ai_generations_insert on ai_generations for insert to authenticated
  with check (exists (select 1 from companies where companies.id = company_id));

create policy ai_generations_update on ai_generations for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
