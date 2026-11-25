-- =============================================================================
-- 0017 · Alertes push aussi pour les ANNONCES (ex. : une nouvelle ONG rejoint le consortium).
-- Jusqu'ici, seules les notifications (événements du fil) déclenchaient un push : la création
-- d'une ONG, qui produit une annonce pour tous les comptes, n'envoyait rien.
-- Même protection que 0015 : la fonction Edge n'envoie que pour une annonce récente
-- (10 minutes) et pas encore poussée, qu'elle marque aussitôt.
-- =============================================================================

alter table public.annonces add column push_envoye_le timestamptz;

create function public._signaler_push_annonce() returns trigger
	language plpgsql security definer set search_path = ''
as $$
declare
	adresse text;
begin
	if to_regnamespace('net') is null then return new; end if;
	if not exists (select 1 from public.abonnements_push) then return new; end if;
	select valeur into adresse from public.parametres_serveur where cle = 'url_envoyer_push';
	if adresse is null then return new; end if;
	execute 'select net.http_post(url := $1, body := $2, headers := $3)'
		using adresse, jsonb_build_object('annonce_id', new.id), jsonb_build_object('Content-Type', 'application/json');
	return new;
exception when others then
	return new;
end;
$$;
revoke all on function public._signaler_push_annonce() from public, anon, authenticated;

create trigger annonces_push
	after insert on public.annonces
	for each row execute function public._signaler_push_annonce();
