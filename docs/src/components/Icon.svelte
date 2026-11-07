<script>
    let { name, size = 18 } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {#if name === "monitor"}
        <rect x="3" y="4" width="18" height="12" rx="1.5" />
        <path d="M8 20h8M12 16v4" />
    {:else if name === "sun"}
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    {:else if name === "moon"}
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    {:else if name === "menu"}
        <path d="M4 7h16M4 12h16M4 17h16" />
    {:else if name === "search"}
        <circle cx="11" cy="11" r="6.5" />
        <path d="M20 20l-4.4-4.4" />
    {:else if name === "check"}
        <path d="M5 12.5l4.5 4.5L19 7.5" />
    {:else if name === "replay"}
        <path d="M4 12a8 8 0 1 0 2.4-5.7" />
        <path d="M4 4v4h4" />
    {/if}
</svg>
