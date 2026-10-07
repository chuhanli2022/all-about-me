"use client";
import { ArrowRight, ImagePlus } from 'lucide-react';
import type { Question } from '@/lib/game';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

export function LoadWelcomeQuiz({ busy, onLoad }: { busy: boolean; onLoad: () => void }) {
  return <AlertDialog>
    <AlertDialogTrigger asChild><button className="secondary" disabled={busy}>Load shared quiz</button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogTitle>Load the shared quiz?</AlertDialogTitle>
      <AlertDialogDescription>This replaces the question text, options, answers, introductions, and stories in this room. Saved photos and videos stay attached to the same question numbers. Pages without media receive the shared template’s photos and video. Unsaved edits, including unsaved photos, will be replaced. Save first if you want to keep newly added photos.</AlertDialogDescription>
      <AlertDialogFooter><AlertDialogCancel>Keep my edits</AlertDialogCancel><AlertDialogAction onClick={onLoad}>Load shared quiz</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

export function IntroEditor({ question, busy, onChange, onUpload }: {
  question: Question; busy: boolean; onChange: (q: Partial<Question>) => void;
  onUpload: (file: File | undefined) => void;
}) {
  return <section className="intro-editor">
    <span className="badge">BEFORE THE QUESTION</span>
    <h3 style={{ marginTop: 20 }}>Set the scene.</h3>
    <p className="muted">A shared introduction page before this question. Leave the introduction and photos empty to skip it.</p>
    <label className="field" htmlFor="intro-title">Introduction title</label>
    <input id="intro-title" maxLength={300} value={question.introTitle || ''} disabled={busy} onChange={e => onChange({ introTitle: e.target.value })} />
    <label className="field" htmlFor="intro-text">Introduction</label>
    <textarea id="intro-text" rows={4} maxLength={5000} value={question.intro || ''} disabled={busy} onChange={e => onChange({ intro: e.target.value })} />
    <div className="photos">{question.introPhotos?.map((src, i) => <div key={src}>
      <img src={src} alt={`Introduction photo ${i + 1}`} />
      <button className="secondary" disabled={busy} onClick={() => onChange({ introPhotos: question.introPhotos!.filter((_, j) => j !== i) })}>Remove intro photo {i + 1}</button>
    </div>)}</div>
    {(question.introPhotos?.length || 0) < 5 && <label className="secondary actions photo-upload">
      <ImagePlus size={18} />Add intro photo
      <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy}
        onChange={e => { onUpload(e.target.files?.[0]); e.target.value = ''; }} />
    </label>}
    <p className="notice">Up to 5 photos, 5 MB each. Save answer-revealing photos for the story page.</p>
  </section>;
}

export function IntroPage({ question, host, index, busy, onNext }: {
  question?: Partial<Question>; host: boolean; index: number; busy: boolean; onNext: () => void;
}) {
  return <article className="panel intro-page">
    <div className="intro-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</div>
    <span className="badge">A LITTLE ABOUT ME</span>
    <h3 className="intro-title">{question?.introTitle || 'Before the next question'}</h3>
    <p className="story-desc">{question?.intro}</p>
    {!!question?.introPhotos?.length && <div className="story-photos">{question.introPhotos.map((src, i) =>
      <img key={src} src={src} alt={`Introduction photo ${i + 1}`} />)}</div>}
    <div className="actions">{host ? <button className="primary" disabled={busy} onClick={onNext}>
      Open question {index + 1}<ArrowRight />
    </button> : <p className="muted">A little backstory first. Your host will open the question when it is time to guess.</p>}</div>
  </article>;
}
