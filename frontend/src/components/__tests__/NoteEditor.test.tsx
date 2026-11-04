import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NoteEditor } from '../NoteEditor';
import { CreateNoteInput } from '../../types';

describe('NoteEditor Component', () => {
  const mockOnSubmit = jest.fn<Promise<void>, [CreateNoteInput]>();
  const mockOnCancel = jest.fn<void, []>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = (mode: 'create' | 'edit' = 'create', initialTitle = '', initialContent = ''): ReturnType<typeof render> => {
    return render(
      <NoteEditor
        mode={mode}
        initialTitle={initialTitle}
        initialContent={initialContent}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );
  };

  it('renders correctly in create mode with blank input fields', () => {
    renderComponent('create');

    expect(screen.getByRole('heading', { name: 'Create New Note' })).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toHaveValue('');
    expect(screen.getByLabelText(/content/i)).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Create Note' })).toBeInTheDocument();
  });

  it('renders correctly in edit mode with initial data', () => {
    renderComponent('edit', 'Existing Title', 'Existing Content');

    expect(screen.getByRole('heading', { name: 'Edit Note' })).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toHaveValue('Existing Title');
    expect(screen.getByLabelText(/content/i)).toHaveValue('Existing Content');
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('switches between Write and Preview tabs correctly', () => {
    renderComponent('create', 'Title', '<b>Bold text</b>');

    const previewTab = screen.getByRole('tab', { name: /preview/i });
    fireEvent.click(previewTab);

    expect(screen.getByText('Content Preview')).toBeInTheDocument();
    expect(screen.queryByLabelText(/content/i)).not.toBeInTheDocument();

    const writeTab = screen.getByRole('tab', { name: /write/i });
    fireEvent.click(writeTab);

    expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
  });

  it('validates required title and content fields on form submission', async () => {
    renderComponent('create');

    fireEvent.click(screen.getByRole('button', { name: 'Create Note' }));

    try {
      expect(await screen.findByText('Title is required.')).toBeInTheDocument();
      expect(screen.getByText('Content is required.')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    } catch (error) {
      throw new Error(`NoteEditor validation test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('accepts user input and submits form successfully', async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);
    renderComponent('create');

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'New Note Title' } });
    fireEvent.change(screen.getByLabelText(/content/i), { target: { value: 'New Note Body' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Note' }));

    try {
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          title: 'New Note Title',
          content: 'New Note Body',
        });
      });
    } catch (error) {
      throw new Error(`NoteEditor submission test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('calls onCancel when Cancel button is clicked', () => {
    renderComponent('create');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('inserts markdown formatting tags when toolbar buttons are clicked', () => {
    renderComponent('create', 'Title', 'sample text');

    const boldBtn = screen.getByRole('button', { name: /bold text/i });
    fireEvent.click(boldBtn);

    const textarea = screen.getByLabelText(/content/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('**text**sample text');
  });

  it('automatically continues bullet list when Enter key is pressed', () => {
    renderComponent('create', 'Title', '- First bullet item');

    const textarea = screen.getByLabelText(/content/i) as HTMLTextAreaElement;
    textarea.selectionStart = textarea.value.length;
    textarea.selectionEnd = textarea.value.length;

    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(textarea.value).toBe('- First bullet item\n- ');
  });

  it('removes HTML tags and markdown formatting without removing plain text comparison if (a<b) return or arithmetic expressions such as 2 * 3 * 4', () => {
    const formattedContent = '**bold text** and *italic text* and <b>html bold</b> with if (a<b) return and 2 * 3 * 4 and 2 > 1';
    renderComponent('create', 'Title', formattedContent);

    const textarea = screen.getByLabelText(/content/i) as HTMLTextAreaElement;
    textarea.selectionStart = 0;
    textarea.selectionEnd = formattedContent.length;

    const clearBtn = screen.getByRole('button', { name: /clear formatting/i });
    fireEvent.click(clearBtn);

    expect(textarea.value).toBe('bold text and italic text and html bold with if (a<b) return and 2 * 3 * 4 and 2 > 1');
  });

  it('preserves HTML-looking content inside backticks when clear formatting is applied', () => {
    const contentWithCode = '**bold** and `<b>example</b>` and <i>italic</i>';
    renderComponent('create', 'Title', contentWithCode);

    const textarea = screen.getByLabelText(/content/i) as HTMLTextAreaElement;
    textarea.selectionStart = 0;
    textarea.selectionEnd = contentWithCode.length;

    const clearBtn = screen.getByRole('button', { name: /clear formatting/i });
    fireEvent.click(clearBtn);

    expect(textarea.value).toBe('bold and `<b>example</b>` and italic');
  });

  it('does not merge lines into list items when dash is followed by newline', () => {
    const rawContent = '-\nsome text';
    renderComponent('create', 'Title', rawContent);

    const previewTab = screen.getByRole('tab', { name: /preview/i });
    fireEvent.click(previewTab);

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText(/some text/)).toBeInTheDocument();
  });

  it('does not trigger Ctrl+B formatting when Alt key is pressed (AltGr protection)', () => {
    renderComponent('create', 'Title', 'plain text');

    const textarea = screen.getByLabelText(/content/i) as HTMLTextAreaElement;
    textarea.selectionStart = 0;
    textarea.selectionEnd = 10;

    fireEvent.keyDown(textarea, { key: 'b', ctrlKey: true, altKey: true });

    expect(textarea.value).toBe('plain text');
  });

  it('renders both lowercase [x] and uppercase [X] task markers as checked checkboxes in preview tab', () => {
    renderComponent('create', 'Title', '- [x] task one\n- [X] task two\n- [ x ] task three\n- [ X ] task four');

    const previewTab = screen.getByRole('tab', { name: /preview/i });
    fireEvent.click(previewTab);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(4);
    checkboxes.forEach((checkbox) => {
      expect(checkbox).toBeChecked();
    });
  });

  it('preserves literal markdown elements inside fenced and inline code blocks without rendering HTML elements', () => {
    const codeMarkdown = '```\n# Fenced Header\n- Fenced Bullet\n```\n`# Inline Header`';
    renderComponent('create', 'Title', codeMarkdown);

    const previewTab = screen.getByRole('tab', { name: /preview/i });
    fireEvent.click(previewTab);

    expect(screen.queryByRole('heading', { name: 'Fenced Header' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Inline Header' })).not.toBeInTheDocument();
    expect(screen.getByText(/# Fenced Header/)).toBeInTheDocument();
    expect(screen.getByText(/- Fenced Bullet/)).toBeInTheDocument();
    expect(screen.getByText(/# Inline Header/)).toBeInTheDocument();
    expect(screen.getByText(/# Fenced Header/).closest('pre')).not.toBeNull();
    expect(screen.getByText(/# Inline Header/).closest('code')).not.toBeNull();
  });

  it('leaves literal placeholder-like text unchanged in the preview', () => {
    const contentWithLiteralPlaceholder = '___INLINE_CODE_PLACEHOLDER_0___ and ___CODE_BLOCK_PLACEHOLDER_0___';
    renderComponent('create', 'Title', contentWithLiteralPlaceholder);

    const previewTab = screen.getByRole('tab', { name: /preview/i });
    fireEvent.click(previewTab);

    expect(screen.getByText(/___INLINE_CODE_PLACEHOLDER_0___ and ___CODE_BLOCK_PLACEHOLDER_0___/)).toBeInTheDocument();
  });

  it('preserves leading indentation when continuing task list on Enter key', () => {
    renderComponent('create', 'Title', '  - [x] Indented task item');

    const textarea = screen.getByLabelText(/content/i) as HTMLTextAreaElement;
    textarea.selectionStart = textarea.value.length;
    textarea.selectionEnd = textarea.value.length;

    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(textarea.value).toBe('  - [x] Indented task item\n  - [ ] ');
  });

  it('renders indented bullet and numbered lists correctly in preview tab', () => {
    renderComponent('create', 'Title', '  - indented bullet item\n  * star bullet item\n  1. indented numbered item');

    const previewTab = screen.getByRole('tab', { name: /preview/i });
    fireEvent.click(previewTab);

    expect(screen.getByText('indented bullet item')).toBeInTheDocument();
    expect(screen.getByText('star bullet item')).toBeInTheDocument();
    expect(screen.getByText('indented numbered item')).toBeInTheDocument();
    expect(screen.getByText('indented bullet item').closest('ul')).not.toBeNull();
    expect(screen.getByText('indented numbered item').closest('ol')).not.toBeNull();
  });

  describe('getRandomToken Security and Random Fallback Behavior', () => {
    const originalCrypto = window.crypto;

    afterEach(() => {
      Object.defineProperty(window, 'crypto', {
        value: originalCrypto,
        writable: true,
        configurable: true,
      });
    });

    it('uses window.crypto.getRandomValues when window.crypto.randomUUID is unavailable', () => {
      const mockGetRandomValues = jest.fn((array: Uint32Array) => {
        array[0] = 12345;
        array[1] = 67890;
        return array;
      });

      Object.defineProperty(window, 'crypto', {
        value: {
          getRandomValues: mockGetRandomValues,
        },
        writable: true,
        configurable: true,
      });

      renderComponent('create', 'Title', '- [ ] Task with getRandomValues');
      const previewTab = screen.getByRole('tab', { name: /preview/i });
      fireEvent.click(previewTab);

      expect(mockGetRandomValues).toHaveBeenCalled();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('falls back to Date.now() when window.crypto is unavailable', () => {
      Object.defineProperty(window, 'crypto', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      renderComponent('create', 'Title', '- [ ] Fallback Task');
      const previewTab = screen.getByRole('tab', { name: /preview/i });
      fireEvent.click(previewTab);

      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('handles fallback in getRandomToken when window.crypto exists but has no randomUUID or getRandomValues', () => {
      Object.defineProperty(window, 'crypto', {
        value: {},
        writable: true,
        configurable: true,
      });

      renderComponent('create', 'Title', '- [x] Completed Fallback Task');
      const previewTab = screen.getByRole('tab', { name: /preview/i });
      fireEvent.click(previewTab);

      expect(screen.getByRole('checkbox')).toBeChecked();
    });
  });

  describe('DOMPurify Sanitization & Input Security', () => {
    it('renders task-list checkboxes as disabled checkbox input elements', () => {
      renderComponent('create', 'Title', '- [ ] Unchecked item\n- [x] Checked item');
      const previewTab = screen.getByRole('tab', { name: /preview/i });
      fireEvent.click(previewTab);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]).not.toBeChecked();
      expect(checkboxes[0]).toBeDisabled();
      expect(checkboxes[1]).toBeChecked();
      expect(checkboxes[1]).toBeDisabled();
    });

    it('sanitizes and strips raw unsafe input tags like <input type="text"> and <input type="password">', () => {
      const unsafeContent = `
        - [ ] Valid task item
        <input type="text" name="malicious_text" value="stolen_data" />
        <input type="password" name="malicious_pass" value="secret" />
        <input type="button" value="Click me" />
        <input type="file" />
        <input type="hidden" name="csrf" value="123" />
      `;

      renderComponent('create', 'Title', unsafeContent);
      const previewTab = screen.getByRole('tab', { name: /preview/i });
      fireEvent.click(previewTab);

      // Only the valid task list checkbox should exist inside the note preview box
      const previewInputs = document.querySelectorAll('.note-preview-box input');
      expect(previewInputs).toHaveLength(1);
      expect(previewInputs[0].getAttribute('type')).toBe('checkbox');

      // Ensure no text, password, or other unsafe inputs are present inside the note preview box
      expect(document.querySelector('.note-preview-box input[type="text"]')).toBeNull();
      expect(document.querySelector('.note-preview-box input[type="password"]')).toBeNull();
      expect(document.querySelector('.note-preview-box input[type="button"]')).toBeNull();
      expect(document.querySelector('.note-preview-box input[type="file"]')).toBeNull();
      expect(document.querySelector('.note-preview-box input[type="hidden"]')).toBeNull();
    });

    it('sanitizes malicious script tags and event handlers', () => {
      const maliciousHtml = '<script>alert("xss")</script><img src="x" onerror="alert(1)" /><a href="https://example.com" onclick="alert(1)">Click link</a>';
      renderComponent('create', 'Title', maliciousHtml);
      const previewTab = screen.getByRole('tab', { name: /preview/i });
      fireEvent.click(previewTab);

      expect(document.querySelector('.note-preview-box script')).toBeNull();
      expect(document.querySelector('.note-preview-box img')).toBeNull();
      const link = document.querySelector('.note-preview-box a');
      expect(link).not.toBeNull();
      expect(link?.getAttribute('onclick')).toBeNull();
      expect(link?.getAttribute('href')).toBe('https://example.com');
    });
  });

  describe('Validation, Errors, Toolbar, and Keyboard Shortcuts Coverage', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('validates title length when exceeding 200 characters', async () => {
      try {
        renderComponent('create', 'a'.repeat(201), 'Valid Content');
        fireEvent.click(screen.getByRole('button', { name: 'Create Note' }));

        expect(await screen.findByText('Title cannot exceed 200 characters.')).toBeInTheDocument();
        expect(mockOnSubmit).not.toHaveBeenCalled();
      } catch (error) {
        throw new Error(`Title validation test failed: ${(error as Error).message}`);
      }
    });

    it('clears field errors when user edits title or content after failed submit', async () => {
      try {
        renderComponent('create');
        fireEvent.click(screen.getByRole('button', { name: 'Create Note' }));

        expect(await screen.findByText('Title is required.')).toBeInTheDocument();
        expect(screen.getByText('Content is required.')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'New Title' } });
        expect(screen.queryByText('Title is required.')).not.toBeInTheDocument();

        fireEvent.change(screen.getByLabelText(/content/i), { target: { value: 'New Content' } });
        expect(screen.queryByText('Content is required.')).not.toBeInTheDocument();
      } catch (error) {
        throw new Error(`Clearing field errors test failed: ${(error as Error).message}`);
      }
    });

    it('handles submission errors when onSubmit throws an Error instance', async () => {
      try {
        mockOnSubmit.mockRejectedValueOnce(new Error('Failed to save note to server.'));
        renderComponent('create', 'Title', 'Content');

        fireEvent.click(screen.getByRole('button', { name: 'Create Note' }));

        expect(await screen.findByText('Failed to save note to server.')).toBeInTheDocument();
      } catch (error) {
        throw new Error(`Submission Error instance test failed: ${(error as Error).message}`);
      }
    });

    it('handles submission errors when onSubmit throws a non-Error object', async () => {
      try {
        mockOnSubmit.mockRejectedValueOnce('Network error string');
        renderComponent('create', 'Title', 'Content');

        fireEvent.click(screen.getByRole('button', { name: 'Create Note' }));

        expect(await screen.findByText('An error occurred while saving the note. Please try again.')).toBeInTheDocument();
      } catch (error) {
        throw new Error(`Submission non-Error object test failed: ${(error as Error).message}`);
      }
    });

    it('triggers formatting from toolbar buttons (Italic, Underline, H2, H3, Bullet, Numbered, Task, Link, Quote, Code)', () => {
      renderComponent('create', 'Title', '');

      const italicBtn = screen.getByRole('button', { name: /italic text/i });
      fireEvent.click(italicBtn);
      jest.runAllTimers();
      const textarea = screen.getByLabelText(/content/i) as HTMLTextAreaElement;
      expect(textarea.value).toBe('*text*');

      fireEvent.click(screen.getByRole('button', { name: /underline text/i }));
      jest.runAllTimers();
      expect(textarea.value).toContain('<u>');

      fireEvent.click(screen.getByRole('button', { name: /heading 2/i }));
      jest.runAllTimers();
      expect(textarea.value).toContain('## ');

      fireEvent.click(screen.getByRole('button', { name: /heading 3/i }));
      jest.runAllTimers();
      expect(textarea.value).toContain('### ');

      fireEvent.click(screen.getByRole('button', { name: /bullet list/i }));
      jest.runAllTimers();
      expect(textarea.value).toContain('- ');

      fireEvent.click(screen.getByRole('button', { name: /numbered list/i }));
      jest.runAllTimers();
      expect(textarea.value).toContain('1. ');

      fireEvent.click(screen.getByRole('button', { name: /checklist task/i }));
      jest.runAllTimers();
      expect(textarea.value).toContain('- [ ] ');

      fireEvent.click(screen.getByRole('button', { name: /insert link/i }));
      jest.runAllTimers();
      expect(textarea.value).toContain('](https://example.com)');

      fireEvent.click(screen.getByRole('button', { name: /quote/i }));
      jest.runAllTimers();
      expect(textarea.value).toContain('> ');

      fireEvent.click(screen.getByRole('button', { name: /code snippet/i }));
      jest.runAllTimers();
      expect(textarea.value).toContain('`');
    });

    it('handles Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+K keyboard shortcuts in editor', () => {
      renderComponent('create', 'Title', 'sample');
      const textarea = screen.getByLabelText(/content/i) as HTMLTextAreaElement;
      textarea.selectionStart = 0;
      textarea.selectionEnd = 6;

      fireEvent.keyDown(textarea, { key: 'b', ctrlKey: true });
      jest.runAllTimers();
      expect(textarea.value).toBe('**sample**');

      textarea.selectionStart = 0;
      textarea.selectionEnd = textarea.value.length;
      fireEvent.keyDown(textarea, { key: 'i', ctrlKey: true });
      jest.runAllTimers();
      expect(textarea.value).toBe('***sample***');

      textarea.selectionStart = 0;
      textarea.selectionEnd = textarea.value.length;
      fireEvent.keyDown(textarea, { key: 'u', ctrlKey: true });
      jest.runAllTimers();
      expect(textarea.value).toBe('<u>***sample***</u>');

      textarea.selectionStart = 0;
      textarea.selectionEnd = textarea.value.length;
      fireEvent.keyDown(textarea, { key: 'k', ctrlKey: true });
      jest.runAllTimers();
      expect(textarea.value).toContain('](https://example.com)');
    });

    it.each([
      ['handles list continuation for numbered lists on Enter key', '1. Item one', '1. Item one\n2. '],
      ['terminates empty numbered list item on Enter key', '1. Item one\n2. ', '1. Item one\n'],
      ['terminates empty task list item on Enter key', '- [ ] ', ''],
      ['terminates empty bullet list item on Enter key', '- ', ''],
    ])('%s', (_description, initialContent, expectedContent) => {
      renderComponent('create', 'Title', initialContent);
      const textarea = screen.getByLabelText(/content/i) as HTMLTextAreaElement;
      textarea.selectionStart = textarea.value.length;
      textarea.selectionEnd = textarea.value.length;
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });
      jest.runAllTimers();
      expect(textarea.value).toBe(expectedContent);
    });
  });

  describe('SonarQube Regex Optimization & ReDoS Prevention Tests', () => {
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['performance'] });
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('clears formatting on lines starting with task lists without super-linear backtracking (Line 291 fix)', () => {
      const taskLine = '- [  x  ] Task with extra space';
      renderComponent('create', 'Title', taskLine);

      const textarea = screen.getByLabelText(/content/i) as HTMLTextAreaElement;
      textarea.selectionStart = 0;
      textarea.selectionEnd = taskLine.length;

      const clearBtn = screen.getByRole('button', { name: /clear formatting/i });
      fireEvent.click(clearBtn);

      expect(textarea.value).toBe('Task with extra space');
    });

    it('handles long adversarial inputs for task clear formatting in linear time (Line 291 ReDoS safety)', () => {
      const longSpaces = ' '.repeat(10000);
      const adversarialInput = `- [${longSpaces}] Non-matching task bracket without closing bracket`;
      renderComponent('create', 'Title', adversarialInput);

      const textarea = screen.getByLabelText(/content/i) as HTMLTextAreaElement;
      textarea.selectionStart = 0;
      textarea.selectionEnd = adversarialInput.length;

      const startTime = performance.now();
      const clearBtn = screen.getByRole('button', { name: /clear formatting/i });
      fireEvent.click(clearBtn);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
    });

    it('handles task list continuation on Enter with whitespace in linear time (Line 356 & 360 fix)', () => {
      const longContent = 'x'.repeat(10000);
      renderComponent('create', 'Title', `  - [ x ] ${longContent}`);

      const textarea = screen.getByLabelText(/content/i) as HTMLTextAreaElement;
      textarea.selectionStart = textarea.value.length;
      textarea.selectionEnd = textarea.value.length;

      const startTime = performance.now();
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });
      jest.runAllTimers();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(textarea.value).toBe(`  - [ x ] ${longContent}\n  - [ ] `);
    });

    it('handles bullet list continuation on Enter with long line content in linear time (Line 366 fix)', () => {
      const longContent = 'a'.repeat(20000);
      renderComponent('create', 'Title', `  - ${longContent}`);

      const textarea = screen.getByLabelText(/content/i) as HTMLTextAreaElement;
      textarea.selectionStart = textarea.value.length;
      textarea.selectionEnd = textarea.value.length;

      const startTime = performance.now();
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });
      jest.runAllTimers();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(textarea.value).toBe(`  - ${longContent}\n  - `);
    });

    it('handles numbered list continuation on Enter with long line content in linear time (Line 376 fix)', () => {
      const longContent = 'b'.repeat(20000);
      renderComponent('create', 'Title', `   42. ${longContent}`);

      const textarea = screen.getByLabelText(/content/i) as HTMLTextAreaElement;
      textarea.selectionStart = textarea.value.length;
      textarea.selectionEnd = textarea.value.length;

      const startTime = performance.now();
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });
      jest.runAllTimers();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(textarea.value).toBe(`   42. ${longContent}\n   43. `);
    });
  });
});


