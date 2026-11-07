<script>
    let { options, value = $bindable(), label } = $props();
</script>

<div class="seg" role="group" aria-label={label}>
    {#each options as option (option.value)}
        <button aria-pressed={value === option.value} class:on={value === option.value} onclick={() => (value = option.value)}>
            {option.label}
        </button>
    {/each}
</div>

<style>
    .seg {
        display: inline-flex;
        padding: 2px;
        border-radius: var(--radius-m);
        background: var(--sunken);
    }

    button {
        height: 24px;
        padding: 0 var(--space-3);
        border: 0;
        border-radius: var(--radius-s);
        background: none;
        color: var(--muted);
        font: 500 15px/1 var(--font-body);
        white-space: nowrap;
        cursor: pointer;
        transition:
            background-color 150ms var(--ease-out),
            color 150ms var(--ease-out);
    }

    button.on {
        background: var(--surface);
        color: var(--text);
    }
</style>
