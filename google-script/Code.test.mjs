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

test('quota exhaustion rejects the send and always releases the lock', () => {
  const harness = createHarness();
  harness.setQuota(5);

  assert.throws(
    () => harness.context.sendManualFacultyEmail(() => harness.sentAt.push(1000)),
    /daily email reserve has been reached/,
  );
  assert.deepEqual(harness.sentAt, []);
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

test('venue email buttons accept only the shared map URL and escape attributes', () => {
  const harness = createHarness();
  const button = harness.context.venueButtonHtml('https://conference.example/venue');

  assert.match(button, /href="https:\/\/conference\.example\/venue"/);
  assert.match(button, /Open the shared venue map/);
  assert.equal(harness.context.venueButtonHtml('javascript:alert(1)'), '');
  assert.equal(harness.context.venueButtonHtml('https://conference.example/venue?rooms=hall-b'), '');
  assert.equal(harness.context.venueButtonHtml('http://external.example/venue'), '');
  assert.match(harness.context.venueButtonHtml('http://localhost:3000/venue'), /Open the shared venue map/);
});
