<script>
    import Icon from "./Icon.svelte";
    import Search from "./Search.svelte";

    let { theme, oncycletheme, drawer, onmenu } = $props();

    const icons = { system: "monitor", light: "sun", dark: "moon" };
</script>

<header class="bar">
    <button class="icon menu" aria-label={drawer ? "Close menu" : "Open menu"} aria-expanded={drawer} onclick={onmenu}>
        <Icon name="menu" />
    </button>
    <a class="brand" href="#introduction">
        <span class="mark">Lumo</span>
        <span class="docs">docs</span>
    </a>
    <span class="chip">design preview</span>
    <div class="spacer"></div>
    <Search />
    <button class="icon" aria-label="Theme: {theme}" title="Theme: {theme}" onclick={oncycletheme}>
        <Icon name={icons[theme]} />
    </button>
</header>

<style>
    .bar {
        position: sticky;
        top: env(safe-area-inset-top, 0px);
        z-index: 30;
        display: flex;
        align-items: center;
        gap: var(--space-3);
        height: var(--topbar-h);
        padding-left: max(16px, env(safe-area-inset-left, 0px));
        padding-right: max(16px, env(safe-area-inset-right, 0px));
        background: var(--surface);
        border-bottom: 1px solid var(--line);
    }

    .brand {
        display: flex;
        align-items: baseline;
        gap: var(--space-1);
        flex-shrink: 0;
        color: var(--text);
        text-decoration: none;
    }

    .mark {
        font: 800 28px/1 var(--font-display);
    }

    .docs {
        font: 500 16px/1 var(--font-body);
        color: var(--muted);
    }

    .chip {
        flex-shrink: 0;
        padding: 0 var(--space-2);
        border: 1px solid var(--line);
        border-radius: var(--radius-s);
        color: var(--muted);
        font-size: 14px;
        line-height: 20px;
    }

    .spacer {
        flex: 1;
    }

    .icon {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        padding: 0;
        border: 0;
        border-radius: var(--radius-m);
        background: none;
        color: var(--muted);
        cursor: pointer;
        transition:
            background-color 150ms var(--ease-out),
            color 150ms var(--ease-out);
    }

    .icon:hover {
        background: var(--sunken);
        color: var(--text);
    }

    .menu {
        margin-left: calc(var(--space-2) * -1);
    }

    @media (min-width: 900px) {
        .menu {
            display: none;
        }
    }

    @media (max-width: 560px) {
        .bar {
            gap: var(--space-2);
        }

        .chip {
            display: none;
        }
    }
</style>
