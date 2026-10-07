import { database } from '@/lib/storage';
import sharedQuiz from '@/lib/shared-quiz.json';
const sharedQuestions = (): Question[] => structuredClone(sharedQuiz);
import { Game, Question, welcomeQuestions, prepareGame } from '@/lib/game';

const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
function fail(message: string): never { throw new Error(message); }
const photoPattern = /^\/api\/photo\?key=[A-Z]{6}\/[a-f0-9-]+$/;

function view(g: Game, token: string, code: string) {
  const host = g.host === token;
  const me = g.players.find(p => p.id === token);
  if (!host && !me) fail('This game session is not valid. Please join again.');
  const q = g.questions[g.index];
  const selected = me?.answers[String(g.index)];
  const closedThrough = g.closedThrough ?? (g.phase === 'story' || g.phase === 'finished' ? g.index : g.index - 1);
  const answerClosed = g.index <= closedThrough;
  const revealed = answerClosed || g.phase === 'story' || g.phase === 'finished' || selected !== undefined;
  const question = g.phase === 'lobby' && !host ? undefined :
    g.phase === 'intro' && !host ? {
      introTitle: q.introTitle, intro: q.intro, introPhotos: q.introPhotos || [],
    } : {
      title: q.title, options: q.options,
      ...(revealed || host ? { correct: q.correct } : {}),
      ...(g.phase === 'story' || host ? {
        story: q.story, description: q.description, photos: q.photos, video: q.video,
        introTitle: q.introTitle, intro: q.intro, introPhotos: q.introPhotos || [],
      } : {}),
    };
  return {
    code, host, phase: g.phase, index: g.index,
    questions: host ? g.questions : undefined, question, selected, answerClosed,
    ...(host ? { correctPlayers: g.players.filter(p => p.answers[String(g.index)] === q.correct).map(p => p.name) } : {}),
    players: g.players.map(p => ({
      name: p.name, answered: p.answers[String(g.index)] !== undefined,
      score: Object.entries(p.answers).filter(([i, answer]) => g.questions[Number(i)].correct === answer).length,
    })),
    me: me?.name,
  };
}

function validateQuestions(questions: Question[]) {
  if (!Array.isArray(questions) || questions.length !== 7) fail('Please keep exactly seven questions.');
  for (const q of questions) {
    if (!q || typeof q.title !== 'string' || !q.title.trim() || q.title.length > 300 ||
        !Array.isArray(q.options) || q.options.length !== 4 ||
        q.options.some(o => typeof o !== 'string' || !o.trim() || o.length > 150) ||
        !Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3 ||
        typeof q.story !== 'string' || q.story.length > 300 ||
        typeof q.description !== 'string' || q.description.length > 5000 ||
        (q.introTitle !== undefined && (typeof q.introTitle !== 'string' || q.introTitle.length > 300)) ||
        (q.intro !== undefined && (typeof q.intro !== 'string' || q.intro.length > 5000))) {
      fail('Check the question, four options, correct answer, and introduction and story text.');
    }
    if (q.video !== undefined && (typeof q.video !== 'string' || (q.video && !/^\/api\/video\?key=[A-Z]{6}\/video-[a-f0-9-]+$/.test(q.video)))) fail('Choose an uploaded video.');
    for (const photos of [q.photos, q.introPhotos || []]) {
      if (!Array.isArray(photos) || photos.length > 5 ||
          photos.some(p => typeof p !== 'string' || !photoPattern.test(p))) {
        fail('Each page can contain up to five uploaded photos.');
      }
    }
  }
}
const firstPhase = (q: Question): 'intro' | 'question' =>
  q.intro?.trim() || q.introPhotos?.length ? 'intro' : 'question';

export async function GET(req: Request) {
  try {
    const code = new URL(req.url).searchParams.get('room') || '';
    const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';
    const row = await database().prepare('SELECT state FROM rooms WHERE code=?').bind(code).first<{ state: string }>();
    if (!row) return json({ error: 'Room not found. Check the six-letter code.' }, 404);
    return json(view(prepareGame(JSON.parse(row.state)), token, code));
  } catch (e) { return json({ error: (e as Error).message }, 400); }
}

