<script>
    import { inline } from "../../lib/inline.js";
    import CodeBlock from "./CodeBlock.svelte";

    let { items } = $props();
</script>

<ol>
    {#each items as step, i (i)}
        <li>
            <span class="num" aria-hidden="true">{i + 1}</span>
            <div class="body">
                <h3>{step.title}</h3>
                <p>{@html inline(step.s)}</p>
                {#if step.code}
                    <CodeBlock s={step.code} lang={step.lang} />
                {/if}
            </div>
        </li>
    {/each}
</ol>

<style>
    ol {
        margin: 0 0 var(--space-5);
        padding: 0;
        list-style: none;
    }

    li {
        position: relative;
        display: grid;
        grid-template-columns: 28px minmax(0, 1fr);
        gap: var(--space-4);
        padding-bottom: var(--space-4);
    }

    li:not(:last-child)::before {
        content: "";
        position: absolute;
        top: 32px;
        bottom: 4px;
        left: 13.5px;
        width: 1px;
        background: var(--line);
    }

    .num {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border: 1px solid var(--line-strong);
        border-radius: 50%;
        background: var(--surface);
        color: var(--text);
        font: 700 20px/1 var(--font-display);
    }

    h3 {
        margin: 2px 0 var(--space-1);
        font: 600 18px/1.4 var(--font-body);
    }

    p {
        margin: 0 0 var(--space-3);
    }

    p :global(code) {
        padding: 1px 4px;
        border-radius: var(--radius-s);
        background: var(--sunken);
        font-size: 0.88em;
    }
</style>
