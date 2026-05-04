export interface TextSplitter {
  split(text: string): string[];
}

interface RecursiveOptions {
  chunkSize?: number;
  overlap?: number;
  separators?: string[];
}

export class RecursiveCharacterTextSplitter implements TextSplitter {
  private readonly chunkSize: number;
  private readonly overlap: number;
  private readonly separators: string[];

  constructor(options: RecursiveOptions = {}) {
    this.chunkSize = options.chunkSize ?? 1800;
    this.overlap = options.overlap ?? 200;
    this.separators = options.separators ?? ['\n\n', '\n', '. ', ' ', ''];
  }

  split(text: string): string[] {
    return this.splitWith(text, this.separators);
  }

  private splitWith(text: string, remaining: string[]): string[] {
    if (text.length <= this.chunkSize) return text.trim() ? [text.trim()] : [];

    const [sep, ...rest] = remaining as [string, ...string[]];

    if (sep === '') {
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += this.chunkSize - this.overlap) {
        const slice = text.slice(i, i + this.chunkSize).trim();
        if (slice) chunks.push(slice);
      }
      return chunks;
    }

    const small: string[] = [];
    for (const piece of text.split(sep).filter((p) => p.trim())) {
      if (piece.length > this.chunkSize) {
        small.push(...this.splitWith(piece, rest.length ? rest : ['']));
      } else {
        small.push(piece.trim());
      }
    }

    return this.merge(small, sep);
  }

  private merge(pieces: string[], sep: string): string[] {
    const chunks: string[] = [];
    let current = '';

    for (const piece of pieces) {
      const joined = current ? `${current}${sep}${piece}` : piece;
      if (joined.length > this.chunkSize && current) {
        chunks.push(current.trim());
        const tail = current.slice(-this.overlap);
        current = tail ? `${tail}${sep}${piece}` : piece;
      } else {
        current = joined;
      }
    }

    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }
}

// Factory: select splitter based on file extension.
// Add new cases here when new document formats require a different strategy.
export function splitterFor(_ext: string): TextSplitter {
  // _ext reserved for future strategies (e.g. '.md' → MarkdownHeaderTextSplitter)
  return new RecursiveCharacterTextSplitter();
}
