import React, { useState, useRef, useEffect } from 'react';
import { AppStatus, StoryPart } from './types';
import { analyseImageAndWriteStory, generateNarration, extendStory, generateStoryImage } from './services/geminiService';
import { decode, decodeAudioData } from './utils/audioUtils';

const TONES = [
  { id: 'mystery', label: 'Mystery', icon: '🔍', color: 'border-purple-500 text-purple-400 bg-purple-500/10' },
  { id: 'adventure', label: 'Adventure', icon: '⚔️', color: 'border-orange-500 text-orange-400 bg-orange-500/10' },
  { id: 'romance', label: 'Romance', icon: '❤️', color: 'border-pink-500 text-pink-400 bg-pink-500/10' },
  { id: 'gothic', label: 'Gothic', icon: '🏰', color: 'border-slate-500 text-slate-400 bg-slate-500/10' },
  { id: 'cyberpunk', label: 'Cyberpunk', icon: '🤖', color: 'border-cyan-500 text-cyan-400 bg-cyan-500/10' },
  { id: 'whimsical', label: 'Whimsical', icon: '✨', color: 'border-amber-500 text-amber-400 bg-amber-500/10' },
  { id: 'sci-fi', label: 'Sci-Fi', icon: '🚀', color: 'border-indigo-500 text-indigo-400 bg-indigo-500/10' },
  { id: 'horror', label: 'Horror', icon: '👻', color: 'border-red-600 text-red-500 bg-red-600/10' },
];

const VISUAL_STYLES = [
  { id: 'original', label: "Don't change", icon: '🖼️', prompt: "Maintain the exact same art style, lighting, and medium as the reference image." },
  { id: 'oil-painting', label: 'Oil Painting', icon: '🎨', prompt: "Render in the style of a classical oil painting with thick brushstrokes and rich, canvas textures." },
  { id: 'sketch', label: 'Pencil Sketch', icon: '✏️', prompt: "Render as a detailed graphite pencil sketch on textured paper." },
  { id: 'ghibli', label: 'Studio Ghibli', icon: '☁️', prompt: "Render in a whimsical hand-painted anime style similar to Studio Ghibli, with soft lighting and vibrant colours." },
  { id: 'noir', label: 'Film Noir', icon: '🎥', prompt: "Render in high-contrast black and white film noir style, with dramatic shadows and atmospheric fog." },
  { id: 'synthwave', label: 'Synthwave', icon: '🌆', prompt: "Render in a synthwave aesthetic with vibrant neons, retro-futuristic grids, and 80s digital textures." },
  { id: 'watercolor', label: 'Watercolour', icon: '🖌️', prompt: "Render in a delicate watercolour style with soft edges, fluid colour bleeds, and visible paper grain." },
  { id: 'pop-art', label: 'Pop Art', icon: '🗯️', prompt: "Render in a bold Pop Art style with vibrant, saturated colours, thick black outlines, and Ben-Day dot patterns." },
  { id: 'steampunk', label: 'Steampunk', icon: '⚙️', prompt: "Render in a steampunk aesthetic featuring sepia tones, polished brass, intricate gears, and Victorian industrial machinery." },
  { id: 'pixel-art', label: 'Pixel Art', icon: '👾', prompt: "Render as high-quality 16-bit pixel art with a limited colour palette and clean, blocky structures." },
  { id: 'impressionist', label: 'Impressionist', icon: '🌅', prompt: "Render in an impressionist style with visible dabs of vibrant colour, emphasising the play of light and movement over detail." },
  { id: 'ukiyo-e', label: 'Ukiyo-e', icon: '🌊', prompt: "Render in the style of traditional Japanese woodblock prints (Ukiyo-e), with flat colour areas and elegant line work." },
  { id: '3d-render', label: '3D Render', icon: '🧊', prompt: "Render as a high-fidelity modern CGI 3D model, with realistic lighting, smooth surfaces, and depth of field." },
  { id: 'charcoal', label: 'Charcoal', icon: '🌑', prompt: "Render as a rough charcoal drawing on heavy paper, with deep blacks, smudged shadows, and tactile textures." },
  { id: 'cybernetic', label: 'Cybernetic', icon: '⚡', prompt: "Render with a high-tech digital overlay, featuring neon circuit lines, holographic glitches, and data-stream aesthetics." },
  { id: 'paper-cutout', label: 'Paper Cutout', icon: '✂️', prompt: "Render as a layered paper cutout diorama, with distinct shadows between physical layers and a handcrafted craft feel." },
];

