import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));

function createHarness() {
  let now = 1000;
  let lockHeld = false;
  let quota = 20;
  const properties = new Map();
  const sleeps = [];
  const sentAt = [];
  const context = {
    Date: { now: () => now },
    LockService: {
      getScriptLock: () => ({
        waitLock: () => {
          if (lockHeld) throw new Error('Lock already held');
          lockHeld = true;
        },
        releaseLock: () => { lockHeld = false; },
      }),
    },
    MailApp: { getRemainingDailyQuota: () => quota },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => properties.get(key) ?? null,
        setProperty: (key, value) => properties.set(key, value),
      }),
    },
    Utilities: {
      sleep: (duration) => { sleeps.push(duration); now += duration; },
    },
  };
  const code = readFileSync(join(__dirname, 'Code.js'), 'utf8');
  vm.runInNewContext(code, context);

  return {
    context,
    properties,
    sleeps,
    sentAt,
    setNow(value) { now = value; },
    setQuota(value) { quota = value; },
    isLockHeld() { return lockHeld; },
  };
}

test('manual faculty sends wait only for the remaining six-second interval', () => {
  const harness = createHarness();
  harness.context.sendManualFacultyEmail(() => {
    assert.equal(harness.isLockHeld(), true);
    harness.sentAt.push(1000);
  });
  assert.deepEqual(harness.sleeps, []);

  harness.setNow(3500);
  harness.context.sendManualFacultyEmail(() => harness.sentAt.push(7000));
  assert.deepEqual(harness.sleeps, [3500]);
  assert.deepEqual(harness.sentAt, [1000, 7000]);
  assert.equal(harness.isLockHeld(), false);
});

test('the app no longer holds emails back: a low remaining quota does not block a send', () => {
  const harness = createHarness();
  harness.setQuota(5);

  harness.context.sendManualFacultyEmail(() => harness.sentAt.push(1000));
  assert.deepEqual(harness.sentAt, [1000]);
  assert.equal(harness.isLockHeld(), false);
});

test('a failed email send releases the lock', () => {
  const harness = createHarness();

  assert.throws(
    () => harness.context.sendManualFacultyEmail(() => { throw new Error('send failed'); }),
    /send failed/,
  );
  assert.equal(harness.isLockHeld(), false);
});

test('faculty commitment emails omit the shared map button', () => {
  const harness = createHarness();
  const template = readFileSync(join(__dirname, 'Template.html'), 'utf8');
  harness.context.readTemplate = () => template;
  harness.context.Date = Date;
  harness.context.Utilities.formatDate = () => '15/11/2026';
  const html = harness.context.buildLetterHtml([], {
    name: 'Dr Example',
    role: 'Faculty',
    title: 'Commitment',
    greeting: 'Hello',
    intro: 'Your schedule is below.',
    formLink: 'https://forms.example/confirm',
    changes: [],
    venueUrl: 'https://conference.example/venue',
  });

  assert.doesNotMatch(html, /Open the shared venue map|conference\.example\/venue|VenueButton/);
});
