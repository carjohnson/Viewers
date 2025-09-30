const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((val, i) => val === b[i]);