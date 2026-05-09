export interface FishboneWrapOptions {
  maxUnitsPerLine: number;
  maxLines: number;
  ellipsis?: string;
}

export const FISHBONE_CATEGORY_WRAP: FishboneWrapOptions = {
  maxUnitsPerLine: 6.6,
  maxLines: 2,
};

export const FISHBONE_CAUSE_WRAP: FishboneWrapOptions = {
  maxUnitsPerLine: 12.2,
  maxLines: 2,
};

export const FISHBONE_PROBLEM_WRAP: FishboneWrapOptions = {
  maxUnitsPerLine: 14.2,
  maxLines: 4,
};

export const FISHBONE_IMPACT_WRAP: FishboneWrapOptions = {
  maxUnitsPerLine: 16.8,
  maxLines: 4,
};

function isCjkCharacter(character: string) {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(character);
}

function isWidePunctuation(character: string) {
  return /[\u3001\u3002\uff01\uff08\uff09\uff0c\uff1a\uff1b\uff1f\u3010\u3011\u300a\u300b\u201c\u201d\u2018\u2019]/u.test(
    character
  );
}

function isAsciiLetterOrNumber(character: string) {
  return /[A-Za-z0-9]/.test(character);
}

export function measureFishboneTextUnits(text: string) {
  let total = 0;

  for (const character of text) {
    if (character === " ") {
      total += 0.35;
    } else if (isCjkCharacter(character) || isWidePunctuation(character)) {
      total += 1;
    } else if (isAsciiLetterOrNumber(character)) {
      total += /[A-Z]/.test(character) ? 0.72 : 0.62;
    } else {
      total += 0.7;
    }
  }

  return Number(total.toFixed(3));
}

export function tokenizeFishboneText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [] as string[];
  }

  const tokens: string[] = [];
  let buffer = "";

  const flushBuffer = () => {
    if (buffer) {
      tokens.push(buffer);
      buffer = "";
    }
  };

  for (const character of normalized) {
    if (character === " ") {
      flushBuffer();
      if (tokens[tokens.length - 1] !== " ") {
        tokens.push(" ");
      }
      continue;
    }

    if (isCjkCharacter(character) || isWidePunctuation(character)) {
      flushBuffer();
      tokens.push(character);
      continue;
    }

    buffer += character;
  }

  flushBuffer();
  return tokens;
}

function splitOversizedToken(token: string, maxUnitsPerLine: number) {
  const parts: string[] = [];
  let current = "";

  for (const character of token) {
    const candidate = `${current}${character}`;
    if (current && measureFishboneTextUnits(candidate) > maxUnitsPerLine) {
      parts.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

function trimLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function truncateFishboneLine(text: string, maxUnitsPerLine: number, ellipsis: string) {
  const tokens = tokenizeFishboneText(text);
  let line = "";

  for (const token of tokens) {
    if (token === " " && !line) {
      continue;
    }

    const candidate = trimLine(`${line}${token}`);
    const withEllipsis = `${candidate}${ellipsis}`;

    if (
      candidate &&
      measureFishboneTextUnits(withEllipsis) <= maxUnitsPerLine + 0.001
    ) {
      line = `${line}${token}`;
      continue;
    }

    if (!line) {
      const pieces = splitOversizedToken(
        token,
        maxUnitsPerLine - measureFishboneTextUnits(ellipsis)
      );
      return `${trimLine(pieces[0] ?? "")}${ellipsis}`;
    }

    break;
  }

  return `${trimLine(line)}${ellipsis}`;
}

export function wrapFishboneText(text: string, options: FishboneWrapOptions) {
  const {
    maxUnitsPerLine,
    maxLines,
    ellipsis = "\u2026",
  } = options;
  const tokens = tokenizeFishboneText(text);

  if (tokens.length === 0) {
    return [] as string[];
  }

  const lines: string[] = [];
  let current = "";
  let stoppedAtIndex = -1;

  const pushCurrent = () => {
    const next = trimLine(current);
    if (next) {
      lines.push(next);
    }
    current = "";
  };

  const appendToken = (token: string): boolean => {
    if (token === " ") {
      if (current && !current.endsWith(" ")) {
        current += " ";
      }
      return true;
    }

    if (measureFishboneTextUnits(token) > maxUnitsPerLine) {
      const segments = splitOversizedToken(token, maxUnitsPerLine);
      for (const segment of segments) {
        if (!appendToken(segment)) {
          return false;
        }
      }
      return true;
    }

    const candidate = trimLine(`${current}${token}`);
    if (candidate && measureFishboneTextUnits(candidate) <= maxUnitsPerLine + 0.001) {
      current = `${current}${token}`;
      return true;
    }

    pushCurrent();

    if (lines.length >= maxLines) {
      return false;
    }

    current = token;
    return true;
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const appended = appendToken(tokens[index] ?? "");
    if (!appended) {
      stoppedAtIndex = index;
      break;
    }
  }

  if (current) {
    pushCurrent();
  }

  if (stoppedAtIndex === -1 && lines.length <= maxLines) {
    return lines;
  }

  const kept = lines.slice(0, maxLines);
  const overflowTokens =
    stoppedAtIndex === -1 ? [] : tokens.slice(stoppedAtIndex);
  const overflowText = trimLine(
    [kept[maxLines - 1] ?? "", ...overflowTokens].join("")
  );

  if (overflowText) {
    kept[maxLines - 1] = truncateFishboneLine(overflowText, maxUnitsPerLine, ellipsis);
  }

  return kept;
}
