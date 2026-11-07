<script>
    import { groups, pages } from "../content/pages.js";

    let { route, onnavigate } = $props();
</script>

<nav>
    {#each groups as group (group.title)}
        <div class="group">
            <h2>{group.title}</h2>
            <ul>
                {#each group.pages as id (id)}
                    <li>
                        <a href="#{id}" class:active={id === route} aria-current={id === route ? "page" : undefined} onclick={onnavigate}>
                            {pages[id].title}
                        </a>
                    </li>
                {/each}
            </ul>
        </div>
    {/each}
</nav>

<style>
    .group + .group {
        margin-top: var(--space-5);
    }

    h2 {
        margin: 0 0 var(--space-2);
        padding-inline: var(--space-3);
        color: var(--muted);
        font-size: 15px;
        font-weight: 600;
        line-height: 1.4;
    }

    ul {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    a {
        display: block;
        padding: 5px var(--space-3);
        border-radius: var(--radius-m);
        color: var(--text);
        font-size: 16px;
        line-height: 1.4;
        text-decoration: none;
        transition: background-color 150ms var(--ease-out);
    }

    a:hover {
        background: var(--sunken);
    }

    a.active {
        background: var(--accent-soft);
        color: var(--accent);
        font-weight: 500;
    }
</style>
