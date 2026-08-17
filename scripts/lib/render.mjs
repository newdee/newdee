/**
 * Renders the collected profile data into a self-contained terminal SVG.
 *
 * Motion is SMIL, not CSS. GitHub embeds README images through <img>, and in
 * that context Chrome applies static CSS but never advances CSS animations —
 * anything relying on animation-fill-mode to fade in stays at opacity 0
 * forever. Every animated attribute here therefore carries its *final* value
 * as the base value and is animated away from it, so a viewer that ignores
 * SMIL entirely still sees the finished card.
 */

import { FONT, langColor, THEMES } from './theme.mjs'

const W = 880
const PAD = 26
const RIGHT = W - PAD
const FS = 13
const LH = 22
const TITLEBAR = 38
const STATUSBAR = 30

const CELL = 13
const GAP = 2
const STEP = CELL + GAP
const HEAT_X = 54

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function clip(s, max) {
  const str = String(s ?? '')
  return str.length <= max ? str : str.slice(0, Math.max(0, max - 1)) + '…'
}

function fmtDay(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')}`
}

/**
 * A hold-then-ease animation that freezes on `to`, which is also the element's
 * authored value.
 *
 * `begin` is deliberately not 0. Where the SVG animation clock never advances —
 * <img> embedding in some browsers, and any viewer with reduced motion — the
 * animation simply never starts and the authored value stands, leaving the card
 * fully rendered. Starting at 0 instead would pin every element to its `from`
 * value and blank the whole card. The 10ms offset is below the perception
 * threshold when the clock does run.
 */
const SAFE_BEGIN = '0.01s'

function anim(attribute, from, to, at, dur = 0.42, easing = '.2 .8 .2 1') {
  const total = Math.max(0.02, at + dur)
  const hold = (at / total).toFixed(4)
  return (
    `<animate attributeName="${attribute}" values="${from};${from};${to}" ` +
    `keyTimes="0;${hold};1" dur="${total.toFixed(2)}s" begin="${SAFE_BEGIN}" ` +
    `calcMode="spline" keySplines="0 0 1 1;${easing}" fill="freeze" restart="never"/>`
  )
}

function fadeIn(at, dur) {
  return anim('opacity', 0, 1, at, dur)
}

function text(x, y, content, opts = {}) {
  const { fill, size = FS, anchor, inner = '' } = opts
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    fill ? `fill="${fill}"` : '',
    `font-size="${size}"`,
    anchor ? `text-anchor="${anchor}"` : '',
  ].filter(Boolean)
  return `<text ${attrs.join(' ')}>${content}${inner}</text>`
}

/** Builds a shell command line out of coloured segments. */
function command(t, x, y, segments) {
  const spans = segments
    .map(([value, colorKey]) => `<tspan fill="${t[colorKey] || t.text}">${esc(value)}</tspan>`)
    .join('<tspan> </tspan>')
  return text(x, y, spans)
}

function styles() {
  return `text { font-family: ${FONT}; dominant-baseline: middle; white-space: pre; }`
}

