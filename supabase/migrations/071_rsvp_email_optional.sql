-- 071: an Owner can add a guest by hand (Eventbrite / Chamber RSVPs) without an email.
-- Website RSVPs still always carry one. The (event_id, email) uniqueness still holds
-- for real emails; blanks don't collide.
alter table event_rsvps alter column email drop not null;
