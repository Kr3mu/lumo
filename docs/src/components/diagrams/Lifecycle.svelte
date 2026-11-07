<script>
    import { Player } from "../../lib/motion.svelte.js";
    import DiagramFrame from "./DiagramFrame.svelte";
    import Segmented from "./Segmented.svelte";

    // Database.transaction costs n + 2 bridge calls: checkout carries START TRANSACTION, and COMMIT (or ROLLBACK) carries the release.
    const head = [
        { label: "checkout connection", call: true, note: "bridge call" },
        { label: "START TRANSACTION", note: "sent with checkout" },
        { label: "Players:get(id, { lock = true })", call: true, note: "bridge call" },
    ];
    const paths = {
        returns: [
            ...head,
            { label: "Players:increment(id, { money = -price })", call: true, note: "bridge call" },
            { label: "Inventory:insert({ … })", call: true, note: "bridge call" },
            { label: "COMMIT", call: true, note: "bridge call", kind: "ok" },
            { label: "release", note: "sent with COMMIT" },
        ],
        raises: [
            ...head,
            { label: "not enough money, fn raises", note: "in Lua", kind: "bad" },
            { label: "ROLLBACK", call: true, note: "bridge call", kind: "bad" },
            { label: "release", note: "sent with ROLLBACK" },
            { label: "error re-raised", note: "in Lua", kind: "bad" },
        ],
    };
    const stepMs = 380;

    let mode = $state("returns");
    const steps = $derived(paths[mode]);
    const player = new Player();

    $effect(() => {
        player.play(paths[mode].length * stepMs);
        return player.stop;
    });

    const reached = $derived(player.t >= 1 ? steps.length : Math.floor(player.t * steps.length) + 1);
    const calls = $derived(steps.slice(0, reached).filter((s) => s.call).length);
</script>

<DiagramFrame title="A transaction, start to finish" onreplay={() => player.play(steps.length * stepMs)}>
    {#snippet controls()}
        <Segmented
            label="Outcome"
            bind:value={mode}
            options={[
                { value: "returns", label: "Function returns" },
                { value: "raises", label: "Function raises" },
            ]}
        />
    {/snippet}

    <ol class="timeline">
        {#each steps as step, i (step.label)}
            <li class:reached={i < reached} class:current={player.t < 1 && i === reached - 1} class:ok={step.kind === "ok"} class:bad={step.kind === "bad"}>
                <span class="dot" class:call={step.call}></span>
                <code>{step.label}</code>
                <span class="note">{step.note}</span>
            </li>
        {/each}
    </ol>

    <div class="summary">
        <span><strong>{calls}</strong> bridge calls</span>
        {#if mode === "raises"}
            <span class="skipped">skipped: Players:increment, Inventory:insert, COMMIT</span>
        {/if}
    </div>

    {#snippet caption()}
        <p>The connection is always released. A raise rolls back every table call made inside the function, then the error continues to the caller.</p>
    {/snippet}
</DiagramFrame>

<style>
    .timeline {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    li {
        position: relative;
        display: grid;
        grid-template-columns: 12px minmax(0, auto) 1fr;
        align-items: center;
        gap: var(--space-3);
        padding: 6px var(--space-2);
        border-radius: var(--radius-m);
        opacity: 0.45;
        transition:
            opacity 180ms var(--ease-out),
            background-color 180ms var(--ease-out);
    }

    li:not(:last-child)::after {
        content: "";
        position: absolute;
        top: calc(50% + 8px);
        left: calc(var(--space-2) + 5.5px);
        width: 1px;
        height: calc(100% - 16px);
        background: var(--line-strong);
    }

    li.reached {
        opacity: 1;
    }

    li.current {
        background: var(--sunken);
    }

    .dot {
        width: 12px;
        height: 12px;
        border: 1.5px solid var(--line-strong);
        border-radius: 50%;
        background: var(--surface);
    }

    .dot.call {
        border-color: var(--brass);
        background: var(--brass);
    }

    code {
        font-size: 16px;
        color: var(--text);
        overflow-wrap: anywhere;
    }

    .ok code {
        color: var(--ok);
    }

    .bad code {
        color: var(--bad);
    }

    .note {
        color: var(--muted);
        font-size: 15px;
    }

    .summary {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-4);
        margin-top: var(--space-3);
        color: var(--muted);
        font-size: 16px;
        font-variant-numeric: tabular-nums;
    }

    .summary strong {
        color: var(--text);
        font: 600 17px/1 var(--font-mono);
    }

    .skipped {
        color: var(--faint);
    }

    p :global(code) {
        font-size: 0.9em;
    }
</style>
