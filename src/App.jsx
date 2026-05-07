import React, { useState, useEffect, useRef } from 'react';
import { 
  Book, FileText, MessageSquare, Headphones, Code, 
  Plus, Upload, X, Send, Play, Pause, Square, File,
  PanelLeftClose, PanelLeftOpen, Maximize2, Loader2, Sparkles,
  Network, Globe, Link2, ListChecks, Bold, Italic, Heading,
  Heading1, Heading2, Heading3, Table as TableIcon, PenTool, 
  Workflow, MessageSquareWarning, Type
} from 'lucide-react';

const API_KEY = ""; // Canvas will auto-inject the key here

// Default mock data to get started
const DEFAULT_SOURCES = [
  {
    id: 'src-1',
    title: 'The Apollo 11 Mission',
    content: 'Apollo 11 was the American spaceflight that first landed humans on the Moon on July 20, 1969. Commander Neil Armstrong and lunar module pilot Buzz Aldrin landed the Apollo Lunar Module Eagle. Armstrong became the first person to step onto the lunar surface six hours and 39 minutes later, followed by Aldrin 19 minutes later. They spent about two and a quarter hours together outside the spacecraft, and they collected 47.5 pounds (21.5 kg) of lunar material to bring back to Earth. Michael Collins flew the command module Columbia alone in lunar orbit while they were on the Moon\'s surface.',
  },
  {
    id: 'src-2',
    title: 'Photosynthesis Process',
    content: 'Photosynthesis is a process used by plants and other organisms to convert light energy into chemical energy that, through cellular respiration, can later be released to fuel the organism\'s activities. This chemical energy is stored in carbohydrate molecules, such as sugars and starches, which are synthesized from carbon dioxide and water – hence the name photosynthesis, from the Greek phōs, "light", and synthesis, "putting together". In most cases, oxygen is also released as a waste product.',
  }
];

const DEFAULT_NOTES = [
  {
    id: 'note-1',
    title: 'Science Study Plan',
    content: '# My Study Plan\n\nNeed to review the following topics for the exam:\n\n1.  **Space History**: Specifically the Apollo missions.\n2.  **Biology**: [[Photosynthesis Process]] and cellular respiration.\n\n*Action item*: Ask the AI to generate a quiz on Apollo 11.',
    lastEdited: Date.now()
  }
];

// Utility to convert raw PCM data to WAV format for playing
function pcmToWav(pcmData, sampleRate = 24000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + pcmData.byteLength);
  const view = new DataView(buffer);

  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcmData.byteLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, pcmData.byteLength, true);

  // Copy PCM data
  const pcmBytes = new Uint8Array(pcmData);
  const wavBytes = new Uint8Array(buffer, 44);
  wavBytes.set(pcmBytes);

  return new Blob([buffer], { type: 'audio/wav' });
}

