import { escapeHtml } from "./inline.js";

// A small single-pass tokenizer per language: enough for docs snippets, no library needed.
// Groups in every pattern: 1 comment, 2 string, 3 number, 4 special keyword, 5 word.
const languages = {
    lua: {
        pattern:
            /(--\[\[[\s\S]*?\]\]|--[^\n]*)|(\[\[[\s\S]*?\]\]|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?\b)|(<close>|<const>)|([A-Za-z_][A-Za-z0-9_]*)/g,
        keywords:
            /^(local|function|end|if|then|else|elseif|for|in|do|while|return|not|and|or|nil|true|false|break|repeat|until|goto)$/,
        // Lua calls a function with ( or directly with a string or table literal: Database.value 'SELECT 1'
        call: /^\s*[('"{]|^\s*\[\[/,
    },
    ts: {
        pattern:
            /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|(\b\d+(?:\.\d+)?\b)|(@\w+)|([A-Za-z_$][A-Za-z0-9_$]*)/g,
        keywords:
            /^(const|let|var|function|return|if|else|for|of|in|while|new|class|extends|import|export|from|await|async|type|interface|true|false|null|undefined|throw|try|catch|finally|switch|case|break)$/,
        call: /^\s*\(/,
    },
    sql: {
        pattern: /(--[^\n]*)|('(?:''|[^'])*')|(\b\d+(?:\.\d+)?\b)|(`[^`]*`)|([A-Za-z_][A-Za-z0-9_]*)/g,
        keywords:
            /^(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|TEMPORARY|PRIMARY|KEY|NOT|NULL|DEFAULT|AND|OR|ORDER|BY|LIMIT|GROUP|JOIN|ON|AS|FOR|START|TRANSACTION|COMMIT|ROLLBACK|IF|EXISTS|INT|UNSIGNED|VARCHAR|AUTO_INCREMENT|DESC|ASC|SUM|COUNT|NOW|INDEX|UNIQUE)$/i,
        call: /^\s*\(/,
    },
    cfg: {
        pattern: /(#[^\n]*)|("(?:\\.|[^"\\\n])*")|(\b\d+\b)|(\+set\b)|([A-Za-z_][A-Za-z0-9_]*)/g,
        keywords: /^(set|setr|ensure|start|exec|add_ace|add_unsafe_worker_permission)$/,
        call: null,
    },
};

export function highlight(code, lang) {
    const language = languages[lang];
    if (!language) return escapeHtml(code);

    const { pattern, keywords, call } = language;
    let out = "";
    let last = 0;
    let match;

    pattern.lastIndex = 0;
    while ((match = pattern.exec(code))) {
        out += escapeHtml(code.slice(last, match.index));
        const [whole, comment, string, number, special, word] = match;

        if (comment) out += `<span class="tok-c">${escapeHtml(comment)}</span>`;
        else if (string) out += `<span class="tok-s">${escapeHtml(string)}</span>`;
        else if (number) out += `<span class="tok-n">${number}</span>`;
        else if (special) out += `<span class="tok-k">${escapeHtml(special)}</span>`;
        else if (keywords.test(word)) out += `<span class="tok-k">${word}</span>`;
        else if (call && call.test(code.slice(pattern.lastIndex, pattern.lastIndex + 24))) out += `<span class="tok-f">${word}</span>`;
        else out += escapeHtml(whole);

        last = pattern.lastIndex;
    }

    return out + escapeHtml(code.slice(last));
}
