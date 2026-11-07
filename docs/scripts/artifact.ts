// The artifact host wraps the page in its own <!doctype>/<html>/<head>/<body>, so the built page keeps only its contents.
const path = new URL("../dist/index.html", import.meta.url);
const html = await Bun.file(path).text();
const page = html
    .replace(/<!doctype html>/i, "")
    .replace(/<\/?(html|head|body)[^>]*>/gi, "")
    .replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/gi, "")
    .replace(/\n\s*\n/g, "\n")
    .trim();
await Bun.write(new URL("../dist/page.html", import.meta.url), page + "\n");
console.log("dist/page.html written");
