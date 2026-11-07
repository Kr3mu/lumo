<script>
    import { inline } from "../../lib/inline.js";

    let { head, rows, mono = [] } = $props();
</script>

<div class="scroll">
    <table>
        <thead>
            <tr>
                {#each head as cell, i (i)}
                    <th>{@html inline(cell)}</th>
                {/each}
            </tr>
        </thead>
        <tbody>
            {#each rows as row, r (r)}
                <tr>
                    {#each row as cell, i (i)}
                        <td class:mono={mono.includes(i)}>{@html inline(cell)}</td>
                    {/each}
                </tr>
            {/each}
        </tbody>
    </table>
</div>

<style>
    .scroll {
        margin: 0 0 var(--space-5);
        overflow-x: auto;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 16px;
        font-variant-numeric: tabular-nums;
    }

    th,
    td {
        padding: var(--space-2) var(--space-3);
        border-bottom: 1px solid var(--line);
        text-align: left;
        vertical-align: top;
    }

    th:first-child,
    td:first-child {
        padding-left: 0;
    }

    th {
        color: var(--muted);
        font-size: 15px;
        font-weight: 600;
        white-space: nowrap;
    }

    td.mono {
        font-family: var(--font-mono);
        font-size: 15px;
    }

    td.mono:first-child {
        white-space: nowrap;
    }

    td :global(code) {
        font-size: 0.9em;
        color: var(--text);
    }

    td:not(.mono) :global(code) {
        padding: 1px 4px;
        border-radius: var(--radius-s);
        background: var(--sunken);
    }

    td :global(strong) {
        font-weight: 600;
    }
</style>
