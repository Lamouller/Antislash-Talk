import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Wand2, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Meeting } from '../../lib/schemas';
import toast from 'react-hot-toast';

const REPORT_TEMPLATES = {
  summary: `Create a concise summary of the following transcription. The summary should be easy to read and highlight the key decisions and action items.`,
  detailed: `Create a detailed report from the following transcription. The report should be structured with headings and bullet points, and should include a detailed analysis of the discussion.`,
  action_items: `Extract all action items from the following transcription. The output should be a numbered list of action items, with a clear description of the action and the person responsible.`,
  minutes: `Create formal meeting minutes from the following transcription. The minutes should include the date, time, attendees, and a detailed record of the discussion, decisions, and action items.`,
};

type TemplateKey = keyof typeof REPORT_TEMPLATES | 'custom';

export default function GenerateReportScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const meetingId = searchParams.get('meetingId');
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>('summary');
  const [customPrompt, setCustomPrompt] = useState('');
  const [tokenBalance, setTokenBalance] = useState(0);
  const [availableLlms, setAvailableLlms] = useState<string[]>([]);
  const [selectedLlm, setSelectedLlm] = useState('');

  useEffect(() => {
    const fetchMeetingData = async () => {
      if (!meetingId) {
        navigate('/meetings');
        return;
      }
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate('/auth/login'); return; }

        const [meetingRes, balanceRes, profileRes, apiKeysRes] = await Promise.all([
          supabase.from('meetings').select('*').eq('id', meetingId).single(),
          supabase.rpc('get_user_token_balance', { user_id: user.id }),
          supabase.from('profiles').select('preferred_llm').eq('id', user.id).single(),
          supabase.from('api_keys').select('provider').eq('user_id', user.id)
        ]);

        const { data: meetingData, error: meetingError } = meetingRes;
        if (meetingError || !meetingData?.transcript) {
            toast.error('Meeting or transcription not found.');
            navigate(-1);
            return;
        }

        const { data: balance } = balanceRes;
        const { data: profile } = profileRes;
        const { data: apiKeys } = apiKeysRes;

        const savedProviders = apiKeys?.map(k => k.provider) || [];
        setAvailableLlms(savedProviders);

        if (profile?.preferred_llm && savedProviders.includes(profile.preferred_llm)) {
          setSelectedLlm(profile.preferred_llm);
        } else if (savedProviders.length > 0) {
          setSelectedLlm(savedProviders[0]);
        }

        setMeeting(meetingData);
        setTokenBalance(balance || 0);
      } catch (error) {
        console.error('Error loading meeting data:', error);
        toast.error('Failed to load meeting data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchMeetingData();
  }, [meetingId, navigate]);
  
  const handleGeneratePress = () => {
    const REPORT_GENERATION_COST = 5;
    if (tokenBalance < REPORT_GENERATION_COST) {
      toast((t) => (
        <span>
          You need at least {REPORT_GENERATION_COST} tokens. Purchase more?
          <Button
            onClick={() => {
              navigate('/tokens');
              toast.dismiss(t.id);
            }}
            className="ml-2"
            size="small"
          >
            Purchase
          </Button>
          <Button
            onClick={() => toast.dismiss(t.id)}
            className="ml-2"
            variant="outline"
            size="small"
          >
            Cancel
          </Button>
        </span>
      ));
      return;
    }
    
    toast((t) => (
      <span>
        This will consume {REPORT_GENERATION_COST} tokens. Proceed?
        <Button
          onClick={() => {
            generateReport();
            toast.dismiss(t.id);
          }}
          className="ml-2"
          size="small"
        >
          Proceed
        </Button>
        <Button
          onClick={() => toast.dismiss(t.id)}
          className="ml-2"
          variant="outline"
          size="small"
        >
          Cancel
        </Button>
      </span>
    ));
  };

  const generateReport = async () => {
    if (!meeting?.transcript) return;
    setIsGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth/login'); return; }
      
      const prompt = selectedTemplate === 'custom' ? customPrompt : REPORT_TEMPLATES[selectedTemplate as keyof typeof REPORT_TEMPLATES];
        
      await supabase.functions.invoke('generate-report', {
        body: { meeting_id: meetingId, transcription: meeting.transcript, prompt, user_id: user.id, llm: selectedLlm }
      });

      navigate(`/meeting/${meetingId}?tab=reports`);
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error(`Failed to generate report: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGenerating(false);
    }
  };
  
  if (isLoading) return <div className="p-6">Loading...</div>;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
            <header className="flex items-center mb-6">
                <Button variant="outline" size="small" onClick={() => navigate(-1)}><ArrowLeft size={16}/></Button>
                <h1 className="flex-1 mx-4 text-xl font-bold">Generate Report</h1>
            </header>

            <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded-md mb-6" role="alert">
                <div className="flex">
                    <div className="py-1"><Info className="h-5 w-5 text-blue-500 mr-3" /></div>
                    <div>
                        <p className="font-bold">Cost: 5 tokens</p>
                        <p className="text-sm">Your current balance is {tokenBalance} tokens.</p>
                    </div>
                </div>
            </div>

            <Card className="p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Choose a LLM</h2>
                <select
                    value={selectedLlm}
                    onChange={(e) => setSelectedLlm(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    disabled={availableLlms.length === 0}
                >
                    {availableLlms.length > 0 ? (
                      availableLlms.map(provider => (
                        <option key={provider} value={provider}>
                          {provider.charAt(0).toUpperCase() + provider.slice(1)}
                        </option>
                      ))
                    ) : (
                      <option>No API keys configured</option>
                    )}
                </select>
                {availableLlms.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Please configure an API key in your <a href="/tabs/settings" className="text-indigo-600 hover:underline">settings</a>.
                  </p>
                )}
            </Card>
            
            <Card className="p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Choose a Template</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.keys(REPORT_TEMPLATES).map((key) => (
                        <button
                            key={key}
                            onClick={() => setSelectedTemplate(key as TemplateKey)}
                            className={`p-4 rounded-lg border-2 ${selectedTemplate === key ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'}`}
                        >
                            <h3 className="font-semibold">{key.replace(/_/g, ' ')}</h3>
                            <p className="text-sm text-gray-500 mt-1">{REPORT_TEMPLATES[key as keyof typeof REPORT_TEMPLATES].substring(0, 50)}...</p>
                        </button>
                    ))}
                    <button
                        onClick={() => setSelectedTemplate('custom')}
                        className={`p-4 rounded-lg border-2 ${selectedTemplate === 'custom' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'}`}
                    >
                        <h3 className="font-semibold">Custom</h3>
                        <p className="text-sm text-gray-500 mt-1">Write your own prompt.</p>
                    </button>
                </div>
            </Card>

            {selectedTemplate === 'custom' && (
                 <Card className="p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-4">Custom Prompt</h2>
                    <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="e.g., Summarize the key decisions and action items..."
                        className="w-full h-32 p-2 border rounded-md"
                    />
                 </Card>
            )}

            <div className="mt-8">
                <Button onClick={handleGeneratePress} disabled={isGenerating} isLoading={isGenerating} size="large" className="w-full">
                    <Wand2 size={20} className="mr-2"/>
                    Generate Report
                </Button>
            </div>
        </div>
    </div>
  );
}