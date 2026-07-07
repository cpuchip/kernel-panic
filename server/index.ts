// Kernel Panic server — Phase 0 is single-player, so this just serves the built
// client (dist/) plus /healthz and /version (the deploy oracle). The
// authoritative ws game server arrives in Phase 2 (co-op MP).

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync, existsSync, readFile } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const PORT = Number(process.env.PORT ?? 8080)
const DIST = join(process.cwd(), 'dist')

function readVersion(): string {
  try {
    return readFileSync(join(DIST, 'version.txt'), 'utf8').trim()
  } catch {
    return process.env.VITE_GIT_SHA?.trim() || 'dev'
  }
}
const VERSION = readVersion()

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain',
  '.woff2': 'font/woff2',
}

function handle(req: IncomingMessage, res: ServerResponse): void {
  const url = (req.url ?? '/').split('?')[0]
  if (url === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('ok')
    return
  }
  if (url === '/version') {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end(VERSION)
    return
  }
  // /wiki → the Field Guide (help docs). Clean URL for the static wiki page.
  if (url === '/wiki' || url === '/wiki/') {
    readFile(join(DIST, 'wiki.html'), (err, buf) => {
      if (err) {
        res.writeHead(404, { 'content-type': 'text/plain' })
        res.end('wiki not built')
        return
      }
      res.writeHead(200, { 'content-type': MIME['.html'] })
      res.end(buf)
    })
    return
  }
  const safe = normalize(url).replace(/^([.\\/])+/, '')
  let file = join(DIST, safe === '' ? 'index.html' : safe)
  if (!existsSync(file) || extname(file) === '') file = join(DIST, 'index.html')
  readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('not found (build the client: npm run build)')
      return
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(buf)
  })
}

createServer(handle).listen(PORT, () => {
  console.log(`kernel-panic server on :${PORT} (version ${VERSION})`)
})
