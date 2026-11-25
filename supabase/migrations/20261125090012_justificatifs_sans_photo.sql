-- =============================================================================
-- 0012 — Justificatifs : documents seulement, aucune photo (demande d'APSUD du 2026-11-25)
-- Les pièces jointes aux moyens de vérification sont des documents : PDF, Word, Excel,
-- PowerPoint, texte, archives… Les photos (JPEG, PNG, HEIC, WebP…) sont refusées : à
-- regrouper dans un PDF si besoin. Cela protège aussi les enfants (aucune photo
-- identifiable dans la plateforme, INSTRUCTIONS §0.10). Même règle dans depot.svelte.ts.
-- =============================================================================

update storage.buckets set allowed_mime_types = array[
	'application/pdf',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/vnd.ms-powerpoint',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'application/vnd.oasis.opendocument.text',
	'application/vnd.oasis.opendocument.spreadsheet',
	'text/csv',
	'text/plain',
	'application/zip',
	'application/x-zip-compressed'
]
where id = 'justificatifs';

create or replace function public.ajouter_justificatif(
	p_evenement text, p_id text, p_volet text, p_mois text,
	p_rattachement_type text, p_rattachement_id text,
	p_nom_fichier text, p_type_mime text, p_taille bigint, p_moyen text, p_chemin text
) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils;
	id_j text := coalesce(p_id, gen_random_uuid()::text);
	nom text := trim(coalesce(p_nom_fichier, ''));
begin
	if public._deja_fait(p_evenement) then return; end if;
	p := public._exiger_saisie(p_volet, p_mois);
	if nom = '' then raise exception 'Le fichier n’a pas de nom.' using errcode = 'P0001'; end if;
	if lower(coalesce(p_type_mime, '')) like 'image/%'
		or lower(nom) ~ '\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|svg)$' then
		raise exception 'Les photos ne sont pas acceptées : joignez un document (PDF, Word, Excel…). Regroupez les photos dans un PDF si besoin.' using errcode = 'P0001';
	end if;
	insert into public.justificatifs (id, volet, mois, rattachement_type, rattachement_id, nom_fichier, type_mime, taille, chemin_stockage, moyen_verification, auteur)
	values (id_j, p_volet, p_mois, p_rattachement_type, p_rattachement_id, nom,
		coalesce(nullif(p_type_mime, ''), 'application/octet-stream'), greatest(coalesce(p_taille, 0), 0),
		nullif(p_chemin, ''), nullif(trim(coalesce(p_moyen, '')), ''), p.id);
	perform public._journaliser(p_evenement, p, 'justificatif_ajoute', p_volet, p_mois, 'justificatif', id_j, nom, 'a ajouté le justificatif');
end;
$$;
