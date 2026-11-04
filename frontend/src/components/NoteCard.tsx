import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEdit3, FiTrash2 } from 'react-icons/fi';
import { Note } from '../types';

interface NoteCardProps {
  note: Note;
  onDeleteRequest: (note: Note) => void;
  isDeleting?: boolean;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onDeleteRequest, isDeleting = false }) => {
  const navigate = useNavigate();
  const noteId = note._id || note.id || '';

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  // Strip HTML tags for clean text preview
  const getContentPreview = (htmlOrText: string): string => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = htmlOrText;
    const text = tmp.textContent || tmp.innerText || '';
    return text.trim().slice(0, 150) + (text.length > 150 ? '...' : '');
  };

  const handleOpenNote = (): void => {
    navigate(`/notes/${noteId}/edit`);
  };

  return (
    <div className="note-card">
      <div className="note-card-header">
        <h3 className="note-card-title">
          <button
            type="button"
            className="note-card-title-link"
            onClick={handleOpenNote}
            aria-label={`Open note: ${note.title}`}
          >
            {note.title}
          </button>
        </h3>
        <span className="note-card-date">{formatDate(note.updatedAt || note.createdAt)}</span>
      </div>

      <p className="note-card-preview">{getContentPreview(note.content)}</p>

      <div className="note-card-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleOpenNote}
          aria-label={`Edit note ${note.title}`}
        >
          <FiEdit3 aria-hidden="true" style={{ marginRight: '0.35rem' }} /> Edit
        </button>

        <button
          type="button"
          className="btn btn-danger-outline btn-sm"
          onClick={() => onDeleteRequest(note)}
          disabled={isDeleting}
          aria-label={`Delete note ${note.title}`}
          data-note-id={noteId}
        >
          <FiTrash2 aria-hidden="true" style={{ marginRight: '0.35rem' }} />
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
};
