import { hashPassword, verifyPassword } from "../auth/password.js";
import { validatePassword } from "../utils/validators.js";

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  PASS  ${description}`);
    passed++;
  } catch (error) {
    console.error(`  FAIL  ${description}`);
    console.error(`        ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, label = "") {
  if (actual !== expected) {
    throw new Error(`${label ? label + ": " : ""}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log("\npassword.js — hashPassword / verifyPassword\n");

test("hashPassword returns a bcrypt hash string", () => {
  const hash = hashPassword("Test123!");
  assert(typeof hash === "string", "hash should be a string");
  assert(hash.startsWith("$2"), "hash should be a bcrypt hash (starts with $2)");
});

test("hashPassword produces a different hash each call (random salt)", () => {
  const hash1 = hashPassword("Test123!");
  const hash2 = hashPassword("Test123!");
  assert(hash1 !== hash2, "two hashes of the same password should differ");
});

test("verifyPassword returns true for correct bcrypt password", () => {
  const hash = hashPassword("CorrectPassword1!");
  assert(verifyPassword("CorrectPassword1!", hash) === true, "correct password should verify");
});

test("verifyPassword returns false for wrong password", () => {
  const hash = hashPassword("CorrectPassword1!");
  assert(verifyPassword("WrongPassword1!", hash) === false, "wrong password should not verify");
});

test("verifyPassword returns false for empty password", () => {
  const hash = hashPassword("SomePassword1!");
  assert(verifyPassword("", hash) === false, "empty password should not verify");
});

test("verifyPassword returns false for null stored hash", () => {
  assert(verifyPassword("SomePassword1!", null) === false, "null hash should not verify");
});

test("verifyPassword returns false for empty stored hash", () => {
  assert(verifyPassword("SomePassword1!", "") === false, "empty hash should not verify");
});

test("verifyPassword returns false for malformed stored hash", () => {
  assert(verifyPassword("SomePassword1!", "notahash") === false, "malformed hash should not verify");
});

test("verifyPassword handles legacy scrypt format gracefully", () => {
  const result = verifyPassword("anything", "scrypt$bad$format$garbage");
  assert(result === false, "invalid scrypt format should return false");
});

console.log("\nvalidators.js — validatePassword\n");

test("returns null for a valid password (10+ chars, letter, digit, special)", () => {
  assertEqual(validatePassword("Secure1!xx"), null, "valid password");
});

test("returns null for minimum valid password (exactly 10 chars)", () => {
  assertEqual(validatePassword("Abcdef1!23"), null, "10-char valid password");
});

test("returns error for password shorter than 10 characters", () => {
  const result = validatePassword("Ab1!");
  assert(result !== null, "short password should fail");
  assert(result.includes("10"), "error should mention 10 characters");
});

test("returns error for password with no letters", () => {
  const result = validatePassword("1234567890!");
  assert(result !== null, "no-letter password should fail");
});

test("returns error for password with no digits", () => {
  const result = validatePassword("Abcdefghij!");
  assert(result !== null, "no-digit password should fail");
});

test("returns error for password with no special characters", () => {
  const result = validatePassword("Abcdefg123");
  assert(result !== null, "no-special-char password should fail");
});

test("returns error for empty string", () => {
  const result = validatePassword("");
  assert(result !== null, "empty password should fail");
});

test("accepts various special characters (space is special)", () => {
  assertEqual(validatePassword("Password1 xx"), null, "space counts as special");
});

test("accepts various special characters (@, #, $, %, etc.)", () => {
  for (const special of ["@", "#", "$", "%", "^", "&", "*", "-", "_", "+"]) {
    const pass = `Password1${special}`;
    assertEqual(validatePassword(pass), null, `special char '${special}'`);
  }
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exitCode = 1;
}
