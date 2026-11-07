<script>
    import CodeBlock from "./CodeBlock.svelte";

    let { tabs } = $props();

    let active = $state(0);
    let list;
    let buttons = [];
    let indicator = $state({ x: 0, w: 0 });

    $effect(() => {
        const measure = () => {
            const el = buttons[active];
            if (el) indicator = { x: el.offsetLeft, w: el.offsetWidth };
        };
        measure();
        // Widths change when the web font finishes loading, so re-measure on resize.
        const observer = new ResizeObserver(measure);
        observer.observe(list);
        return () => observer.disconnect();
    });
</script>

<div class="tabs">
    <div class="list" role="tablist" bind:this={list}>
        {#each tabs as tab, i (tab.label)}
            <button bind:this={buttons[i]} role="tab" aria-selected={i === active} class:active={i === active} onclick={() => (active = i)}>
                {tab.label}
            </button>
        {/each}
        <span class="indicator" style:transform="translateX({indicator.x}px)" style:width="{indicator.w}px"></span>
    </div>
    {#key active}
        <CodeBlock s={tabs[active].s} lang={tabs[active].lang} />
    {/key}
</div>

<style>
    .tabs {
        margin-bottom: var(--space-5);
    }

    .list {
        position: relative;
        display: flex;
        gap: var(--space-1);
        margin-bottom: var(--space-2);
        border-bottom: 1px solid var(--line);
        overflow-x: auto;
    }

    button {
        padding: var(--space-2) var(--space-3);
        border: 0;
        background: none;
        color: var(--muted);
        font: 500 16px/1.4 var(--font-body);
        cursor: pointer;
        white-space: nowrap;
        transition: color 150ms var(--ease-out);
    }

    button:hover,
    button.active {
        color: var(--text);
    }

    .indicator {
        position: absolute;
        left: 0;
        bottom: -1px;
        height: 2px;
        background: var(--accent);
        transition:
            transform 200ms var(--ease-out),
            width 200ms var(--ease-out);
    }
</style>
