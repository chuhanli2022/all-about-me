export type Question = {
  title: string; options: string[]; correct: number;
  introTitle?: string; intro?: string; introPhotos?: string[];
  story: string; description: string; photos: string[]; video?: string;
};
export type Player = { id: string; name: string; answers: Record<string, number> };
export type Game = {
  host: string; phase: 'lobby' | 'intro' | 'question' | 'story' | 'finished';
  index: number; questions: Question[]; players: Player[]; closedThrough?: number;
};

export const welcomeQuestions = (): Question[] => Array.from({ length: 7 }, (_, i) => ({
  introTitle: `Chapter ${i + 1}`,
  intro: 'Add a short introduction before this question.',
  title: `Your question ${i + 1} goes here`,
  options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: 0,
  story: `The story behind question ${i + 1}`,
  description: 'Add a personal story or explanation here.',
  photos: [], introPhotos: [],
}));

export function prepareGame(game: Game): Game { return game; }
