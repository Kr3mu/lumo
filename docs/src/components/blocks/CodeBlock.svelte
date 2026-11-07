<script>
    import { highlight } from "../../lib/highlight.js";

    let { s, lang, title } = $props();

    const labels = { lua: "Lua", ts: "TypeScript", sql: "SQL", cfg: "cfg" };

    let copied = $state(false);
    let code;
    let timer;

    $effect(() => () => clearTimeout(timer));

    async function copy() {
        try {
            await navigator.clipboard.writeText(s);
            copied = true;
            clearTimeout(timer);
            timer = setTimeout(() => (copied = false), 1500);
        } catch {
            // Sandboxed frames may deny clipboard access; select the code so a manual copy is one keystroke.
            const range = document.createRange();
            range.selectNodeContents(code);
            const selection = getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
</script>

<div class="code">
    <div class="head">
        {#if title}<span class="title">{title}</span>{/if}
        <span class="lang">{labels[lang] ?? lang}</span>
        <button onclick={copy} aria-live="polite">{copied ? "Copied" : "Copy"}</button>
    </div>
    <pre><code bind:this={code}>{@html highlight(s, lang)}</code></pre>
</div>

<style>
    .code {
        margin: 0 0 var(--space-5);
        border: 1px solid var(--line);
        border-radius: var(--radius-l);
        background: var(--code-bg);
        min-width: 0;
    }

    .head {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        min-height: 36px;
        padding: var(--space-1) var(--space-1) var(--space-1) var(--space-4);
        border-bottom: 1px solid var(--line);
        font: 400 14px/1.4 var(--font-mono);
    }

    .title {
        min-width: 0;
        overflow: hidden;
        color: var(--muted);
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .lang {
        margin-left: auto;
        color: var(--faint);
    }

    button {
        min-width: 64px;
        padding: var(--space-1) var(--space-2);
        border: 0;
        border-radius: var(--radius-s);
        background: none;
        color: var(--muted);
        font: 500 14px/1.4 var(--font-body);
        cursor: pointer;
        transition:
            background-color 150ms var(--ease-out),
            color 150ms var(--ease-out);
    }

    button:hover {
        background: var(--sunken);
        color: var(--text);
    }

    pre {
        margin: 0;
        padding: var(--space-4);
        overflow-x: auto;
        font: 400 15px/1.65 var(--font-mono);
        tab-size: 4;
    }

    pre :global(.tok-c) {
        color: var(--code-comment);
        font-style: italic;
    }

    pre :global(.tok-s) {
        color: var(--code-string);
    }

    pre :global(.tok-n) {
        color: var(--code-number);
    }

    pre :global(.tok-k) {
        color: var(--code-keyword);
        font-weight: 500;
    }

    pre :global(.tok-f) {
        color: var(--code-fn);
    }
</style>
