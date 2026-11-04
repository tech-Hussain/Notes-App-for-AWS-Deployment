import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, notesApi } from '../services/api';
import { CreateNoteInput } from '../types';
import { NoteEditor } from '../components/NoteEditor';

export const NoteEditorPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [loadingNote, setLoadingNote] = useState<boolean>(isEditMode);
  const [initialTitle, setInitialTitle] = useState<string>('');
  const [initialContent, setInitialContent] = useState<string>('');
  const [noteError, setNoteError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    if (!id) {
      setInitialTitle('');
      setInitialContent('');
      setNoteError(null);
      setLoadingNote(false);
      return () => {
        isCurrent = false;
      };
    }

    const fetchNote = async (): Promise<void> => {
      setLoadingNote(true);
      setNoteError(null);

      try {
        const result = await notesApi.getById(id);
        if (!isCurrent) {
          return;
        }
        setInitialTitle(result.note.title);
        setInitialContent(result.note.content);
      } catch (err: unknown) {
        if (!isCurrent) {
          return;
        }
        if (err instanceof ApiError) {
          setNoteError(err.message);
        } else {
          setNoteError('Failed to load note details. Please try again.');
        }
      } finally {
        if (isCurrent) {
          setLoadingNote(false);
        }
      }
    };

    void fetchNote();

    return () => {
      isCurrent = false;
    };
  }, [id]);

  const handleSubmit = async (data: CreateNoteInput): Promise<void> => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (isEditMode && id) {
        await notesApi.update(id, data);
      } else {
        await notesApi.create(data);
      }
      navigate('/', { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError('Failed to save note. Please check your connection and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = (): void => {
    navigate('/');
  };

  if (loadingNote) {
    return (
      <div className="spinner-container">
        <div className="spinner"></div>
        <p className="loading-text">Loading note details...</p>
      </div>
    );
  }

  if (noteError) {
    return (
      <div className="error-card-container">
        <div className="alert-banner alert-banner-danger">
          <span>⚠️ {noteError}</span>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <NoteEditor
        mode={isEditMode ? 'edit' : 'create'}
        initialTitle={initialTitle}
        initialContent={initialContent}
        isSubmitting={isSubmitting}
        error={submitError}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
};
