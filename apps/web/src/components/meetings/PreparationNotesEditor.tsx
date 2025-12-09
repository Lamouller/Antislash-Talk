import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';
import { Button } from '../ui/Button';
import toast from 'react-hot-toast';
import { Edit2, Eye, Save, Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PreparationNotesEditorProps {
    meetingId: string;
    initialNotes?: string;
    readOnly?: boolean;
    onSave?: (notes: string) => void;
    className?: string;
}

export function PreparationNotesEditor({
    meetingId,
    initialNotes = '',
    readOnly = false,
    onSave,
    className = ''
}: PreparationNotesEditorProps) {
    const { t } = useTranslation();
    const [notes, setNotes] = useState(initialNotes);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    useEffect(() => {
        setNotes(initialNotes || '');
    }, [initialNotes]);

    // Auto-save debouncing
    useEffect(() => {
        if (!isEditing || readOnly) return;

        const timer = setTimeout(async () => {
            await handleSave(false); // Silent save
        }, 2000); // Auto-save after 2s of inactivity

        return () => clearTimeout(timer);
    }, [notes, isEditing]);

    async function handleSave(showToast = true) {
        try {
            setSaving(true);

            const { error } = await supabase
                .from('meetings')
                .update({ preparation_notes: notes })
                .eq('id', meetingId);

            if (error) throw error;

            setLastSaved(new Date());

            if (showToast) {
                toast.success(t('preparationNotes.saved'));
            }

            if (onSave) {
                onSave(notes);
            }
        } catch (error) {
            console.error('Error saving notes:', error);
            toast.error(t('preparationNotes.saveError'));
        } finally {
            setSaving(false);
        }
    }

    if (!notes && readOnly) {
        return null;
    }

    return (
        <div className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl p-6 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {t('preparationNotes.title')}
                </h3>

                {!readOnly && (
                    <div className="flex items-center gap-2">
                        {lastSaved && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {t('preparationNotes.lastSaved', {
                                    time: lastSaved.toLocaleTimeString(undefined, {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })
                                })}
                            </span>
                        )}

                        {saving && (
                            <Loader className="w-4 h-4 animate-spin text-indigo-600" />
                        )}

                        <Button
                            variant={isEditing ? 'primary' : 'outline'}
                            size="small"
                            onClick={() => setIsEditing(!isEditing)}
                        >
                            {isEditing ? (
                                <>
                                    <Eye className="w-4 h-4 mr-2" />
                                    {t('preparationNotes.preview')}
                                </>
                            ) : (
                                <>
                                    <Edit2 className="w-4 h-4 mr-2" />
                                    {t('preparationNotes.edit')}
                                </>
                            )}
                        </Button>

                        {isEditing && (
                            <Button
                                variant="primary"
                                size="small"
                                onClick={() => handleSave(true)}
                                disabled={saving}
                            >
                                <Save className="w-4 h-4 mr-2" />
                                {t('preparationNotes.save')}
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Content */}
            {isEditing && !readOnly ? (
                <div className="relative">
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t('preparationNotes.placeholder')}
                        className="w-full min-h-[400px] p-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-vertical"
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                        {t('preparationNotes.markdownSupport')}
                    </div>
                </div>
            ) : (
                <div className="prose prose-lg dark:prose-invert max-w-none">
                    {notes ? (
                        <MarkdownRenderer content={notes} />
                    ) : (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <p>{t('preparationNotes.empty')}</p>
                            {!readOnly && (
                                <Button
                                    variant="outline"
                                    size="small"
                                    onClick={() => setIsEditing(true)}
                                    className="mt-4"
                                >
                                    <Edit2 className="w-4 h-4 mr-2" />
                                    {t('preparationNotes.startEditing')}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
