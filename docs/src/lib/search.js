import { groups, pages } from "../content/pages.js";
import { plain } from "./inline.js";

const skip = new Set(["t", "id", "lang", "kind", "name", "page", "mono"]);

function collect(value, out) {
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) value.forEach((v) => collect(v, out));
    else if (value && typeof value === "object") {
        for (const [key, v] of Object.entries(value)) if (!skip.has(key)) collect(v, out);
    }
    return out;
}

const index = groups.flatMap((group) =>
    group.pages.map((id) => {
        const page = pages[id];
        return {
            id,
            title: page.title,
            group: group.title,
            titleText: page.title.toLowerCase(),
            text: plain(collect([page.lede, page.blocks], []).join(" ")).toLowerCase(),
        };
    }),
);

export function search(query) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return index
        .filter((e) => words.every((w) => e.titleText.includes(w) || e.text.includes(w)))
        .map((e) => ({ ...e, rank: words.every((w) => e.titleText.includes(w)) ? 0 : 1 }))
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 8);
}

export const order = groups.flatMap((g) => g.pages);
