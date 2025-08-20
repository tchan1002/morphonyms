// src/lib.ts

// Normalize to uppercase, trim spaces
export function normalize(word: string) {
    return word.trim().toUpperCase();
  }
  
  /**
   * Returns true iff b is reachable from a in ONE move by:
   * - change one letter (substitution)
   * - add one letter (insertion)
   * - drop one letter (deletion)
   * - swap two letters (transposition)
   *
   * Notes:
   * - Swap can be any two positions (not just adjacent).
   * - Exact same word is NOT a valid move.
   */
  export function isOneMorph(a: string, b: string): boolean {
    a = normalize(a);
    b = normalize(b);
    if (a === b) return false;
  
    const la = a.length, lb = b.length;
  
    // Same length: substitution or swap
    if (la === lb) {
      // Substitution: exactly one position differs
      const diffIdx: number[] = [];
      for (let i = 0; i < la; i++) {
        if (a[i] !== b[i]) diffIdx.push(i);
        if (diffIdx.length > 2) break;
      }
      if (diffIdx.length === 1) return true; // change one letter
  
      // Swap: exactly two positions differ AND swapping them matches b
      if (diffIdx.length === 2) {
        const [i, j] = diffIdx;
        if (i === j) return false;
        const arr = a.split("");
        [arr[i], arr[j]] = [arr[j], arr[i]];
        return arr.join("") === b;
      }
      return false;
    }
  
    // Insertion: b has exactly one extra letter
    if (lb === la + 1) {
      // Can we insert one letter into a to get b?
      let i = 0, j = 0, usedInsert = false;
      while (i < la && j < lb) {
        if (a[i] === b[j]) {
          i++; j++;
        } else if (!usedInsert) {
          usedInsert = true;
          j++; // skip one letter in b (the inserted one)
        } else {
          return false;
        }
      }
      return true;
    }
  
    // Deletion: b has exactly one fewer letter
    if (lb === la - 1) {
      // Can we delete one letter from a to get b?
      let i = 0, j = 0, usedDelete = false;
      while (i < la && j < lb) {
        if (a[i] === b[j]) {
          i++; j++;
        } else if (!usedDelete) {
          usedDelete = true;
          i++; // skip one letter in a (the deleted one)
        } else {
          return false;
        }
      }
      return true;
    }
  
    return false;
  }
  