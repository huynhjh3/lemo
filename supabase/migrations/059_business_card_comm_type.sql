-- 059: a "business_card" communications-log type. A photo logged this way is
-- read on-device (tesseract.js — see src/lib/businessCard.js) and the contact
-- details on it are added to the company automatically. Only the allowed
-- type list changes; no policy or column changes.

alter table communications_log drop constraint if exists communications_log_type_check;
alter table communications_log add constraint communications_log_type_check
  check (type in ('cold_call','follow_up','meeting','email','text_message','other','business_card'));
