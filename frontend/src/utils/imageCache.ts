import type { HostQuestionState, StudentQuestionState } from '../api/types';

interface ImageCacheEntry {
  image: string;
  options: Map<number, string>;
}

export type QuestionImageCache = Map<number, ImageCacheEntry>;

export function createImageCache(): QuestionImageCache {
  return new Map();
}

/** El backend deja de mandar `image` (manda '') en los polls una vez que ya
 * se la pasó al cliente para la pregunta activa -- acá reponemos esos campos
 * desde este cache local para que el render no note la diferencia, y de paso
 * lo actualizamos con lo que haya de nuevo en la respuesta. */
function mergeEntry(
  cache: QuestionImageCache,
  questionId: number,
  image: string,
  optionImages: [number, string][],
): ImageCacheEntry {
  const cached = cache.get(questionId) ?? { image: '', options: new Map<number, string>() };
  const mergedOptions = new Map(cached.options);
  for (const [id, img] of optionImages) {
    if (img) mergedOptions.set(id, img);
  }
  const entry: ImageCacheEntry = { image: image || cached.image, options: mergedOptions };
  cache.set(questionId, entry);
  return entry;
}

export function hydrateStudentQuestion(q: StudentQuestionState, cache: QuestionImageCache): StudentQuestionState {
  const entry = mergeEntry(
    cache,
    q.question.id,
    q.question.image,
    q.question.options.map((o) => [o.id, o.image]),
  );
  return {
    ...q,
    question: {
      ...q.question,
      image: entry.image,
      options: q.question.options.map((o) => ({ ...o, image: o.image || entry.options.get(o.id) || '' })),
    },
    tally: q.tally?.map((row) => ({
      ...row,
      image: row.image || (row.id !== undefined ? entry.options.get(row.id) : row.image),
    })),
  };
}

export function hydrateHostQuestion(q: HostQuestionState, cache: QuestionImageCache): HostQuestionState {
  const entry = mergeEntry(
    cache,
    q.question.id,
    q.question.image,
    q.question.options.map((o) => [o.id, o.image]),
  );
  return {
    ...q,
    question: {
      ...q.question,
      image: entry.image,
      options: q.question.options.map((o) => ({ ...o, image: o.image || entry.options.get(o.id) || '' })),
    },
    tally: q.tally.map((row) => ({
      ...row,
      image: row.image || (row.id !== undefined ? entry.options.get(row.id) : row.image),
    })),
  };
}
