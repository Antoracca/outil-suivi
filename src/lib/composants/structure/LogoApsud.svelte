<script lang="ts">
	import './LogoApsud.css';
	/** Logo fourni par APSUD (JPEG 85 × 102). Une version vectorielle reste à demander. */
	interface Props {
		taille?: 'sm' | 'lg' | 'xl';
	}
	let { taille = 'sm' }: Props = $props();
</script>

<img class="c-logo c-logo--{taille}" src="/logo-apsud.jpg" alt="" width="85" height="102" />
