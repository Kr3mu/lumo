<script>
    import { Player, clamp01 } from "../../lib/motion.svelte.js";
    import DiagramFrame from "./DiagramFrame.svelte";

    const layers = [
        { name: "Lua object layer", where: "loaded into each resource", chips: ["Database.table", "Table", "rows", "Database.transaction", "Database.batch", "SQL cache"] },
        { name: "Exports", where: "exports of the lumo resource", chips: ["exec", "batch", "checkout / release"] },
        { name: "Bridge", where: "inside the lumo resource", chips: ["Node main thread", "worker thread", "MariaDB pool"], joins: ["shared memory", ""] },
    ];

    const order = layers.flatMap((layer, l) => layer.chips.map((_, c) => `${l}:${c}`));
    const sweep = 0.68;
    const duration = 3200;

    const player = new Player();

    $effect(() => {
        player.play(duration);
        return player.stop;
    });

    // A highlight passes over the chips one by one, then the brass pulse crosses the boundary.
    function lit(key) {
        const i = order.indexOf(key);
        const at = player.t / sweep - i / order.length;
        return player.t < 1 && at >= 0 && at < 1.6 / order.length;
    }

    const pulse = $derived(clamp01((player.t - sweep) / (1 - sweep)));
</script>

<DiagramFrame title="Three layers, one boundary" onreplay={() => player.play(duration)}>
    <div class="stack">
        {#each layers as layer, l (layer.name)}
            {#if l === 1}
                <div class="boundary">
                    <span class="rule"></span>
                    <span class="tag">runtime boundary · one call per query, ~40 µs</span>
                    {#if pulse > 0 && pulse < 1}
                        <span class="pulse" style:transform="translateY({pulse * 44 - 22}px)" style:opacity={Math.sin(pulse * Math.PI)}></span>
                    {/if}
                </div>
            {/if}
            <div class="layer">
                <div class="title">
                    <strong>{layer.name}</strong>
                    <span>{layer.where}</span>
                </div>
                <div class="chips">
                    {#each layer.chips as chip, c (chip)}
                        <code class="chip" class:lit={lit(`${l}:${c}`)}>{chip}</code>
                        {#if layer.joins && c < layer.chips.length - 1}
                            <span class="join">⇄ {layer.joins[c]}</span>
                        {/if}
                    {/each}
                </div>
            </div>
        {/each}
    </div>

    {#snippet caption()}
        <p>Everything above the brass line runs in the calling resource and costs nanoseconds. Each query crosses it exactly once.</p>
    {/snippet}
</DiagramFrame>

<style>
    .stack {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }

    .layer {
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-m);
        background: var(--sunken);
    }

    .title {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 0 var(--space-3);
        margin-bottom: var(--space-2);
        font-size: 16px;
    }

    .title strong {
        font-weight: 600;
    }

    .title span {
        color: var(--muted);
        font-size: 16px;
    }

    .chips {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
    }

    .chip {
        padding: 2px var(--space-2);
        border: 1px solid var(--line);
        border-radius: var(--radius-s);
        background: var(--surface);
        color: var(--text);
        font-size: 15px;
        transition:
            background-color 180ms var(--ease-out),
            border-color 180ms var(--ease-out),
            color 180ms var(--ease-out);
    }

    .chip.lit {
        border-color: var(--accent);
        background: var(--accent-soft);
        color: var(--accent);
    }

    .join {
        color: var(--muted);
        font-size: 15px;
    }

    .boundary {
        position: relative;
        display: flex;
        align-items: center;
        min-height: 44px;
    }

    .rule {
        position: absolute;
        inset: 50% 0 auto;
        border-top: 2px dashed var(--brass);
    }

    .tag {
        position: relative;
        margin-left: var(--space-3);
        padding: 0 var(--space-2);
        border-radius: var(--radius-s);
        background: var(--brass-soft);
        color: var(--brass);
        font-size: 15px;
        font-weight: 500;
        line-height: 22px;
    }

    .pulse {
        position: absolute;
        top: 50%;
        right: 18%;
        width: 12px;
        height: 12px;
        margin-top: -6px;
        border-radius: 50%;
        background: var(--brass);
    }
</style>
