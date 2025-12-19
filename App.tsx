
import React, { useState, useRef, useEffect } from 'react';
import { AppStatus, Message } from './types';
import { analyzeImageAndWriteStory, generateNarration, chatWithGemini } from './services/geminiService';
import { decode, decodeAudioData } from './utils/audioUtils';

export default function App() {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [image, setImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [story, setStory] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isNarrating, setIsNarrating] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        processImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (base64: string) => {
    try {
      setStatus(AppStatus.ANALYZING);
      const result = await analyzeImageAndWriteStory(base64);
      setAnalysis(result.analysis);
      setStory(result.story);
      setStatus(AppStatus.READY);
      
      // Initial chat welcome
      setMessages([{
        role: 'model',
        text: `The image suggests a powerful atmosphere of ${result.analysis.split('.')[0].toLowerCase()}. How should we develop this world?`
      }]);
    } catch (err) {
      console.error(err);
      setStatus(AppStatus.ERROR);
    }
  };

  const handleNarrate = async () => {
    if (isNarrating || !story) return;
    setIsNarrating(true);

    try {
      const base64Audio = await generateNarration(story);
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setIsNarrating(false);
        source.start();
      }
    } catch (err) {
      console.error("Narration failed", err);
      setIsNarrating(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatLoading(true);

    try {
      // Create simple context for the model
      const contextPrompt = `Regarding the story: "${story.substring(0, 500)}...", ${userMsg}`;
      const response = await chatWithGemini([], contextPrompt);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', text: "Forgive me, my creative thoughts are tangled. Could you ask again?" }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-slate-950 text-slate-200">
      
      {/* Left Panel: Studio & Story */}
      <main className="flex-1 overflow-y-auto p-6 md:p-12 space-y-12">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold serif bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">
              Ink & Image
            </h1>
            <p className="text-slate-400 mt-2 font-light">Visual inspiration meets literary craft.</p>
          </div>
          {status !== AppStatus.IDLE && (
            <button 
              onClick={() => { setStatus(AppStatus.IDLE); setImage(null); setStory(''); setMessages([]); }}
              className="px-4 py-2 rounded-full border border-slate-700 text-sm hover:bg-slate-800 transition-colors"
            >
              New Draft
            </button>
          )}
        </header>

        {status === AppStatus.IDLE ? (
          <div className="max-w-2xl mx-auto py-20 text-center">
            <div className="relative group cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              <div className="p-16 border-2 border-dashed border-slate-700 rounded-3xl bg-slate-900 group-hover:border-amber-500/50 transition-all">
                <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold mb-2">Upload a scene</h2>
                <p className="text-slate-500">The AI will dream up a story from the pixels.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Image Preview */}
            <div className="space-y-4">
              <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-900 aspect-video">
                {image && <img src={image} alt="Inspiration" className="w-full h-full object-cover" />}
              </div>
              <div className="p-6 bg-slate-900/50 rounded-3xl border border-slate-800">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-3">Analysis</h3>
                <p className="text-slate-400 italic font-light leading-relaxed">{status === AppStatus.ANALYZING ? "Scanning textures and emotions..." : analysis}</p>
              </div>
            </div>

            {/* Story Content */}
            <div className="space-y-8 bg-slate-900 p-8 md:p-12 rounded-[2rem] border border-slate-800 relative">
              <div className="absolute top-6 right-6 flex gap-2">
                <button 
                  onClick={handleNarrate}
                  disabled={isNarrating || status === AppStatus.ANALYZING}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all ${isNarrating ? 'bg-amber-500 text-slate-950 scale-95' : 'bg-slate-800 text-amber-400 hover:bg-slate-700'}`}
                >
                  {isNarrating ? (
                    <>
                      <div className="flex gap-1">
                        <span className="w-1 h-3 bg-slate-950 animate-bounce"></span>
                        <span className="w-1 h-3 bg-slate-950 animate-bounce delay-75"></span>
                        <span className="w-1 h-3 bg-slate-950 animate-bounce delay-150"></span>
                      </div>
                      <span>Reading...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                      <span>Read Aloud</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-8">
                {status === AppStatus.ANALYZING ? (
                  <div className="space-y-4">
                    <div className="h-6 bg-slate-800 rounded-full w-3/4 animate-pulse"></div>
                    <div className="h-6 bg-slate-800 rounded-full w-full animate-pulse"></div>
                    <div className="h-6 bg-slate-800 rounded-full w-5/6 animate-pulse"></div>
                    <div className="h-6 bg-slate-800 rounded-full w-2/3 animate-pulse"></div>
                  </div>
                ) : (
                  <div className="serif text-2xl md:text-3xl leading-relaxed text-slate-100 first-letter:text-6xl first-letter:font-bold first-letter:mr-3 first-letter:float-left first-letter:text-amber-500">
                    {story}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Right Panel: Chat Sidebar */}
      <aside className="w-full md:w-[400px] bg-slate-900 border-l border-slate-800 flex flex-col h-[500px] md:h-screen">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <h2 className="font-semibold text-slate-200">World-Building Consultant</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-slate-500 mt-20 italic">
              Upload an image to start brainstorming with the AI.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                m.role === 'user' 
                  ? 'bg-amber-600 text-white rounded-tr-none' 
                  : 'bg-slate-800 text-slate-300 rounded-tl-none border border-slate-700'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-none border border-slate-700 flex gap-1">
                <span className="w-1.5 h-1.5 bg-slate-600 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-slate-600 rounded-full animate-bounce delay-75"></span>
                <span className="w-1.5 h-1.5 bg-slate-600 rounded-full animate-bounce delay-150"></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50">
          <form onSubmit={handleSendMessage} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about the world..."
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all pr-12 text-slate-100"
              disabled={status === AppStatus.IDLE || chatLoading}
            />
            <button 
              type="submit"
              disabled={!input.trim() || chatLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500 hover:text-amber-400 disabled:text-slate-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
          <p className="text-[10px] text-slate-600 mt-3 text-center uppercase tracking-widest">Powered by Gemini 3 Pro</p>
        </div>
      </aside>
    </div>
  );
}
