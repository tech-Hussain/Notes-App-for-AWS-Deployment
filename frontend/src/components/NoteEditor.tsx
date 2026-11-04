import React, { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import {
  FiEdit3,
  FiEye,
  FiBold,
  FiItalic,
  FiUnderline,
  FiList,
  FiLink,
  FiCode,
  FiCheckSquare,
  FiMessageSquare,
  FiTrash2,
  FiAlertCircle,
  FiSave,
  FiX,
  FiHash,
} from 'react-icons/fi';
import { CreateNoteInput } from '../types';

interface NoteEditorProps {
  initialTitle?: string;
  initialContent?: string;
  isSubmitting?: boolean;
  error?: string | null;
  mode: 'create' | 'edit';
  onSubmit: (data: CreateNoteInput) => Promise<void>;
  onCancel: () => void;
}

const getRandomToken = (): string => {
  if (typeof window !== 'undefined' && window.crypto) {
    if (typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID().replace(/-/g, '');
    }
    if (typeof window.crypto.getRandomValues === 'function') {
      const array = new Uint32Array(2);
      window.crypto.getRandomValues(array);
      return Array.from(array, (num) => num.toString(36)).join('');
    }
  }
  return Date.now().toString(36);
};

export const NoteEditor: React.FC<NoteEditorProps> = ({
  initialTitle = '',
  initialContent = '',
  isSubmitting = false,
  error = null,
  mode,
  onSubmit,
  onCancel,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; content?: string }>({});
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [localSubmitError, setLocalSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(initialTitle);
    setContent(initialContent);
  }, [initialTitle, initialContent]);

  const validate = (): boolean => {
    const errors: { title?: string; content?: string } = {};

    if (!title.trim()) {
      errors.title = 'Title is required.';
    } else if (title.trim().length > 200) {
      errors.title = 'Title cannot exceed 200 characters.';
    }

    if (!content.trim()) {
      errors.content = 'Content is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLocalSubmitError(null);

    if (!validate()) {
      return;
    }

    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setLocalSubmitError(err.message);
      } else {
        setLocalSubmitError('An error occurred while saving the note. Please try again.');
      }
    }
  };

  // Convert markdown/html content to safe HTML preview
  const parseMarkdownToHtml = (text: string): string => {
    if (!text) return '';
    let html = text;

    const renderToken = getRandomToken() + Date.now().toString(36);
    const placeholders: { token: string; html: string; isBlock: boolean }[] = [];
    const uncheckedToken = `___TASK_UNCHECKED_${renderToken}___`;
    const checkedToken = `___TASK_CHECKED_${renderToken}___`;

    // Helper to escape HTML characters inside code blocks to prevent raw HTML execution/breakage
    const escapeHtml = (str: string): string =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Extract fenced code blocks before other markdown transformations
    html = html.replace(/```([\s\S]*?)```/g, (_, codeContent: string) => {
      const token = `___CODE_BLOCK_${renderToken}_${placeholders.length}___`;
      placeholders.push({ token, html: `<pre><code>${escapeHtml(codeContent)}</code></pre>`, isBlock: true });
      return token;
    });

    // Extract inline code blocks before other markdown transformations
    html = html.replace(/`([^`]+)`/g, (_, codeContent: string) => {
      const token = `___INLINE_CODE_${renderToken}_${placeholders.length}___`;
      placeholders.push({ token, html: `<code>${escapeHtml(codeContent)}</code>`, isBlock: false });
      return token;
    });

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Blockquotes
    html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Task lists (using safe placeholder tokens before DOMPurify sanitization)
    html = html.replace(/^[ \t]*- \[[ \t]*\] +([^\r\n]*)/gm, `<ul><li>${uncheckedToken} $1</li></ul>`);
    html = html.replace(/^[ \t]*- \[[ \t]*[xX][ \t]*\] +([^\r\n]*)/gm, `<ul><li>${checkedToken} $1</li></ul>`);

    // Bullet Lists (accepting optional leading whitespace)
    html = html.replace(/^[ \t]*- +([^\r\n]*)/gim, '<ul><li>$1</li></ul>');
    html = html.replace(/^[ \t]*\* +([^\r\n]*)/gim, '<ul><li>$1</li></ul>');

    // Numbered Lists (accepting optional leading whitespace)
    html = html.replace(/^[ \t]*\d+\. +([^\r\n]*)/gim, '<ol><li>$1</li></ol>');

    // Combine adjacent lists
    html = html.replace(/<\/ul>\s*<ul>/g, '');
    html = html.replace(/<\/ol>\s*<ol>/g, '');

    // Bold, Italic, Strikethrough
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    // HTML tags fallback (for legacy HTML notes)
    html = html.replace(/<b>/g, '<strong>').replace(/<\/b>/g, '</strong>');
    html = html.replace(/<i>/g, '<em>').replace(/<\/i>/g, '</em>');

    // Links
    html = html.replace(/\[([^\]]{1,2000})\]\(([^)\s]{1,2000})\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Paragraph breaks
    html = html
      .split('\n\n')
      .map((p) => {
        const trimmed = p.trim();
        if (
          trimmed.startsWith('<h') ||
          trimmed.startsWith('<ul') ||
          trimmed.startsWith('<ol') ||
          trimmed.startsWith('<blockquote') ||
          trimmed.startsWith('<pre') ||
          placeholders.some((ph) => ph.isBlock && trimmed.startsWith(ph.token))
        ) {
          return trimmed;
        }
        return `<p>${p.replace(/\n/g, '<br />')}</p>`;
      })
      .join('');

    // Restore protected code blocks
    placeholders.forEach(({ token, html: codeHtml }) => {
      html = html.split(token).join(codeHtml);
    });

    let sanitizedHtml = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'b',
        'strong',
        'i',
        'em',
        'u',
        's',
        'del',
        'h1',
        'h2',
        'h3',
        'h4',
        'ul',
        'ol',
        'li',
        'p',
        'code',
        'pre',
        'br',
        'span',
        'blockquote',
        'a',
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });

    // Restore safe checkbox markup for task lists after DOMPurify sanitization
    sanitizedHtml = sanitizedHtml
      .split(uncheckedToken)
      .join('<input type="checkbox" disabled />')
      .split(checkedToken)
      .join('<input type="checkbox" checked disabled />');

    return sanitizedHtml;
  };

  const previewHtml = useMemo(() => {
    if (activeTab !== 'preview') return '';
    return parseMarkdownToHtml(content);
  }, [content, activeTab]);

  const formatText = (prefix: string, suffix: string = ''): void => {
    const textarea = document.getElementById('note-content-input') as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const replacement = `${prefix}${selectedText || 'text'}${suffix}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      const selectionStart = start + prefix.length;
      const selectionEnd = selectedText ? selectionStart + selectedText.length : selectionStart + 4;
      textarea.setSelectionRange(selectionStart, selectionEnd);
    }, 0);
  };

  const clearFormatting = (): void => {
    const textarea = document.getElementById('note-content-input') as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    if (!selectedText) return;

    let cleanedText = selectedText;

    // Protect inline code spans (wrapped in backticks) before cleaning up markdown and HTML
    const clearFmtTokenBase = getRandomToken() + Date.now().toString(36);
    const codePlaceholders: { token: string; original: string }[] = [];

    cleanedText = cleanedText.replace(/`([^`]+)`/g, (match) => {
      const token = `___CLEAR_FMT_CODE_${clearFmtTokenBase}_${codePlaceholders.length}___`;
      codePlaceholders.push({ token, original: match });
      return token;
    });

    // Remove paired markdown & HTML formatting syntax generated by toolbar
    cleanedText = cleanedText.replace(/\*\*([^*]{1,2000})\*\*/g, '$1');
    cleanedText = cleanedText.replace(/(^|[^*\w])\*(\S(?:[^*]*\S)?)\*(?=$|[^\w*])/g, '$1$2');
    cleanedText = cleanedText.replace(/<\/?u>/gi, '');
    cleanedText = cleanedText.replace(/<\/?[a-zA-Z][a-zA-Z0-9]*(?=[\s/>]|$)[^>]*>/g, '');
    cleanedText = cleanedText.replace(/~~([^~]{1,2000})~~/g, '$1');
    cleanedText = cleanedText.replace(/\[([^\]]{1,2000})\]\([^)\s]{1,2000}\)/g, '$1');

    // Remove line-prefix syntax (headings, quotes, bullet/numbered/task lists) only at line starts
    cleanedText = cleanedText
      .split('\n')
      .map((line) => {
        line = line.replace(/^[ \t]*- \[[ \t]*(?:[xX][ \t]*)?\] +/, '');
        line = line.replace(/^[ \t]*[-*] +/, '');
        line = line.replace(/^[ \t]*\d+\. +/, '');
        line = line.replace(/^[ \t]*#{1,6} +/, '');
        line = line.replace(/^[ \t]*> +/, '');
        return line;
      })
      .join('\n');

    // Restore protected inline code spans
    codePlaceholders.forEach(({ token, original }) => {
      cleanedText = cleanedText.split(token).join(original);
    });

    const newContent = content.substring(0, start) + cleanedText + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + cleanedText.length);
    }, 0);
  };

  // Shared helper for list continuation and termination
  const handleListContinuation = (
    textarea: HTMLTextAreaElement,
    lineStart: number,
    selectionStart: number,
    selectionEnd: number,
    value: string,
    contentAfter: string,
    nextPrefix: string,
  ): void => {
    if (!contentAfter) {
      // Empty list item -> terminate list
      const newContent = value.substring(0, lineStart) + value.substring(selectionEnd);
      setContent(newContent);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(lineStart, lineStart);
      }, 0);
    } else {
      // Continue list
      const addition = `\n${nextPrefix}`;
      const newContent = value.substring(0, selectionStart) + addition + value.substring(selectionEnd);
      setContent(newContent);
      setTimeout(() => {
        textarea.focus();
        const newPos = selectionStart + addition.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    }
  };

  // Keyboard shortcut & automatic list continuation on Enter
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    const textarea = e.currentTarget;
    const { selectionStart, selectionEnd, value } = textarea;

    // Automatic list continuation on Enter
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLine = value.substring(lineStart, selectionStart);

      // Check Task list: "- [ ] ", "- [x] ", or "- [ x ] "
      const taskMatch = currentLine.match(/^[ \t]*- \[[ \t]*(?:[xX][ \t]*)?\] +/);
      if (taskMatch) {
        e.preventDefault();
        const matchedPrefix = taskMatch[0];
        const contentAfter = currentLine.slice(matchedPrefix.length).trim();
        const nextPrefix = matchedPrefix.replace(/- \[[ \t]*(?:[xX][ \t]*)?\] +$/, '- [ ] ');
        handleListContinuation(textarea, lineStart, selectionStart, selectionEnd, value, contentAfter, nextPrefix);
        return;
      }

      // Check Bullet list: "- " or "* "
      const bulletMatch = /^[ \t]*[-*] +/.exec(currentLine);
      if (bulletMatch) {
        e.preventDefault();
        const nextPrefix = bulletMatch[0];
        const contentAfter = currentLine.slice(nextPrefix.length).trim();
        handleListContinuation(textarea, lineStart, selectionStart, selectionEnd, value, contentAfter, nextPrefix);
        return;
      }

      // Check Numbered list: "1. "
      const numMatch = /^([ \t]*)(\d+)(\. +)/.exec(currentLine);
      if (numMatch) {
        e.preventDefault();
        const indent = numMatch[1];
        const num = Number.parseInt(numMatch[2], 10);
        const dotSpace = numMatch[3];
        const contentAfter = currentLine.slice(numMatch[0].length).trim();
        const nextPrefix = `${indent}${num + 1}${dotSpace}`;
        handleListContinuation(textarea, lineStart, selectionStart, selectionEnd, value, contentAfter, nextPrefix);
        return;
      }
    }

    // Keyboard Shortcuts: Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+K (Alt key must NOT be pressed to protect AltGr input)
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        formatText('**', '**');
      } else if (key === 'i') {
        e.preventDefault();
        formatText('*', '*');
      } else if (key === 'u') {
        e.preventDefault();
        formatText('<u>', '</u>');
      } else if (key === 'k') {
        e.preventDefault();
        formatText('[', '](https://example.com)');
      }
    }
  };

  const activeError = error || localSubmitError;

  return (
    <div className="note-editor-container">
      <div className="note-editor-header">
        <h2>{mode === 'create' ? 'Create New Note' : 'Edit Note'}</h2>
        <div className="editor-tab-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'write'}
            className={`tab-btn ${activeTab === 'write' ? 'active' : ''}`}
            onClick={() => setActiveTab('write')}
          >
            <FiEdit3 aria-hidden="true" style={{ marginRight: '0.35rem' }} /> Write
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'preview'}
            className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            <FiEye aria-hidden="true" style={{ marginRight: '0.35rem' }} /> Preview
          </button>
        </div>
      </div>

      {activeError && (
        <div className="alert-banner alert-banner-danger" role="alert">
          <FiAlertCircle aria-hidden="true" style={{ marginRight: '0.35rem' }} />
          <span>{activeError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="note-title-input" className="form-label">
            Title <span className="required-star">*</span>
          </label>
          <input
            id="note-title-input"
            type="text"
            className={`form-input ${fieldErrors.title ? 'is-invalid' : ''}`}
            placeholder="Enter note title..."
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (fieldErrors.title) {
                setFieldErrors((prev) => ({ ...prev, title: undefined }));
              }
            }}
            disabled={isSubmitting}
            aria-invalid={!!fieldErrors.title}
            aria-describedby={fieldErrors.title ? 'title-error' : undefined}
            required
          />
          {fieldErrors.title && (
            <p id="title-error" className="field-error" role="alert">
              {fieldErrors.title}
            </p>
          )}
        </div>

        {activeTab === 'write' ? (
          <div className="form-group">
            <div className="content-label-row">
              <label htmlFor="note-content-input" className="form-label">
                Content <span className="required-star">*</span>
              </label>

              {/* Grouped Rich-Text Toolbar with React Icons */}
              <div className="rich-text-toolbar" role="toolbar" aria-label="Text formatting toolbar">
                {/* Text Formatting Group */}
                <div className="toolbar-group" aria-label="Text styles">
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => formatText('**', '**')}
                    title="Bold (Ctrl+B)"
                    aria-label="Bold text"
                  >
                    <FiBold aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => formatText('*', '*')}
                    title="Italic (Ctrl+I)"
                    aria-label="Italic text"
                  >
                    <FiItalic aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => formatText('<u>', '</u>')}
                    title="Underline (Ctrl+U)"
                    aria-label="Underline text"
                  >
                    <FiUnderline aria-hidden="true" />
                  </button>
                </div>

                <div className="toolbar-separator" aria-hidden="true" />

                {/* Headings Group */}
                <div className="toolbar-group" aria-label="Headings">
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => formatText('## ', '')}
                    title="Heading 2"
                    aria-label="Heading 2"
                  >
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>H2</span>
                  </button>
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => formatText('### ', '')}
                    title="Heading 3"
                    aria-label="Heading 3"
                  >
                    <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>H3</span>
                  </button>
                </div>

                <div className="toolbar-separator" aria-hidden="true" />

                {/* Lists Group */}
                <div className="toolbar-group" aria-label="Lists">
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => formatText('- ', '')}
                    title="Bullet List"
                    aria-label="Bullet list"
                  >
                    <FiList aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => formatText('1. ', '')}
                    title="Numbered List"
                    aria-label="Numbered list"
                  >
                    <FiHash aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => formatText('- [ ] ', '')}
                    title="Checklist / Task List"
                    aria-label="Checklist task"
                  >
                    <FiCheckSquare aria-hidden="true" />
                  </button>
                </div>

                <div className="toolbar-separator" aria-hidden="true" />

                {/* Insert Items Group */}
                <div className="toolbar-group" aria-label="Insert elements">
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => formatText('[', '](https://example.com)')}
                    title="Insert Link (Ctrl+K)"
                    aria-label="Insert link"
                  >
                    <FiLink aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => formatText('> ', '')}
                    title="Quote"
                    aria-label="Quote"
                  >
                    <FiMessageSquare aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => formatText('`', '`')}
                    title="Code snippet"
                    aria-label="Code snippet"
                  >
                    <FiCode aria-hidden="true" />
                  </button>
                </div>

                <div className="toolbar-separator" aria-hidden="true" />

                {/* Utilities Group */}
                <div className="toolbar-group" aria-label="Utilities">
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={clearFormatting}
                    title="Clear formatting on selection"
                    aria-label="Clear formatting"
                  >
                    <FiTrash2 aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            <textarea
              id="note-content-input"
              className={`form-input textarea-input ${fieldErrors.content ? 'is-invalid' : ''}`}
              placeholder="Start writing your note..."
              rows={10}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (fieldErrors.content) {
                  setFieldErrors((prev) => ({ ...prev, content: undefined }));
                }
              }}
              onKeyDown={handleEditorKeyDown}
              disabled={isSubmitting}
              aria-invalid={!!fieldErrors.content}
              aria-describedby={fieldErrors.content ? 'content-error' : undefined}
              required
            />
            {fieldErrors.content && (
              <p id="content-error" className="field-error" role="alert">
                {fieldErrors.content}
              </p>
            )}
          </div>
        ) : (
          <div className="form-group">
            <span className="form-label">Content Preview</span>
            <div className="note-preview-box">
              {content.trim() ? (
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : (
                <em className="text-muted">Nothing to preview yet.</em>
              )}
            </div>
          </div>
        )}

        <div className="editor-form-actions">
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="spinner spinner-sm"></span>
                <span>Saving...</span>
              </>
            ) : mode === 'create' ? (
              <>
                <FiSave aria-hidden="true" style={{ marginRight: '0.35rem' }} />
                Create Note
              </>
            ) : (
              <>
                <FiSave aria-hidden="true" style={{ marginRight: '0.35rem' }} />
                Save Changes
              </>
            )}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            <FiX aria-hidden="true" style={{ marginRight: '0.35rem' }} />
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

