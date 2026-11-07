<script>
    import { inline } from "../lib/inline.js";
    import CodeBlock from "./blocks/CodeBlock.svelte";
    import Tabs from "./blocks/Tabs.svelte";
    import DataTable from "./blocks/DataTable.svelte";
    import Note from "./blocks/Note.svelte";
    import ApiEntry from "./blocks/ApiEntry.svelte";
    import Steps from "./blocks/Steps.svelte";
    import Cards from "./blocks/Cards.svelte";
    import CallPath from "./diagrams/CallPath.svelte";
    import Layers from "./diagrams/Layers.svelte";
    import BenchChart from "./diagrams/BenchChart.svelte";
    import Chatty from "./diagrams/Chatty.svelte";
    import Lifecycle from "./diagrams/Lifecycle.svelte";

    let { block } = $props();

    const diagrams = { callpath: CallPath, layers: Layers, bench: BenchChart, chatty: Chatty, lifecycle: Lifecycle };
</script>

{#if block.t === "p"}
    <p>{@html inline(block.s)}</p>
{:else if block.t === "h2"}
    <h2 id={block.id}>{block.s}</h2>
{:else if block.t === "h3"}
    <h3>{block.s}</h3>
{:else if block.t === "list"}
    <ul>
        {#each block.items as item, i (i)}
            <li>{@html inline(item)}</li>
        {/each}
    </ul>
{:else if block.t === "steps"}
    <Steps items={block.items} />
{:else if block.t === "code"}
    <CodeBlock s={block.s} lang={block.lang} title={block.title} />
{:else if block.t === "tabs"}
    <Tabs tabs={block.tabs} />
{:else if block.t === "table"}
    <DataTable head={block.head} rows={block.rows} mono={block.mono} />
{:else if block.t === "note"}
    <Note kind={block.kind} s={block.s} />
{:else if block.t === "api"}
    <ApiEntry {...block} />
{:else if block.t === "diagram" && diagrams[block.name]}
    {@const Diagram = diagrams[block.name]}
    <Diagram />
{:else if block.t === "cards"}
    <Cards items={block.items} />
{/if}

<style>
    p,
    ul {
        margin: 0 0 var(--space-4);
    }

    ul {
        padding-left: var(--space-5);
    }

    li + li {
        margin-top: var(--space-2);
    }

    h2 {
        margin: var(--space-7) 0 var(--space-3);
        font: 700 40px/1.1 var(--font-display);
    }

    h3 {
        margin: var(--space-6) 0 var(--space-2);
        font: 700 27px/1.2 var(--font-display);
    }

    p :global(code),
    li :global(code) {
        padding: 1px 5px;
        border-radius: var(--radius-s);
        background: var(--sunken);
        font-size: 0.88em;
    }

    p :global(strong),
    li :global(strong) {
        font-weight: 600;
    }
</style>
