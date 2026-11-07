// Content strings use a tiny inline syntax: `code`, **bold**, [label](#page) for another docs page
// (the artifact host only passes a plain #name, so there are no #page/anchor links), and
// [label](https://...) for external links. Everything else is escaped.
export function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const source = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/.source;

export function inline(text) {
    // A fresh regex per call: bold and link labels recurse, and a shared global regex would lose its position.
    const pattern = new RegExp(source, "g");
    let out = "";
    let last = 0;
    let match;

    while ((match = pattern.exec(text))) {
        out += escapeHtml(text.slice(last, match.index));

        if (match[1] !== undefined) {
            out += `<code>${escapeHtml(match[1])}</code>`;
        } else if (match[2] !== undefined) {
            out += `<strong>${inline(match[2])}</strong>`;
        } else {
            const href = match[4];
            const external = /^https?:\/\//.test(href);
            const target = external ? ' target="_blank" rel="noopener noreferrer"' : "";
            out += `<a href="${escapeHtml(href)}"${target}>${inline(match[3])}</a>`;
        }

        last = pattern.lastIndex;
    }

    return out + escapeHtml(text.slice(last));
}

// Plain text for search indexing and the page <title>.
export function plain(text) {
    return text.replace(/`([^`]+)`/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}
