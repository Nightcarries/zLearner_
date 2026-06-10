"use client";

import React from 'react';
import katex from 'katex';

export default function Markdown({ text, isAi = false, fontClass = "font-lora" }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let currentParagraph = [];
  let currentList = [];
  let inCodeBlock = false;
  let codeBlockLines = [];
  let inMathBlock = false;
  let mathBlockLines = [];

  const flushParagraph = (key) => {
    if (currentParagraph.length > 0) {
      elements.push(
        <p
          key={`p-${key}`}
          className={`${fontClass} text-[16px] leading-relaxed text-justify mb-4 whitespace-pre-line ${
            isAi ? 'text-white' : 'text-text-grey'
          }`}
        >
          {renderInlineStyles(currentParagraph.join('\n'))}
        </p>
      );
      currentParagraph = [];
    }
  };

  const flushList = (key) => {
    if (currentList.length > 0) {
      elements.push(
        <ul
          key={`ul-${key}`}
          className={`list-disc pl-6 mb-4 space-y-2 ${fontClass} text-[16px] ${
            isAi ? 'text-white' : 'text-text-grey'
          }`}
        >
          {currentList.map((li, idx) => (
            <li key={`li-${key}-${idx}`}>{renderInlineStyles(li)}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  function renderInlineStyles(txt) {
    const parts = [];
    let lastIndex = 0;
    // Regex matches $$math$$, $math$, **bold**, and `code`
    const regex = /(\$\$(.*?)\$\$|\$(.*?)\$|\*\*(.*?)\*\*|`(.*?)`)/g;
    let match;
    let idx = 0;

    while ((match = regex.exec(txt)) !== null) {
      if (match.index > lastIndex) {
        parts.push(txt.slice(lastIndex, match.index));
      }
      
      const fullMatch = match[1];
      if (fullMatch.startsWith('$$')) {
        const mathContent = match[2];
        let html = '';
        try {
          html = katex.renderToString(mathContent, {
            throwOnError: false,
            displayMode: true,
          });
        } catch (e) {
          html = mathContent;
        }
        parts.push(
          <span 
            key={`math-block-${idx}`} 
            className="block my-4 p-3 rounded-lg text-center overflow-x-auto border border-transparent"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } else if (fullMatch.startsWith('$')) {
        const mathContent = match[3];
        let html = '';
        try {
          html = katex.renderToString(mathContent, {
            throwOnError: false,
            displayMode: false,
          });
        } catch (e) {
          html = mathContent;
        }
        parts.push(
          <span 
            key={`math-inline-${idx}`} 
            className="inline-block px-1"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } else if (fullMatch.startsWith('**')) {
        const boldContent = match[4];
        parts.push(
          <strong
            key={`bold-${idx}`}
            className={`font-bold ${isAi ? 'text-white' : 'text-slate-800'}`}
          >
            {boldContent}
          </strong>
        );
      } else {
        const codeContent = match[5];
        parts.push(
          <code
            key={`code-${idx}`}
            className={`px-1 py-0.5 rounded font-mono text-sm ${
              isAi ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-red-600'
            }`}
          >
            {codeContent}
          </code>
        );
      }
      lastIndex = regex.lastIndex;
      idx++;
    }

    if (lastIndex < txt.length) {
      parts.push(txt.slice(lastIndex));
    }

    return parts.length > 0 ? parts : txt;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Single-line Block Math equation check (e.g. $$x = 1$$)
    if (line.trim().startsWith('$$') && line.trim().endsWith('$$') && line.trim().length > 4) {
      flushParagraph(i);
      flushList(i);
      const mathContent = line.trim().slice(2, -2);
      let html = '';
      try {
        html = katex.renderToString(mathContent, {
          throwOnError: false,
          displayMode: true,
        });
      } catch (e) {
        html = mathContent;
      }
      elements.push(
        <div
          key={`math-single-block-${i}`}
          className={`my-4 p-4 rounded-lg text-center overflow-x-auto border ${
            isAi ? 'bg-blue-800/50 border-blue-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'
          }`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
      continue;
    }

    // Multiline Math Block check
    if (line.trim() === '$$') {
      if (inMathBlock) {
        inMathBlock = false;
        let html = '';
        try {
          html = katex.renderToString(mathBlockLines.join('\n'), {
            throwOnError: false,
            displayMode: true,
          });
        } catch (e) {
          html = mathBlockLines.join('\n');
        }
        elements.push(
          <div
            key={`math-multi-${i}`}
            className={`my-4 p-4 rounded-lg text-center overflow-x-auto border ${
              isAi ? 'bg-blue-800/50 border-blue-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'
            }`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
        mathBlockLines = [];
      } else {
        flushParagraph(i);
        flushList(i);
        inMathBlock = true;
      }
      continue;
    }

    if (inMathBlock) {
      mathBlockLines.push(line);
      continue;
    }

    // Code block check
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        inCodeBlock = false;
        elements.push(
          <pre
            key={`code-${i}`}
            className={`p-4 rounded-lg overflow-x-auto font-mono text-sm mb-4 ${
              isAi ? 'bg-blue-800/80 text-white' : 'bg-slate-900 text-slate-100'
            }`}
          >
            <code>{codeBlockLines.join('\n')}</code>
          </pre>
        );
        codeBlockLines = [];
      } else {
        flushParagraph(i);
        flushList(i);
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Header 1
    if (line.startsWith('# ')) {
      flushParagraph(i);
      flushList(i);
      elements.push(
        <h1
          key={`h1-${i}`}
          className={`${fontClass} font-bold text-[36px] leading-tight mb-6 mt-6 ${
            isAi ? 'text-white' : 'text-primary-blue'
          }`}
        >
          {line.slice(2)}
        </h1>
      );
      continue;
    }

    // Header 2
    if (line.startsWith('## ')) {
      flushParagraph(i);
      flushList(i);
      elements.push(
        <h2
          key={`h2-${i}`}
          className={`${fontClass} font-semibold text-[24px] mb-4 mt-6 ${
            isAi ? 'text-white' : 'text-primary-blue'
          }`}
        >
          {line.slice(3)}
        </h2>
      );
      continue;
    }

    // Header 3
    if (line.startsWith('### ')) {
      flushParagraph(i);
      flushList(i);
      elements.push(
        <h3
          key={`h3-${i}`}
          className={`${fontClass} font-semibold text-[20px] mb-3 mt-4 ${
            isAi ? 'text-white' : 'text-primary-blue'
          }`}
        >
          {line.slice(4)}
        </h3>
      );
      continue;
    }

    // Header 4
    if (line.startsWith('#### ')) {
      flushParagraph(i);
      flushList(i);
      elements.push(
        <h4
          key={`h4-${i}`}
          className={`${fontClass} font-semibold text-[17px] mb-2 mt-4 ${
            isAi ? 'text-white' : 'text-primary-blue'
          }`}
        >
          {line.slice(5)}
        </h4>
      );
      continue;
    }

    // List item
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      flushParagraph(i);
      currentList.push(line.trim().slice(2));
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      flushParagraph(i);
      flushList(i);
      continue;
    }

    // Normal paragraph text
    flushList(i);
    currentParagraph.push(line);
  }

  flushParagraph('end');
  flushList('end');

  return <div className="markdown-body select-text">{elements}</div>;
}
