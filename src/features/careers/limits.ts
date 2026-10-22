/**
 * Limits of the application form shared by the client form and its schema
 * (no dependencies: the form must not pull zod into the browser bundle).
 */

/** Longest application message: a few paragraphs, with room to spare (CHECK in 20261022001000). */
export const MESSAGE_MAX = 8000;
