<script>
    import Icon from "./Icon.svelte";
    import { search } from "../lib/search.js";

    let query = $state("");
    let focused = $state(false);
    let active = $state(0);
    let input;

    const results = $derived(search(query));
    const open = $derived(focused && query.trim() !== "");

    function go(id) {
        location.hash = id;
        query = "";
        input.blur();
    }

    function onkeydown(event) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!results.length) return;
            const step = event.key === "ArrowDown" ? 1 : -1;
            active = (active + step + results.length) % results.length;
        } else if (event.key === "Enter" && results[active]) {
            go(results[active].id);
        } else if (event.key === "Escape") {
            input.blur();
        }
    }

    function onwindowkeydown(event) {
        const target = event.target;
        const typing = target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
        if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
            event.preventDefault();
            input.focus();
        }
    }
</script>

<svelte:window onkeydown={onwindowkeydown} />

<div class="search">
    <Icon name="search" size={16} />
    <input
        bind:this={input}
        bind:value={query}
        type="search"
        placeholder="Search docs"
        aria-label="Search docs"
        role="combobox"
        aria-expanded={open}
        aria-controls="search-results"
        aria-autocomplete="list"
        autocomplete="off"
        spellcheck="false"
        oninput={() => (active = 0)}
        onfocus={() => (focused = true)}
        onblur={() => (focused = false)}
        {onkeydown}
    />
    <kbd>/</kbd>
    {#if open}
        <ul class="results" id="search-results" role="listbox">
            {#each results as result, i (result.id)}
                <li role="option" aria-selected={i === active}>
                    <!-- mousedown runs before the input's blur would close the popover -->
                    <a
                        href="#{result.id}"
                        class:active={i === active}
                        onmousedown={(event) => {
                            event.preventDefault();
                            go(result.id);
                        }}
                        onmouseenter={() => (active = i)}
                    >
                        <span>{result.title}</span>
                        <span class="group">{result.group}</span>
                    </a>
                </li>
            {:else}
                <li class="empty">No pages match</li>
            {/each}
        </ul>
    {/if}
</div>

<style>
    .search {
        position: relative;
        display: flex;
        align-items: center;
        gap: var(--space-2);
        width: 260px;
        min-width: 0;
        flex-shrink: 1;
        height: 36px;
        padding-inline: var(--space-3) var(--space-2);
        border: 1px solid var(--line);
        border-radius: var(--radius-m);
        background: var(--bg);
        color: var(--faint);
        transition: border-color 150ms var(--ease-out);
    }

    .search:focus-within {
        border-color: var(--line-strong);
    }

    input {
        flex: 1;
        min-width: 0;
        padding: 0;
        border: 0;
        background: none;
        color: var(--text);
        font: inherit;
        font-size: 16px;
    }

    input::placeholder {
        color: var(--faint);
    }

    input::-webkit-search-cancel-button {
        display: none;
    }

    kbd {
        padding: 0 var(--space-1);
        border: 1px solid var(--line);
        border-radius: var(--radius-s);
        color: var(--faint);
        font-size: 14px;
        line-height: 18px;
    }

    .results {
        position: absolute;
        top: calc(100% + var(--space-2));
        right: 0;
        z-index: 50;
        width: min(340px, calc(100vw - 32px));
        margin: 0;
        padding: var(--space-1);
        list-style: none;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius-l);
    }

    .results a {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: var(--space-3);
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-m);
        color: var(--text);
        font-size: 16px;
        text-decoration: none;
    }

    .results a.active {
        background: var(--accent-soft);
        color: var(--accent);
    }

    .group {
        color: var(--muted);
        font-size: 14px;
        white-space: nowrap;
    }

    .empty {
        padding: var(--space-2) var(--space-3);
        color: var(--muted);
        font-size: 16px;
    }

    @media (max-width: 560px) {
        .search {
            flex: 1;
            width: auto;
        }

        kbd {
            display: none;
        }
    }
</style>
