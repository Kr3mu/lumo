<script>
    import { Player, clamp01 } from "../../lib/motion.svelte.js";
    import DiagramFrame from "./DiagramFrame.svelte";
    import Segmented from "./Segmented.svelte";

    const lanes = [
        { x: 90, label: "Lua script" },
        { x: 270, label: "Bridge (export call)" },
        { x: 450, label: "Node worker" },
        { x: 630, label: "MariaDB" },
    ];
    const X = lanes.map((l) => l.x);

    const start = [
        { self: 0, y: 76, us: 2, w: 1, label: "object layer, < 2 µs" },
        { from: 0, to: 1, y: 112, us: 20, w: 1, brass: true, label: "exec(...)" },
        { from: 1, to: 2, y: 144, us: 10, w: 1, label: "handoff, ~10 µs" },
        { from: 2, to: 3, y: 176, us: 30, w: 1, label: "small SELECT, ~30 µs" },
    ];
    const modes = {
        fast: {
            duration: 2600,
            segs: [...start, { from: 3, to: 0, y: 224, us: 18, w: 1.4, label: "the value is the export's return value" }],
        },
        slow: {
            duration: 4400,
            segs: [
                ...start.slice(0, 3),
                { from: 2, to: 3, y: 176, us: 30, w: 1, label: "slow query" },
                { self: 3, y: 176, y2: 212, us: 4970, w: 3, label: "5 ms in MariaDB" },
                { from: 3, to: 0, y: 224, us: 70, w: 1.4, label: "resumer call resumes the coroutine" },
            ],
        },
    };

    let mode = $state("fast");
    const player = new Player();

    $effect(() => {
        player.play(modes[mode].duration);
        return player.stop;
    });

    const segs = $derived.by(() => {
        const list = modes[mode].segs;
        const total = list.reduce((sum, s) => sum + s.w, 0);
        let at = 0;
        return list.map((s) => {
            const p = clamp01((player.t * total - at) / s.w);
            at += s.w;
            return { ...s, p };
        });
    });

    const elapsed = $derived(segs.reduce((sum, s) => sum + s.us * s.p, 0));
    const done = $derived(player.t >= 1);
    const current = $derived(segs.find((s) => s.p < 1) ?? segs[segs.length - 1]);
    const yielded = $derived(mode === "slow" && elapsed >= 2000);

    const token = $derived.by(() => {
        const s = current;
        if (s.self !== undefined) return { x: X[s.self], y: s.y + ((s.y2 ?? s.y) - s.y) * s.p };
        return { x: X[s.from] + (X[s.to] - X[s.from]) * s.p, y: s.y };
    });

    function end(s) {
        return X[s.from] + (X[s.to] - X[s.from]) * s.p;
    }

    function format(us) {
        return us < 1000 ? `${Math.round(us)} µs` : `${(us / 1000).toFixed(2)} ms`;
    }
</script>

