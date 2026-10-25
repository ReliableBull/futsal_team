/** Only return to known club voting pages; never accept external redirects. */
export function loginReturnPath(value: unknown) {
  return typeof value === "string" && value.length <= 200 && /^\/t\/[a-z0-9]+(?:-[a-z0-9]+)*\/polls(?:\/[a-zA-Z0-9_-]+)?$/.test(value)
    ? value : "/teams?mine=1";
}

export function adminLoginReturnPath(value: unknown) {
  return typeof value === "string" && /^\/polls(?:\/[a-zA-Z0-9_-]{1,64})?$/.test(value) ? value : "/abcd";
}
