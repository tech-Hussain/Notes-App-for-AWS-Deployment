import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, NavigateFunction } from 'react-router-dom';
import { Dashboard } from '../Dashboard';
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
    list: jest.fn<ReturnType<typeof notesApi.list>, Parameters<typeof notesApi.list>>(),
    delete: jest.fn<ReturnType<typeof notesApi.delete>, Parameters<typeof notesApi.delete>>(),
  },
  ApiError: class ApiError extends Error {
    constructor(public message: string, public statusCode: number = 400) {
      super(message);
    }
  },
}));

describe('Dashboard Component', () => {
  const mockNotes = [
    {
      _id: 'note-1',
      title: 'First Note Title',
      content: 'Content of the first note',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      userId: 'user-1',
    },
    {
      _id: 'note-2',
      title: 'Second Note Title',
      content: 'Content of the second note',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      userId: 'user-1',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = (): ReturnType<typeof render> => {
    return render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
  };

  it('renders loading state initially and then displays notes grid', async () => {
    jest.mocked(notesApi.list).mockResolvedValueOnce({
      notes: mockNotes,
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    renderComponent();

    expect(screen.getByText('Loading your notes...')).toBeInTheDocument();

    try {
      expect(await screen.findByText('First Note Title')).toBeInTheDocument();
      expect(screen.getByText('Second Note Title')).toBeInTheDocument();
    } catch (error) {
      throw new Error(`Dashboard loading notes test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('displays empty state when user has no notes', async () => {
    jest.mocked(notesApi.list).mockResolvedValueOnce({
      notes: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });

    renderComponent();

    try {
      expect(await screen.findByText('No notes yet')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create your first note/i })).toBeInTheDocument();
    } catch (error) {
      throw new Error(`Dashboard empty state test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('navigates to /notes/new when Create Note button is clicked', async () => {
    jest.mocked(notesApi.list).mockResolvedValueOnce({
      notes: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });

    renderComponent();

    try {
      const createBtn = await screen.findByRole('button', { name: /create note/i });
      fireEvent.click(createBtn);

      expect(mockNavigate).toHaveBeenCalledWith('/notes/new');
    } catch (error) {
      throw new Error(`Dashboard create note navigation test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('opens delete modal and confirms deletion of a note', async () => {
    jest.mocked(notesApi.list).mockResolvedValueOnce({
      notes: mockNotes,
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
    jest.mocked(notesApi.delete).mockResolvedValueOnce({ deleted: true, noteId: 'note-1' });

    renderComponent();

    try {
      expect(await screen.findByText('First Note Title')).toBeInTheDocument();

      const deleteButtons = screen.getAllByRole('button', { name: /delete note/i });
      fireEvent.click(deleteButtons[0]);

      expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();

      const confirmDeleteBtn = screen.getByRole('button', { name: /^delete note$/i });
      fireEvent.click(confirmDeleteBtn);

      await waitFor(() => {
        expect(notesApi.delete).toHaveBeenCalledWith('note-1');
        expect(screen.queryByText('First Note Title')).not.toBeInTheDocument();
      });
    } catch (error) {
      throw new Error(`Dashboard delete note test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('triggers notesApi.list with updated sort options when sort dropdown changes', async () => {
    jest.mocked(notesApi.list).mockResolvedValue({
      notes: mockNotes,
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    renderComponent();

    try {
      const sortSelect = await screen.findByLabelText(/sort notes by/i);
      fireEvent.change(sortSelect, { target: { value: 'title:asc' } });

      await waitFor(() => {
        expect(notesApi.list).toHaveBeenCalledWith(
          expect.objectContaining({
            sortBy: 'title',
            sortOrder: 'asc',
          })
        );
      });
    } catch (error) {
      throw new Error(`Dashboard sort options change test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
});
