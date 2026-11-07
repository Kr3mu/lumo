<script>
    import Icon from "../Icon.svelte";

    let { title, onreplay, controls, caption, children, minWidth = 0 } = $props();
</script>

<figure aria-label={title}>
    <div class="head">
        <span class="name">{title}</span>
        <div class="actions">
            {@render controls?.()}
            <button class="replay" onclick={onreplay}>
                <Icon name="replay" size={14} />
                Replay
            </button>
        </div>
    </div>
    <div class="scroll">
        <div class="canvas" style:min-width={minWidth ? `${minWidth}px` : undefined}>
            {@render children()}
        </div>
    </div>
    {#if caption}
        <div class="caption">{@render caption()}</div>
    {/if}
</figure>

<style>
    figure {
        margin: var(--space-5) 0 var(--space-6);
        border: 1px solid var(--line);
        border-radius: var(--radius-l);
        background: var(--surface);
        min-width: 0;
    }

    .head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2) var(--space-4);
        padding: var(--space-3) var(--space-4);
        border-bottom: 1px solid var(--line);
    }

    .name {
        font-size: 16px;
        font-weight: 600;
    }

    .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
    }

    .replay {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        height: 28px;
        padding: 0 var(--space-2);
        border: 1px solid var(--line);
        border-radius: var(--radius-m);
        background: none;
        color: var(--muted);
        font: 500 15px/1 var(--font-body);
        cursor: pointer;
        transition:
            border-color 150ms var(--ease-out),
            color 150ms var(--ease-out);
    }

    .replay:hover {
        border-color: var(--line-strong);
        color: var(--text);
    }

    .scroll {
        overflow-x: auto;
    }

    .canvas {
        padding: var(--space-4);
    }

    .caption {
        padding: var(--space-3) var(--space-4);
        border-top: 1px solid var(--line);
        color: var(--muted);
        font-size: 16px;
    }

    .caption :global(p) {
        margin: 0;
    }

    .caption :global(p + p) {
        margin-top: var(--space-1);
    }
</style>
