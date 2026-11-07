<script>
    import { inline } from "../../lib/inline.js";

    let { items } = $props();
</script>

<div class="cards">
    {#each items as card (card.page)}
        <a href="#{card.page}">
            <span class="title">{card.title}</span>
            <span class="text">{@html inline(card.s)}</span>
        </a>
    {/each}
</div>

<style>
    .cards {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-3);
        margin: 0 0 var(--space-5);
    }

    a {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-width: 0;
        padding: var(--space-4);
        border: 1px solid var(--line);
        border-radius: var(--radius-l);
        background: var(--surface);
        color: var(--text);
        text-decoration: none;
        transition: border-color 150ms var(--ease-out);
    }

    a:hover {
        border-color: var(--line-strong);
    }

    .title {
        color: var(--accent);
        font-weight: 600;
    }

    .text {
        color: var(--muted);
        font-size: 16px;
    }

    @media (max-width: 560px) {
        .cards {
            grid-template-columns: minmax(0, 1fr);
        }
    }
</style>
