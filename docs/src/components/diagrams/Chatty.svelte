<script>
    import { Player } from "../../lib/motion.svelte.js";
    import Icon from "../Icon.svelte";
    import DiagramFrame from "./DiagramFrame.svelte";

    const left = ["prepare", "bind", "execute", "result", ...Array.from({ length: 10 }, (_, i) => `fetch ${i + 1}`), "close"];
    const right = [
        { code: "Database.table('players')", calls: 0 },
        { code: "Players:list({ limit = 10 })", calls: 1 },
        { code: "for _, row in ipairs(top)", calls: 0 },
    ];
    const perCall = 40;
    const duration = 3000;
    const sweep = 0.9;

    const player = new Player();

    $effect(() => {
        player.play(duration);
        return player.stop;
    });

    const leftLit = $derived(Math.min(left.length, Math.floor((player.t / sweep) * left.length + (player.t >= 1 ? 1 : 0))));
    const rightLit = $derived(Math.min(right.length, Math.floor((player.t / sweep) * right.length + (player.t >= 1 ? 1 : 0))));
    const rightCalls = $derived(right.slice(0, rightLit).reduce((n, r) => n + r.calls, 0));
</script>

<DiagramFrame title="Where the crossings go" onreplay={() => player.play(duration)}>
    <div class="cols">
        <section>
            <h4>One bridge call per method</h4>
            <ol class="calls">
                {#each left as name, i (name)}
                    <li class:lit={i < leftLit} class:fetch={name.startsWith("fetch")}>
                        <span class="tick"><Icon name="check" size={12} /></span>
                        <code>{name}</code>
                    </li>
                {/each}
            </ol>
            <div class="total">
                <span><strong>{leftLit}</strong> calls</span>
                <span>≈ {leftLit * perCall} µs on Node</span>
                <span class="faint">≈ 2.2 ms on mono</span>
            </div>
        </section>

        <section>
            <h4>Objects in Lua, one bridge call</h4>
            <ol class="calls flow">
                {#each right as row, i (row.code)}
                    <li class:lit={i < rightLit}>
                        <code>{row.code}</code>
                        <span class="count" class:none={row.calls === 0}>{row.calls === 0 ? "in Lua" : "1 bridge call"}</span>
                    </li>
                {/each}
            </ol>
            <div class="total">
                <span><strong>{rightCalls}</strong> call</span>
                <span>≈ {rightLit === right.length ? 80 : rightCalls * perCall} µs end to end</span>
            </div>
        </section>
    </div>

    {#snippet caption()}
        <p>Same Lua, 15× fewer crossings.</p>
    {/snippet}
</DiagramFrame>

<style>
    .cols {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-5);
    }

    section {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    h4 {
        margin: 0 0 var(--space-3);
        font-size: 16px;
        font-weight: 600;
    }

    .calls {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .calls li {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: 2px var(--space-2) 2px var(--space-1);
        border: 1px solid var(--line);
        border-radius: var(--radius-s);
        color: var(--muted);
        font-size: 15px;
        transition:
            background-color 160ms var(--ease-out),
            color 160ms var(--ease-out),
            border-color 160ms var(--ease-out);
    }

    .calls li.lit {
        border-color: var(--brass-soft);
        background: var(--brass-soft);
        color: var(--text);
    }

    .tick {
        display: grid;
        color: var(--brass);
        opacity: 0;
        transition: opacity 160ms var(--ease-out);
    }

    .lit .tick {
        opacity: 1;
    }

    .flow {
        flex-direction: column;
        flex-wrap: nowrap;
    }

    .flow li {
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-2) var(--space-3);
    }

    .flow li.lit {
        border-color: var(--line);
        background: var(--sunken);
    }

    .count {
        flex-shrink: 0;
        padding: 0 var(--space-2);
        border-radius: var(--radius-s);
        background: var(--brass-soft);
        color: var(--brass);
        font-size: 15px;
        font-weight: 500;
        line-height: 20px;
    }

    .count.none {
        background: none;
        color: var(--muted);
    }

    .total {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-3);
        margin-top: auto;
        padding-top: var(--space-3);
        color: var(--muted);
        font-size: 16px;
        font-variant-numeric: tabular-nums;
    }

    .total strong {
        color: var(--text);
        font: 600 17px/1 var(--font-mono);
    }

    .faint {
        color: var(--faint);
    }

    @media (max-width: 640px) {
        .cols {
            grid-template-columns: minmax(0, 1fr);
        }
    }
</style>
