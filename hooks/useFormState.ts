import { useState, useCallback, useRef, useEffect } from 'react';

interface UseFormStateOptions {
  onSuccess?: () => void;
  onError?: (error: any) => void;
  resetOnSuccess?: boolean;
  resetOnClose?: boolean;
}

interface UseFormStateReturn<T> {
  formState: T;
  setFormState: React.Dispatch<React.SetStateAction<T>>;
  updateField: (field: keyof T, value: any) => void;
  isSubmitting: boolean;
  errors: Record<string, string>;
  setError: (field: string, message: string) => void;
  clearErrors: () => void;
  reset: () => void;
  handleSubmit: (submitFn: (data: T) => Promise<any>) => (e?: React.FormEvent) => Promise<void>;
}

/**
 * Centralized form state management hook
 * Eliminates form state leaks and provides consistent behavior
 */
export function useFormState<T extends Record<string, any>>(
  initialState: T,
  options: UseFormStateOptions = {}
): UseFormStateReturn<T> {
  const {
    onSuccess,
    onError,
    resetOnSuccess = true,
    resetOnClose = true
  } = options;

  const [formState, setFormState] = useState<T>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const initialStateRef = useRef(initialState);

  // Update initial state ref when initialState changes
  useEffect(() => {
    initialStateRef.current = initialState;
  }, [initialState]);

  const updateField = useCallback((field: keyof T, value: any) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (errors[field as string]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field as string];
        return newErrors;
      });
    }
  }, [errors]);

  const setError = useCallback((field: string, message: string) => {
    setErrors(prev => ({ ...prev, [field]: message }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const reset = useCallback(() => {
    setFormState(initialStateRef.current);
    setErrors({});
    setIsSubmitting(false);
  }, []);

  const handleSubmit = useCallback((submitFn: (data: T) => Promise<any>) => {
    return async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }

      if (isSubmitting) return; // Prevent double submission

      setIsSubmitting(true);
      clearErrors();

      try {
        await submitFn(formState);
        
        if (resetOnSuccess) {
          reset();
        }
        
        onSuccess?.();
      } catch (error: any) {
        console.error('Form submission error:', error);
        
        // Handle validation errors
        if (error.validationErrors) {
          Object.entries(error.validationErrors).forEach(([field, message]) => {
            setError(field, message as string);
          });
        } else {
          setError('general', error.message || 'An error occurred');
        }
        
        onError?.(error);
      } finally {
        setIsSubmitting(false);
      }
    };
  }, [formState, isSubmitting, clearErrors, reset, resetOnSuccess, onSuccess, onError, setError]);

  // Reset on unmount if specified
  useEffect(() => {
    return () => {
      if (resetOnClose) {
        // Small delay to avoid issues with concurrent state updates
        setTimeout(reset, 0);
      }
    };
  }, [resetOnClose, reset]);

  return {
    formState,
    setFormState,
    updateField,
    isSubmitting,
    errors,
    setError,
    clearErrors,
    reset,
    handleSubmit
  };
}

/**
 * Specialized hook for edit modes (inline editing)
 */
export function useEditMode(initialValue: any = '') {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startEditing = useCallback((value?: any) => {
    setEditValue(value !== undefined ? value : initialValue);
    setIsEditing(true);
  }, [initialValue]);

  const cancelEditing = useCallback(() => {
    setEditValue(initialValue);
    setIsEditing(false);
    setIsSubmitting(false);
  }, [initialValue]);

  const handleSave = useCallback(async (saveFn: (value: any) => Promise<void>) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await saveFn(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Save error:', error);
      // Don't reset edit mode on error, let user try again
    } finally {
      setIsSubmitting(false);
    }
  }, [editValue, isSubmitting]);

  return {
    isEditing,
    editValue,
    setEditValue,
    isSubmitting,
    startEditing,
    cancelEditing,
    handleSave
  };
}

/**
 * Hook for managing loading states across multiple operations
 */
export function useLoadingStates() {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const setLoading = useCallback((key: string, loading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: loading
    }));
  }, []);

  const isLoading = useCallback((key: string) => {
    return loadingStates[key] || false;
  }, [loadingStates]);

  const isAnyLoading = useCallback(() => {
    return Object.values(loadingStates).some(Boolean);
  }, [loadingStates]);

  const withLoading = useCallback(<T extends any[]>(key: string, fn: (...args: T) => Promise<any>) => {
    return async (...args: T) => {
      setLoading(key, true);
      try {
        return await fn(...args);
      } finally {
        setLoading(key, false);
      }
    };
  }, [setLoading]);

  return {
    setLoading,
    isLoading,
    isAnyLoading,
    withLoading
  };
}