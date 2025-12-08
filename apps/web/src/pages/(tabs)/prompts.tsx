import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
// import { useTranslation } from 'react-i18next';
// import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Plus, Sparkles, Trash2, Edit2, Save, Wand2, FileText, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useOllama } from '../../hooks/useOllama';

interface PromptTemplate {
    id: string;
    name: string;
    description: string;
    category: 'summary' | 'title' | 'system' | 'transcript';
    content: string;
    is_favorite: boolean;
}

export default function PromptWorkshop() {
    // const { t } = useTranslation();
    // const navigate = useNavigate();
    const { generate } = useOllama(); // Using local LLM for the assistant
    const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPrompt, setEditingPrompt] = useState<Partial<PromptTemplate> | null>(null);
    const [activeTab, setActiveTab] = useState<'list' | 'editor' | 'wizard'>('list');

    // Wizard State
    const [wizardMode, setWizardMode] = useState<'describe' | 'example'>('describe');
    const [wizardInput, setWizardInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        fetchPrompts();
    }, []);

    const fetchPrompts = async () => {
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
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editingPrompt?.name || !editingPrompt?.content) {
            toast.error('Name and Content are required');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const promptData = {
                ...editingPrompt,
                user_id: user.id,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('prompt_templates')
                .upsert(promptData);

            if (error) throw error;

            toast.success('Prompt saved successfully!');
            setEditingPrompt(null);
            setActiveTab('list');
            fetchPrompts();
        } catch (error: any) {
            toast.error('Error saving prompt: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this prompt?')) return;

        try {
            const { error } = await supabase
                .from('prompt_templates')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Prompt deleted');
            fetchPrompts();
        } catch (error: any) {
            toast.error('Error deleting prompt: ' + error.message);
        }
    };

    const handleRunWizard = async () => {
        if (!wizardInput.trim()) {
            toast.error('Please provide some input');
            return;
        }

        setIsGenerating(true);
        try {
            let systemPrompt = '';
            let userPrompt = '';

            if (wizardMode === 'describe') {
                systemPrompt = "You are an expert Prompt Engineer. Your goal is to write a highly effective SYSTEM PROMPT for an LLM based on the user's description. The output should be ONLY the system prompt, ready to be pasted.";
                userPrompt = `Write a system prompt for an AI meeting assistant based on this description:\n"${wizardInput}"\n\nThe prompt should include instructions for structure, tone, and specific elements to extract. Return ONLY the prompt content.`;
            } else {
                systemPrompt = "You are an expert Prompt Engineer. Your goal is to Analyze the provided text and Reverse-Engineer a system prompt that would generate output in EXACTLY that style and structure. The output should be ONLY the system prompt.";
                userPrompt = `Analyze this document style and write a system prompt to reproduce it for future meeting summaries:\n\n=== DOCUMENT START ===\n${wizardInput.substring(0, 3000)}\n=== DOCUMENT END ===\n\nReturn ONLY the system prompt content.`;
            }

            // Try using a decent local model if available, or fallback to simple heuristics if needed
            // Here we assume useOllama is configured with a selected model (e.g. llama3)
            // If generate is not available (no model), we might need a fallback.
            // For now, we assume the user has a model selected in settings.

            const generatedContent = await generate('llama3.2:latest', `${systemPrompt}\n\n${userPrompt}`);

            setEditingPrompt({
                name: wizardMode === 'describe' ? 'New Custom Prompt' : 'Reverse Engineered Prompt',
                description: `Generated from ${wizardMode === 'describe' ? 'description' : 'example'}`,
                category: 'summary',
                content: generatedContent // Assuming generate returns string directly
            });

            setActiveTab('editor');
            toast.success('Prompt generated! You can now edit and save it.');

        } catch (error: any) {
            console.error('Wizard error:', error);
            toast.error('Failed to generate prompt. Make sure a local LLM is selected in settings.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                        {/* Translations needed */}
                        Atelier Prompts
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        Créez, gérez et testez vos templates de génération pour des rapports parfaits.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={() => {
                            setEditingPrompt({ category: 'summary', content: '' });
                            setActiveTab('editor');
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Nouveau Prompt
                    </Button>
                    <Button
                        onClick={() => setActiveTab('wizard')}
                        variant="outline"
                        className="border-purple-500 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
                    >
                        <Wand2 className="w-4 h-4 mr-2" />
                        Assistant IA
                    </Button>
                </div>
            </div>

            {activeTab === 'list' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {prompts.map((prompt) => (
                        <Card key={prompt.id} className="p-6 hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-gray-800">
                            <div className="flex justify-between items-start mb-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${prompt.category === 'summary' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                    prompt.category === 'title' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                                    }`}>
                                    {prompt.category.toUpperCase()}
                                </span>
                                <div className="flex gap-2">
                                    <button onClick={() => { setEditingPrompt(prompt); setActiveTab('editor'); }} className="text-gray-400 hover:text-blue-500">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(prompt.id)} className="text-gray-400 hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-xl font-bold mb-2">{prompt.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">
                                {prompt.description || 'No description'}
                            </p>
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg text-xs font-mono text-gray-600 dark:text-gray-400 line-clamp-3">
                                {prompt.content}
                            </div>
                        </Card>
                    ))}
                    {prompts.length === 0 && !loading && (
                        <div className="col-span-full flex flex-col items-center justify-center p-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                            <Sparkles className="w-12 h-12 text-gray-300 mb-4" />
                            <p className="text-gray-500">Aucun prompt créé pour le moment.</p>
                            <Button variant="ghost" onClick={() => setActiveTab('wizard')}>Utiliser l'Assistant IA pour démarrer</Button>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'editor' && (
                <Card className="p-6 max-w-4xl mx-auto">
                    <div className="flex items-center mb-6">
                        <Button variant="ghost" onClick={() => setActiveTab('list')} className="mr-4">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <h2 className="text-2xl font-bold">
                            {editingPrompt?.id ? 'Modifier le Prompt' : 'Créer un Prompt'}
                        </h2>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nom</label>
                                <input
                                    type="text"
                                    value={editingPrompt?.name || ''}
                                    onChange={e => setEditingPrompt(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700"
                                    placeholder="Ex: Synthèse Commerciale"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Catégorie</label>
                                <select
                                    value={editingPrompt?.category || 'summary'}
                                    onChange={e => setEditingPrompt(prev => ({ ...prev, category: e.target.value as any }))}
                                    className="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700"
                                >
                                    <option value="summary">Résumé (Summary)</option>
                                    <option value="title">Titre (Title)</option>
                                    <option value="transcript">Consignes Transcription</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Description (Optionnel)</label>
                            <input
                                type="text"
                                value={editingPrompt?.description || ''}
                                onChange={e => setEditingPrompt(prev => ({ ...prev, description: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700"
                                placeholder="Ex: Utilise un ton formel pour les décideurs."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Contenu du Prompt (System Prompt)</label>
                            <textarea
                                value={editingPrompt?.content || ''}
                                onChange={e => setEditingPrompt(prev => ({ ...prev, content: e.target.value }))}
                                className="w-full h-96 px-3 py-2 rounded-lg border font-mono text-sm dark:bg-gray-900 dark:border-gray-700"
                                placeholder="Rédigez ici les instructions pour l'IA..."
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="ghost" onClick={() => setActiveTab('list')}>Annuler</Button>
                            <Button onClick={handleSave}>
                                <Save className="w-4 h-4 mr-2" />
                                Sauvegarder
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {activeTab === 'wizard' && (
                <Card className="p-8 max-w-4xl mx-auto">
                    <div className="flex items-center mb-8">
                        <Button variant="ghost" onClick={() => setActiveTab('list')} className="mr-4">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <div>
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <Wand2 className="w-6 h-6 text-purple-600" />
                                Assistant Création de Prompt
                            </h2>
                            <p className="text-gray-500">Laissez l'IA concevoir le prompt parfait pour vous.</p>
                        </div>
                    </div>

                    <div className="flex gap-4 mb-8">
                        <button
                            onClick={() => setWizardMode('describe')}
                            className={`flex-1 p-4 rounded-xl border-2 transition-all ${wizardMode === 'describe'
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                                }`}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                                    <Sparkles className="w-5 h-5 text-purple-500" />
                                </div>
                                <h3 className="font-bold">Décrire mon besoin</h3>
                            </div>
                            <p className="text-sm text-gray-500 text-left">
                                "Je veux un résumé drôle avec des emojis..."
                            </p>
                        </button>

                        <button
                            onClick={() => setWizardMode('example')}
                            className={`flex-1 p-4 rounded-xl border-2 transition-all ${wizardMode === 'example'
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                }`}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                                    <FileText className="w-5 h-5 text-blue-500" />
                                </div>
                                <h3 className="font-bold">Analyser un exemple</h3>
                            </div>
                            <p className="text-sm text-gray-500 text-left">
                                Collez un rapport existant pour copier son style.
                            </p>
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                            <label className="block text-sm font-medium mb-2">
                                {wizardMode === 'describe'
                                    ? "Décrivez ce que vous voulez :"
                                    : "Collez votre exemple de document ici :"}
                            </label>
                            <textarea
                                value={wizardInput}
                                onChange={e => setWizardInput(e.target.value)}
                                className="w-full h-48 p-3 rounded-lg border dark:bg-gray-900 dark:border-gray-700 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                placeholder={wizardMode === 'describe'
                                    ? "Ex: Fais un résumé très structuré pour un comité de direction, en mettant l'accent sur les risques financiers..."
                                    : "Collez ici le texte d'un rapport dont vous aimez le style..."}
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button
                                onClick={handleRunWizard}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-6 rounded-xl text-lg shadow-lg hover:shadow-purple-500/25 transition-all"
                                disabled={isGenerating || !wizardInput.trim()}
                            >
                                {isGenerating ? (
                                    <>
                                        <Sparkles className="w-5 h-5 mr-2 animate-spin" />
                                        Génération en cours...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="w-5 h-5 mr-2" />
                                        Générer le Prompt
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
}
