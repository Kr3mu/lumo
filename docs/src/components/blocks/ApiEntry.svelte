<script>
    import { inline } from "../../lib/inline.js";

    let { sig, calls, returns, s, params = [] } = $props();

    const callText = $derived(calls === 0 ? "no bridge calls" : calls === 1 ? "1 bridge call" : `${calls} bridge calls`);
</script>

<section class="api">
    <code class="sig">{sig}</code>
    <div class="meta">
        <span>Returns <code>{returns}</code></span>
        <span class="calls" class:none={calls === 0}>{callText}</span>
    </div>
    <p>{@html inline(s)}</p>
    {#if params.length}
        <dl>
            {#each params as param (param.name)}
                <div class="param">
                    <dt><code>{param.name}</code> <code class="type">{param.type}</code></dt>
                    <dd>{@html inline(param.s)}</dd>
                </div>
            {/each}
        </dl>
    {/if}
</section>

<style>
    .api {
        padding: var(--space-5) 0;
        border-top: 1px solid var(--line);
    }

    .sig {
        display: block;
        font: 500 17px/1.4 var(--font-mono);
        overflow-wrap: anywhere;
    }

    .meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-3);
        margin: var(--space-2) 0 var(--space-3);
        color: var(--muted);
        font-size: 16px;
    }

    .meta code {
        color: var(--text);
        font-size: 15px;
    }

    .calls {
        padding: 0 var(--space-2);
        border-radius: var(--radius-s);
        background: var(--brass-soft);
        color: var(--brass);
        font-size: 14px;
        font-weight: 500;
        line-height: 20px;
    }

    .calls.none {
        background: var(--sunken);
        color: var(--muted);
    }

    p {
        margin: 0;
    }

    p :global(code),
    dd :global(code) {
        padding: 1px 4px;
        border-radius: var(--radius-s);
        background: var(--sunken);
        font-size: 0.88em;
    }

    dl {
        margin: var(--space-3) 0 0;
    }

    .param {
        display: grid;
        grid-template-columns: minmax(0, auto) minmax(0, 1fr);
        gap: var(--space-1) var(--space-4);
        padding: var(--space-2) 0;
        border-top: 1px dashed var(--line);
        font-size: 16px;
    }

    dt code {
        font-size: 15px;
    }

    .type {
        color: var(--muted);
    }

    dd {
        margin: 0;
    }

    @media (max-width: 560px) {
        .param {
            grid-template-columns: minmax(0, 1fr);
        }
    }
</style>
