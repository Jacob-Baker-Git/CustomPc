// Serve dist/ with public/_headers actually applied.
//
// ⚠️ This exists because of a whole class of bug that is INVISIBLE until deploy.
// `npm run dev` sends no CSP at all and `vite preview` sends no CSP either, so a
// policy that breaks the app looks perfectly fine on localhost and only fails in
// production — where, for this app specifically, every textured part silently
// degrades to a grey primitive rather than throwing anything you would notice.
//
// src/tests/cspHeaders.test.js asserts the policy TEXT: that connect-src carries
// blob:, that script-src carries 'wasm-unsafe-eval', that no third-party host
// creeps in. That catches a regression in the directives someone already knew to
// need. It cannot catch a NEW dependency that needs a directive nobody has
// thought of yet, because a static assertion only knows what it was told.
//
// This closes that half: a real browser, the real bundle, the real policy, and
// any violation reported as a console error the way the deployed site would.
//
//   npm run build && npm run preview:csp
//
// Then open the printed URL and watch the console. A CSP violation prints as
// "Refused to ..." — that is the failure this command exists to surface.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { resolve, extname, join } from 'node:path'

const ROOT = resolve(process.cwd(), 'dist')
const PORT = Number(process.env.PORT ?? 4184)

// Netlify's _headers format: a path pattern at column 0, then indented
// "Name: value" lines, with # comments allowed anywhere.
function parseHeaders(file) {
  const rules = []
  let current = null
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (!line.trim() || line.trim().startsWith('#')) continue
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: [] }
      rules.push(current)
      continue
    }
    if (!current) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    current.headers.push([line.slice(0, idx).trim(), line.slice(idx + 1).trim()])
  }
  return rules
}

// Only the globbing Netlify actually documents for this file: a trailing /* .
const matches = (pattern, path) =>
  pattern.endsWith('/*') ? path.startsWith(pattern.slice(0, -1)) : pattern === path

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.glb': 'model/gltf-binary',
  '.hdr': 'image/vnd.radiance',
  '.wasm': 'application/wasm',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

const rules = parseHeaders(resolve(process.cwd(), 'public/_headers'))

const readIfFile = async (p) => {
  try {
    if (!(await stat(p)).isFile()) return null
    return await readFile(p)
  } catch {
    return null
  }
}

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  // Traversal guard: a preview server is still a server.
  const target = resolve(join(ROOT, path))
  if (!target.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden')
    return
  }

  // Real file, then directory index, then the SPA fallback — the same order
  // Netlify resolves in, so a pre-rendered /help/index.html wins over the shell.
  let body = await readIfFile(target)
  let served = path
  if (!body) {
    body = await readIfFile(join(target, 'index.html'))
    if (body) served = join(path, 'index.html')
  }
  if (!body) {
    body = await readIfFile(join(ROOT, 'index.html'))
    served = '/index.html'
  }
  if (!body) {
    res.writeHead(404).end('Not found — run `npm run build` first')
    return
  }

  for (const rule of rules) {
    if (matches(rule.pattern, path)) for (const [k, v] of rule.headers) res.setHeader(k, v)
  }
  res.setHeader('Content-Type', TYPES[extname(served)] ?? 'application/octet-stream')
  res.writeHead(200).end(body)
})

// ⚠️ Fail CLOSED, and this is the whole point of the tool.
//
// If the parser ever stops understanding _headers — a format change, a stray edit,
// a bad regex — it returns no rules, the server serves the bundle with NO policy,
// and the app loads perfectly. That looks exactly like success, and every run
// afterwards would certify a policy it never applied, which is worse than not
// having the command at all. So refuse to start instead.
const csp = rules
  .flatMap((r) => r.headers)
  .find(([k]) => k.toLowerCase() === 'content-security-policy')

if (!csp) {
  console.error('preview-csp: parsed no Content-Security-Policy out of public/_headers.')
  console.error('Refusing to serve — a run with no policy would certify one that was never applied.')
  process.exit(1)
}

server.listen(PORT, () => {
  console.log(`dist/ served with public/_headers applied -> http://localhost:${PORT}`)
  console.log(`${rules.length} header rule(s), CSP ACTIVE`)
  console.log(`\n  ${csp[1]}\n`)
})
