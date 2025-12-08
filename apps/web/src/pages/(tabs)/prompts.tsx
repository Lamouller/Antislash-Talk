import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAI } from '../../hooks/useAI';
import { useTranslation } from 'react-i18next';
// import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Plus, Sparkles, Trash2, Edit3, Save, Wand2, FileText, ArrowLeft, Loader2, MessageSquare, Bot, Star } from 'lucide-react';
import toast from 'react-hot-toast';

interface PromptTemplate {
    id?: string;
    name: string;
    description: string;
    category: 'summary' | 'title' | 'system' | 'transcript' | 'custom';
    content: string;
    is_favorite: boolean;
    user_id?: string;
    created_at?: string;
    updated_at?: string;
}

export default function PromptWorkshopScreen() {
    const { t } = useTranslation();
    // const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'list' | 'assistant' | 'editor'>('list');
    const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);

    // Wizard State
    const [wizardMode, setWizardMode] = useState<'analyze' | 'describe'>('describe');
    const [wizardInput, setWizardInput] = useState('');
    const [wizardOutput, setWizardOutput] = useState('');

    // Use unified AI hook
    const { generate, isGenerating } = useAI();

    useEffect(() => {
        fetchPrompts();
    }, []);

    async function fetchPrompts() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('prompt_templates')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPrompts(data || []);
        } catch (error) {
            console.error('Error fetching prompts:', error);
            toast.error('Failed to load prompts');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm(t('prompts.delete_confirmation'))) return;

        try {
            const { error } = await supabase
                .from('prompt_templates')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setPrompts(prev => prev.filter(p => p.id !== id));
            toast.success(t('prompts.delete_success'));
        } catch (error: any) {
            toast.error(t('prompts.delete_error') + ': ' + error.message);
        }
    }

    async function handleSave(template: Partial<PromptTemplate>) {
        if (!template?.name || !template?.content) {
            toast.error('Name and Content are required');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const payload = {
                ...template,
                user_id: user.id,
                updated_at: new Date().toISOString(),
            };

            if (template.id) {
                // Update
                const { error } = await supabase
                    .from('prompt_templates')
                    .update(payload)
                    .eq('id', template.id);
                if (error) throw error;
                toast.success(t('prompts.save_success'));
            } else {
                // Create
                const { error } = await supabase
                    .from('prompt_templates')
                    .insert(payload);
                if (error) throw error;
                toast.success(t('prompts.create_success'));
            }

            await fetchPrompts();
            setActiveTab('list');
            setEditingPrompt(null);
        } catch (error: any) {
            toast.error(t('prompts.save_error') + ': ' + error.message);
        }
    }

    const handleRunWizard = async () => {
        if (!wizardInput.trim()) {
            toast.error('Please provide some input');
            return;
        }

        try {
            let systemPrompt = '';
            let userPrompt = '';

            if (wizardMode === 'describe') {
                systemPrompt = `Tu es un expert en Prompt Engineering pour les modèles LLM (GPT-4, Claude, Llama).
Ta mission est de rédiger un "System Prompt" parfait pour un assistant de réunion IA.
L'utilisateur va te décrire son besoin (ex: "Je veux un résumé drôle").
Tu dois générer le prompt système exact qui permettra à l'IA de se comporter ainsi.

Règles:
1. Réponds UNIQUEMENT par le prompt système. Pas de bla-bla avant ou après.
2. Le prompt doit être en anglais ou français selon la langue de la demande, mais optimisé pour l'IA.
3. Inclus des instructions sur le ton, le format, et la structure.`;
                userPrompt = `Besoin utilisateur: "${wizardInput}"\n\nGénère le System Prompt optimisé:`;
            } else {
                systemPrompt = `Tu es un expert en "Reverse Engineering" de prompts.
L'utilisateur va te fournir un exemple de rapport ou de résumé.
Ta mission est de déduire le "System Prompt" qui a permis de générer ce résultat.
Analyse le ton, la structure, la longueur, et le style.

Règles:
1. Réponds UNIQUEMENT par le prompt système reconstitué.
2. Sois précis sur les instructions de formatage (gras, listes, etc.).`;
                userPrompt = `Exemple de contenu:\n---\n${wizardInput}\n---\n\nGénère le System Prompt qui produirait ce résultat:`;
            }

            // Use useAI hook
            const result = await generate({
                systemPrompt,
                userPrompt
            });

            setWizardOutput(result);
            toast.success(t('prompts.wizard_success'));
        } catch (error: any) {
            console.error('Wizard error:', error);
            toast.error(t('prompts.wizard_error') + ': ' + error.message);
        }
    };

    const copyWizardToEditor = () => {
        setEditingPrompt({
            name: 'Nouveau Prompt IA',
            description: 'Généré par l\'assistant',
            category: 'custom',
            content: wizardOutput,
            is_favorite: false
        } as PromptTemplate);
        setActiveTab('editor');
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
            {/* Header */}
            <header className="flex-none bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-6">
                <div className="flex items-center justify-between max-w-6xl mx-auto w-full">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            {t('prompts.title')}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                            {t('prompts.subtitle')}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        {/* Tabs Navigation */}
                        <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                            <button
                                onClick={() => setActiveTab('list')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'list'
                                        ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                                    }`}
                            >
                                {t('prompts.tabs.my_prompts')}
                            </button>
                            <button
                                onClick={() => setActiveTab('assistant')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'assistant'
                                        ? 'bg-white dark:bg-slate-600 text-purple-600 dark:text-purple-400 shadow-sm'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                                    }`}
                            >
                                <Wand2 className="w-4 h-4" />
                                {t('prompts.tabs.assistant')}
                            </button>
                        </div>
                        <Button onClick={() => {
                            setEditingPrompt({ name: '', description: '', category: 'custom', content: '', is_favorite: false } as PromptTemplate);
                            setActiveTab('editor');
                        }}>
                            <Plus className="w-4 h-4 mr-2" />
                            {t('prompts.new_prompt')}
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-8">
                <div className="max-w-6xl mx-auto w-full">

                    {/* LIST VIEW */}
                    {activeTab === 'list' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {prompts.map(prompt => (
                                <Card key={prompt.id} className="p-6 hover:shadow-lg transition-shadow border-slate-200 dark:border-slate-700">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        {prompt.is_favorite && <Star className="w-5 h-5 text-yellow-400 fill-current" />}
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{prompt.name}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 line-clamp-2">{prompt.description}</p>
                                    <div className="flex justify-between items-center mt-auto">
                                        <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                            {prompt.category}
                                        </span>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => {
                                                setEditingPrompt(prompt);
                                                setActiveTab('editor');
                                            }}>
                                                <Edit3 className="w-4 h-4 text-slate-600" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(prompt.id!)}>
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}

                            {/* Empty State */}
                            {prompts.length === 0 && !isLoading && (
                                <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
                                        <Sparkles className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">{t('prompts.empty_title')}</h3>
                                    <p className="text-slate-500 mb-6 max-w-md">{t('prompts.empty_description')}</p>
                                    <Button variant="outline" onClick={() => setActiveTab('assistant')}>
                                        <Wand2 className="w-4 h-4 mr-2" />
                                        {t('prompts.try_assistant')}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* EDITOR VIEW */}
                    {activeTab === 'editor' && editingPrompt && (
                        <div className="max-w-3xl mx-auto">
                            <Button variant="ghost" onClick={() => setActiveTab('list')} className="mb-4">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                {t('common.back')}
                            </Button>
                            <Card className="p-8">
                                <h2 className="text-xl font-bold mb-6">
                                    {editingPrompt.id ? t('prompts.edit_title') : t('prompts.create_title')}
                                </h2>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">{t('prompts.form.name')}</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded-md dark:bg-slate-800 dark:border-slate-700"
                                            value={editingPrompt.name}
                                            onChange={e => setEditingPrompt({ ...editingPrompt, name: e.target.value })}
                                            placeholder="Ex: Résumé Exécutif"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">{t('prompts.form.category')}</label>
                                            <select
                                                className="w-full p-2 border rounded-md dark:bg-slate-800 dark:border-slate-700"
                                                value={editingPrompt.category}
                                                onChange={e => setEditingPrompt({ ...editingPrompt, category: e.target.value as any })}
                                            >
                                                <option value="summary">Summary</option>
                                                <option value="title">Title</option>
                                                <option value="transcript">Transcript</option>
                                                <option value="custom">Custom</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center pt-6">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={editingPrompt.is_favorite}
                                                    onChange={e => setEditingPrompt({ ...editingPrompt, is_favorite: e.target.checked })}
                                                    className="w-4 h-4 rounded border-slate-300"
                                                />
                                                <span className="text-sm font-medium">{t('prompts.form.favorite')}</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">{t('prompts.form.description')}</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded-md dark:bg-slate-800 dark:border-slate-700"
                                            value={editingPrompt.description}
                                            onChange={e => setEditingPrompt({ ...editingPrompt, description: e.target.value })}
                                            placeholder="Ex: Utilise un ton formel..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">{t('prompts.form.content')}</label>
                                        <textarea
                                            className="w-full p-4 border rounded-md font-mono text-sm h-64 dark:bg-slate-800 dark:border-slate-700"
                                            value={editingPrompt.content}
                                            onChange={e => setEditingPrompt({ ...editingPrompt, content: e.target.value })}
                                            placeholder="You are an AI assistant..."
                                        />
                                        <p className="text-xs text-slate-500 mt-2">
                                            {t('prompts.form.tips')}
                                        </p>
                                    </div>
                                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                                        <Button variant="ghost" onClick={() => setActiveTab('list')}>{t('common.cancel')}</Button>
                                        <Button onClick={() => handleSave(editingPrompt)}>
                                            <Save className="w-4 h-4 mr-2" />
                                            {t('common.save')}
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* ASSISTANT WIZARD VIEW */}
                    {activeTab === 'assistant' && (
                        <div className="max-w-4xl mx-auto">
                            <Button variant="ghost" onClick={() => setActiveTab('list')} className="mb-4">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                {t('common.back')}
                            </Button>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Left: Input */}
                                <Card className="p-6">
                                    <div className="flex gap-4 mb-6">
                                        <button
                                            onClick={() => setWizardMode('describe')}
                                            className={`flex-1 p-3 rounded-lg border text-center transition-all ${wizardMode === 'describe'
                                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                                                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                                }`}
                                        >
                                            <MessageSquare className="w-6 h-6 mx-auto mb-2" />
                                            <div className="font-semibold text-sm">{t('prompts.wizard.mode_describe')}</div>
                                        </button>
                                        <button
                                            onClick={() => setWizardMode('analyze')}
                                            className={`flex-1 p-3 rounded-lg border text-center transition-all ${wizardMode === 'analyze'
                                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                                }`}
                                        >
                                            <Bot className="w-6 h-6 mx-auto mb-2" />
                                            <div className="font-semibold text-sm">{t('prompts.wizard.mode_analyze')}</div>
                                        </button>
                                    </div>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-2">
                                            {wizardMode === 'describe' ? t('prompts.wizard.input_describe_label') : t('prompts.wizard.input_analyze_label')}
                                        </label>
                                        <textarea
                                            value={wizardInput}
                                            onChange={e => setWizardInput(e.target.value)}
                                            className="w-full p-4 border rounded-lg h-48 resize-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-800 dark:border-slate-700"
                                            placeholder={wizardMode === 'describe'
                                                ? "Ex: Je veux un résumé très court, orienté action, avec des emojis pour les bonnes nouvelles."
                                                : "Collez ici un exemple de rapport parfait que vous avez déjà..."
                                            }
                                        />
                                    </div>

                                    <Button
                                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                                        disabled={!wizardInput.trim() || isGenerating}
                                        onClick={handleRunWizard}
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                {t('prompts.wizard.generating')}...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4 mr-2" />
                                                {t('prompts.wizard.generate_btn')}
                                            </>
                                        )}
                                    </Button>
                                </Card>

                                {/* Right: Output */}
                                <div className="space-y-4">
                                    {wizardOutput ? (
                                        <Card className="p-6 h-full flex flex-col bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="font-semibold flex items-center gap-2">
                                                    <Bot className="w-5 h-5 text-purple-600" />
                                                    {t('prompts.wizard.result_title')}
                                                </h3>
                                            </div>
                                            <div className="flex-1 bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs overflow-y-auto mb-4 whitespace-pre-wrap">
                                                {wizardOutput}
                                            </div>
                                            <Button onClick={copyWizardToEditor} className="w-full">
                                                <Edit3 className="w-4 h-4 mr-2" />
                                                {t('prompts.wizard.use_btn')}
                                            </Button>
                                        </Card>
                                    ) : (
                                        <div className="h-full border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                                            <Wand2 className="w-12 h-12 mb-4 opacity-50" />
                                            <p>{t('prompts.wizard.placeholder')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
