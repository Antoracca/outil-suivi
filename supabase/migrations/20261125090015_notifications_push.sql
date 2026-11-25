-- =============================================================================
-- 0015 · Notifications « push » envoyées par le serveur (demande du développeur,
-- 2026-11-25) : l'alerte arrive sur l'ordinateur ou le téléphone même quand la
-- plateforme est fermée.
--
-- Circuit : une notification est créée (fonction _journaliser) → le déclencheur
-- appelle la fonction Edge « envoyer-push » (extension pg_net, appel asynchrone)
-- → elle envoie l'alerte à chaque appareil abonné du destinataire (Web Push, VAPID).
--
-- Aucun secret dans la base : la fonction Edge n'envoie que pour une notification
-- récente (10 minutes) et pas encore poussée (push_envoye_le), puis la marque.
-- Un appel forgé ne peut donc que déclencher une alerte qui serait partie de toute façon.
-- Les abonnements sont des données techniques d'appareil (pas des données métier) :
-- un abonnement expiré est retiré par la fonction Edge, et chacun peut retirer le sien.
-- =============================================================================

-- Appareils abonnés aux alertes (un abonnement = un navigateur sur un appareil).
create table public.abonnements_push (
	id uuid primary key default gen_random_uuid(),
	utilisateur uuid not null references public.profils (id),
	endpoint text not null unique check (endpoint like 'https://%'),
	p256dh text not null,
	auth text not null,
	appareil text,
	cree_le timestamptz not null default now(),
	dernier_envoi timestamptz
);
create index abonnements_push_utilisateur on public.abonnements_push (utilisateur);
alter table public.abonnements_push enable row level security;
-- Aucune lecture ni écriture directe pour les rôles de l'application : fonctions ci-dessous seulement.
revoke all on public.abonnements_push from anon, authenticated;

-- Une notification n'est poussée qu'une fois.
alter table public.notifications add column push_envoye_le timestamptz;

-- Paramètres techniques du serveur (adresse de la fonction Edge), illisibles par l'application.
create table public.parametres_serveur (
	cle text primary key,
	valeur text not null
);
alter table public.parametres_serveur enable row level security;
revoke all on public.parametres_serveur from anon, authenticated;
insert into public.parametres_serveur (cle, valeur)
values ('url_envoyer_push', 'https://npcqqivoorfwkfaznsbc.supabase.co/functions/v1/envoyer-push');

-- pg_net (appels HTTP asynchrones) est fourni par Supabase ; absent des tests locaux (PGlite).
do $$
begin
	create extension if not exists pg_net with schema extensions;
exception when others then
	raise notice 'pg_net indisponible (tests locaux) : alertes push désactivées';
end;
$$;

/** Abonne l'appareil du compte connecté (ou le rattache à ce compte s'il servait à un autre). */
create function public.enregistrer_abonnement_push(p_endpoint text, p_p256dh text, p_auth text, p_appareil text default null) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	moi public.profils;
begin
	select * into moi from public.profils where id = auth.uid() and actif;
	if moi.id is null then raise exception 'Compte inconnu ou désactivé.'; end if;
	if coalesce(p_endpoint, '') not like 'https://%' or length(p_endpoint) > 1000 then raise exception 'Adresse d’abonnement invalide.'; end if;
	if coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' or length(p_p256dh) > 200 or length(p_auth) > 100 then raise exception 'Clés d’abonnement invalides.'; end if;
	insert into public.abonnements_push (utilisateur, endpoint, p256dh, auth, appareil)
	values (moi.id, p_endpoint, p_p256dh, p_auth, left(p_appareil, 200))
	on conflict (endpoint) do update
		set utilisateur = excluded.utilisateur, p256dh = excluded.p256dh, auth = excluded.auth, appareil = excluded.appareil;
end;
$$;

/** Désabonne un appareil du compte connecté. */
create function public.retirer_abonnement_push(p_endpoint text) returns void
	language plpgsql security definer set search_path = ''
as $$
begin
	if auth.uid() is null then raise exception 'Connexion requise.'; end if;
	delete from public.abonnements_push where endpoint = p_endpoint and utilisateur = auth.uid();
end;
$$;

revoke all on function public.enregistrer_abonnement_push(text, text, text, text) from public, anon;
revoke all on function public.retirer_abonnement_push(text) from public, anon;
grant execute on function public.enregistrer_abonnement_push(text, text, text, text) to authenticated;
grant execute on function public.retirer_abonnement_push(text) to authenticated;

/**
 * Après chaque notification : demande à la fonction Edge d'envoyer l'alerte, si le
 * destinataire a au moins un appareil abonné. Ne bloque JAMAIS la création de la
 * notification (sans pg_net ou en cas d'erreur, rien ne se passe).
 */
create function public._signaler_push() returns trigger
	language plpgsql security definer set search_path = ''
as $$
declare
	adresse text;
begin
	if to_regnamespace('net') is null then return new; end if;
	if not exists (select 1 from public.abonnements_push where utilisateur = new.destinataire) then return new; end if;
	select valeur into adresse from public.parametres_serveur where cle = 'url_envoyer_push';
	if adresse is null then return new; end if;
	execute 'select net.http_post(url := $1, body := $2, headers := $3)'
		using adresse, jsonb_build_object('notification_id', new.id), jsonb_build_object('Content-Type', 'application/json');
	return new;
exception when others then
	return new;
end;
$$;
revoke all on function public._signaler_push() from public, anon, authenticated;

create trigger notifications_push
	after insert on public.notifications
	for each row execute function public._signaler_push();
