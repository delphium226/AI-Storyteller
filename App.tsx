import React, { useState, useRef, useEffect } from 'react';
import { AppStatus, StoryPart } from './types';
import { analyseImageAndWriteStory, generateNarration, extendStory, generateStoryImage } from './services/geminiService';
import { decode, decodeAudioData } from './utils/audioUtils';
import { jsPDF } from 'jspdf';

const TONES = [
  { id: 'mystery', label: 'Mystery', icon: '🔍', authors: ['Arthur Conan Doyle', 'Agatha Christie'], color: 'border-purple-500 text-purple-400 bg-purple-500/10 shadow-purple-500/20' },
  { id: 'adventure', label: 'Adventure', icon: '⚔️', authors: ['Robert Louis Stevenson', 'J.R.R. Tolkien'], color: 'border-orange-500 text-orange-400 bg-orange-500/10 shadow-orange-500/20' },
  { id: 'romance', label: 'Romance', icon: '❤️', authors: ['Jane Austen', 'Charlotte Brontë'], color: 'border-pink-500 text-pink-400 bg-pink-500/10 shadow-pink-500/20' },
  { id: 'gothic', label: 'Gothic', icon: '🏰', authors: ['Edgar Allan Poe', 'Mary Shelley'], color: 'border-slate-500 text-slate-400 bg-slate-500/10 shadow-slate-500/20' },
  { id: 'cyberpunk', label: 'Cyberpunk', icon: '🤖', authors: ['William Gibson', 'Philip K. Dick'], color: 'border-cyan-500 text-cyan-400 bg-cyan-500/10 shadow-cyan-500/20' },
  { id: 'whimsical', label: 'Whimsical', icon: '✨', authors: ['Lewis Carroll', 'Roald Dahl'], color: 'border-amber-500 text-amber-400 bg-amber-500/10 shadow-amber-500/20' },
  { id: 'sci-fi', label: 'Sci-Fi', icon: '🚀', authors: ['Isaac Asimov', 'H.G. Wells'], color: 'border-indigo-500 text-indigo-400 bg-indigo-500/10 shadow-indigo-500/20' },
  { id: 'horror', label: 'Horror', icon: '👻', authors: ['H.P. Lovecraft', 'Bram Stoker'], color: 'border-red-600 text-red-500 bg-red-600/10 shadow-red-600/20' },
];

const VISUAL_STYLES = [
  { id: 'original', label: "Maintain Original", icon: '🖼️', prompt: "Maintain the exact same art style, lighting, and medium as the reference image." },
  { id: 'cinematic', label: 'Cinematic', icon: '🎬', prompt: "Render with a high-budget cinematic look, featuring anamorphic lens flares, realistic depth of field, and dramatic colour grading." },
  { id: 'anime', label: 'Anime', icon: '⛩️', prompt: "Render in a modern high-definition anime style, with vibrant colours, clean linework, and expressive character designs." },
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
  { id: 'victorian-etching', label: 'Victorian Etching', icon: '🖋️', prompt: "Detailed cross-hatched Victorian book illustration style with fine lines and aged paper texture." },
  { id: 'claymation', label: 'Claymation', icon: '🧱', prompt: "Hand-sculpted clay figures with visible fingerprints, tactile textures, and stop-motion charm." },
  { id: 'stained-glass', label: 'Stained Glass', icon: '⛪', prompt: "Vibrant panels of coloured glass separated by thick lead lines with light passing through." },
  { id: 'bauhaus', label: 'Bauhaus', icon: '📐', prompt: "Geometric shapes, primary colours, minimalist balanced composition, and functional aesthetic." },
  { id: 'comic-ink', label: 'Comic Ink', icon: '🖋️', prompt: "Thick, expressive black ink lines with halftone dots and hatching, typical of golden age comics." },
  { id: 'tarot-card', label: 'Tarot Card', icon: '🃏', prompt: "Flat colours, ornate golden borders, and highly symbolic, mystical imagery characteristic of Rider-Waite tarot." },
  { id: 'bioluminescent', label: 'Bioluminescent', icon: '💡', prompt: "Glowing organisms, ethereal cool-toned neon lights, and deep-sea dark contrasts." },
  { id: 'glitch-art', label: 'Glitch Art', icon: '📺', prompt: "Digital artifacts, chromatic aberration, scanlines, and aesthetic data corruption." },
];

const NARRATOR_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

