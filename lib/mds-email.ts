// Shared by browser form validation and both submission endpoints.
// Escape the hyphen for HTML pattern's Unicode Sets (v) mode.
export const MDS_EMAIL_PATTERN = String.raw`[A-Za-z0-9._%+\-]+@(?:[Cc][Oo][Nn][Ss][Uu][Ll][Tt][Aa][Nn][Tt]\.)?[Vv][Oo][Ll][Vv][Oo]\.[Cc][Oo][Mm]`;

const emailPattern = new RegExp(`^(?:${MDS_EMAIL_PATTERN})$`);

export const isVolvoEmail = (value: string): boolean => emailPattern.test(value.trim());
