<script lang="ts">
	import './Avatar.css';

	interface Props {
		initiales: string;
		nom: string;
		organisation?: string;
	}
	let { initiales, nom, organisation }: Props = $props();
</script>

<span class="c-avatar c-avatar--{organisation?.toLowerCase() ?? 'neutre'}" title={nom}>
	<span aria-hidden="true">{initiales}</span>
	<span class="u-visuellement-masque">{nom}</span>
</span>
