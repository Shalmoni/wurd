-- Commit the new enum value before using it in the settlement migration.
alter type public.xp_event_kind add value if not exists 'common_wurd';
