/**
 * Data collection for the profile card.
 *
 * Everything here is public data. The contribution calendar comes from the
 * HTML endpoint GitHub serves for the profile graph, which needs no auth and
 * carries exact per-day counts in its tooltips. A token is optional and only
 * raises the REST rate limit.
 */

const API = 'https://api.github.com'
const UA = 'newdee-profile-card'

function headers(token) {
  const h = {
    accept: 'application/vnd.github+json',
    'user-agent': UA,
    'x-github-api-version': '2022-11-28',
  }
  if (token) h.authorization = `Bearer ${token}`
  return h
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Retries transient failures rather than swallowing them.
 *
 * A dropped request used to be skipped silently, which quietly changed the
 * language sample size between runs and made the rendered card — and therefore
 * the committed diff — unstable. Rate limits and 5xx are retried; anything
 * still failing after the last attempt is raised so the build fails loudly
 * instead of publishing shifting numbers.
 */
async function getJson(url, token, attempts = 4) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { headers: headers(token) })
      if (res.ok) return res.json()

      const retryable = res.status === 403 || res.status === 429 || res.status >= 500
      lastError = new Error(`GET ${url} -> HTTP ${res.status} ${res.statusText}`)
      if (!retryable || attempt === attempts) throw lastError

      const reset = Number(res.headers.get('x-ratelimit-reset'))
      const remaining = Number(res.headers.get('x-ratelimit-remaining'))
      let waitMs = 500 * 2 ** (attempt - 1)
      if (remaining === 0 && Number.isFinite(reset)) {
        waitMs = Math.max(waitMs, Math.min(60_000, reset * 1000 - Date.now() + 1000))
      }
      await sleep(waitMs)
    } catch (error) {
      lastError = error
      if (attempt === attempts) throw lastError
      await sleep(500 * 2 ** (attempt - 1))
    }
  }
  throw lastError
}

export async function fetchUser(login, token) {
  const u = await getJson(`${API}/users/${encodeURIComponent(login)}`, token)
  return {
    login: u.login,
    name: u.name || u.login,
    bio: u.bio || '',
    company: (u.company || '').replace(/^@/, ''),
    location: u.location || '',
    blog: u.blog || '',
    followers: u.followers || 0,
    following: u.following || 0,
    publicRepos: u.public_repos || 0,
    publicGists: u.public_gists || 0,
    createdAt: u.created_at,
  }
}

/** Walks every page so repo 101+ is not silently dropped. */
export async function fetchRepos(login, token) {
  const all = []
  for (let page = 1; page <= 10; page++) {
    const batch = await getJson(
      `${API}/users/${encodeURIComponent(login)}/repos?per_page=100&page=${page}&sort=pushed`,
      token
    )
    if (!Array.isArray(batch) || batch.length === 0) break
    all.push(...batch)
    if (batch.length < 100) break
  }

  return all
    .filter((r) => !r.fork && !r.archived && !r.private)
    .map((r) => ({
      name: r.name,
      description: r.description || '',
      language: r.language || null,
      stars: r.stargazers_count || 0,
      forks: r.forks_count || 0,
      pushedAt: r.pushed_at || r.updated_at || null,
      url: r.html_url,
    }))
}

/** Languages below this share of a repo are treated as incidental. */
const LANG_NOISE_FLOOR = 0.02

/**
 * Language mix across the profile, normalised per repository.
 *
 * Raw byte totals are not usable here: a single static-site repo carries tens
 * of megabytes of generated HTML and drowns out everything else. Each repo
 * instead contributes a weight of exactly 1, split across its languages by
 * their share of that repo, so the result describes what the author works in
 * rather than which repo happens to be largest.
 */
