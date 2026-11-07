<script>
    import { pages } from "./content/pages.js";
    import TopBar from "./components/TopBar.svelte";
    import SideNav from "./components/SideNav.svelte";
    import PageView from "./components/PageView.svelte";
    import OnThisPage from "./components/OnThisPage.svelte";

    const modes = ["system", "light", "dark"];

    function readRoute() {
        let id = location.hash.slice(1);
        try {
            id = decodeURIComponent(id);
        } catch {}
        return Object.hasOwn(pages, id) ? id : "introduction";
    }

    function readTheme() {
        try {
            const saved = localStorage.getItem("mdb-docs-theme");
            return modes.includes(saved) ? saved : "system";
        } catch {
            return "system";
        }
    }

    let route = $state(readRoute());
    let theme = $state(readTheme());
    let drawer = $state(false);

    const page = $derived(pages[route]);
    const headings = $derived(page.blocks.filter((b) => b.t === "h2"));

    $effect(() => {
        if (theme === "system") document.documentElement.removeAttribute("data-theme");
        else document.documentElement.setAttribute("data-theme", theme);
        try {
            localStorage.setItem("mdb-docs-theme", theme);
        } catch {}
    });

    function cycleTheme() {
        theme = modes[(modes.indexOf(theme) + 1) % modes.length];
    }

    function onhashchange() {
        route = readRoute();
        drawer = false;
        window.scrollTo(0, 0);
    }

    function onkeydown(event) {
        if (event.key === "Escape" && drawer) drawer = false;
    }
</script>

<svelte:window {onkeydown} {onhashchange} />

<svelte:head>
    <title>{page.title} · Lumo docs</title>
</svelte:head>

<TopBar {theme} oncycletheme={cycleTheme} {drawer} onmenu={() => (drawer = !drawer)} />

<div class="page">
    <div class="layout">
        {#if drawer}
            <button class="backdrop" aria-label="Close menu" onclick={() => (drawer = false)}></button>
        {/if}
        <aside class="nav" class:open={drawer} aria-label="Sections">
            <SideNav {route} onnavigate={() => (drawer = false)} />
        </aside>
        <main>
            <PageView id={route} {page} />
        </main>
        <aside class="toc">
            <OnThisPage {headings} />
        </aside>
    </div>
</div>

<style>
    .page {
        padding-left: max(16px, env(safe-area-inset-left, 0px));
        padding-right: max(16px, env(safe-area-inset-right, 0px));
        padding-block: var(--space-6) var(--space-8);
    }

    .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        max-width: 800px;
        margin-inline: auto;
    }

    main {
        min-width: 0;
    }

    .nav {
        position: fixed;
        inset: 0 auto 0 0;
        z-index: 40;
        width: min(300px, 85vw);
        padding-top: calc(env(safe-area-inset-top, 0px) + var(--space-5));
        padding-bottom: var(--space-6);
        padding-left: max(var(--space-4), env(safe-area-inset-left, 0px));
        padding-right: var(--space-4);
        overflow-y: auto;
        background: var(--surface);
        border-right: 1px solid var(--line);
        transform: translateX(-100%);
        visibility: hidden;
        transition:
            transform 220ms var(--ease-out),
            visibility 0s linear 220ms;
    }

    .nav.open {
        transform: none;
        visibility: visible;
        transition: transform 220ms var(--ease-out);
    }

    .backdrop {
        position: fixed;
        inset: 0;
        z-index: 35;
        border: 0;
        padding: 0;
        background: var(--text);
        opacity: 0.32;
        cursor: pointer;
    }

    .toc {
        display: none;
    }

    @media (min-width: 900px) {
        .layout {
            grid-template-columns: 240px minmax(0, 1fr);
            gap: var(--space-7);
            max-width: none;
        }

        .backdrop {
            display: none;
        }

        .nav {
            position: sticky;
            inset: auto;
            top: calc(env(safe-area-inset-top, 0px) + var(--topbar-h) + var(--space-6));
            z-index: auto;
            align-self: start;
            width: auto;
            max-height: calc(100vh - var(--topbar-h) - var(--space-7));
            padding: 0;
            background: none;
            border: 0;
            transform: none;
            visibility: visible;
            transition: none;
        }

        main {
            max-width: 800px;
        }
    }

    @media (min-width: 1180px) {
        .layout {
            grid-template-columns: 240px minmax(0, 760px) 200px;
            justify-content: center;
        }

        .toc {
            display: block;
            position: sticky;
            top: calc(env(safe-area-inset-top, 0px) + var(--topbar-h) + var(--space-6));
            align-self: start;
            min-width: 0;
        }
    }
</style>