export async function POST(req: Request) {
  try {
    const b = await req.json() as {
      action: string; code?: string; name?: string; index?: number; phase?: string;
      answer: number; questions: Question[];
    };
    const db = database();
    if (b.action === 'create') {
      let questions = sharedQuestions();
      if (b.code) {
        const previous = await db.prepare('SELECT state FROM rooms WHERE code=?').bind(String(b.code).toUpperCase()).first<{state:string}>();
        if (!previous) fail('Previous room not found. Your quiz has not been reset.');
        const source: Game = JSON.parse(previous.state);
        if (source.host !== req.headers.get('authorization')?.replace('Bearer ', '')) fail('Only the host can reuse this quiz.');
        questions = source.questions;
      }
      const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), n => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[n % 23]).join('');
      const token = crypto.randomUUID();
      const game: Game = { host: token, phase: 'lobby', index: 0, questions, players: [] };
      await db.prepare('INSERT INTO rooms(code,state,version) VALUES(?,?,0)').bind(code, JSON.stringify(game)).run();
      return json({ token, ...view(game, token, code) });
    }
    const code = String(b.code || '').toUpperCase();
    for (let attempt = 0; attempt < 20; attempt++) {
      const row = await db.prepare('SELECT state,version FROM rooms WHERE code=?').bind(code)
        .first<{ state: string; version: number }>();
      if (!row) return json({ error: 'Room not found. Check the six-letter code.' }, 404);
      const game: Game = prepareGame(JSON.parse(row.state));
      let token = req.headers.get('authorization')?.replace('Bearer ', '') || '';
      const host = game.host === token;
      const player = game.players.find(p => p.id === token);
      if (b.action === 'join') {
        if (game.phase === 'finished') fail('This game has finished. Ask your host for the next room code.');
        if (game.players.length >= 30) fail('This room already has 30 players.');
        const name = String(b.name || '').trim().slice(0, 24);
        if (!name) fail('Enter your name to join.');
        if (game.players.some(p => p.name.toLowerCase() === name.toLowerCase())) fail('That name is already taken. Try a nickname.');
        token = crypto.randomUUID();
        game.players.push({ id: token, name, answers: {} });
      } else if (b.action === 'answer') {
        if (!player) fail('Join the game first.');
        if (game.index <= (game.closedThrough ?? (game.phase === 'story' || game.phase === 'finished' ? game.index : game.index - 1))) fail('This question has already closed.');
        if (game.phase !== 'question' || game.index !== b.index) fail('This question is not open.');
        if (!Number.isInteger(b.answer) || b.answer < 0 || b.answer > 3) fail('Choose one of the four answers.');
        if (player.answers[String(game.index)] !== undefined) fail('Your answer is already locked in.');
        player.answers[String(game.index)] = b.answer;
      } else {
        if (!host) fail('Only the host can do that.');
        if (b.action === 'save') {
          if (game.phase !== 'lobby') fail('The quiz cannot be edited after starting.');
          validateQuestions(b.questions);
          game.questions = b.questions;
        } else if (b.action === 'loadWelcome') {
          if (game.phase !== 'lobby') fail('The quiz cannot be edited after starting.');
          game.questions = sharedQuestions().map((q, i) => ({
            ...q, video: game.questions[i].video || q.video, photos: game.questions[i].photos.length ? game.questions[i].photos : q.photos, introPhotos: game.questions[i].introPhotos?.length ? game.questions[i].introPhotos : q.introPhotos,
          }));
        } else if (b.action === 'start') {
          if (game.phase !== 'lobby' || !game.players.length) fail('Wait for at least one player to join.');
          game.phase = firstPhase(game.questions[0]);
        } else if (b.action === 'previous') {
          if (b.index !== game.index || b.phase !== game.phase) fail('The game has already moved on.');
          game.closedThrough ??= game.phase === 'story' || game.phase === 'finished' ? game.index : game.index - 1;
          if (game.phase === 'finished') game.phase = 'story';
          else if (game.phase === 'story') game.phase = 'question';
          else if (game.phase === 'question' && firstPhase(game.questions[game.index]) === 'intro') game.phase = 'intro';
          else if (game.phase !== 'lobby' && game.index > 0) { game.index--; game.phase = 'story'; }
          else fail('You are at the first page.');
        } else if (b.action === 'next') {
          if (b.index !== game.index || b.phase !== game.phase) fail('The game has already moved on.');
          if (game.phase === 'intro') game.phase = 'question';
          else if (game.phase === 'question') {
            game.closedThrough = Math.max(game.closedThrough ?? -1, game.index);
            game.phase = 'story';
          } else if (game.phase === 'story') {
            if (game.index === 6) game.phase = 'finished';
            else { game.index++; game.phase = firstPhase(game.questions[game.index]); }
          } else fail('There is no next page yet.');
        } else fail('Unknown action.');
      }
      const result = await db.prepare('UPDATE rooms SET state=?,version=version+1 WHERE code=? AND version=?')
        .bind(JSON.stringify(game), code, row.version).run();
      if (result.meta.changes) return json({ ...(b.action === 'join' ? { token } : {}), ...view(game, token, code) });
    }
    return json({ error: 'The room is busy. Please try again.' }, 409);
  } catch (e) {
    console.error('Game request failed:', (e as Error).message);
    return json({ error: (e as Error).message }, 400);
  }
}