export async function fetchLanguageMix(login, repos, token, sampleSize = 60) {
  // Deterministic ordering: the same repo set must always sample the same way.
  const ranked = [...repos]
    .sort(
      (a, b) =>
        b.stars - a.stars ||
        String(b.pushedAt).localeCompare(String(a.pushedAt)) ||
        a.name.localeCompare(b.name)
    )
    .slice(0, sampleSize)

  const weights = new Map()
  const repoCounts = new Map()
  const rawBytes = new Map()
  let sampled = 0

  for (const repo of ranked) {
    // No catch here on purpose: a partial sample silently changes every
    // percentage on the card, so a failure must stop the build.
    const bytes = await getJson(
      `${API}/repos/${encodeURIComponent(login)}/${encodeURIComponent(repo.name)}/languages`,
      token
    )

    const entries = Object.entries(bytes).map(([name, size]) => [name, Number(size) || 0])
    const repoTotal = entries.reduce((sum, [, size]) => sum + size, 0)
    // Repos GitHub reports no bytes for — empty, or nothing but assets — carry
    // no signal and are left out of the sample count shown on the card. This is
    // a property of the repo, not a transient failure, so it stays stable
    // across runs.
    if (repoTotal <= 0) continue
    sampled++

    const significant = entries.filter(([, size]) => size / repoTotal >= LANG_NOISE_FLOOR)
    const kept = significant.length > 0 ? significant : entries
    const keptTotal = kept.reduce((sum, [, size]) => sum + size, 0)

    for (const [name, size] of kept) {
      weights.set(name, (weights.get(name) || 0) + size / keptTotal)
      repoCounts.set(name, (repoCounts.get(name) || 0) + 1)
      rawBytes.set(name, (rawBytes.get(name) || 0) + size)
    }
  }

  const grandWeight = [...weights.values()].reduce((a, b) => a + b, 0)
  const languages = [...weights.entries()]
    .map(([name, weight]) => ({
      name,
      pct: grandWeight > 0 ? (weight / grandWeight) * 100 : 0,
      repos: repoCounts.get(name) || 0,
      bytes: rawBytes.get(name) || 0,
    }))
    .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name))

  return { languages, sampled }
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`))
  return m ? m[1] : null
}

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/**
 * Exact daily contribution counts for the trailing year.
 *
 * Each calendar cell carries the date; the count lives in a separate tooltip
 * element that points back at the cell by id. Reading levels alone would lose
 * the real numbers, so the two are joined here.
 */
export async function fetchContributions(login) {
  const res = await fetch(`https://github.com/users/${encodeURIComponent(login)}/contributions`, {
    headers: { 'user-agent': UA, 'x-requested-with': 'XMLHttpRequest' },
  })
  if (!res.ok) throw new Error(`contributions -> HTTP ${res.status}`)
  const html = await res.text()

  const countById = new Map()
  for (const m of html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g)) {
    const target = attr(m[1], 'for')
    if (!target) continue
    const text = decodeEntities(m[2]).trim()
    const num = text.match(/^([\d,]+)\s+contributions?\b/)
    countById.set(target, num ? Number(num[1].replace(/,/g, '')) : 0)
  }

  const days = []
  for (const m of html.matchAll(/<td\b([^>]*\bclass="[^"]*ContributionCalendar-day[^"]*"[^>]*)>/g)) {
    const tag = m[1]
    const date = attr(tag, 'data-date')
    if (!date) continue
    const id = attr(tag, 'id')
    const level = Number(attr(tag, 'data-level') || 0)
    const count = id && countById.has(id) ? countById.get(id) : 0
    days.push({ date, count, level })
  }

  days.sort((a, b) => a.date.localeCompare(b.date))

  const total = days.reduce((sum, d) => sum + d.count, 0)
  const activeDays = days.filter((d) => d.count > 0).length

  let longestStreak = 0
  let run = 0
  let best = { date: null, count: 0 }
  for (const d of days) {
    if (d.count > 0) {
      run++
      if (run > longestStreak) longestStreak = run
    } else {
      run = 0
    }
    if (d.count > best.count) best = { date: d.date, count: d.count }
  }

  // The trailing day can still be in progress, so a zero there does not break
  // an otherwise live streak.
  let currentStreak = 0
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) currentStreak++
    else if (i === days.length - 1) continue
    else break
  }

  const weeks = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

  return { total, days, weeks, activeDays, currentStreak, longestStreak, best }
}

export async function collect(login, token) {
  const [user, contributions] = await Promise.all([
    fetchUser(login, token),
    fetchContributions(login),
  ])
  const repos = await fetchRepos(login, token)
  const { languages, sampled } = await fetchLanguageMix(login, repos, token)

  return {
    user,
    repos,
    languages,
    languageSample: { repos: sampled },
    contributions,
    totals: {
      stars: repos.reduce((s, r) => s + r.stars, 0),
      forks: repos.reduce((s, r) => s + r.forks, 0),
      sourceRepos: repos.length,
    },
  }
}