export function renderSvg(data, themeId) {
  const t = THEMES[themeId]
  const { user, repos, languages, languageSample, contributions, totals } = data

  // Ties are broken by name so the same data always renders the same bytes.
  const topRepos = [...repos]
    .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name))
    .slice(0, 6)
  const topLangs = [...languages]
    .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name))
    .slice(0, 6)
  const maxStars = Math.max(1, ...topRepos.map((r) => r.stars))
  const maxPct = Math.max(1, ...topLangs.map((l) => l.pct))

  const out = []
  const defs = []
  let clipId = 0
  let y = TITLEBAR + 30

  /** Wraps a command line in a clip whose width sweeps open, like typing. */
  const typed = (segments, at) => {
    const id = `cmd${clipId++}`
    const width = RIGHT - PAD
    defs.push(
      `<clipPath id="${id}"><rect x="${PAD}" y="${y - 13}" width="${width}" height="26">` +
        `${anim('width', 0, width, at, 0.5, '0 0 1 1')}</rect></clipPath>`
    )
    out.push(`<g clip-path="url(#${id})">${command(t, PAD, y, segments)}</g>`)
    y += LH
  }

  // ── whoami ────────────────────────────────────────────────────────────────
  typed([['$', 'prompt'], ['whoami', 'text']], 0.15)

  const identity = [user.name, user.location, user.blog.replace(/^https?:\/\//, '')]
    .filter(Boolean)
    .join('  ·  ')
  out.push(`<g>${fadeIn(0.55)}${text(PAD, y, esc(identity), { fill: t.text })}</g>`)
  y += LH

  if (user.bio) {
    out.push(
      `<g>${fadeIn(0.66)}${text(PAD, y, esc(`“${clip(user.bio, 60)}”`), { fill: t.dim })}</g>`
    )
    y += LH
  }
  y += 16

  // ── selected work ─────────────────────────────────────────────────────────
  typed(
    [
      ['$', 'prompt'],
      ['ls', 'text'],
      ['-l ~/src', 'path'],
      ['--sort=stars', 'flag'],
    ],
    0.8
  )

  topRepos.forEach((repo, i) => {
    const at = 1.12 + i * 0.07
    const barW = Math.max(2, Math.round((repo.stars / maxStars) * 260))
    const row = [
      text(PAD, y, 'drwxr-xr-x', { fill: t.faint }),
      text(112, y, esc(clip(repo.name, 22)), { fill: t.path }),
      repo.language
        ? `<circle cx="304" cy="${y}" r="4" fill="${langColor(repo.language)}"/>` +
          text(316, y, esc(clip(repo.language, 13)), { fill: t.dim })
        : '',
      `<rect x="420" y="${y - 4}" width="260" height="8" rx="2" fill="${t.bar}"/>`,
      `<rect x="420" y="${y - 4}" width="${barW}" height="8" rx="2" fill="${t.barLead}">` +
        `${anim('width', 0, barW, at + 0.1, 0.7)}</rect>`,
      text(692, y, `★ ${repo.stars}`, { fill: repo.stars > 0 ? t.star : t.faint }),
      text(RIGHT, y, fmtDay(repo.pushedAt), { fill: t.faint, anchor: 'end' }),
    ]
    out.push(`<g>${fadeIn(at)}${row.join('')}</g>`)
    y += LH
  })
  y += 16

  // ── language mix ──────────────────────────────────────────────────────────
  typed(
    [
      ['$', 'prompt'],
      ['langstat', 'text'],
      [`--per-repo --sample=${languageSample.repos}`, 'flag'],
    ],
    1.62
  )

  topLangs.forEach((lang, i) => {
    const at = 1.94 + i * 0.07
    const color = langColor(lang.name)
    const barW = Math.max(2, Math.round((lang.pct / maxPct) * 420))
    const row = [
      text(PAD, y, esc(clip(lang.name, 14)), { fill: t.text }),
      `<rect x="148" y="${y - 5}" width="420" height="10" rx="2" fill="${t.bar}"/>`,
      `<rect x="148" y="${y - 5}" width="${barW}" height="10" rx="2" fill="${color}">` +
        `${anim('width', 0, barW, at + 0.1, 0.7)}</rect>`,
      text(648, y, `${lang.pct.toFixed(1)}%`, { fill: t.text, anchor: 'end' }),
      text(RIGHT, y, `${lang.repos} ${lang.repos === 1 ? 'repo' : 'repos'}`, {
        fill: t.faint,
        anchor: 'end',
      }),
    ]
    out.push(`<g>${fadeIn(at)}${row.join('')}</g>`)
    y += LH
  })
  y += 16

  // ── contribution calendar ─────────────────────────────────────────────────
  typed(
    [
      ['$', 'prompt'],
      ['git log', 'text'],
      ['--since=1.year', 'path'],
      ['--pretty=calendar', 'flag'],
    ],
    2.44
  )
  y += 6

  const days = contributions.days
  const offset = days.length > 0 ? new Date(days[0].date + 'T00:00:00Z').getUTCDay() : 0
  const columns = Math.ceil((days.length + offset) / 7)

  const monthRow = []
  let lastMonth = -1
  for (let col = 0; col < columns - 1; col++) {
    const day = days[Math.max(0, col * 7 - offset)]
    if (!day) continue
    const month = new Date(day.date + 'T00:00:00Z').getUTCMonth()
    if (month === lastMonth) continue
    lastMonth = month
    monthRow.push(text(HEAT_X + col * STEP, y, MONTHS[month], { fill: t.faint, size: 10 }))
  }
  const weekdayRow = [
    [1, 'Mon'],
    [3, 'Wed'],
    [5, 'Fri'],
  ]

  out.push(`<g>${fadeIn(2.7)}${monthRow.join('')}</g>`)
  y += 14

  const gridTop = y
  out.push(
    `<g>${fadeIn(2.7)}` +
      weekdayRow
        .map(([row, label]) =>
          text(PAD + 20, gridTop + row * STEP + CELL / 2, label, {
            fill: t.faint,
            size: 10,
            anchor: 'end',
          })
        )
        .join('') +
      '</g>'
  )

  // Cells are grouped by week so one animation drives seven of them. Animating
  // each day separately triples the file size for no visible gain.
  const byColumn = new Map()
  days.forEach((day, i) => {
    const slot = i + offset
    const col = Math.floor(slot / 7)
    const row = slot % 7
    const fill = t.heat[Math.min(4, Math.max(0, day.level))]
    const stroke = day.level === 0 ? ` stroke="${t.heatEmptyStroke}"` : ''
    const rect =
      `<rect x="${HEAT_X + col * STEP}" y="${gridTop + row * STEP}" ` +
      `width="${CELL}" height="${CELL}" rx="2" fill="${fill}"${stroke}/>`
    byColumn.set(col, (byColumn.get(col) || '') + rect)
  })
  for (const [col, rects] of [...byColumn.entries()].sort((a, b) => a[0] - b[0])) {
    out.push(`<g>${fadeIn(2.72 + col * 0.012, 0.3)}${rects}</g>`)
  }
  y = gridTop + 7 * STEP + 12

  const summary = [
    `${contributions.total.toLocaleString('en-US')} contributions`,
    `${contributions.activeDays} active days`,
    `longest ${contributions.longestStreak}d`,
    `current ${contributions.currentStreak}d`,
    contributions.best.date
      ? `peak ${contributions.best.count} on ${contributions.best.date}`
      : null,
  ]
    .filter(Boolean)
    .join('  ·  ')
  out.push(`<g>${fadeIn(3.22)}${text(PAD, y + 4, esc(summary), { fill: t.dim })}</g>`)
  y += LH + 8

  // ── trailing prompt ───────────────────────────────────────────────────────
  out.push(
    `<g>${fadeIn(3.5)}` +
      text(PAD, y, '$', { fill: t.prompt }) +
      `<rect x="${PAD + 14}" y="${y - 8}" width="8" height="16" fill="${t.prompt}">` +
      `<animate attributeName="opacity" values="1;0" keyTimes="0;0.5" calcMode="discrete" ` +
      `dur="1.06s" begin="3.9s" repeatCount="indefinite"/></rect>` +
      '</g>'
  )
  y += LH

  const H = Math.round(y + 8 + STATUSBAR)

  // ── window chrome ─────────────────────────────────────────────────────────
  const dots = t.dot
    .map((color, i) => `<circle cx="${PAD + i * 18}" cy="${TITLEBAR / 2}" r="5.5" fill="${color}"/>`)
    .join('')

  const newestPush = repos
    .map((r) => r.pushedAt)
    .filter(Boolean)
    .sort()
    .pop()

  const statusY = H - STATUSBAR / 2
  const statusLeft =
    `<tspan fill="${t.prompt}">[0]</tspan><tspan> </tspan>` +
    `<tspan fill="${t.chromeText}">0:zsh*  1:cargo-  2:nvim-</tspan>`
  const statusRight =
    `${totals.sourceRepos} repos  ·  ${totals.stars.toLocaleString('en-US')}★  ·  ` +
    `updated ${fmtDay(newestPush)}`

  const chrome =
    `<rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="${t.windowBg}" stroke="${t.border}"/>` +
    `<path d="M0 10a10 10 0 0 1 10-10h${W - 20}a10 10 0 0 1 10 10v${TITLEBAR - 10}H0Z" fill="${t.chrome}"/>` +
    `<line x1="0" y1="${TITLEBAR}" x2="${W}" y2="${TITLEBAR}" stroke="${t.border}"/>` +
    dots +
    text(PAD + 3 * 18 + 12, TITLEBAR / 2, `${esc(user.login)}@dfine: ~/src`, {
      fill: t.chromeText,
      size: 12,
    }) +
    text(RIGHT, TITLEBAR / 2, 'zsh', { fill: t.faint, size: 12, anchor: 'end' }) +
    `<path d="M0 ${H - STATUSBAR}h${W}v${STATUSBAR - 10}a10 10 0 0 1-10 10H10a10 10 0 0 1-10-10Z" fill="${t.chrome}"/>` +
    `<line x1="0" y1="${H - STATUSBAR}" x2="${W}" y2="${H - STATUSBAR}" stroke="${t.border}"/>` +
    text(PAD, statusY, statusLeft, { size: 11 }) +
    text(RIGHT, statusY, esc(statusRight), { fill: t.chromeText, size: 11, anchor: 'end' })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(user.login)} GitHub profile terminal card">
<title>${esc(user.name)} — ${contributions.total} contributions, ${totals.sourceRepos} repositories</title>
<defs>${defs.join('')}</defs>
<style>${styles()}</style>
${chrome}
${out.join('\n')}
</svg>
`
}
