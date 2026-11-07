<script>
    import { fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { pages } from "../content/pages.js";
    import { inline } from "../lib/inline.js";
    import { order } from "../lib/search.js";
    import { reducedMotion } from "../lib/motion.svelte.js";
    import Block from "./Block.svelte";

    let { id, page } = $props();

    const index = $derived(order.indexOf(id));
    const prev = $derived(order[index - 1]);
    const next = $derived(order[index + 1]);
</script>

{#key id}
    <article in:fly={{ y: 8, duration: reducedMotion() ? 0 : 180, easing: cubicOut }}>
        <h1>{page.title}</h1>
        <p class="lede">{@html inline(page.lede)}</p>

        {#each page.blocks as block, i (i)}
            <Block {block} />
        {/each}

        <nav class="pager" aria-label="Previous and next page">
            {#if prev}
                <a class="prev" href="#{prev}">
                    <span class="dir">Previous</span>
                    <span class="name">{pages[prev].title}</span>
                </a>
            {/if}
            {#if next}
                <a class="next" href="#{next}">
                    <span class="dir">Next</span>
                    <span class="name">{pages[next].title}</span>
                </a>
            {/if}
        </nav>
    </article>
{/key}

<style>
    h1 {
        margin: 0 0 var(--space-3);
        font: 800 62px/1 var(--font-display);
        letter-spacing: -0.005em;
    }

    .lede {
        margin: 0 0 var(--space-6);
        color: var(--muted);
        font-size: 21px;
        line-height: 1.55;
    }

    .pager {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-4);
        margin-top: var(--space-8);
        padding-top: var(--space-5);
        border-top: 1px solid var(--line);
    }

    .pager a {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-width: 0;
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--line);
        border-radius: var(--radius-l);
        text-decoration: none;
        transition: border-color 150ms var(--ease-out);
    }

    .pager a:hover {
        border-color: var(--line-strong);
    }

    .next {
        grid-column: 2;
        text-align: right;
    }

    .dir {
        color: var(--muted);
        font-size: 15px;
    }

    .name {
        color: var(--accent);
        font-weight: 500;
    }

    @media (max-width: 560px) {
        h1 {
            font-size: 38px;
        }

        .lede {
            font-size: 18px;
        }
    }
</style>
