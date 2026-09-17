export interface Options {
  readonly ambiguousIsNarrow?: boolean;
  readonly countAnsiEscapeCodes?: boolean;
}

export type AmbiguousWidth = 'narrow' | 'wide';

export function setAmbiguousWidth(mode: AmbiguousWidth): void;
export function getAmbiguousWidth(): AmbiguousWidth;

export default function stringWidth(input: string, options?: Options): number;
