// Whole-card regression check. Run against a LOCAL test server only (it writes a test confession and sets Pete's word):
//   DATA_DIR=/tmp/t SECRET_CODE=testcode ADMIN_CODE=adm PETE_CODE=pp fastapi run main.py --port 8123   (after: cd frontend && npm run build)
//   NODE_PATH=$(npm root -g) node scripts/regression.js http://localhost:8123 testcode pp
// Needs Playwright (npm i -g playwright). Exits 1 if anything fails. Walks every screen Pete sees and, on each,
// checks that every button is actually visible (the check that would have caught the invisible Enter button).
const { chromium } = require('playwright'); const crypto = require('crypto')
const [BASE = 'http://localhost:8123', CODE = 'testcode', PETE = 'pp'] = process.argv.slice(2)
let failures = 0
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++ }

;(async () => {
  const token = crypto.createHash('sha256').update(`petermas-door:${CODE}`).digest('hex')
  const browser = await chromium.launch()

  // 1. the lock: a visitor without the code gets the login page, not the card
  const anon = await fetch(BASE + '/', { headers: { accept: 'text/html' } })
  ok(anon.status === 401, 'locked without the guest code')
  const picHeaders = await fetch(BASE + '/club-entrance.jpg?v=2', { headers: { cookie: `petermas_door=${token}` } })
  ok(/no-cache/.test(picHeaders.headers.get('cache-control') || ''), 'pictures are re-checked each visit (no stale cache)')

  const ctx = await browser.newContext({ viewport: { width: 400, height: 800 }, hasTouch: true })
  await ctx.addCookies([{ name: 'petermas_door', value: token, url: BASE }])
  await fetch(BASE + '/confessions', { method: 'POST', headers: { 'content-type': 'application/json', cookie: `petermas_door=${token}` },
    body: JSON.stringify({ code: CODE, name: 'Regression Friend', text: 'Regression test confession.', contact: '' }) })
  const p = await ctx.newPage(); const bad = [], errs = []
  p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().replace(BASE, '')) })
  p.on('pageerror', e => errs.push(e.message))
  const stage = () => p.evaluate(() => document.querySelector('.club')?.className || (document.querySelector('#st-petermas') ? 'CHAPEL' : 'other'))
  // every visible button must be really visible: opacity, size, on-screen, inside the open modal if there is one
  const buttonsVisible = async (where) => {
    const hidden = await p.evaluate(() => {
      const scope = document.querySelector('.pane-modal') || document
      return [...scope.querySelectorAll('button')].filter(b => !b.disabled && !b.closest('[hidden]') && !b.classList.contains('ticket'))  /* the ticket is meant to be gone once the card is open */.map(b => {
        const r = b.getBoundingClientRect(), cs = getComputedStyle(b)
        return { t: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 30), bad: r.width === 0 || r.height === 0 || parseFloat(cs.opacity) < 0.5 || cs.visibility === 'hidden' || cs.display === 'none' }
      }).filter(x => x.bad).map(x => x.t)
    })
    ok(hidden.length === 0, `${where}: all buttons visible` + (hidden.length ? ` (invisible: ${hidden.join(' | ')})` : ''))
  }

  // 2. the intro, tap by tap
  await p.goto(BASE + '/#pete-day-31'); await p.waitForTimeout(2500)
  ok((await stage()).includes('club-wake'), 'opens on "Tap to begin"')
  await p.touchscreen.tap(200, 400); await p.waitForTimeout(1800); ok((await stage()).includes('club-arrive'), 'Rave Over screen')
  await p.touchscreen.tap(200, 400); await p.waitForTimeout(3000); ok((await stage()).includes('club-ticket'), 'queue screen with ticket')
  await p.locator('.ticket').tap({ timeout: 4000 }); await p.waitForTimeout(3600); ok((await stage()).includes('club-displayed'), 'card dropped in')
  await p.locator('.book').tap({ timeout: 4000 }); await p.waitForTimeout(2500); ok((await stage()).includes('club-open'), 'card opened')
  await buttonsVisible('book (messages / chapel buttons)')
  await p.locator('.chapel-btn').tap({ timeout: 4000 }); await p.waitForTimeout(3500); ok((await stage()) === 'CHAPEL', 'into the chapel')

  // 3. scratch the saint with a finger
  const bb = await p.evaluate(() => { const e = document.querySelector('.scratch-finale-wrap'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })
  ok(!!bb, 'scratch-off is there on day 31')
  if (bb) {
    await p.waitForTimeout(400)
    const cdp = await ctx.newCDPSession(p)
    const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
    await t('touchStart', bb.x + bb.w / 2, bb.y + bb.h / 2)
    for (let pass = 0; pass < 8; pass++) for (let y = 25; y < bb.h - 15; y += 22) for (let x = 25; x < bb.w - 25; x += 26) await t('touchMove', bb.x + (pass % 2 ? bb.w - x : x), bb.y + y)
    await t('touchEnd'); await p.waitForTimeout(14000)
    ok(await p.evaluate(() => document.querySelectorAll('.scratch-finale-wrap canvas').length === 0), 'scratching clears both layers')
  }

  // 4. the window grid and the windows
  ok(await p.evaluate(() => document.querySelectorAll('button.pane').length === 31), 'all 31 windows are there after the scratch')
  await buttonsVisible('chapel page')
  for (const d of [1, 13, 31]) {
    await p.evaluate(n => document.querySelector(`button[aria-label="Open day ${n}"]`)?.scrollIntoView({ block: 'center' }), d)
    await p.locator(`button[aria-label="Open day ${d}"]`).tap({ timeout: 4000 }); await p.waitForTimeout(1000)
    ok(await p.evaluate(() => !!document.querySelector('.pane-modal')), `window ${d} opens`)
    await p.locator('.scratch-skip').tap({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(900)
    const imgOk = await p.evaluate(() => { const i = document.querySelector('.pane-modal img'); return !i || (i.complete && i.naturalWidth > 0) })
    ok(imgOk, `window ${d} photo loads`)
    await buttonsVisible(`window ${d}`)
    await p.locator('.pane-close').tap({ timeout: 2000 }); await p.waitForTimeout(500)
  }

  // 5. the 4am Confessional, all three states
  await p.evaluate(() => document.querySelector('.confess-door')?.scrollIntoView({ block: 'center' }))
  ok(await p.evaluate(() => !!document.querySelector('.confess-door')), 'Confessional door shows when there is a confession')
  await p.locator('.confess-door').tap({ timeout: 4000 }); await p.waitForTimeout(900)
  await buttonsVisible('Confessional: enter your word')
  await p.fill('.confess-card input', PETE); await p.locator('.confess-card .enter-btn:not(.pane-close)').tap({ timeout: 4000 }); await p.waitForTimeout(1200)
  const firstTime = await p.evaluate(() => /Choose your own secret word/.test(document.querySelector('.confess-card')?.innerText || ''))
  if (firstTime) {
    await buttonsVisible('Confessional: choose a word')
    await p.fill('.confess-card input', 'my-secret-word'); await p.locator('.confess-card .enter-btn:not(.pane-close)').tap({ timeout: 4000 }); await p.waitForTimeout(1500)
  }
  ok(await p.evaluate(() => /Regression test confession/.test(document.querySelector('.confess-card')?.innerText || '')), 'Confessional opens and shows the confession')
  await buttonsVisible('Confessional: reading')
  await p.locator('.confess-card .pane-close').tap({ timeout: 3000 }); await p.waitForTimeout(500)

  // 6. back out to the club and on to the messages page
  await p.locator('.chapel-back').tap({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(2500)
  await p.locator('.book-inside .enter-btn').first().tap({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(2500)
  ok(await p.evaluate(() => /Pete's 50th/.test(document.body.innerText)), 'messages page opens')

  ok(bad.length === 0, 'no failed requests' + (bad.length ? ': ' + bad.join(', ') : ''))
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ').slice(0, 200) : ''))
  await browser.close()
  console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED'); process.exit(failures ? 1 : 0)
})().catch(e => { console.error('SCRIPT ERROR', e.message); process.exit(1) })
