// src/lib.ts
export function oneLetterDiff(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diff++;
      if (diff > 1) return false;
    }
    return diff === 1;
  }
  
  export function normalize(word: string) {
    return word.trim().toUpperCase();
  }
  