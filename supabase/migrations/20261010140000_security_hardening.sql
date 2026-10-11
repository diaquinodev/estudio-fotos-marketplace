-- Reaplica a privacidade do bucket mesmo se ele já existir.
update storage.buckets
set public = false
where id = 'generations';
