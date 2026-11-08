/**
 * Spread onto text inputs so browsers and password managers (1Password,
 * LastPass, Bitwarden) don't offer logins for budget fields like "Name".
 */
export const NO_AUTOFILL = {
  autoComplete: "off",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
} as const;