function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Upgraded markdown parser to handle advanced syntax (Mermaid, Tables, Callouts)
function parseMarkdown(text) {
  if (!text) return { __html: '' };

  let html = text;

  // 1. Extract Code Blocks (including Mermaid) to prevent formatting corruption
  const codeBlocks = [];
  html = html.replace(/```(.*?)?\n([\s\S]*?)```/g, (match, lang, code) => {
    codeBlocks.push({ lang: lang?.trim(), code });
    return `___CODE_BLOCK_${codeBlocks.length - 1}___`;
  });

  // 2. Escape HTML natively
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 3. Block elements (Requires matching \n before converting them to <br/>)
  
  // Headings
  html = html.replace(/^### (.*)$/gm, '<h3 class="text-lg font-bold mt-4 mb-2 text-zinc-100">$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2 class="text-xl font-bold mt-5 mb-2 text-zinc-100 border-b border-zinc-800 pb-1">$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-3 text-zinc-100">$1</h1>');

  // Callouts / Highlight Boxes (Obsidian style)
  html = html.replace(/^> \[\!info\] (.*)\n(?:> (.*)\n?)*/gm, (match, title) => {
      const lines = match.trim().split('\n');
      const content = lines.slice(1).map(l => l.replace(/^> /, '')).join('<br/>');
      return `<div class="bg-blue-900/20 border-l-4 border-blue-500 p-3 my-3 rounded-r-md"><div class="font-bold text-blue-400 mb-1 flex items-center gap-2"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg> ${title}</div><div class="text-zinc-300 text-sm">${content}</div></div>`;
  });
  
  // Standard Blockquotes
  html = html.replace(/^> (.*)$/gm, '<blockquote class="border-l-4 border-zinc-600 pl-3 my-3 text-zinc-400 italic">$1</blockquote>');

  // Checklists
  html = html.replace(/^- \[ \] (.*)$/gm, '<div class="flex items-center gap-2 my-1"><input type="checkbox" class="rounded bg-zinc-800 border-zinc-700" disabled> <span>$1</span></div>');
  html = html.replace(/^- \[x\] (.*)$/gm, '<div class="flex items-center gap-2 my-1"><input type="checkbox" class="rounded bg-zinc-800 border-zinc-700" checked disabled> <span class="line-through text-zinc-500">$1</span></div>');

  // Tables
  html = html.replace(/(?:^\|.*\|\n?)+/gm, (match) => {
      const rows = match.trim().split('\n');
      let tableHtml = '<div class="overflow-x-auto my-4"><table class="w-full text-sm border-collapse border border-zinc-700">';
      rows.forEach((row, i) => {
         if (row.includes('|---|') || row.includes('|---')) return;
         const cells = row.split('|').map(c => c.trim()).filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''));
         tableHtml += '<tr>';
         cells.forEach(cell => {
            if (i === 0) tableHtml += `<th class="border border-zinc-700 bg-zinc-800 p-2 text-left">${cell}</th>`;
            else tableHtml += `<td class="border border-zinc-700 p-2">${cell}</td>`;
         });
         tableHtml += '</tr>';
      });
      tableHtml += '</table></div>';
      return tableHtml;
  });

  // 4. Transform Newlines to HTML line breaks
  html = html.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>');

  // 5. Inline formats
  html = html
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/==(.*?)==/g, '<mark class="bg-yellow-500/30 text-yellow-200 rounded px-1">$1</mark>')
    .replace(/\[serif\](.*?)\[\/serif\]/g, '<span class="font-serif">$1</span>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-blue-400 hover:underline">$1</a>')
    .replace(/\[\[(.*?)\]\]/g, '<span class="text-purple-400 cursor-pointer hover:underline font-medium bg-purple-500/10 px-1 rounded" data-link="$1">[[$1]]</span>');

  // 6. Restore Code Blocks
  codeBlocks.forEach((block, index) => {
    let replacement = '';
    if (block.lang && block.lang.toLowerCase() === 'mermaid') {
      replacement = `<div class="mermaid-placeholder my-4 p-4 bg-zinc-900/50 rounded-lg flex justify-center text-zinc-500 text-sm border border-zinc-800" data-mermaid-code="${encodeURIComponent(block.code)}">Rendering flowchart...</div>`;
    } else {
      replacement = `<pre class="bg-zinc-900 p-4 rounded-md my-2 overflow-x-auto text-sm font-mono border border-zinc-800 text-zinc-300"><code>${block.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
    }
    html = html.replace(`___CODE_BLOCK_${index}___`, replacement);
  });

  return { __html: `<p>${html}</p>` };
}

// Wrapper component to securely parse markdown and initialize Mermaid diagrams
const MarkdownPreview = ({ content, onLinkClick }) => {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const mermaidNodes = containerRef.current.querySelectorAll('.mermaid-placeholder');
        if (mermaidNodes.length === 0) return;

        const renderMermaid = async () => {
            if (!window.mermaid) return;
            window.mermaid.initialize({ startOnLoad: false, theme: 'dark' });
            for (let i = 0; i < mermaidNodes.length; i++) {
                const node = mermaidNodes[i];
                try {
                   const code = decodeURIComponent(node.dataset.mermaidCode);
                   const id = `mermaid-svg-${Date.now()}-${i}`;
                   const { svg } = await window.mermaid.render(id, code);
                   node.innerHTML = svg;
                   node.classList.remove('mermaid-placeholder');
                } catch (e) {
                   node.innerHTML = `<span class="text-red-400 text-xs font-mono">Mermaid Syntax Error: ${e.message}</span>`;
                }
            }
        };

        if (window.mermaid) {
            renderMermaid();
        } else {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js';
            script.onload = () => renderMermaid();
            document.head.appendChild(script);
        }
    }, [content]);

    return (
        <div
            ref={containerRef}
            className="prose prose-invert prose-zinc max-w-none prose-p:leading-relaxed prose-a:text-blue-400 hover:prose-a:text-blue-300 pb-12"
            onClick={onLinkClick}
            dangerouslySetInnerHTML={parseMarkdown(content)}
        />
    );
};

const GraphView3D = ({ notes, sources, onNodeClick }) => {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    
    const initGraph = () => {
      if (!isMounted || !containerRef.current) return;
      
      try {
        if (!window.ForceGraph3D) {
           setError("3D Graph library not fully loaded.");
           return;
        }

        const nodes = [
          ...notes.map(n => ({ id: n.id, name: n.title || 'Untitled', group: 'Note', color: '#60a5fa' })),
          ...sources.map(s => ({ id: s.id, name: s.title || 'Untitled', group: 'Source', color: '#34d399' }))
        ];
        
        const links = [];
        notes.forEach(note => {
          const linkMatches = [...(note.content || '').matchAll(/\[\[(.*?)\]\]/g)];
          linkMatches.forEach(match => {
            const targetTitle = match[1].toLowerCase();
            const targetNote = notes.find(n => n.title.toLowerCase() === targetTitle);
            if (targetNote && targetNote.id !== note.id) {
                links.push({ source: note.id, target: targetNote.id });
            } else {
              const targetSource = sources.find(s => s.title.toLowerCase() === targetTitle);
              if (targetSource) {
                  links.push({ source: note.id, target: targetSource.id });
              }
            }
          });
        });

        // Clear previous container content safely
        containerRef.current.innerHTML = '';
        
        let initialZoomDone = false;

        graphRef.current = window.ForceGraph3D()(containerRef.current)
          .graphData({ nodes, links })
          .nodeLabel('name')
          .nodeColor('color')
          .backgroundColor('#09090b') // matches zinc-950
          .onNodeClick(node => {
            const isNote = notes.some(n => n.id === node.id);
            onNodeClick({ type: isNote ? 'note' : 'source', id: node.id });
          })
          .onEngineStop(() => {
             if (!initialZoomDone && graphRef.current) {
                 // Zoom out to see the entire graph network
                 graphRef.current.zoomToFit(800, 50); 
                 initialZoomDone = true;
             }
          });
      } catch (err) {
        console.error("ForceGraph3D Init Error:", err);
        setError("Failed to initialize 3D graph. Your browser or device might not fully support WebGL context.");
      }
    };

    const loadScript = () => {
      if (window.ForceGraph3D) {
        initGraph();
        return null;
      }

      let script = document.getElementById('3d-force-graph-script');
      
      if (!script) {
        script = document.createElement('script');
        script.id = '3d-force-graph-script';
        script.src = 'https://unpkg.com/3d-force-graph@1.73.3/dist/3d-force-graph.min.js';
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
      }

      const onScriptLoad = () => { if (isMounted) initGraph(); };
      const onScriptError = () => { if (isMounted) setError("Failed to load 3D graph script from network."); };

      script.addEventListener('load', onScriptLoad);
      script.addEventListener('error', onScriptError);

      return () => {
         script.removeEventListener('load', onScriptLoad);
         script.removeEventListener('error', onScriptError);
      };
    };

    const cleanupScriptListeners = loadScript();

    return () => {
      isMounted = false;
      if (cleanupScriptListeners) cleanupScriptListeners();
      if (graphRef.current) {
        try {
          graphRef.current._destructor();
        } catch(e) {
          console.warn("Graph destructor error:", e);
        }
        graphRef.current = null;
      }
    };
  }, [notes, sources, onNodeClick]);

  if (error) {
     return (
       <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-red-400 bg-zinc-950">
         <p className="mb-2 font-medium">Graph View Error</p>
         <p className="text-sm text-zinc-500">{error}</p>
       </div>
     );
  }

  return <div ref={containerRef} className="w-full h-full cursor-crosshair bg-[#09090b]" />;
};

export default function App() {
  // Data State
  const [sources, setSources] = useState(DEFAULT_SOURCES);
  const [notes, setNotes] = useState(DEFAULT_NOTES);
  const [chatHistory, setChatHistory] = useState([
    { role: 'model', text: 'Hello! I am your study assistant. I can answer questions based on your sources or help you synthesize notes.' }
  ]);

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeItem, setActiveItem] = useState({ type: 'note', id: 'note-1' }); // type: 'source' | 'note'
  const [rightPanel, setRightPanel] = useState('chat'); // 'chat' | 'audio'
  const [noteEditMode, setNoteEditMode] = useState(false);
  const [viewMode, setViewMode] = useState('document'); // 'document' | 'graph'
  
  const textareaRef = useRef(null);

  // Generator State
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState(null);
  const [isGeneratingHtml, setIsGeneratingHtml] = useState(false);
  const [showWebpageModal, setShowWebpageModal] = useState(false);

  const chatEndRef = useRef(null);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleAddNote = () => {
    const newNote = {
      id: `note-${Date.now()}`,
      title: 'Untitled Note',
      content: '',
      lastEdited: Date.now()
    };
    setNotes([newNote, ...notes]);
    setActiveItem({ type: 'note', id: newNote.id });
    setNoteEditMode(true);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const newSource = {
        id: `src-${Date.now()}`,
        title: file.name,
        content: event.target.result
      };
      setSources([...sources, newSource]);
      setActiveItem({ type: 'source', id: newSource.id });
      setViewMode('document');
    };
    reader.readAsText(file);
  };

  const handleAddWebsite = async () => {
    const query = prompt("Enter a Topic to search or a Website URL:");
    if (!query) return;
    
    setIsGeneratingHtml(true); 
    try {
      const payload = {
        contents: [{ parts: [{ text: `Search the web for the following topic or URL and provide a comprehensive, detailed summary of the main informational content. \n\nQuery: ${query}\n\nReturn ONLY a JSON object: {"title": "Descriptive Title", "content": "Detailed text content here..."}` }] }],
        tools: [{ "google_search": {} }],
      };
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const cleanedText = text.replace(/```json\n?/, '').replace(/```$/, '').trim();
      
      let parsed;
      try {
        parsed = JSON.parse(cleanedText);
      } catch(e) {
        parsed = { title: `Search: ${query}`, content: text };
      }
      
      const newSource = {
        id: `src-${Date.now()}`,
        title: parsed.title || `Search: ${query}`,
        content: parsed.content || 'Content could not be parsed clearly.'
      };
      setSources([...sources, newSource]);
      setActiveItem({ type: 'source', id: newSource.id });
      setViewMode('document');
      setNoteEditMode(true);
    } catch (error) {
      console.error(error);
      alert("Failed to extract website content.");
    } finally {
      setIsGeneratingHtml(false);
    }
  };

  const updateActiveDoc = (field, value) => {
    if (activeItem.type === 'note') {
      setNotes(notes.map(n => n.id === activeItem.id ? { ...n, [field]: value, lastEdited: Date.now() } : n));
    } else {
      setSources(sources.map(s => s.id === activeItem.id ? { ...s, [field]: value } : s));
    }
  };

  const insertFormatting = (prefix, suffix = '') => {
    if (!textareaRef.current || !activeDoc) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = activeDoc.content || '';
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);
    
    updateActiveDoc('content', `${before}${prefix}${selected}${suffix}${after}`);
    
    setTimeout(() => {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const buildContextString = () => {
    let context = "Here are the sources the user has provided:\n\n";
    sources.forEach(s => {
      context += `--- SOURCE: ${s.title} ---\n${s.content}\n\n`;
    });
    return context;
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsChatting(true);

    try {
      const systemPrompt = "You are a helpful study assistant. Answer the user's questions based primarily on the provided sources. If the user asks for new information, current events, or something not in the sources, USE Google Search to find the answer. Always synthesize information clearly.";
      
      const payload = {
        contents: [
           { role: 'user', parts: [{ text: buildContextString() }] },
           { role: 'model', parts: [{ text: "Understood. I have read the sources." }] },
           ...chatHistory.map(msg => ({ role: msg.role === 'model' ? 'model' : 'user', parts: [{ text: msg.text }] })),
           { role: 'user', parts: [{ text: userMessage }] }
        ],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: [{ "google_search": {} }]
      };

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        setChatHistory(prev => [...prev, { role: 'model', text: data.candidates[0].content.parts[0].text }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'model', text: "Sorry, I couldn't generate a response." }]);
      }
    } catch (error) {
      console.error(error);
      setChatHistory(prev => [...prev, { role: 'model', text: "Error connecting to AI." }]);
    } finally {
      setIsChatting(false);
    }
  };

  const generateAudioOverview = async () => {
    setIsGeneratingAudio(true);
    setRightPanel('audio');
    
    try {
      // 1. Generate the script using standard Gemini Flash
      const scriptPrompt = `Create a short, engaging 2-person podcast script summarizing these sources. 
      Speaker 1 (Alex) is the curious host. Speaker 2 (Sam) is the expert explaining things. 
      Format EXACTLY like this (no asterisks, no stage directions, just Names and colons):
      Alex: Welcome to the deep dive. Today we are talking about...
      Sam: That's right Alex, it's a fascinating topic...
      
      Sources to discuss:
      ${buildContextString()}`;

      const scriptRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: scriptPrompt }] }] })
      });
      const scriptData = await scriptRes.json();
      const podcastScript = scriptData.candidates?.[0]?.content?.parts?.[0]?.text || "Alex: Hi.\nSam: Hello.";

      // 2. Pass script to TTS
      const ttsPayload = {
        contents: [{ parts: [{ text: podcastScript }] }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                multiSpeakerVoiceConfig: {
                    speakerVoiceConfigs: [
                        { speaker: "Alex", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
                        { speaker: "Sam", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } } }
                    ]
                }
            }
        },
        model: "gemini-2.5-flash-preview-tts"
      };

      const ttsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ttsPayload)
      });
      const ttsData = await ttsRes.json();
      
      const part = ttsData?.candidates?.[0]?.content?.parts?.[0];
      const audioBase64 = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType;

      if (audioBase64) {
        const sampleRate = mimeType ? parseInt(mimeType.match(/rate=(\d+)/)?.[1] || "24000", 10) : 24000;
        const pcmBuffer = base64ToArrayBuffer(audioBase64);
        const wavBlob = pcmToWav(pcmBuffer, sampleRate);
        const url = URL.createObjectURL(wavBlob);
        setAudioUrl(url);
      }
    } catch (error) {
      console.error("Audio generation failed:", error);
      alert("Failed to generate audio overview.");
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const generateStudyGuide = async () => {
    setIsGeneratingHtml(true);
    setShowWebpageModal(true);
    setGeneratedHtml(null);

    const targetContent = activeItem.type === 'note' 
      ? notes.find(n => n.id === activeItem.id)?.content 
      : sources.find(s => s.id === activeItem.id)?.content;

    try {
      const prompt = `You are an expert web developer and educator. Create a complete, self-contained interactive HTML file based on the following content. 
      The HTML should act as a "Study Guide", potentially including interactive flashcards, a short quiz, or beautifully formatted summary cards.
      Use modern, clean CSS (embedded in <style>) and plain JavaScript (embedded in <script>) for interactivity. Do NOT use external libraries.
      Return ONLY valid HTML starting with <!DOCTYPE html>.
      
      Content to use:
      ${targetContent}`;

      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
      };

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      let html = data.candidates?.[0]?.content?.parts?.[0]?.text || "<h1>Error generating guide</h1>";
      // Clean up markdown code blocks if LLM adds them
      html = html.replace(/^```html\n/, '').replace(/\n```$/, '');
      
      setGeneratedHtml(html);
    } catch (error) {
      console.error(error);
      setGeneratedHtml("<h1>Error connecting to AI</h1>");
    } finally {
      setIsGeneratingHtml(false);
    }
  };

  const activeDoc = activeItem.type === 'note' 
    ? notes.find(n => n.id === activeItem.id) 
    : sources.find(s => s.id === activeItem.id);

  const handleLinkClick = (e) => {
    if (e.target.tagName === 'SPAN' && e.target.dataset.link) {
      const linkTarget = e.target.dataset.link;
      // Try to find a note or source with this title
      const foundNote = notes.find(n => n.title.toLowerCase() === linkTarget.toLowerCase());
      if (foundNote) {
        setActiveItem({ type: 'note', id: foundNote.id });
        return;
      }
      const foundSource = sources.find(s => s.title.toLowerCase() === linkTarget.toLowerCase());
      if (foundSource) {
        setActiveItem({ type: 'source', id: foundSource.id });
      }
    }
  };

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-300 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 border-r border-zinc-800 bg-zinc-900 flex flex-col shrink-0 overflow-hidden`}>
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <span className="font-bold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" /> StudyHub
          </span>
          <button onClick={() => setSidebarOpen(false)} className="hover:bg-zinc-800 p-1 rounded">
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          {/* Notes Section */}
          <div>
            <div className="flex items-center justify-between mb-2 px-2">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Notes</span>
              <button onClick={handleAddNote} className="hover:text-zinc-100"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1">
              {notes.map(note => (
                <button
                  key={note.id}
                  onClick={() => setActiveItem({ type: 'note', id: note.id })}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 truncate ${
                    activeItem.id === note.id ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-zinc-800'
                  }`}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate">{note.title || 'Untitled'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sources Section */}
          <div>
            <div className="flex items-center justify-between mb-2 px-2">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Sources</span>
              <div className="flex items-center gap-3">
                <button onClick={handleAddWebsite} className="hover:text-zinc-100 text-zinc-400" title="Web Search / Add URL"><Globe className="w-4 h-4" /></button>
                <label className="hover:text-zinc-100 text-zinc-400 cursor-pointer" title="Upload File">
                  <Upload className="w-4 h-4" />
                  <input type="file" className="hidden" accept=".txt,.md" onChange={handleFileUpload} />
                </label>
              </div>
            </div>
            <div className="space-y-1">
              {sources.map(src => (
                <button
                  key={src.id}
                  onClick={() => setActiveItem({ type: 'source', id: src.id })}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 truncate ${
                    activeItem.id === src.id ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-zinc-800'
                  }`}
                >
                  <Book className="w-4 h-4 shrink-0" />
                  <span className="truncate">{src.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 border-b border-zinc-800 flex items-center px-4 justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="hover:bg-zinc-800 p-1 rounded text-zinc-400">
                <PanelLeftOpen className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-1 bg-zinc-800/50 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('document')}
                className={`p-1.5 rounded-md text-sm flex items-center gap-2 ${viewMode === 'document' ? 'bg-zinc-700 text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                 <FileText className="w-4 h-4" /> Editor
              </button>
              <button 
                onClick={() => setViewMode('graph')}
                className={`p-1.5 rounded-md text-sm flex items-center gap-2 ${viewMode === 'graph' ? 'bg-zinc-700 text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                 <Network className="w-4 h-4" /> 3D Graph
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                const isZen = !sidebarOpen && !rightPanel;
                setSidebarOpen(isZen);
                setRightPanel(isZen ? 'chat' : null);
              }}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors mr-2"
              title="Toggle Focus Mode"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button 
              onClick={generateStudyGuide}
              className="flex items-center gap-2 text-sm px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
              title="Generate Interactive HTML Webpage from this doc"
            >
              <Code className="w-4 h-4 text-purple-400" />
              <span>Webpage Gen</span>
            </button>
            <div className="w-px h-5 bg-zinc-700 mx-1"></div>
            <button 
              onClick={() => setRightPanel(rightPanel === 'chat' ? null : 'chat')}
              className={`p-2 rounded-md transition-colors ${rightPanel === 'chat' ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-zinc-800 text-zinc-400'}`}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setRightPanel(rightPanel === 'audio' ? null : 'audio')}
              className={`p-2 rounded-md transition-colors ${rightPanel === 'audio' ? 'bg-orange-600/20 text-orange-400' : 'hover:bg-zinc-800 text-zinc-400'}`}
            >
              <Headphones className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Workspace Split */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Document Viewer / Editor / Graph (Left) */}
          <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden relative">
            {viewMode === 'graph' ? (
              <GraphView3D 
                notes={notes} 
                sources={sources} 
                onNodeClick={(item) => { setActiveItem(item); setViewMode('document'); }} 
              />
            ) : activeDoc ? (
              <div className="flex-1 flex flex-col p-4 lg:p-6 overflow-y-auto">
                <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-2">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setNoteEditMode(false)}
                      className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${!noteEditMode ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                    >
                      Preview
                    </button>
                    <button 
                      onClick={() => setNoteEditMode(true)}
                      className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${noteEditMode ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                    >
                      Edit
                    </button>
                  </div>

                  {noteEditMode && (
                    <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-md p-1 flex-wrap">
                      {/* Text Styles */}
                      <button onClick={() => insertFormatting('**', '**')} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded" title="Bold"><Bold className="w-3.5 h-3.5" /></button>
                      <button onClick={() => insertFormatting('*', '*')} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded" title="Italic"><Italic className="w-3.5 h-3.5" /></button>
                      <button onClick={() => insertFormatting('==', '==')} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded" title="Highlight"><PenTool className="w-3.5 h-3.5" /></button>
                      <button onClick={() => insertFormatting('[serif]', '[/serif]')} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded" title="Serif Font"><Type className="w-3.5 h-3.5" /></button>
                      
                      <div className="w-px bg-zinc-800 mx-1"></div>
                      
                      {/* Headings */}
                      <button onClick={() => insertFormatting('# ')} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded" title="Heading 1"><Heading1 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => insertFormatting('## ')} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded" title="Heading 2"><Heading2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => insertFormatting('### ')} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded" title="Heading 3"><Heading3 className="w-3.5 h-3.5" /></button>
                      
                      <div className="w-px bg-zinc-800 mx-1"></div>
                      
                      {/* Objects */}
                      <button onClick={() => insertFormatting('\n| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |\n')} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded" title="Table"><TableIcon className="w-3.5 h-3.5" /></button>
                      <button onClick={() => insertFormatting('\n```mermaid\ngraph TD;\n    A-->B;\n    A-->C;\n    B-->D;\n    C-->D;\n```\n')} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded" title="Flowchart"><Workflow className="w-3.5 h-3.5" /></button>
                      <button onClick={() => insertFormatting('\n> [!info] Callout Title\n> Enter your important note here...\n\n')} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded" title="Highlight Box"><MessageSquareWarning className="w-3.5 h-3.5" /></button>
                      
                      <div className="w-px bg-zinc-800 mx-1"></div>
                      
                      {/* Links & Lists */}
                      <button onClick={() => insertFormatting('[', '](url)')} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded" title="Link"><Link2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => insertFormatting('- [ ] ')} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded" title="Checklist"><ListChecks className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>

                {noteEditMode ? (
                  <textarea
                    ref={textareaRef}
                    className="w-full flex-1 bg-transparent border-none outline-none resize-none leading-relaxed text-zinc-300 font-mono text-sm pb-12"
                    value={activeDoc.content}
                    onChange={(e) => updateActiveDoc('content', e.target.value)}
                    placeholder="Write your notes here... Use [[Title]] to link to other notes or sources. Markdown is supported."
                  />
                ) : (
                  <MarkdownPreview 
                    content={activeDoc.content} 
                    onLinkClick={handleLinkClick} 
                  />
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                <FileText className="w-12 h-12 text-zinc-800 mb-4" />
                <p>Select a note or source to begin</p>
              </div>
            )}
          </div>

          {/* Right Panel (Chat / Audio) */}
          <div className={`${rightPanel ? 'w-80 lg:w-96 border-l border-zinc-800' : 'w-0 border-transparent'} transition-all duration-300 shrink-0 bg-zinc-900/30 flex flex-col relative overflow-hidden`}>
            <div className="w-80 lg:w-96 h-full flex flex-col shrink-0">
            {rightPanel === 'chat' && (
              <>
                <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-400" /> Studio Chat
                  </h3>
                  <button onClick={() => setRightPanel(null)} className="hover:bg-zinc-800 p-1 rounded text-zinc-400">
                     <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4" onClick={handleLinkClick}>
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <span className="text-xs text-zinc-500 mb-1 ml-1">{msg.role === 'user' ? 'You' : 'AI Assistant'}</span>
                      <div className={`px-4 py-2 rounded-2xl max-w-[90%] text-sm leading-relaxed ${
                        msg.role === 'user' 
                          ? 'bg-blue-600 text-white rounded-tr-sm' 
                          : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
                      }`}>
                        {msg.role === 'user' ? (
                          msg.text
                        ) : (
                          <div 
                             className="prose prose-invert prose-zinc max-w-none prose-sm prose-p:my-1 prose-pre:my-2 prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-700 prose-a:text-blue-400"
                             dangerouslySetInnerHTML={parseMarkdown(msg.text)}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                  {isChatting && (
                    <div className="flex items-start">
                      <div className="bg-zinc-800 px-4 py-3 rounded-2xl rounded-tl-sm text-zinc-400 text-sm flex gap-1">
                        <span className="animate-bounce">.</span><span className="animate-bounce delay-100">.</span><span className="animate-bounce delay-200">.</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-zinc-900 border-t border-zinc-800">
                  <div className="relative">
                    <textarea 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                      placeholder="Ask about your sources..."
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 pr-12 text-sm outline-none focus:border-blue-500 transition-colors resize-none h-14"
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={!chatInput.trim() || isChatting}
                      className="absolute right-2 top-2 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {rightPanel === 'audio' && (
              <div className="flex-1 flex flex-col">
                 <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-orange-400" /> Audio Overview
                  </h3>
                  <button onClick={() => setRightPanel(null)} className="hover:bg-zinc-800 p-1 rounded text-zinc-400">
                     <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
                  <div className="w-24 h-24 rounded-full bg-orange-500/10 flex items-center justify-center relative">
                    {isGeneratingAudio && (
                       <div className="absolute inset-0 rounded-full border-4 border-orange-500/30 border-t-orange-500 animate-spin" />
                    )}
                    <Headphones className={`w-10 h-10 ${isGeneratingAudio ? 'text-orange-500 animate-pulse' : 'text-orange-400'}`} />
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-medium text-zinc-100 mb-2">Deep Dive Podcast</h4>
                    <p className="text-sm text-zinc-400 max-w-xs">
                      Generate a conversational audio overview featuring two AI hosts discussing your uploaded sources.
                    </p>
                  </div>

                  {!audioUrl && !isGeneratingAudio && (
                    <button 
                      onClick={generateAudioOverview}
                      className="px-6 py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 font-medium rounded-full transition-colors flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4 text-orange-500" />
                      Generate Overview
                    </button>
                  )}

                  {isGeneratingAudio && (
                    <div className="text-orange-400 text-sm font-medium animate-pulse flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Analyzing sources & synthesizing audio...
                    </div>
                  )}

                  {audioUrl && !isGeneratingAudio && (
                    <div className="w-full mt-4 space-y-4">
                      <audio controls className="w-full h-12 rounded-lg" src={audioUrl} />
                      <button 
                        onClick={generateAudioOverview}
                        className="text-xs text-zinc-500 hover:text-zinc-300 underline"
                      >
                        Regenerate
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {showWebpageModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 lg:p-8 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full h-full max-w-6xl shadow-2xl flex flex-col overflow-hidden relative transform transition-all">
            
            {/* Modal Header */}
            <div className="h-14 bg-zinc-800/50 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center gap-3">
                <Code className="w-5 h-5 text-purple-400" />
                <h2 className="font-semibold text-zinc-100">Interactive Webpage Generated</h2>
                <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-0.5 rounded-full font-medium border border-purple-500/30">
                  from {activeDoc?.title}
                </span>
              </div>
              <button 
                onClick={() => setShowWebpageModal(false)}
                className="p-2 hover:bg-zinc-700 rounded-full transition-colors text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Iframe */}
            <div className="flex-1 relative bg-white overflow-hidden flex items-center justify-center">
              {isGeneratingHtml ? (
                <div className="flex flex-col items-center gap-4 text-zinc-400">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                     <Loader2 className="w-10 h-10 animate-spin text-purple-500 absolute" />
                     <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                  </div>
                  <p className="font-medium">Writing code & compiling study materials...</p>
                </div>
              ) : generatedHtml ? (
                <iframe 
                  className="w-full h-full border-none"
                  srcDoc={generatedHtml}
                  title="Generated Study Guide"
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : (
                <p className="text-zinc-500">Failed to generate content.</p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