<DiagramFrame title="One query, end to end" onreplay={() => player.play(modes[mode].duration)} minWidth={640}>
    {#snippet controls()}
        <Segmented
            label="Answer speed"
            bind:value={mode}
            options={[
                { value: "fast", label: "Fast answer" },
                { value: "slow", label: "Slow answer" },
            ]}
        />
    {/snippet}

    <div class="readout">
        <span>Elapsed <strong>{format(elapsed)}</strong></span>
        <span class="budget">inline budget 2 ms</span>
    </div>

    <svg viewBox="0 0 720 250" role="img" aria-label="A query travels from Lua through the bridge and the Node worker to MariaDB and back">
        {#each lanes as lane (lane.x)}
            <rect class="head" x={lane.x - 76} y="8" width="152" height="30" rx="4" />
            <text class="head-text" x={lane.x} y="28">{lane.label}</text>
            <line class="lane" x1={lane.x} y1="40" x2={lane.x} y2="244" />
        {/each}

        {#each segs as s, i (i)}
            {#if s.self !== undefined}
                <rect class="busy" x={X[s.self] - 5} y={s.y - 8} width="10" height={(s.y2 ?? s.y) - s.y + 16} rx="2" opacity={s.p > 0 ? 1 : 0} />
                <text class="label" class:end={s.self === 3} x={s.self === 3 ? X[s.self] - 14 : X[s.self] + 14} y={(s.y + (s.y2 ?? s.y)) / 2 + 4} opacity={s.p > 0 ? 1 : 0}>{s.label}</text>
            {:else}
                {@const xe = end(s)}
                {@const dir = Math.sign(X[s.to] - X[s.from])}
                {#if s.to === 0}
                    <line class="arrow" x1={X[s.from]} y1={s.y} x2={Math.max(xe, X[1])} y2={s.y} opacity={s.p > 0 ? 1 : 0} />
                    {#if xe < X[1]}
                        <line class="arrow brass" x1={X[1]} y1={s.y} x2={xe} y2={s.y} />
                    {/if}
                {:else}
                    <line class="arrow" class:brass={s.brass} x1={X[s.from]} y1={s.y} x2={xe} y2={s.y} opacity={s.p > 0 ? 1 : 0} />
                {/if}
                {#if s.p >= 1}
                    <polygon class="tip" class:brass={s.brass || s.to === 0} points="{xe},{s.y} {xe - 7 * dir},{s.y - 4} {xe - 7 * dir},{s.y + 4}" />
                {/if}
                <text class="label mid" x={(X[s.from] + X[s.to]) / 2} y={s.y - 8} opacity={s.p > 0 ? 1 : 0}>{s.label}</text>
            {/if}
        {/each}

        {#if yielded}
            <rect class="chip-warn" x="46" y="158" width="88" height="22" rx="4" />
            <text class="chip-text warn" x="90" y="173">yielded</text>
            <rect class="chip-plain" x="196" y="158" width="148" height="22" rx="4" />
            <text class="chip-text" x="270" y="173">thread released at 2 ms</text>
        {:else if mode === "fast" && done}
            <rect class="chip-ok" x="40" y="148" width="100" height="22" rx="4" />
            <text class="chip-text ok" x="90" y="163">never yields</text>
        {/if}

        {#if !done}
            <circle class="token" cx={token.x} cy={token.y} r="6" />
        {/if}
    </svg>

    {#snippet caption()}
        <p><strong>Fast answer:</strong> the worker replies inside the 2 ms budget, so the row comes back as the export's return value and the coroutine never yields (about 80 µs).</p>
        <p><strong>Slow answer:</strong> at 2 ms the coroutine yields and the server thread moves on; when MariaDB answers, the resumer call wakes it (about 5.1 ms).</p>
    {/snippet}
</DiagramFrame>

<style>
    .readout {
        display: flex;
        gap: var(--space-4);
        align-items: baseline;
        margin-bottom: var(--space-2);
        font-size: 16px;
        font-variant-numeric: tabular-nums;
        color: var(--muted);
    }

    .readout strong {
        display: inline-block;
        min-width: 72px;
        color: var(--text);
        font: 500 17px/1 var(--font-mono);
    }

    .budget {
        color: var(--faint);
    }

    svg {
        display: block;
        width: 100%;
        height: auto;
        font-family: var(--font-body);
    }

    .head {
        fill: var(--sunken);
        stroke: var(--line);
    }

    .head-text {
        fill: var(--text);
        font-size: 16px;
        font-weight: 600;
        text-anchor: middle;
    }

    .lane {
        fill: none;
        stroke: var(--line);
        stroke-dasharray: 3 4;
    }

    .arrow {
        fill: none;
        stroke: var(--line-strong);
        stroke-width: 2;
    }

    .arrow.brass {
        stroke: var(--brass);
    }

    .tip {
        fill: var(--line-strong);
    }

    .tip.brass {
        fill: var(--brass);
    }

    .busy {
        fill: var(--accent-soft);
        stroke: var(--accent);
    }

    .label {
        fill: var(--muted);
        font-size: 15px;
    }

    .label.mid {
        text-anchor: middle;
    }

    .label.end {
        text-anchor: end;
    }

    .token {
        fill: var(--accent);
        stroke: var(--surface);
        stroke-width: 2;
    }

    .chip-warn {
        fill: var(--warn-soft);
    }

    .chip-ok {
        fill: var(--ok-soft);
    }

    .chip-plain {
        fill: var(--sunken);
    }

    .chip-text {
        fill: var(--muted);
        font-size: 15px;
        font-weight: 500;
        text-anchor: middle;
    }

    .chip-text.warn {
        fill: var(--warn);
    }

    .chip-text.ok {
        fill: var(--ok);
    }
</style>
