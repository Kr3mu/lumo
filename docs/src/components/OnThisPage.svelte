<script>
    import { reducedMotion } from "../lib/motion.svelte.js";

    let { headings } = $props();

    let current = $state("");

    $effect(() => {
        const ids = headings.map((h) => h.id);
        current = ids[0] ?? "";
        const visible = new Set();
        // The band between the top bar and 60% of the viewport counts as "in view"; the first
        // heading inside it wins, and the last one passed stays active between headings.
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) visible.add(entry.target.id);
                    else visible.delete(entry.target.id);
                }
                const first = ids.find((id) => visible.has(id));
                if (first) current = first;
            },
            { rootMargin: "-80px 0px -40% 0px" },
        );
        for (const id of ids) {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        }
        return () => observer.disconnect();
    });

    function jump(id) {
        document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
        current = id;
    }
</script>

{#if headings.length >= 2}
    <nav aria-label="On this page">
        <h2>On this page</h2>
        <ul>
            {#each headings as heading (heading.id)}
                <li>
                    <button class:active={heading.id === current} onclick={() => jump(heading.id)}>{heading.s}</button>
                </li>
            {/each}
        </ul>
    </nav>
{/if}

<style>
    h2 {
        margin: 0 0 var(--space-2);
        color: var(--muted);
        font-size: 15px;
        font-weight: 600;
    }

    ul {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    button {
        display: block;
        width: 100%;
        padding: var(--space-1) 0;
        border: 0;
        background: none;
        color: var(--muted);
        font: inherit;
        font-size: 16px;
        line-height: 1.4;
        text-align: left;
        cursor: pointer;
        transition: color 150ms var(--ease-out);
    }

    button:hover {
        color: var(--text);
    }

    button.active {
        color: var(--accent);
        font-weight: 500;
    }
</style>
