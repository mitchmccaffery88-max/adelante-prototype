alter table app.record_class_grants alter column org_id set not null;
create trigger touch_updated_at before update on app.record_class_grants for each row execute function app.touch_updated_at();