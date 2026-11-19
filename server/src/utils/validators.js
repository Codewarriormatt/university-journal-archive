export function validatePassword(password) {
  if (password.length < 10) {
    return "Password must be at least 10 characters.";
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return "Password must include letters, numbers, and a special character.";
  }

  return null;
}
