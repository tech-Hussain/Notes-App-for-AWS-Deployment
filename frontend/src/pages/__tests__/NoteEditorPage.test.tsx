import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, NavigateFunction, Route, Routes } from 'react-router-dom';
import { NoteEditorPage } from '../NoteEditorPage';
import { notesApi } from '../../services/api';

const mockNavigate = jest.fn<ReturnType<NavigateFunction>, Parameters<NavigateFunction>>();
jest.mock('react-router-dom', () => {
  let actual: typeof import('react-router-dom');
  try {
    actual = jest.requireActual<typeof import('react-router-dom')>('react-router-dom');
  } catch (error) {
    throw new Error(`Failed to import actual react-router-dom module in test setup: ${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock('../../services/api', () => ({
  notesApi: {
    getById: jest.fn<ReturnType<typeof notesApi.getById>, Parameters<typeof notesApi.getById>>(),
    create: jest.fn<ReturnType<typeof notesApi.create>, Parameters<typeof notesApi.create>>(),
    update: jest.fn<ReturnType<typeof notesApi.update>, Parameters<typeof notesApi.update>>(),
  },
  ApiError: class ApiError extends Error {
    constructor(public message: string, public statusCode: number = 400) {
      super(message);
    }
  },
}));

describe('NoteEditorPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderInCreateMode = (): ReturnType<typeof render> => {
    return render(
      <BrowserRouter>
        <NoteEditorPage />
      </BrowserRouter>
    );
  };

  const renderInEditMode = (id = 'note-123'): ReturnType<typeof render> => {
    window.history.pushState({}, 'Edit Note', `/notes/${id}/edit`);
    return render(
      <BrowserRouter>
        <Routes>
          <Route path="/notes/:id/edit" element={<NoteEditorPage />} />
        </Routes>
      </BrowserRouter>
    );
  };

  it('renders in create mode without fetching initial data', () => {
    renderInCreateMode();

    expect(screen.getByRole('heading', { name: 'Create New Note' })).toBeInTheDocument();
    expect(notesApi.getById).not.toHaveBeenCalled();
  });

  it('fetches existing note details and populates form in edit mode', async () => {
    jest.mocked(notesApi.getById).mockResolvedValueOnce({
      note: {
        _id: 'note-123',
        title: 'Existing Note Title',
        content: 'Existing Note Content',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        userId: 'user-1',
      },
    });

    renderInEditMode('note-123');

    expect(screen.getByText('Loading note details...')).toBeInTheDocument();

    try {
      expect(await screen.findByRole('heading', { name: 'Edit Note' })).toBeInTheDocument();
      expect(screen.getByLabelText(/title/i)).toHaveValue('Existing Note Title');
      expect(screen.getByLabelText(/content/i)).toHaveValue('Existing Note Content');
    } catch (error) {
      throw new Error(`NoteEditorPage edit mode fetch test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('displays error card when fetching note details fails in edit mode', async () => {
    jest.mocked(notesApi.getById).mockRejectedValueOnce(new Error('Note not found'));

    renderInEditMode('missing-note');

    try {
      expect(await screen.findByText(/Failed to load note details/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument();
    } catch (error) {
      throw new Error(`NoteEditorPage fetch error card test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('creates new note and navigates home when submitting in create mode', async () => {
    jest.mocked(notesApi.create).mockResolvedValueOnce({
      note: {
        _id: 'new-note-id',
        title: 'Created Title',
        content: 'Created Content',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        userId: 'user-1',
      },
    });

    renderInCreateMode();

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Created Title' } });
    fireEvent.change(screen.getByLabelText(/content/i), { target: { value: 'Created Content' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Note' }));

    try {
      await waitFor(() => {
        expect(notesApi.create).toHaveBeenCalledWith({
          title: 'Created Title',
          content: 'Created Content',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
      });
    } catch (error) {
      throw new Error(`NoteEditorPage create note submission test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
});
