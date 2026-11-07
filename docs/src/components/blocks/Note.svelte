<script>
    import { inline } from "../../lib/inline.js";

    let { kind = "info", s } = $props();

    const labels = { info: "Note", tip: "Tip", warn: "Warning" };
</script>

<aside class="note {kind}">
    <span class="label">{labels[kind] ?? "Note"}</span>
    <p>{@html inline(s)}</p>
</aside>

<style>
    .note {
        margin: 0 0 var(--space-5);
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-l);
        background: var(--accent-soft);
        color: var(--text);
        font-size: 16px;
    }

    .tip {
        background: var(--ok-soft);
    }

    .warn {
        background: var(--warn-soft);
    }

    .label {
        display: block;
        margin-bottom: var(--space-1);
        color: var(--accent);
        font-size: 15px;
        font-weight: 600;
    }

    .tip .label {
        color: var(--ok);
    }

    .warn .label {
        color: var(--warn);
    }

    p {
        margin: 0;
    }

    p :global(code) {
        font-size: 0.88em;
    }
</style>
