<script>
    import { Player, clamp01, easeOut } from "../../lib/motion.svelte.js";
    import DiagramFrame from "./DiagramFrame.svelte";

    const us = (v) => (v < 1000 ? `${v} µs` : `${(v / 1000).toFixed(2)} ms`);
    const sec = (v) => (v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`);

    const charts = [
        {
            title: "Small queries",
            note: "median per call",
            max: 2000,
            ticks: [0, 500, 1000, 1500, 2000],
            unit: "µs",
            format: us,
            rows: [
                { label: "scalar", mdb: 203, ox: 1360 },
                { label: "single", mdb: 169, ox: 1480 },
                { label: "prepare", mdb: 115, ox: 1720 },
                { label: "query", mdb: 108, ox: 1370 },
            ],
        },
        {
            title: "Whole benchmark",
            note: "sum of step medians",
            max: 20,
            ticks: [0, 5, 10, 15, 20],
            unit: "s",
            format: sec,
            rows: [{ label: "total", mdb: 0.517, ox: 17.82 }],
        },
    ];

    const grow = 700;
    const stagger = 60;
    const bars = charts.reduce((n, c) => n + c.rows.length * 2, 0);
    const duration = grow + stagger * (bars - 1);

    const player = new Player();

    $effect(() => {
        player.play(duration);
        return player.stop;
    });

    function progress(i) {
        return easeOut(clamp01((player.t * duration - stagger * i) / grow));
    }

    function offset(chartIndex) {
        return charts.slice(0, chartIndex).reduce((n, c) => n + c.rows.length * 2, 0);
    }
</script>

<DiagramFrame title="Lumo prototype vs oxmysql" onreplay={() => player.play(duration)}>
    <div class="legend">
        <span><i class="swatch mdb"></i>Lumo</span>
        <span><i class="swatch ox"></i>oxmysql 2.14.3</span>
        <span class="hint">lower is better</span>
    </div>

    <div class="charts">
        {#each charts as chart, c (chart.title)}
            <div class="chart">
                <h4>{chart.title} <span>{chart.note}</span></h4>
                {#each chart.rows as row, r (row.label)}
                    <div class="row">
                        <span class="label">{row.label}</span>
                        <div class="track">
                            <div class="scale">
                                {#each chart.ticks as tick (tick)}
                                    <span class="grid" style:left="{(tick / chart.max) * 100}%"></span>
                                {/each}
                                {#each [["mdb", row.mdb], ["ox", row.ox]] as [kind, value], k (kind)}
                                    {@const pct = (value / chart.max) * 100 * progress(offset(c) + r * 2 + k)}
                                    <div class="bar-row">
                                        <span class="bar {kind}" style:width="{pct}%"></span>
                                        <span class="value" style:left="{pct}%">{chart.format(value)}</span>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    </div>
                {/each}
                <div class="row axis">
                    <span></span>
                    <div class="track">
                        <div class="scale">
                            {#each chart.ticks as tick, i (tick)}
                                <span class="tick" style:left="{(tick / chart.max) * 100}%">{tick}{i === chart.ticks.length - 1 ? ` ${chart.unit}` : ""}</span>
                            {/each}
                        </div>
                    </div>
                </div>
            </div>
        {/each}
    </div>

    {#snippet caption()}
        <p>oxmysql documentation benchmark, Legacy FXServer, MariaDB 12.3.3, 5 rounds, median. Lumo figures are its Node prototype.</p>
    {/snippet}
</DiagramFrame>

<style>
    .legend {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-4);
        margin-bottom: var(--space-4);
        color: var(--muted);
        font-size: 16px;
    }

    .legend span {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
    }

    .hint {
        color: var(--faint);
    }

    .swatch {
        width: 10px;
        height: 10px;
        border-radius: 2px;
    }

    .swatch.mdb,
    .bar.mdb {
        background: var(--accent);
    }

    .swatch.ox,
    .bar.ox {
        background: var(--line-strong);
    }

    .charts {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
    }

    h4 {
        margin: 0 0 var(--space-2);
        font-size: 16px;
        font-weight: 600;
    }

    h4 span {
        margin-left: var(--space-2);
        color: var(--muted);
        font-weight: 400;
    }

    .row {
        display: grid;
        grid-template-columns: 64px minmax(0, 1fr);
        gap: var(--space-3);
        align-items: center;
        padding-block: var(--space-1);
    }

    .label {
        color: var(--muted);
        font: 400 16px/1 var(--font-mono);
    }

    .track {
        min-width: 0;
    }

    /* The right margin leaves room for the value label of the longest bar. */
    .scale {
        position: relative;
        margin-right: var(--space-8);
    }

    .grid {
        position: absolute;
        top: -4px;
        bottom: -4px;
        width: 1px;
        background: var(--line);
    }

    .bar-row {
        position: relative;
        height: 14px;
    }

    .bar-row + .bar-row {
        margin-top: 3px;
    }

    .bar {
        position: absolute;
        inset: 1px auto 1px 0;
        border-radius: 0 2px 2px 0;
    }

    .value {
        position: absolute;
        top: 50%;
        padding-left: 6px;
        transform: translateY(-50%);
        color: var(--text);
        font-size: 15px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .axis {
        padding-top: var(--space-2);
    }

    .axis .scale {
        height: 16px;
    }

    .tick {
        position: absolute;
        transform: translateX(-50%);
        color: var(--faint);
        font-size: 14px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .tick:first-child {
        transform: none;
    }
</style>
