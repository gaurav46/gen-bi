export interface EmbeddingPort {
  generateEmbeddings(inputs: string[]): Promise<number[][]>;
}

export const EMBEDDING_PORT = 'EMBEDDING_PORT';
