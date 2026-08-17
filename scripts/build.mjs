#!/usr/bin/env node
/**
 * Builds the profile card.
 *
 *   node scripts/build.mjs [login]
 *
 * GITHUB_TOKEN is optional and only raises the REST rate limit; every source
 * used here is public. The output is a pure function of the fetched data, so
 * an unchanged profile produces byte-identical SVGs and the workflow has
 * nothing to commit.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { collect } from './lib/github.mjs'
import { renderSvg } from './lib/render.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'assets')

const login = process.argv[2] || process.env.PROFILE_LOGIN || 'newdee'
const token = process.env.GITHUB_TOKEN || ''

const data = await collect(login, token)
await mkdir(OUT, { recursive: true })

for (const theme of ['dark', 'light']) {
  const svg = renderSvg(data, theme)
  const file = join(OUT, `profile-${theme}.svg`)
  await writeFile(file, svg, 'utf8')
  console.log(`${theme.padEnd(5)} ${String(Buffer.byteLength(svg)).padStart(7)} bytes  ${file}`)
}

await writeFile(join(OUT, 'data.json'), JSON.stringify(data, null, 2) + '\n', 'utf8')

const { contributions, totals, languages, languageSample } = data
console.log(
  [
    '',
    `login            ${data.user.login}`,
    `source repos     ${totals.sourceRepos}`,
    `stars            ${totals.stars}`,
    `contributions    ${contributions.total} over ${contributions.days.length} days`,
    `active days      ${contributions.activeDays}`,
    `streak           current ${contributions.currentStreak}d / longest ${contributions.longestStreak}d`,
    `languages        ${languages.length} across ${languageSample.repos} sampled repos`,
    `top language     ${languages[0]?.name ?? '—'} ${languages[0]?.pct.toFixed(1) ?? '0'}%`,
  ].join('\n')
)