export default function App() {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [setupStep, setSetupStep] = useState(1);
  const [initialImage, setInitialImage] = useState<string | null>(null);
  const [storyTitle, setStoryTitle] = useState<string>('Graphic Novel Creator');
  const [storyParts, setStoryParts] = useState<StoryPart[]>([]);
  const [selectedTone, setSelectedTone] = useState<string>(TONES[0].id);
  const [selectedStyle, setSelectedStyle] = useState<string>(VISUAL_STYLES[0].id);
  const [narrativeHint, setNarrativeHint] = useState<string>('');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  
  // Narration tracking
  const [narratingIndex, setNarratingIndex] = useState<number | null>(null);
  const [isNarrationLoading, setIsNarrationLoading] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    if (status === AppStatus.READY || status === AppStatus.EXTENDING) {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [storyParts, status]);

  const handleOpenKeyDialog = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setInitialImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const processInitialScene = async () => {
    if (!initialImage) return;
    try {
      setStatus(AppStatus.ANALYSING);
      
      const result = await analyseImageAndWriteStory(initialImage, selectedTone, narrativeHint);
      setStoryTitle(result.title);
      
      let finalInitialImage = initialImage;
      if (selectedStyle !== 'original') {
        const styleObj = VISUAL_STYLES.find(s => s.id === selectedStyle);
        const styleInstruction = styleObj?.prompt || VISUAL_STYLES[0].prompt;
        const transformed = await generateStoryImage(initialImage, result.visualPrompt, styleInstruction);
        if (transformed) {
          finalInitialImage = transformed;
        }
      }

      setStoryParts([{ text: result.story, imageUrl: finalInitialImage }]);
      setStatus(AppStatus.READY);
    } catch (err: any) {
      if (err?.message?.includes("Requested entity was not found.")) {
        setHasApiKey(false);
        handleOpenKeyDialog();
      }
      console.error(err);
      setStatus(AppStatus.ERROR);
    }
  };

  const handleContinueStory = async () => {
    if (!initialImage || storyParts.length === 0 || status === AppStatus.EXTENDING) return;
    
    try {
      setStatus(AppStatus.EXTENDING);
      
      // Get the image from the last chapter to use as a visual reference for character/scene consistency
      const lastPart = storyParts[storyParts.length - 1];
      const referenceImage = lastPart.imageUrl || initialImage;
      
      const fullText = storyParts.map(p => p.text).join("\n\n");
      const { nextPart, visualPrompt } = await extendStory(initialImage, fullText, selectedTone);
      
      const styleObj = VISUAL_STYLES.find(s => s.id === selectedStyle);
      const styleInstruction = styleObj?.prompt || VISUAL_STYLES[0].prompt;
      
      // Use the last chapter's image as the structural and character design reference
      const newImageUrl = await generateStoryImage(referenceImage, visualPrompt, styleInstruction);
      
      setStoryParts(prev => [...prev, { text: nextPart, imageUrl: newImageUrl || referenceImage }]);
      setStatus(AppStatus.READY);
    } catch (err: any) {
      if (err?.message?.includes("Requested entity was not found.")) {
        setHasApiKey(false);
        handleOpenKeyDialog();
      }
      console.error("Failed to extend story", err);
      setStatus(AppStatus.ERROR);
    }
  };

  const handleShare = async () => {
    const fullText = storyParts.map((p, i) => `Chapter ${i + 1}:\n${p.text}`).join('\n\n');
    
    let shareUrl = '';
    try {
      const currentUrl = window.location.href;
      if (currentUrl.startsWith('http')) {
        shareUrl = currentUrl;
      }
    } catch (e) {}

    if (navigator.share) {
      try {
        const shareData: ShareData = {
          title: `Graphic Novel Creator: ${storyTitle}`,
          text: `Read this ${selectedTone} story I created with AI:\n\n${fullText}`,
        };
        
        if (shareUrl) {
          shareData.url = shareUrl;
        }

        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Sharing failed', err);
          try {
            await navigator.clipboard.writeText(fullText);
            alert("Sharing failed. Story text has been copied to clipboard instead.");
          } catch (clipErr) {}
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(fullText);
        alert("Story text copied to clipboard!");
      } catch (clipErr) {}
    }
  };

  const stopNarration = () => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (e) {}
      sourceRef.current = null;
    }
    setNarratingIndex(null);
    setIsNarrationLoading(false);
  };

  const handleNarrateSegment = async (index: number) => {
    if (narratingIndex === index) {
      stopNarration();
      return;
    }

    stopNarration();
    const part = storyParts[index];
    if (!part) return;

    setNarratingIndex(index);
    setIsNarrationLoading(true);

    try {
      const base64Audio = await generateNarration(part.text);
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') await ctx.resume();

        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => {
          setNarratingIndex(null);
          sourceRef.current = null;
        };
        sourceRef.current = source;
        setIsNarrationLoading(false);
        source.start();
      } else {
        stopNarration();
      }
    } catch (err: any) {
      if (err?.message?.includes("Requested entity was not found.")) {
        setHasApiKey(false);
        handleOpenKeyDialog();
      }
      console.error("Narration failed", err);
      stopNarration();
    }
  };

  const resetDraft = () => {
    stopNarration();
    setStatus(AppStatus.IDLE);
    setSetupStep(1);
    setInitialImage(null);
    setStoryTitle('Graphic Novel Creator');
    setStoryParts([]);
    setNarrativeHint('');
    setSelectedStyle(VISUAL_STYLES[0].id);
  };

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-bold serif text-amber-500">API Key Required</h1>
          <p className="text-slate-400">Select a Gemini API key from a paid GCP project to unlock full functionality.</p>
          <button onClick={handleOpenKeyDialog} className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg">
            Select API Key
          </button>
          <p className="text-xs text-slate-500">
            More info: <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline">Billing Documentation</a>
          </p>
        </div>
      </div>
    );
  }

  if (showSplash) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-amber-500 rounded-full blur-[120px]"></div>
          <div className="absolute top-1/2 -right-24 w-80 h-80 bg-blue-600 rounded-full blur-[100px]"></div>
          <div className="absolute -bottom-24 left-1/4 w-72 h-72 bg-purple-600 rounded-full blur-[120px]"></div>
        </div>

        <div className="max-w-3xl space-y-10 z-10 animate-in fade-in zoom-in-95 duration-1000">
          <div className="space-y-4">
            <h1 className="text-6xl md:text-8xl font-black serif bg-gradient-to-br from-amber-100 via-amber-400 to-amber-700 bg-clip-text text-transparent uppercase tracking-tighter">
              Graphic Novel Creator
            </h1>
            <h2 className="text-xl md:text-2xl font-light tracking-[0.3em] text-slate-400 uppercase">
              A Creative Story Studio
            </h2>
          </div>

          <div className="space-y-6 text-lg md:text-xl text-slate-300 font-light leading-relaxed max-w-2xl mx-auto">
            <p>Bridge the gap between vision and prose. Transform a single scene into a rich, immersive narrative.</p>
            <p>By uploading a visual seed, our ghostwriting intelligence crafts a unique opening, visualises new chapters in your chosen style, and brings the manuscript to life with atmospheric narration.</p>
          </div>

          <div className="pt-8 flex flex-col items-center gap-4">
            <button 
              onClick={() => setShowSplash(false)}
              className="px-12 py-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-[2rem] text-xl transition-all shadow-[0_0_50px_-10px_rgba(245,158,11,0.6)] hover:-translate-y-1 active:scale-95 group flex items-center gap-4"
            >
              Begin Your Journey
              <svg className="w-6 h-6 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-600 font-bold">App by Rhett, curation by Gemini AI</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-amber-500/30">
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300 cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <button 
            className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors"
            onClick={() => setZoomedImage(null)}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <img 
            src={zoomedImage} 
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300 ring-1 ring-white/10" 
            alt="Zoomed View" 
          />
        </div>
      )}

      <main className="max-w-7xl mx-auto p-6 md:p-12 space-y-12">
        <header className="flex items-center justify-between">
          <div className="cursor-pointer" onClick={resetDraft}>
            <h1 className="text-4xl font-bold serif bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent transition-all duration-1000 uppercase tracking-wider">{storyTitle}</h1>
            <p className="text-slate-400 mt-2 font-light">Visual seeds sprout literary worlds.</p>
          </div>
          {status !== AppStatus.IDLE && status !== AppStatus.HINT_ENTRY && (
            <button onClick={resetDraft} className="px-6 py-2 rounded-full border border-slate-700 text-sm hover:bg-slate-800 transition-all">New Draft</button>
          )}
        </header>

        {status === AppStatus.IDLE || status === AppStatus.HINT_ENTRY ? (
          <div className="max-w-3xl mx-auto py-12 space-y-12 animate-in fade-in zoom-in-95 duration-500">
            {setupStep === 1 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 text-center">Step 1: Choose a Narrative Tone</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {TONES.map((tone) => (
                    <button key={tone.id} onClick={() => setSelectedTone(tone.id)} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${selectedTone === tone.id ? `${tone.color} shadow-lg shadow-black/40 scale-[1.02]` : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 grayscale-[0.5] hover:grayscale-0'}`}>
                      <span className="text-2xl">{tone.icon}</span>
                      <span className="font-medium">{tone.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex justify-center pt-8">
                  <button onClick={() => setSetupStep(2)} className="px-10 py-3 bg-slate-800 hover:bg-slate-700 text-amber-500 font-bold rounded-2xl transition-all border border-slate-700">Next: Upload Scene</button>
                </div>
              </div>
            )}

            {setupStep === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 text-center">Step 2: Upload Your Scene</h2>
                {initialImage ? (
                  <div className="space-y-6">
                    <div className="relative group rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-slate-800 max-w-xl mx-auto ring-1 ring-white/10">
                      <img src={initialImage} className="w-full h-auto block" alt="Selected Preview" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="px-6 py-2 bg-white text-slate-900 font-bold rounded-full text-sm">Change Image</button>
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </div>
                    </div>
                    <div className="flex justify-between pt-8">
                      <button onClick={() => setSetupStep(1)} className="px-8 py-3 text-slate-500 hover:text-slate-300 font-medium transition-all">Back</button>
                      <button onClick={() => setSetupStep(3)} className="px-10 py-3 bg-slate-800 hover:bg-slate-700 text-amber-500 font-bold rounded-2xl transition-all border border-slate-700">Next: Visual Style</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="relative group cursor-pointer">
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                      <div className="p-16 border-2 border-dashed border-slate-700 rounded-[2.5rem] bg-slate-900/50 group-hover:bg-slate-800/50 group-hover:border-slate-500 transition-all shadow-2xl backdrop-blur-sm">
                        <div className="w-20 h-20 bg-amber-500/10 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 transition-all group-hover:scale-110 group-hover:bg-amber-500/20">
                          <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <h2 className="text-2xl font-bold mb-2 text-white text-center">Select a photo</h2>
                        <p className="text-slate-400 text-center">The visual spark that ignites the narrative.</p>
                      </div>
                    </div>
                    <div className="flex justify-center pt-8">
                      <button onClick={() => setSetupStep(1)} className="px-8 py-3 text-slate-500 hover:text-slate-300 font-medium transition-all">Back</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {setupStep === 3 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 text-center">Step 3: Future Visual Style</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {VISUAL_STYLES.map((style) => (
                    <button key={style.id} onClick={() => setSelectedStyle(style.id)} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${selectedStyle === style.id ? 'border-amber-500 text-amber-400 bg-amber-500/10 shadow-lg shadow-black/40 scale-[1.02]' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 grayscale-[0.5] hover:grayscale-0'}`}>
                      <span className="text-2xl">{style.icon}</span>
                      <span className="font-medium text-center text-xs md:text-sm">{style.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex justify-between pt-8">
                  <button onClick={() => setSetupStep(2)} className="px-8 py-3 text-slate-500 hover:text-slate-300 font-medium transition-all">Back to Image</button>
                  <button onClick={() => setSetupStep(4)} className="px-10 py-3 bg-slate-800 hover:bg-slate-700 text-amber-500 font-bold rounded-2xl transition-all border border-slate-700">Next: Narrative Direction</button>
                </div>
              </div>
            )}

            {setupStep === 4 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 text-center">Step 4: Narrative Hint (Optional)</h2>
                <div className="space-y-4">
                   <p className="text-slate-400 text-center font-light">Add a specific plot point, a name, or a feeling to guide the story.</p>
                   <textarea 
                    value={narrativeHint}
                    onChange={(e) => setNarrativeHint(e.target.value)}
                    placeholder="e.g. A character named Elara discovers an ancient key..."
                    className="w-full h-32 bg-slate-900/50 border border-slate-800 rounded-3xl p-6 text-slate-200 placeholder:text-slate-700 focus:outline-none focus:border-amber-500/50 transition-all resize-none font-light"
                   />
                </div>
                <div className="flex justify-between pt-8">
                  <button onClick={() => setSetupStep(3)} className="px-8 py-3 text-slate-500 hover:text-slate-300 font-medium transition-all">Back to Style</button>
                  <button onClick={processInitialScene} className="px-12 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl transition-all shadow-[0_0_40px_-10px_rgba(245,158,11,0.5)]">Begin the Journey</button>
                </div>
              </div>
            )}
          </div>
        ) : status === AppStatus.ERROR ? (
          <div className="max-w-2xl mx-auto py-20 text-center space-y-8">
             <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto ring-4 ring-red-500/5"><svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
             <div className="space-y-4">
                <h2 className="text-3xl font-bold serif text-slate-100">The vision is blurred...</h2>
                <p className="text-slate-400">Something went wrong. Let's try again.</p>
             </div>
             <button onClick={resetDraft} className="px-10 py-4 bg-slate-100 text-slate-900 font-bold rounded-2xl hover:bg-white transition-all shadow-xl">Try Another Scene</button>
          </div>
        ) : (
          <div className="space-y-24 max-w-4xl mx-auto">
            {status === AppStatus.ANALYSING && storyParts.length === 0 ? (
              <div className="flex flex-col gap-8 items-center py-12 animate-in fade-in duration-700">
                <div className="w-full">
                   <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 bg-slate-900 ring-1 ring-white/10">
                      {initialImage && (
                        <img src={initialImage} className="w-full h-auto opacity-60 blur-[1px] scale-110 transition-transform duration-[30s] ease-linear animate-pulse" alt="Original Upload" />
                      )}
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/20 backdrop-blur-[2px]">
                         <div className="w-full h-1 bg-amber-500/80 absolute top-0 animate-scan z-30 shadow-[0_0_15px_rgba(245,158,11,0.8)]"></div>
                         <div className="bg-slate-900/90 backdrop-blur-xl px-8 py-4 rounded-3xl border border-amber-500/30 flex flex-col items-center gap-4 shadow-2xl">
                            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                            <div className="text-center"><span className="text-amber-400 font-bold tracking-[0.15em] text-sm uppercase block mb-1">Analysing Scene</span></div>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            ) : (
              <div className="space-y-32 pb-12">
                {storyParts.map((part, idx) => (
                  <div key={idx} className="space-y-10 animate-in fade-in slide-in-from-bottom-12 duration-1000 pt-10 border-t border-slate-800 first:border-t-0 first:pt-0">
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold uppercase tracking-[0.4em] text-slate-500">Chapter {idx + 1}</span>
                      <button 
                        onClick={() => handleNarrateSegment(idx)}
                        className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold transition-all min-w-[144px] justify-center ${
                          narratingIndex === idx ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : 'bg-slate-800 text-amber-400 hover:bg-slate-700'
                        }`}
                      >
                        {narratingIndex === idx && isNarrationLoading ? (
                          <div className="flex gap-0.5 items-center">
                            <span className="w-1 h-1 bg-slate-950 rounded-full animate-bounce"></span>
                            <span className="w-1 h-1 bg-slate-950 rounded-full animate-bounce delay-75"></span>
                            <span className="w-1 h-1 bg-slate-950 rounded-full animate-bounce delay-150"></span>
                          </div>
                        ) : narratingIndex === idx ? (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        ) : (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        )}
                        <span>{narratingIndex === idx && isNarrationLoading ? 'Busy' : narratingIndex === idx ? 'Stop Reading' : 'Read Aloud'}</span>
                      </button>
                    </div>

                    <div className="relative group cursor-zoom-in" onClick={() => part.imageUrl && setZoomedImage(part.imageUrl)}>
                       <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5 bg-slate-900 ring-1 ring-white/10">
                         {part.imageUrl ? (
                           <img src={part.imageUrl} alt={`Chapter ${idx + 1}`} className="w-full h-auto block transition-transform duration-1000 group-hover:scale-[1.02]" />
                         ) : (
                           <div className="aspect-video w-full flex flex-col items-center justify-center bg-slate-950/80 animate-pulse">
                              <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                           </div>
                         )}
                         <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <svg className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                         </div>
                       </div>
                    </div>

                    <p className="serif text-2xl md:text-4xl leading-relaxed text-slate-100 first-letter:text-8xl first-letter:font-bold first-letter:mr-4 first-letter:float-left first-letter:text-amber-500 first-letter:leading-none whitespace-pre-wrap">
                      {part.text}
                    </p>
                  </div>
                ))}

                {status === AppStatus.EXTENDING && (
                  <div className="flex flex-col items-center justify-center py-20 space-y-8 animate-in fade-in duration-500 border-t border-slate-800">
                     <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(245,158,11,0.3)]"></div>
                     <div className="text-center"><p className="text-amber-400 font-bold tracking-[0.2em] uppercase text-sm">Expanding the narrative</p></div>
                  </div>
                )}

                {status === AppStatus.READY && (
                  <div ref={scrollRef} className="flex flex-row items-center justify-center gap-6 pt-12 pb-20 animate-in fade-in zoom-in-95 duration-700">
                    <button onClick={handleContinueStory} className="group relative px-10 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-3xl transition-all shadow-[0_0_40px_-10px_rgba(245,158,11,0.5)] hover:-translate-y-1">
                      <span className="flex items-center gap-4 text-lg tracking-tight">Continue the Journey
                        <svg className="w-6 h-6 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </span>
                    </button>
                    <button onClick={handleShare} className="p-4 bg-slate-900 hover:bg-slate-800 text-amber-500 rounded-3xl border border-slate-800 transition-all shadow-xl hover:-translate-y-1 active:scale-95 group" title="Share Story">
                      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
      
      <footer className="py-24 border-t border-slate-900 text-center">
        <p className="text-[10px] text-slate-800 uppercase tracking-[0.5em]">App by Rhett, curation by Gemini AI</p>
      </footer>
    </div>
  );
}
