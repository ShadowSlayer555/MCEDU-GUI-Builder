import React, { useState, useRef, MouseEvent, useEffect } from 'react';
import { 
  Square,
  Type,
  Image as ImageIcon,
  MousePointer2,
  Maximize,
  Edit2,
  Search,
  CheckCircle2,
  Layers,
  Settings2,
  X,
  Play,
  FileJson,
  FolderOpen,
  Wand2,
  Loader2,
  Code2,
  Download
} from 'lucide-react';

type ElementType = 'panel' | 'button' | 'label' | 'image';

interface EditorElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  props: Record<string, string>;
}

type ViewMode = 'designer' | 'export';

export default function App() {
  const [elements, setElements] = useState<EditorElement[]>([
    { id: '1', type: 'panel', x: 50, y: 50, width: 400, height: 220, name: 'Main Background', props: { texture: 'textures/gui/new_bg.png' } },
    { id: '2', type: 'label', x: 70, y: 70, width: 100, height: 20, name: 'Title', props: { text: 'Attribute Points: 5' } },
    { id: '3', type: 'button', x: 70, y: 110, width: 120, height: 30, name: 'Strength +', props: { action: 'increase_str' } }
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>('designer');
  const [selectedFile, setSelectedFile] = useState<string>('RP/ui/attribute_levelup.json');
  
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  const handleGenerateLogic = async () => {
    if (!selectedId || !aiPrompt) return;
    setIsGenerating(true);
    const el = elements.find(e => e.id === selectedId);
    try {
      const res = await fetch("/api/generate-logic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, elementType: el?.type })
      });
      const data = await res.json();
      if (data.result) {
        updateSelectedProp("bedrockCode", data.result);
        setAiPrompt("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateBridgeJSON = () => {
    const controls = elements.map(el => {
      let code = el.props.bedrockCode;
      let extraCode = "";
      if (code && code.startsWith("{") && code.endsWith("}")) {
         extraCode = code.slice(1, -1).trim();
      }
      
      return `
    "${el.name.replace(/ /g, '_').toLowerCase()}": {
      "type": "${el.type === 'image' ? 'custom_image' : el.type}",
      "size": [${el.width}, ${el.height}],
      "offset": [${el.x}, ${el.y}],
      "anchor_from": "top_left",
      "anchor_to": "top_left"${el.type === 'label' ? `,\n      "text": "${el.props.text || ''}"` : ''}${extraCode ? ',\n      ' + extraCode : ''}
    }`;
    }).join(",");

    return `{
  "namespace": "attribute_levelup",
  "main_screen": {
    "type": "panel",
    "controls": [${controls}
    ]
  }
}`;
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    
    const el = elements.find(el => el.id === id);
    if (el) {
      setIsDragging(true);
      // Ensure we drag from the mouse pointer's relative position
      const parentRect = canvasRef.current?.getBoundingClientRect();
      if (parentRect) {
        const mouseX = e.clientX - parentRect.left;
        const mouseY = e.clientY - parentRect.top;
        setDragOffset({
          x: mouseX - el.x,
          y: mouseY - el.y
        });
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging && selectedId && canvasRef.current) {
      const parentRect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - parentRect.left;
      const mouseY = e.clientY - parentRect.top;

      setElements(prev => prev.map(el => {
        if (el.id === selectedId) {
          return {
            ...el,
            x: Math.max(0, Math.round((mouseX - dragOffset.x) / 10) * 10), // snap to 10px grid
            y: Math.max(0, Math.round((mouseY - dragOffset.y) / 10) * 10)
          };
        }
        return el;
      }));
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const addElement = (type: ElementType) => {
    const newEl: EditorElement = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: 100,
      y: 100,
      width: type === 'label' ? 100 : 150,
      height: type === 'label' ? 20 : 40,
      name: `New ${type}`,
      props: {}
    };
    setElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const updateSelectedProp = (key: string, value: string) => {
    if (!selectedId) return;
    setElements(prev => prev.map(el => {
      if (el.id === selectedId) {
        return {
          ...el,
          props: { ...el.props, [key]: value }
        };
      }
      return el;
    }));
  };

   const updateSelectedDimensions = (width: number, height: number) => {
    if (!selectedId) return;
    setElements(prev => prev.map(el => {
      if (el.id === selectedId) {
        return { ...el, width, height };
      }
      return el;
    }));
  };

  const selectedElement = elements.find(el => el.id === selectedId);

  return (
    <div className="w-full h-screen bg-[#1a1a1a] text-[#e0e0e0] font-sans flex flex-col overflow-hidden select-none">
      
      {/* Top Navigation Bar */}
      <header className="h-12 border-b border-[#333] flex items-center justify-between px-4 bg-[#252525] shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#4CAF50] rounded flex items-center justify-center">
               <span className="text-white font-bold text-xs">Bg</span>
            </div>
            <span className="font-bold text-sm tracking-tight uppercase">BlockGui.Edu</span>
          </div>
          <div className="h-6 w-[1px] bg-[#444]"></div>
          <nav className="flex gap-4 text-xs font-medium uppercase tracking-wider text-[#999]">
            <span onClick={() => setViewMode('designer')} className={`cursor-pointer transition-colors ${viewMode === 'designer' ? 'text-blue-400 font-bold' : 'hover:text-white'}`}>Designer</span>
            <span onClick={() => setViewMode('export')} className={`cursor-pointer transition-colors ${viewMode === 'export' ? 'text-blue-400 font-bold' : 'hover:text-white'}`}>Code & Export</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] text-[#777] font-mono mr-4">PROJECT: attribute_levelup.json</div>
          <button className="px-3 py-1 bg-[#444] text-white text-[11px] font-bold uppercase rounded hover:bg-[#555] transition-colors flex items-center gap-1">
             <Play className="w-3 h-3" />
             Preview
          </button>
          <button onClick={() => setViewMode('export')} className="px-3 py-1 bg-[#3498db] text-white text-[11px] font-bold uppercase rounded hover:bg-[#2980b9] transition-colors flex items-center gap-1">
             <Download className="w-3 h-3" /> Export to Bridge
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        
        {viewMode === 'designer' ? (
          <>
            {/* Left Sidebar: Assets & Layers */}
        <aside className="w-64 border-r border-[#333] flex flex-col bg-[#212121] shrink-0">
          <div className="p-3 border-b border-[#333]">
            <div className="text-[10px] font-bold text-[#666] uppercase mb-2">GUI Toolbox</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => addElement('panel')} className="h-10 bg-[#333] border border-[#444] rounded flex items-center justify-center gap-2 text-xs text-[#aaa] hover:bg-[#3a3a3a] hover:border-[#555] cursor-pointer">
                 <Square className="w-4 h-4" /> Panel
              </button>
               <button onClick={() => addElement('button')} className="h-10 bg-[#333] border border-[#444] rounded flex items-center justify-center gap-2 text-xs text-[#aaa] hover:bg-[#3a3a3a] hover:border-[#555] cursor-pointer">
                 <MousePointer2 className="w-4 h-4" /> Button
              </button>
              <button onClick={() => addElement('label')} className="h-10 bg-[#333] border border-[#444] rounded flex items-center justify-center gap-2 text-xs text-[#aaa] hover:bg-[#3a3a3a] hover:border-[#555] cursor-pointer">
                 <Type className="w-4 h-4" /> Label
              </button>
               <button onClick={() => addElement('image')} className="h-10 bg-[#333] border border-[#444] rounded flex items-center justify-center gap-2 text-xs text-[#aaa] hover:bg-[#3a3a3a] hover:border-[#555] cursor-pointer">
                 <ImageIcon className="w-4 h-4" /> Image
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-2 bg-[#2a2a2a] text-[10px] font-bold text-[#888] flex justify-between items-center uppercase">
              <span className="flex items-center gap-1"><Layers className="w-3 h-3"/> Layers</span>
              <span>({elements.length})</span>
            </div>
            <div className="flex-1 bg-[#1e1e1e] overflow-y-auto pt-1">
               {elements.slice().reverse().map(el => (
                  <div 
                    key={el.id}
                    onClick={() => setSelectedId(el.id)}
                    className={`p-2 mx-1 rounded flex items-center gap-2 mb-1 cursor-pointer transition-colors ${selectedId === el.id ? 'bg-[#333] border-l-2 border-blue-500' : 'border-l-2 border-transparent hover:bg-[#2a2a2a]'}`}
                  >
                     {el.type === 'panel' && <Square className="w-3 h-3 text-[#aaa]" />}
                     {el.type === 'button' && <MousePointer2 className="w-3 h-3 text-[#aaa]" />}
                     {el.type === 'label' && <Type className="w-3 h-3 text-[#aaa]" />}
                     {el.type === 'image' && <ImageIcon className="w-3 h-3 text-[#aaa]" />}
                    <span className={`text-[11px] truncate ${selectedId === el.id ? 'text-white' : 'text-[#aaa]'}`}>{el.name}</span>
                  </div>
               ))}
            </div>
          </div>
        </aside>

        {/* Center: Canvas Viewport */}
        <main 
           className="flex-1 bg-[#121212] relative overflow-hidden flex items-center justify-center shadow-inner"
           onPointerMove={handlePointerMove}
           onPointerUp={handlePointerUp}
           onPointerLeave={handlePointerUp}
        >
          {/* Grid Background */}
          <div 
            className="absolute inset-0 pointer-events-none" 
            style={{ 
               backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', 
               backgroundSize: '10px 10px',
               opacity: 0.5
            }}
          />
          
          {/* Main Working Canvas */}
          <div 
             ref={canvasRef}
             className="relative w-[800px] h-[500px] bg-transparent border border-[#333] overflow-hidden"
             onPointerDown={() => setSelectedId(null)} // deselect on map background click
          >
             {elements.map(el => {
                const isSelected = selectedId === el.id;
                return (
                   <div
                     key={el.id}
                     onPointerDown={(e) => handlePointerDown(e, el.id)}
                     style={{
                        position: 'absolute',
                        left: el.x,
                        top: el.y,
                        width: el.width,
                        height: el.height,
                        cursor: isDragging && isSelected ? 'grabbing' : 'grab',
                        border: isSelected ? '1px solid #3498db' : '1px solid transparent',
                        boxShadow: isSelected ? '0 0 0 1px rgba(52, 152, 219, 0.4)' : 'none',
                        zIndex: isSelected ? 10 : 1
                     }}
                     className={`
                        ${el.type === 'panel' ? 'bg-[#c6c6c6] border-[2px] border-t-white border-l-white border-b-[#555] border-r-[#555]' : ''}
                        ${el.type === 'button' ? 'bg-[#d0d0d0] border-[2px] border-t-white border-l-white border-b-[#555] border-r-[#555] flex items-center justify-center active:border-t-[#555] active:border-l-[#555] active:border-b-white active:border-r-white' : ''}
                        ${el.type === 'image' ? 'bg-[#333] opacity-80' : ''}
                     `}
                   >
                     {/* Element Content Rendering */}
                     {el.type === 'label' && (
                        <div className="w-full h-full flex items-center font-mono text-[#404040]" style={{fontSize: '16px', textShadow: '2px 2px 0px #eee'}}>{el.props.text || 'Label'}</div>
                     )}
                     {el.type === 'button' && (
                         <div className="w-full h-full flex items-center justify-center font-mono text-[#404040] text-sm pointer-events-none select-none">{el.name}</div>
                     )}
                     
                     {/* Selection Resize Handles (Visual Only) */}
                     {isSelected && (
                        <>
                           <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 border border-white" />
                           <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 border border-white" />
                           <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 border border-white" />
                           <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 border border-white" />
                        </>
                     )}
                   </div>
                );
             })}
          </div>

          {/* Floating Toolbar */}
          <div className="absolute left-6 top-6 flex flex-col gap-1 z-20 shadow-xl">
             <div className="w-10 h-10 bg-[#1e1e1e] border-2 border-blue-500 rounded flex items-center justify-center text-blue-400 cursor-pointer shadow-[0_0_10px_rgba(59,130,246,0.3)]" title="Selection Tool">
               <MousePointer2 className="w-4 h-4 text-blue-400" />
            </div>
          </div>

          {/* Viewport Label */}
          <div className="absolute bottom-4 left-4 flex gap-4 pointer-events-none">
             <div className="text-[10px] text-[#777] uppercase tracking-widest font-mono bg-[#111]/80 px-2 py-1 rounded backdrop-blur">
               Preview: GUI_Scale_Modern
             </div>
              <div className="text-[10px] text-[#777] uppercase tracking-widest font-mono bg-[#111]/80 px-2 py-1 rounded backdrop-blur">
               Snap to Grid: 10px
             </div>
          </div>
        </main>

        {/* Right Sidebar: Properties */}
        <aside className="w-72 border-l border-[#333] bg-[#212121] flex flex-col shrink-0">
          <div className="p-3 border-b border-[#333] bg-[#252525]">
            <div className="text-[11px] font-bold text-white flex items-center justify-between uppercase">
               <span className="flex items-center gap-1"><Settings2 className="w-3 h-3" /> Properties</span>
               {selectedId && <span className="text-[#666] text-[9px] lowercase font-mono">#{selectedId}</span>}
            </div>
          </div>
          
          <div className="p-4 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
             {!selectedId ? (
                <div className="text-[#666] text-xs text-center mt-10 italic">
                   Select an element to view properties
                </div>
             ) : (
                selectedElement && (
                   <>
                       {/* Identification */}
                     <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-[#666] uppercase">Identification</span>
                        <div className="flex flex-col gap-1">
                           <label className="text-[9px] text-[#888]">Element Name</label>
                           <input 
                              type="text" 
                              value={selectedElement.name} 
                              onChange={(e) => {
                                 setElements(prev => prev.map(el => el.id === selectedId ? {...el, name: e.target.value} : el))
                              }}
                              className="bg-[#111] border border-[#333] rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono transition-colors"
                           />
                        </div>
                     </div>

                     <div className="h-[1px] bg-[#333] w-full" />

                     {/* Geometry */}
                     <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-[#666] uppercase">Geometry & Position</span>
                        <div className="grid grid-cols-2 gap-3 mb-2">
                           <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-[#888]">X Position (px)</label>
                              <div className="flex bg-[#111] border border-[#333] rounded overflow-hidden focus-within:border-blue-500 transition-colors">
                                 <span className="text-[10px] text-[#555] px-2 py-1.5 bg-[#1a1a1a] border-r border-[#333]">X</span>
                                 <input 
                                    type="number" 
                                    value={selectedElement.x} 
                                    readOnly
                                    className="bg-transparent px-2 py-1.5 text-[11px] outline-none text-blue-400 w-full font-mono cursor-default"
                                 />
                              </div>
                           </div>
                           <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-[#888]">Y Position (px)</label>
                              <div className="flex bg-[#111] border border-[#333] rounded overflow-hidden focus-within:border-blue-500 transition-colors">
                                 <span className="text-[10px] text-[#555] px-2 py-1.5 bg-[#1a1a1a] border-r border-[#333]">Y</span>
                                 <input 
                                    type="number" 
                                    value={selectedElement.y} 
                                    readOnly
                                    className="bg-transparent px-2 py-1.5 text-[11px] outline-none text-blue-400 w-full font-mono cursor-default"
                                 />
                              </div>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                           <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-[#888]">Width (px)</label>
                              <div className="flex bg-[#111] border border-[#333] rounded overflow-hidden focus-within:border-blue-500 transition-colors">
                                 <span className="text-[10px] text-[#555] px-2 py-1.5 bg-[#1a1a1a] border-r border-[#333]">W</span>
                                 <input 
                                    type="number" 
                                    value={selectedElement.width} 
                                     onChange={(e) => updateSelectedDimensions(parseInt(e.target.value) || 0, selectedElement.height)}
                                    className="bg-transparent px-2 py-1.5 text-[11px] outline-none text-white w-full font-mono"
                                 />
                              </div>
                           </div>
                           <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-[#888]">Height (px)</label>
                              <div className="flex bg-[#111] border border-[#333] rounded overflow-hidden focus-within:border-blue-500 transition-colors">
                                 <span className="text-[10px] text-[#555] px-2 py-1.5 bg-[#1a1a1a] border-r border-[#333]">H</span>
                                 <input 
                                    type="number" 
                                    value={selectedElement.height} 
                                    onChange={(e) => updateSelectedDimensions(selectedElement.width, parseInt(e.target.value) || 0)}
                                    className="bg-transparent px-2 py-1.5 text-[11px] outline-none text-white w-full font-mono"
                                 />
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="h-[1px] bg-[#333] w-full" />

                     {/* Specific Properties based on Type */}
                     {selectedElement.type === 'label' && (
                        <div className="flex flex-col gap-2">
                           <span className="text-[10px] font-bold text-[#666] uppercase">Label Content</span>
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-[#888]">Text</label>
                              <input 
                                 type="text" 
                                 value={selectedElement.props.text || ''} 
                                 onChange={(e) => updateSelectedProp('text', e.target.value)}
                                 className="bg-[#111] border border-[#333] rounded px-2 py-1.5 text-[11px] outline-none text-green-400 focus:border-green-500 font-mono transition-colors w-full"
                              />
                           </div>
                        </div>
                     )}

                      {/* AI Logic Generator Box */}
                      <div className="h-[1px] bg-[#333] w-full" />
                      <div className="flex flex-col gap-2">
                         <div className="flex items-center gap-1.5 text-[#3498db]">
                           <Wand2 className="w-3.5 h-3.5" />
                           <span className="text-[10px] font-bold uppercase tracking-wider">AI Event Builder</span>
                         </div>
                         <p className="text-[9px] text-[#777] leading-tight">Describe what this element should do. AI will generate the Bedrock JSON logic bindings.</p>
                         <textarea
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="e.g., Increase player strength by 1 when clicked... or show player health amount"
                            className="bg-[#111] border border-[#333] rounded p-2 text-[11px] outline-none text-white focus:border-blue-500 font-sans transition-colors resize-none h-16 w-full"
                         />
                         <button 
                            onClick={handleGenerateLogic}
                            disabled={isGenerating || !aiPrompt}
                            className="py-1.5 px-3 bg-[#3498db] text-white text-[10px] font-bold uppercase rounded hover:bg-[#2980b9] transition-colors w-full flex items-center justify-center gap-2 disabled:opacity-50"
                         >
                            {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Code2 className="w-3 h-3" />}
                            {isGenerating ? "Generating Logic..." : "Generate Bedrock Logic"}
                         </button>
                      </div>

                     {/* JSON Bindings Simulator */}
                     <div className="h-[1px] bg-[#333] w-full" />
                     <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                           <span className="text-[10px] font-bold text-[#666] uppercase">JSON Context</span>
                           <span className="text-[8px] bg-[#333] px-1 py-0.5 rounded text-[#aaa]">Generated</span>
                        </div>
                        <div className="bg-[#111] border border-[#333] p-2.5 rounded h-32 font-mono text-[10px] text-[#aaa] overflow-auto whitespace-pre leading-relaxed shadow-inner custom-scrollbar relative w-full">
                           <span className="text-blue-400">"{selectedElement.name.replace(/ /g, '_').toLowerCase()}"</span>: {"{\n"}
                           &nbsp;&nbsp;<span className="text-purple-400">"type"</span>: <span className="text-green-400">"{selectedElement.type === 'image' ? 'custom_image' : selectedElement.type}"</span>,\n
                           &nbsp;&nbsp;<span className="text-purple-400">"size"</span>: <span className="text-[#dcdcaa]">[{selectedElement.width}, {selectedElement.height}]</span>,\n
                           &nbsp;&nbsp;<span className="text-purple-400">"offset"</span>: <span className="text-[#dcdcaa]">[{selectedElement.x}, {selectedElement.y}]</span>,\n
                           {selectedElement.type === 'label' && (
                              <>&nbsp;&nbsp;<span className="text-purple-400">"text"</span>: <span className="text-green-400">"{selectedElement.props.text}"</span>,\n</>
                           )}
                           {selectedElement.props.bedrockCode ? (
                              <span className="text-yellow-400 whitespace-pre-wrap">{selectedElement.props.bedrockCode.split('\n').filter((_,i) => i>0 && i<selectedElement.props.bedrockCode.split('\n').length-1).join('\n')}</span>
                           ) : (
                              <>&nbsp;&nbsp;<span className="text-[#666] italic">// Use AI Box above to generate logic...</span>\n</>
                           )}
                           {"\n}"}
                        </div>
                     </div>

                     <button 
                        onClick={() => {
                           setElements(prev => prev.filter(e => e.id !== selectedId));
                           setSelectedId(null);
                        }}
                        className="mt-4 w-full py-2 bg-[#4a1f1f] border border-[#ff4a4a] text-[#ffbaba] rounded text-[10px] uppercase font-bold hover:bg-[#662020] transition-colors"
                     >
                        Delete Element
                     </button>
                   </>
                )
             )}
          </div>
        </aside>
       </>
      ) : (
         /* Export / Code Mode */
         <div className="flex w-full h-full">
            <aside className="w-64 border-r border-[#333] bg-[#212121] flex flex-col shrink-0">
               <div className="p-3 border-b border-[#333]">
                  <div className="text-[10px] font-bold text-[#888] uppercase tracking-wider flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5" /> Bridge Workspace
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto p-2">
                  <div 
                     onClick={() => setSelectedFile('RP/ui/attribute_levelup.json')}
                     className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${selectedFile === 'RP/ui/attribute_levelup.json' ? 'bg-[#3498db]/20 text-blue-400' : 'text-[#aaa] hover:bg-[#333]'}`}
                  >
                     <FileJson className="w-3.5 h-3.5" />
                     <span>RP/ui/attribute_levelup.json</span>
                  </div>
                  <div 
                     onClick={() => setSelectedFile('RP/texts/en_US.lang')}
                     className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${selectedFile === 'RP/texts/en_US.lang' ? 'bg-[#3498db]/20 text-blue-400' : 'text-[#aaa] hover:bg-[#333]'}`}
                  >
                     <FileJson className="w-3.5 h-3.5" />
                     <span>RP/texts/en_US.lang</span>
                  </div>
               </div>
               <div className="p-4 border-t border-[#333]">
                 <button onClick={() => {
                     let text = "";
                     if (selectedFile === 'RP/ui/attribute_levelup.json') text = generateBridgeJSON();
                     if (selectedFile === 'RP/texts/en_US.lang') text = `## Text bindings for attribute_levelup.json\n\n${elements.filter(e=>e.type==='label').map(e => `label.${e.name.replace(/ /g, '_').toLowerCase()} = ${e.props.text}`).join('\n')}`;
                     navigator.clipboard.writeText(text);
                     alert(`Copied ${selectedFile} to clipboard!`);
                 }} className="w-full py-2 bg-[#333] hover:bg-[#444] text-white text-xs font-bold uppercase rounded transition-colors border border-[#555]">
                    Copy Current File
                 </button>
               </div>
            </aside>
            <main className="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden">
               <div className="h-10 bg-[#252525] border-b border-[#333] flex items-center px-4 shrink-0">
                  <div className="text-[11px] font-mono text-[#888]">{selectedFile}</div>
               </div>
               <div className="flex-1 p-4 overflow-auto custom-scrollbar">
                  <pre className="text-[12px] font-mono text-[#dcdcaa] leading-relaxed">
                     {selectedFile === 'RP/ui/attribute_levelup.json' && generateBridgeJSON()}
                     {selectedFile === 'RP/texts/en_US.lang' && `## Text bindings for attribute_levelup.json\n\n${elements.filter(e=>e.type==='label').map(e => `label.${e.name.replace(/ /g, '_').toLowerCase()} = ${e.props.text}`).join('\n')}`}
                  </pre>
               </div>
            </main>
         </div>
      )}
      </div>

      {/* Bottom Console */}
      <footer className="h-8 border-t border-[#333] bg-[#1a1a1a] flex items-center px-4 justify-between shrink-0">
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            <span className="text-[10px] text-[#888] font-medium tracking-wide">Connected to Bridge IDE.</span>
          </div>
          <div className="h-4 w-[1px] bg-[#333]"></div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[#555] font-mono">X: {selectedElement ? selectedElement.x : '-'}</span>
            <span className="text-[10px] text-[#555] font-mono">Y: {selectedElement ? selectedElement.y : '-'}</span>
          </div>
        </div>
        <div className="text-[10px] text-[#666] tracking-wider uppercase">Drag & Drop GUI Builder | v1.0.0</div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #111; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #444; 
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555; 
        }
      `}</style>
    </div>
  );
}

