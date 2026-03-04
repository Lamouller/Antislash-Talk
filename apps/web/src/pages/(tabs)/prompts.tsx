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
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header with safe area for Dynamic Island */}
            <header
                className="flex-none bg-white/20 backdrop-blur-xl border-b border-gray-300/30 px-8 pb-6"
                style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)' }}
            >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 max-w-6xl mx-auto w-full">
                    <div>
                        <h1 className="text-2xl font-bold text-black tracking-tight flex items-center gap-3">
                            <div className="p-2.5 bg-gray-100/80 rounded-xl">
                                <Sparkles className="w-6 h-6 text-gray-700" />
                            </div>
                            {t('prompts.title')}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            {t('prompts.subtitle')}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                        {/* Tabs Navigation */}
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                            <button
                                onClick={() => setActiveTab('list')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'list'
                                    ? 'bg-black text-white shadow-sm'
                                    : 'text-gray-600 hover:text-black'
                                    }`}
                            >
                                {t('prompts.tabs.my_prompts')}
                            </button>
                            <button
                                onClick={() => setActiveTab('assistant')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'assistant'
                                    ? 'bg-black text-white shadow-sm'
                                    : 'text-gray-600 hover:text-black'
                                    }`}
                            >
                                <Wand2 className="w-4 h-4" />
                                {t('prompts.tabs.assistant')}
                            </button>
                        </div>
                        <Button onClick={() => {
                            setEditingPrompt({ name: '', description: '', category: 'custom', content: '', is_favorite: false } as PromptTemplate);
                            setActiveTab('editor');
                        }} className="bg-black text-white rounded-xl hover:bg-gray-800 active:scale-[0.98] shadow-lg shadow-black/10">
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
                                <Card key={prompt.id} className="p-6 bg-white/20 backdrop-blur-xl border border-gray-300/30 shadow-lg shadow-black/5 rounded-2xl hover:shadow-xl hover:shadow-black/10 transition-all duration-200">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-2.5 bg-gray-100/80 rounded-xl">
                                            <FileText className="w-6 h-6 text-gray-700" />
                                        </div>
                                        {prompt.is_favorite && <Star className="w-5 h-5 text-gray-700 fill-current" />}
                                    </div>
                                    <h3 className="text-lg font-semibold text-black mb-2">{prompt.name}</h3>
                                    <p className="text-gray-500 text-sm mb-4 line-clamp-2">{prompt.description}</p>
                                    <div className="flex justify-between items-center mt-auto">
                                        <span className="bg-gray-100 text-gray-700 border border-gray-200 rounded-full text-xs px-2.5 py-1">
                                            {prompt.category}
                                        </span>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="small" onClick={() => {
                                                setEditingPrompt(prompt);
                                                setActiveTab('editor');
                                            }} className="text-gray-600 hover:bg-gray-100 hover:text-black rounded-xl">
                                                <Edit3 className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="small" onClick={() => handleDelete(prompt.id!)} className="text-gray-600 hover:bg-gray-100 hover:text-black rounded-xl">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}

                            {/* Empty State */}
                            {prompts.length === 0 && !isLoading && (
                                <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-gray-300 rounded-2xl">
                                    <div className="p-4 bg-gray-100 rounded-full mb-4">
                                        <Sparkles className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <h3 className="text-lg font-medium text-black mb-2">{t('prompts.empty_title')}</h3>
                                    <p className="text-gray-500 mb-6 max-w-md">{t('prompts.empty_description')}</p>
                                    <Button variant="outline" onClick={() => setActiveTab('assistant')} className="text-gray-600 hover:bg-gray-100 hover:text-black rounded-xl">
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
                            <Button variant="ghost" onClick={() => setActiveTab('list')} className="mb-4 text-gray-600 hover:bg-gray-100 hover:text-black rounded-xl">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                {t('common.back')}
                            </Button>
                            <Card className="p-8 bg-white/20 backdrop-blur-xl border border-gray-300/30 shadow-lg shadow-black/5 rounded-2xl">
                                <h2 className="text-xl font-bold text-black mb-6">
                                    {editingPrompt.id ? t('prompts.edit_title') : t('prompts.create_title')}
                                </h2>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-black mb-2">{t('prompts.form.name')}</label>
                                        <input
                                            type="text"
                                            className="w-full h-12 px-4 bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-black focus:bg-white focus:shadow-lg focus:shadow-black/5 outline-none transition-all"
                                            value={editingPrompt.name}
                                            onChange={e => setEditingPrompt({ ...editingPrompt, name: e.target.value })}
                                            placeholder="Ex: Résumé Exécutif"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-black mb-2">{t('prompts.form.category')}</label>
                                            <select
                                                className="w-full h-12 px-4 bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-xl text-gray-900 focus:border-black focus:bg-white focus:shadow-lg focus:shadow-black/5 outline-none transition-all"
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
                                                    className="w-4 h-4 rounded border-gray-300"
                                                />
                                                <span className="text-sm font-medium text-black">{t('prompts.form.favorite')}</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-black mb-2">{t('prompts.form.description')}</label>
                                        <input
                                            type="text"
                                            className="w-full h-12 px-4 bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-black focus:bg-white focus:shadow-lg focus:shadow-black/5 outline-none transition-all"
                                            value={editingPrompt.description}
                                            onChange={e => setEditingPrompt({ ...editingPrompt, description: e.target.value })}
                                            placeholder="Ex: Utilise un ton formel..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-black mb-2">{t('prompts.form.content')}</label>
                                        <textarea
                                            className="w-full p-4 bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-black focus:bg-white focus:shadow-lg focus:shadow-black/5 outline-none transition-all font-mono text-sm h-64"
                                            value={editingPrompt.content}
                                            onChange={e => setEditingPrompt({ ...editingPrompt, content: e.target.value })}
                                            placeholder="You are an AI assistant..."
                                        />
                                        <p className="text-xs text-gray-500 mt-2">
                                            {t('prompts.form.tips')}
                                        </p>
                                    </div>
                                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                        <Button variant="ghost" onClick={() => setActiveTab('list')} className="text-gray-600 hover:bg-gray-100 hover:text-black rounded-xl">{t('common.cancel')}</Button>
                                        <Button onClick={() => handleSave(editingPrompt)} className="bg-black text-white rounded-xl hover:bg-gray-800 active:scale-[0.98] shadow-lg shadow-black/10">
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
                            <Button variant="ghost" onClick={() => setActiveTab('list')} className="mb-4 text-gray-600 hover:bg-gray-100 hover:text-black rounded-xl">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                {t('common.back')}
                            </Button>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Left: Input */}
                                <Card className="p-6 bg-white/20 backdrop-blur-xl border border-gray-300/30 shadow-lg shadow-black/5 rounded-2xl">
                                    <div className="flex gap-4 mb-6">
                                        <button
                                            onClick={() => setWizardMode('describe')}
                                            className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${wizardMode === 'describe'
                                                ? 'border-black bg-gray-50 text-black'
                                                : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                                                }`}
                                        >
                                            <MessageSquare className="w-6 h-6 mx-auto mb-2" />
                                            <div className="font-semibold text-sm">{t('prompts.wizard.mode_describe')}</div>
                                        </button>
                                        <button
                                            onClick={() => setWizardMode('analyze')}
                                            className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${wizardMode === 'analyze'
                                                ? 'border-black bg-gray-50 text-black'
                                                : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                                                }`}
                                        >
                                            <Bot className="w-6 h-6 mx-auto mb-2" />
                                            <div className="font-semibold text-sm">{t('prompts.wizard.mode_analyze')}</div>
                                        </button>
                                    </div>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-black mb-2">
                                            {wizardMode === 'describe' ? t('prompts.wizard.input_describe_label') : t('prompts.wizard.input_analyze_label')}
                                        </label>
                                        <textarea
                                            value={wizardInput}
                                            onChange={e => setWizardInput(e.target.value)}
                                            className="w-full p-4 bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-black focus:bg-white focus:shadow-lg focus:shadow-black/5 outline-none transition-all h-48 resize-none"
                                            placeholder={wizardMode === 'describe'
                                                ? "Ex: Je veux un résumé très court, orienté action, avec des emojis pour les bonnes nouvelles."
                                                : "Collez ici un exemple de rapport parfait que vous avez déjà..."
                                            }
                                        />
                                    </div>

                                    <Button
                                        className="w-full bg-black text-white rounded-xl hover:bg-gray-800 active:scale-[0.98] shadow-lg shadow-black/10"
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
                                        <Card className="p-6 h-full flex flex-col bg-white/20 backdrop-blur-xl border border-gray-300/30 shadow-lg shadow-black/5 rounded-2xl">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="font-semibold text-black flex items-center gap-2">
                                                    <Bot className="w-5 h-5 text-gray-700" />
                                                    {t('prompts.wizard.result_title')}
                                                </h3>
                                            </div>
                                            <div className="flex-1 bg-white/60 p-4 rounded-xl border border-gray-200 font-mono text-xs overflow-y-auto mb-4 whitespace-pre-wrap text-gray-900">
                                                {wizardOutput}
                                            </div>
                                            <Button onClick={copyWizardToEditor} className="w-full bg-black text-white rounded-xl hover:bg-gray-800 active:scale-[0.98] shadow-lg shadow-black/10">
                                                <Edit3 className="w-4 h-4 mr-2" />
                                                {t('prompts.wizard.use_btn')}
                                            </Button>
                                        </Card>
                                    ) : (
                                        <div className="h-full border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center text-gray-400 p-8 text-center">
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