export default function App() {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [setupStep, setSetupStep] = useState(1);
  const [initialImage, setInitialImage] = useState<string | null>(null);
  const [storyTitle, setStoryTitle] = useState<string>('Graphic Novel Studio');
  const [storyParts, setStoryParts] = useState<StoryPart[]>([]);
  
  const [selectedTones, setSelectedTones] = useState<string[]>([TONES[0].id]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([VISUAL_STYLES[0].id]);
  
  const [narrativeHint, setNarrativeHint] = useState<string>('');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [narratingIndex, setNarratingIndex] = useState<number | null>(null);
  const [isNarrationLoading, setIsNarrationLoading] = useState(false);
  const [sessionVoice, setSessionVoice] = useState<string>(NARRATOR_VOICES[0]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const randomVoice = NARRATOR_VOICES[Math.floor(Math.random() * NARRATOR_VOICES.length)];
    setSessionVoice(randomVoice);

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

  const toggleSelection = (id: string, state: string[], setState: React.Dispatch<React.SetStateAction<string[]>>) => {
    setState(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter(item => item !== id);
      }
      return [...prev, id];
    });
  };

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

  const getAuthors = () => {
    const chosenTones = TONES.filter(t => selectedTones.includes(t.id));
    const authors = chosenTones.map(t => t.authors[0]);
    return Array.from(new Set(authors));
  };

  const processInitialScene = async () => {
    if (!initialImage) return;
    try {
      setStatus(AppStatus.ANALYSING);
      
      const toneLabels = TONES.filter(t => selectedTones.includes(t.id)).map(t => t.label);
      const authors = getAuthors();
      const stylePrompts = VISUAL_STYLES.filter(s => selectedStyles.includes(s.id)).map(s => s.prompt);

      const result = await analyseImageAndWriteStory(initialImage, toneLabels, authors, narrativeHint);
      setStoryTitle(result.title);
      
      let finalInitialImage = initialImage;
      const transformed = await generateStoryImage(initialImage, result.visualPrompt, stylePrompts);
      if (transformed) {
        finalInitialImage = transformed;
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
      
      const lastPart = storyParts[storyParts.length - 1];
      const referenceImage = lastPart.imageUrl || initialImage;
      
      const toneLabels = TONES.filter(t => selectedTones.includes(t.id)).map(t => t.label);
      const authors = getAuthors();
      const stylePrompts = VISUAL_STYLES.filter(s => selectedStyles.includes(s.id)).map(s => s.prompt);
      const fullText = storyParts.map(p => p.text).join("\n\n");
      
      const { nextPart, visualPrompt } = await extendStory(initialImage, fullText, toneLabels, authors);
      const newImageUrl = await generateStoryImage(referenceImage, visualPrompt, stylePrompts);
      
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

  const handleDownloadPdf = async () => {
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.setFont('times', 'bold');
    doc.setFontSize(36);
    const titleLines = doc.splitTextToSize(storyTitle.toUpperCase(), pageWidth - (margin * 2));
    const titleHeight = titleLines.length * 15;
    doc.text(titleLines, pageWidth / 2, (pageHeight / 2) - (titleHeight / 2), { align: 'center' });

    for (let i = 0; i < storyParts.length; i++) {
      doc.addPage();
      const part = storyParts[i];
      let yPos = 30;

      doc.setFont('times', 'bold');
      doc.setFontSize(22);
      doc.text(`CHAPTER ${i + 1}`, margin, yPos);
      yPos += 15;

      if (part.imageUrl) {
        try {
          const imgWidth = pageWidth - (margin * 2);
          const imgHeight = (imgWidth * 9) / 16;
          doc.addImage(part.imageUrl, 'PNG', margin, yPos, imgWidth, imgHeight);
          yPos += imgHeight + 15;
        } catch (e) {
          console.error("Could not add image to PDF", e);
        }
      }

      doc.setFont('times', 'normal');
      doc.setFontSize(16);
      const textLines = doc.splitTextToSize(part.text, pageWidth - (margin * 2));
      
      for (let lineIdx = 0; lineIdx < textLines.length; lineIdx++) {
        if (yPos > 280) {
          doc.addPage();
          yPos = 30;
        }
        doc.text(textLines[lineIdx], margin, yPos);
        yPos += 10;
      }
    }

    doc.save(`${storyTitle.replace(/\s+/g, '_')}.pdf`);
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
      const base64Audio = await generateNarration(part.text, sessionVoice);
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
      console.error("Narration failed", err);
      stopNarration();
    }
  };

  const resetDraft = () => {
    stopNarration();
    setStatus(AppStatus.IDLE);
    setSetupStep(1);
    setInitialImage(null);
    setStoryTitle('Graphic Novel Studio');
    setStoryParts([]);
    setNarrativeHint('');
    setSelectedTones([TONES[0].id]);
    setSelectedStyles([VISUAL_STYLES[0].id]);
    
    const randomVoice = NARRATOR_VOICES[Math.floor(Math.random() * NARRATOR_VOICES.length)];
    setSessionVoice(randomVoice);
  };

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-bold serif text-amber-500">API Key Required</h1>
          <p className="text-slate-400">Select a Gemini API key from a paid project.</p>
          <button onClick={handleOpenKeyDialog} className="w-full py-3 bg-amber-500 text-slate-950 font-bold rounded-xl shadow-lg">Select API Key</button>
        </div>
      </div>
    );
  }

  if (showSplash) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-amber-500 rounded-full blur-[120px]"></div>
          <div className="absolute top-1/2 -right-24 w-80 h-80 bg-blue-600 rounded-full blur-[100px]"></div>
        </div>
        <div className="max-w-3xl space-y-10 z-10 animate-in fade-in zoom-in-95 duration-1000">
          <h1 className="text-6xl md:text-8xl font-black serif bg-gradient-to-br from-amber-100 via-amber-400 to-amber-700 bg-clip-text text-transparent uppercase tracking-tighter">Graphic Novel Studio</h1>
          <p className="text-xl text-slate-300 font-light max-w-2xl mx-auto">Transform visual seeds into immersive, multi-style narratives with AI-powered prose and atmospheric visualisation.</p>
          <button onClick={() => setShowSplash(false)} className="px-12 py-5 bg-amber-500 text-slate-950 font-black rounded-[2rem] text-xl transition-all shadow-[0_0_50px_-10px_rgba(245,158,11,0.6)] hover:-translate-y-1 active:scale-95">Begin Your Journey</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-amber-500/30">
      {zoomedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl cursor-zoom-out" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300 ring-1 ring-white/10" alt="Zoomed" />
        </div>
      )}

      <main className="max-w-7xl mx-auto p-6 md:p-12 space-y-12">
        <header className="flex flex-col items-center justify-center gap-4">
          <div className="cursor-pointer text-center" onClick={resetDraft}>
            <h1 className="text-4xl md:text-5xl font-bold serif bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent uppercase tracking-wider">{storyTitle}</h1>
          </div>
          {status !== AppStatus.IDLE && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-amber-500 text-[10px] font-bold uppercase tracking-widest opacity-80 text-center">
                Inspired by the works of {getAuthors().join(', ')}
              </p>
              <button onClick={resetDraft} className="px-6 py-2 rounded-full border border-slate-700 text-sm hover:bg-slate-800 transition-colours">New Draft</button>
            </div>
          )}
        </header>

        {(status === AppStatus.IDLE || status === AppStatus.HINT_ENTRY) ? (
          <div className="max-w-5xl mx-auto py-12 space-y-12 animate-in fade-in zoom-in-95 duration-500">
            {setupStep === 1 && (
              <div className="space-y-6">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 text-center">Step 1: Blend Narrative Tones & Authors</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {TONES.map((tone) => (
                    <button key={tone.id} onClick={() => toggleSelection(tone.id, selectedTones, setSelectedTones)} 
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${selectedTones.includes(tone.id) ? `${tone.color} shadow-lg scale-[1.05]` : 'border-slate-800 bg-slate-900/50 grayscale hover:grayscale-0'}`}>
                      <span className="text-2xl">{tone.icon}</span>
                      <span className="font-medium text-sm md:text-base">{tone.label}</span>
                      <div className="text-[10px] opacity-60 text-center">Inspired by {tone.authors[0]}</div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-center pt-8"><button onClick={() => setSetupStep(2)} className="px-10 py-3 bg-slate-800 text-amber-500 font-bold rounded-2xl border border-slate-700">Next: Upload Scene</button></div>
              </div>
            )}

            {setupStep === 2 && (
              <div className="space-y-6">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 text-center">Step 2: Upload Your Initial Scene</h2>
                {initialImage ? (
                  <div className="space-y-6">
                    <div className="relative group rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-slate-800 max-w-xl mx-auto">
                      <img src={initialImage} className="w-full h-auto block" alt="Preview" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="px-6 py-2 bg-white text-slate-900 font-bold rounded-full text-sm">Change Image</button>
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </div>
                    </div>
                    <div className="flex justify-between pt-8">
                      <button onClick={() => setSetupStep(1)} className="px-8 py-3 text-slate-500">Back</button>
                      <button onClick={() => setSetupStep(3)} className="px-10 py-3 bg-slate-800 text-amber-500 font-bold rounded-2xl">Next: Visual Styles</button>
                    </div>
                  </div>
                ) : (
                  <div className="relative group cursor-pointer max-w-xl mx-auto">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    <div className="p-16 border-2 border-dashed border-slate-700 rounded-[2.5rem] bg-slate-900/50 text-center">
                      <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <p className="text-white font-bold text-xl">Upload initial visual seed</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {setupStep === 3 && (
              <div className="space-y-6">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 text-center">Step 3: Future Visual Styles (Multi-select)</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {VISUAL_STYLES.map((style) => (
                    <button key={style.id} onClick={() => toggleSelection(style.id, selectedStyles, setSelectedStyles)} 
                      className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${selectedStyles.includes(style.id) ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10 scale-[1.05]' : 'border-slate-800 bg-slate-900/50'}`}>
                      <span className="text-xl">{style.icon}</span>
                      <span className="text-[10px] uppercase font-bold text-center tracking-tighter leading-none">{style.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex justify-between pt-8">
                  <button onClick={() => setSetupStep(2)} className="px-8 py-3 text-slate-500">Back</button>
                  <button onClick={() => setSetupStep(4)} className="px-10 py-3 bg-slate-800 text-amber-500 font-bold rounded-2xl">Next: Direction</button>
                </div>
              </div>
            )}

            {setupStep === 4 && (
              <div className="space-y-6 max-w-xl mx-auto">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 text-center">Step 4: Narrative Direction</h2>
                <textarea value={narrativeHint} onChange={(e) => setNarrativeHint(e.target.value)} placeholder="e.g. A character named Silas finds a portal..."
                  className="w-full h-32 bg-slate-900 border border-slate-800 rounded-3xl p-6 focus:border-amber-500 outline-none resize-none" />
                <div className="flex justify-between pt-8">
                  <button onClick={() => setSetupStep(3)} className="px-8 py-3 text-slate-500">Back</button>
                  <button onClick={processInitialScene} className="px-12 py-3 bg-amber-500 text-slate-950 font-black rounded-2xl shadow-[0_0_40px_rgba(245,158,11,0.4)]">Begin Journey</button>
                </div>
              </div>
            )}
          </div>
        ) : status === AppStatus.ERROR ? (
          <div className="py-20 text-center space-y-8">
             <h2 className="text-3xl font-bold serif text-slate-100">Something went wrong.</h2>
             <button onClick={resetDraft} className="px-10 py-4 bg-slate-100 text-slate-900 font-bold rounded-2xl">Try Again</button>
          </div>
        ) : (
          <div className="space-y-24 max-w-4xl mx-auto">
            {status === AppStatus.ANALYSING && storyParts.length === 0 ? (
              <div className="flex flex-col items-center py-20 space-y-10">
                <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-amber-400 font-bold tracking-[0.3em] uppercase">Synthesising Narrative...</p>
              </div>
            ) : (
              <div className="space-y-32 pb-24">
                {storyParts.map((part, idx) => (
                  <div key={idx} className="space-y-10 animate-in fade-in slide-in-from-bottom-12 duration-700">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                      <span className="text-2xl font-bold uppercase tracking-[0.4em] text-slate-500">Chapter {idx + 1}</span>
                      <button onClick={() => handleNarrateSegment(idx)} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${narratingIndex === idx ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-amber-400'}`}>
                        {narratingIndex === idx && isNarrationLoading ? 'Preparing...' : narratingIndex === idx ? 'Stop Reading' : 'Listen'}
                      </button>
                    </div>
                    {part.imageUrl && (
                      <div className="relative group rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-white/10 cursor-zoom-in" onClick={() => setZoomedImage(part.imageUrl)}>
                        <img src={part.imageUrl} className="w-full h-auto block" alt={`Chapter ${idx + 1}`} />
                      </div>
                    )}
                    <p className="serif text-2xl md:text-3xl leading-relaxed text-slate-100 whitespace-pre-wrap">{part.text}</p>
                  </div>
                ))}
                
                {status === AppStatus.EXTENDING && (
                  <div className="flex flex-col items-center justify-center py-20 space-y-6">
                     <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                     <p className="text-amber-500 font-bold tracking-widest uppercase text-xs">Generating next scene...</p>
                  </div>
                )}

                {status === AppStatus.READY && (
                  <div ref={scrollRef} className="flex flex-col items-center justify-center gap-6 pt-12">
                    <div className="flex flex-row items-center gap-4">
                      <button onClick={handleContinueStory} className="px-12 py-5 bg-amber-500 text-slate-950 font-black rounded-3xl text-xl shadow-[0_0_40px_rgba(245,158,11,0.3)] hover:-translate-y-1 transition-all">Continue Journey</button>
                      <button onClick={handleDownloadPdf} className="px-12 py-5 bg-slate-900 text-blue-400 font-black rounded-3xl text-xl border border-slate-800 shadow-[0_0_40px_rgba(59,130,246,0.2)] hover:bg-slate-800 transition-all flex items-center gap-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Export PDF
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-4 text-center">Save your journey as a high-quality graphic novel document</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
