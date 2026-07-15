// AI import help (plan Task 24; canvas 5a, screenshot 14). Route
// #/settings/ai-import. Four numbered steps with 30px green discs, a mono
// prompt preview + "⧉ Copy full prompt" (full text in aiPrompt.ts), and the
// primary "Choose CSV file to import…" which mounts the same CsvImportFlow
// as the Books tab.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { CsvImportFlow } from '../books/CsvImport';
import { AI_IMPORT_PROMPT } from './aiPrompt';

const PREVIEW_CHARS = 180;
const moreLines = AI_IMPORT_PROMPT.slice(PREVIEW_CHARS).split('\n').length - 1;

export function AiImportHelp() {
  const showToast = useToast();
  const [importing, setImporting] = useState(false);

  const copyPrompt = () => {
    void navigator.clipboard.writeText(AI_IMPORT_PROMPT).then(
      () => showToast('Prompt copied'),
      () => showToast('Copy failed — long-press the preview to select it'),
    );
  };

  return (
    <main style={{ padding: '20px 16px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          aria-label="Back"
          onClick={() => window.history.back()}
          style={{
            width: 38,
            height: 38,
            display: 'grid',
            placeItems: 'center',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-pill)',
            background: 'var(--card)',
            color: 'var(--ink-mid)',
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-.01em' }}>
          Import a book with AI help
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '6px 0 16px' }}>
        Skip typing hundreds of recipes — let an AI chatbot read your book’s table of contents and build the file
        for you. Takes about 5 minutes.
      </p>

      <Step n={1} title="Photograph the table of contents">
        <StepBody>Or the index — whichever lists recipe names with page numbers. Several photos are fine.</StepBody>
        <div
          style={{
            marginTop: 8,
            height: 74,
            borderRadius: 'var(--r-inner)',
            background: 'repeating-linear-gradient(45deg, var(--panel) 0 8px, var(--line) 8px 16px)',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'monospace',
            fontSize: 10,
            color: 'var(--ink-soft)',
          }}
        >
          example: photo of a contents page
        </div>
      </Step>

      <Step n={2} title="Paste this prompt into any AI chatbot">
        <StepBody>Attach your photos, then send the prompt (Claude, ChatGPT, Gemini — any works).</StepBody>
        <div
          style={{
            marginTop: 8,
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-inner)',
            padding: '11px 12px',
            fontFamily: 'monospace',
            fontSize: 11.5,
            color: 'var(--ink-mid)',
            lineHeight: 1.5,
          }}
        >
          {AI_IMPORT_PROMPT.slice(0, PREVIEW_CHARS)}…{' '}
          <span style={{ color: 'var(--ink-disabled)' }}>(+{moreLines} more lines)</span>
        </div>
        <button
          onClick={copyPrompt}
          style={{
            marginTop: 8,
            minHeight: 44,
            padding: '0 16px',
            border: '1.5px solid var(--accent)',
            background: 'var(--accent-tint)',
            color: 'var(--accent)',
            borderRadius: 'var(--r-pill)',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          ⧉ Copy full prompt
        </button>
      </Step>

      <Step n={3} title="Save the reply as a .csv file">
        <StepBody>
          Copy the chatbot’s output into a text file named anything ending in <b>.csv</b>. Don’t worry about stray
          spaces — the importer is forgiving.
        </StepBody>
      </Step>

      <Step n={4} title="Import it here">
        <StepBody>
          You’ll get a preview (“47 recipes found”) before anything is saved. Re-importing later never duplicates
          recipes.
        </StepBody>
      </Step>

      <button
        onClick={() => setImporting(true)}
        style={{
          width: '100%',
          minHeight: 52,
          background: 'var(--accent)',
          color: 'var(--on-accent)',
          borderRadius: 'var(--r-cta)',
          fontSize: 16,
          fontWeight: 700,
          marginTop: 2,
        }}
      >
        Choose CSV file to import…
      </button>
      <div className="hint" style={{ marginTop: 10, textAlign: 'center' }}>
        Names + page numbers only — no recipe text is copied. Fix any wrong category later, right on the recipe
        card.
      </div>

      {importing && <CsvImportFlow onClose={() => setImporting(false)} />}
    </main>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
      <div
        style={{
          flex: 'none',
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'var(--accent)',
          color: 'var(--on-accent)',
          fontWeight: 800,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {n}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontWeight: 600 }}>{title}</b>
        {children}
      </div>
    </div>
  );
}

function StepBody({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 13, color: 'var(--ink-mid)', marginTop: 2 }}>{children}</div>;
}
