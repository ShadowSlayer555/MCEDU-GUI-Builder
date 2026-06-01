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
  Download,
  Key,
  Upload
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

type ViewMode = 'designer' | 'book_editor' | 'export';
type AppPhase = 'setup' | 'builder';

export default function App() {
  const [appPhase, setAppPhase] = useState<AppPhase>('setup');
  const [toggleLocation, setToggleLocation] = useState<'inventory' | 'book'>('inventory');
  const [toggleName, setToggleName] = useState('Open Custom GUI');
  const [toggleKeybind, setToggleKeybind] = useState('H');
  
  const [guiElements, setGuiElements] = useState<EditorElement[]>([]);
  const [bookElements, setBookElements] = useState<EditorElement[]>([]);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>('designer');
  const [selectedFile, setSelectedFile] = useState<string>('RP/ui/attribute_levelup.json');
  
  const elements = viewMode === 'book_editor' ? bookElements : guiElements;
  const setElements = (value: React.SetStateAction<EditorElement[]>) => {
    if (viewMode === 'book_editor') {
      setBookElements(value);
    } else {
      setGuiElements(value);
    }
  };
  
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('GEMINI_API_KEY') || '');
  const [showSettings, setShowSettings] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  const handleStartBuilder = () => {
    setGuiElements([
      { id: Math.random().toString(36).substr(2, 9), type: 'image', x: 200, y: 150, width: 400, height: 220, name: 'Main Background', props: { texture: 'textures/gui/new_bg.png' } },
      { id: Math.random().toString(36).substr(2, 9), type: 'button', x: 575, y: 155, width: 20, height: 20, name: 'Close Button', props: { text: 'X', action: 'close_gui' } }
    ]);
    if (toggleLocation === 'book') {
       setBookElements([
         { id: Math.random().toString(36).substr(2, 9), type: 'button', x: 20, y: 20, width: 100, height: 20, name: 'Open GUI Toggle', props: { text: toggleName } }
       ]);
    }
    setSelectedFile('README.txt');
    setAppPhase('builder');
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('GEMINI_API_KEY', key);
  };

  const handleGenerateLogic = async () => {
    if (!selectedId || !aiPrompt) return;
    if (!apiKey) {
      alert("Please configure your Gemini API Key in Settings first.");
      setShowSettings(true);
      return;
    }
    
    setIsGenerating(true);
    const el = elements.find(e => e.id === selectedId);
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           system_instruction: { parts: [{ text: "You are an expert at Minecraft Bedrock UI JSON programming." }] },
           contents: [{ role: "user", parts: [{ text: `You are assisting a developer working on a custom GUI in Minecraft Bedrock edition. 
        They selected a "${el?.type}" UI element and provided this instruction: "${aiPrompt}".
        Generate the raw JSON object snippet that implements this logic for Bedrock (e.g., button_mappings for a button, or bindings for a label).
        Return ONLY valid JSON. Omit all markdown formatting like \`\`\`json. Return just the JSON object string.` }] }]
        })
      });
      const data = await response.json();
      if (data.candidates && data.candidates[0].content.parts[0].text) {
         let text = data.candidates[0].content.parts[0].text;
         text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
         updateSelectedProp("bedrockCode", text);
         setAiPrompt("");
      } else {
         throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error("AI Generation Error:", err);
      alert("Failed to generate logic via AI. Ensure your API key is correct and valid.");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateBridgeJSON = () => {
    const controls = guiElements.map(el => {
      let code = el.props.bedrockCode;
      let extraCode = "";
      if (code && code.startsWith("{") && code.endsWith("}")) {
         extraCode = code.slice(1, -1).trim();
      }
      
      let typeField = `"type": "${el.type}",`;
      let elName = el.name.replace(/ /g, '_').toLowerCase();
      
      if (el.type === 'button') {
        typeField = "";
        elName += "@common_buttons.light_text_button";
      } else if (el.type === 'panel' && el.props.texture) {
        typeField = `"type": "image",`;
      }
      
      return `
      {
        "${elName}": {
          ${typeField}
          "size": [${el.width}, ${el.height}],
          "offset": [${el.x}, ${el.y}],
          "anchor_from": "top_left",
          "anchor_to": "top_left"${el.type === 'label' ? `,\n          "text": "${el.props.text || ''}"` : ''}${el.props.texture ? `,\n          "texture": "${el.props.texture}"` : ''}${extraCode ? ',\n          ' + extraCode.replace(/\n      /g, '\n          ') : ''}${el.type === 'button' ? `,\n          "$pressed_button_name": "button.${el.name.replace(/ /g, '_').toLowerCase()}",\n          "$button_text": "label.${el.name.replace(/ /g, '_').toLowerCase()}"` : ''}
        }
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

  const generateToggleJSON = () => {
    return `{
  "namespace": "crafting",

  "recipe_inventory_screen_content@crafting.recipe_inventory_screen_content": {
    "modifications": [
      {
        "array_name": "controls",
        "operation": "insert_back",
        "value": [
          {
            "custom_gui_toggle@common_toggles.light_text_toggle": {
              "size": [100, 20],
              "anchor_from": "top_right",
              "anchor_to": "top_right",
              "offset": [-5, 5],
              "layer": 900,
              "$button_text": "label.open_custom_gui",
              "$toggle_name": "${toggleName}",
              "$toggle_state_binding_name": "#is_custom_gui_open",
              "$toggle_group_default_selected": 0
            }
          },
          {
            "custom_gui_container": {
              "type": "panel",
              "layer": 950,
              "controls": [
                {
                  "my_gui@attribute_levelup.main_screen": {}
                }
              ],
              "bindings": [
                {
                  "binding_type": "view",
                  "source_control_name": "custom_gui_toggle",
                  "source_property_name": "(#toggle_state)",
                  "target_property_name": "#visible"
                }
              ]
            }
          }
        ]
      }
    ]
  }
}`;
  };

  const generateBookJSON = () => {
    const controls = bookElements.map(el => {
      let code = el.props.bedrockCode;
      let extraCode = "";
      if (code && code.startsWith("{") && code.endsWith("}")) {
         extraCode = code.slice(1, -1).trim();
      }
      
      if (el.name.toLowerCase().includes('toggle')) {
        return `
          {
            "${el.name.replace(/ /g, '_').toLowerCase()}@common_toggles.light_text_toggle": {
              "size": [${el.width}, ${el.height}],
              "offset": [${el.x}, ${el.y}],
              "layer": 300,
              "anchor_from": "top_left",
              "anchor_to": "top_left",
              "$button_text": "label.${el.name.replace(/ /g, '_').toLowerCase()}",
              "$toggle_name": "custom_gui_toggle_state",
              "$toggle_state_binding_name": "#is_custom_gui_open",
              "$toggle_group_default_selected": 0${extraCode ? ',\n              ' + extraCode.replace(/\n      /g, '\n              ') : ''}
            }
          }`;
      }
      
      let typeField = `"type": "${el.type}",`;
      let elName = el.name.replace(/ /g, '_').toLowerCase();
      
      if (el.type === 'button') {
        typeField = "";
        elName += "@common_buttons.light_text_button";
      } else if (el.type === 'panel' && el.props.texture) {
        typeField = `"type": "image",`;
      }
      
      return `
          {
            "${elName}": {
              ${typeField}
              "size": [${el.width}, ${el.height}],
              "offset": [${el.x}, ${el.y}],
              "layer": 300,
              "anchor_from": "top_left",
              "anchor_to": "top_left"${el.type === 'label' ? `,\n              "text": "${el.props.text || ''}"` : ''}${el.props.texture ? `,\n              "texture": "${el.props.texture}"` : ''}${extraCode ? ',\n              ' + extraCode.replace(/\n      /g, '\n              ') : ''}${el.type === 'button' ? `,\n              "$pressed_button_name": "button.${el.name.replace(/ /g, '_').toLowerCase()}",\n              "$button_text": "label.${el.name.replace(/ /g, '_').toLowerCase()}"` : ''}
            }
          }`;
    }).join(",");

    const toggleEl = bookElements.find(el => el.name.toLowerCase().includes('toggle'));
    const toggleControlName = toggleEl ? toggleEl.name.replace(/ /g, '_').toLowerCase() : 'custom_gui_toggle';

    return `{
  "namespace": "book",

  "book_screen_content@book.book_screen_content": {
    "modifications": [
      {
        "array_name": "controls",
        "operation": "insert_back",
        "value": [
          {
            "custom_book_overlay_container": {
              "type": "panel",
              "layer": 900,
              "controls": [${controls}
              ]
            }
          },
          {
            "custom_gui_container": {
              "type": "panel",
              "layer": 950,
              "controls": [
                {
                  "my_gui@attribute_levelup.main_screen": {}
                }
              ],
              "bindings": [
                {
                  "binding_type": "view",
                  "source_control_name": "${toggleControlName}",
                  "source_property_name": "(#toggle_state)",
                  "target_property_name": "#visible"
                }
              ]
            }
          }
        ]
      }
    ]
  }
}`;
  };

  const generateUIDefsJSON = () => {
    return `{
  "ui_defs": [
    "ui/attribute_levelup.json",
    "ui/${toggleLocation === 'book' ? 'custom_book_injection.json' : 'custom_inventory_injection.json'}"
  ]
}`;
  };

  const getReadmeText = () => {
    const filename = toggleLocation === 'book' ? 'custom_book_injection.json' : 'custom_inventory_injection.json';
    const targetScreen = toggleLocation === 'book' ? 'book_screen.json' : 'inventory_screen.json';
    
     return `==========================================
CRITICAL BEDROCK UI MODDING RULES
==========================================

Why didn't your hud_screen button or keybind work?
1. MOUSE CURSOR: On PC, you cannot click the HUD because your mouse is locked to the camera. You MUST place your button inside a screen where the cursor is active.
2. FAKE KEYBINDS: Bedrock JSON UI does not allow binding custom keys (like "H") or making up actions.
3. STANDALONE SCREENS: You cannot just make a new file called "my_screen.json" and expect it to magically open. The game only knows vanilla screens.

THE SOLUTION (INJECTION VIA MODIFICATIONS):
To make your GUI work purely with JSON using Bridge IDE WITHOUT destroying your vanilla GUI:

STEP 1: NEVER NAME IT '${targetScreen}'
If you name your file exactly '${targetScreen}', Minecraft completely replaces the vanilla file. Since this snippet only contains the modification block, all the other vanilla panels are lost, causing your screen to be completely empty!

STEP 2: ADD IT TO BRIDGE SAFELY
1. In Bridge IDE, create a **NEW** file in your 'ui' folder with a custom name, for example: 'RP/ui/${filename}'
2. Copy the ENTIRE contents of the 'RP/ui/${filename}' tab and paste it into that new file inside Bridge.
3. Bridge IDE will automatically detect this new UI file and add it to 'ui_defs.json' behind the scenes.
4. Because the file has a different name, the game loads the full real screen first, then safely applies your modification on top!

STEP 3: REGISTER IN _ui_defs.json
1. Bedrock UI files will NOT load automatically! 
2. You must open or create 'RP/ui/_ui_defs.json'
3. Copy the 'RP/ui/_ui_defs.json' file contents from this app and paste them!
4. *NOTE:* Bridge IDE may show yellow tooltips ("expected object" / "matched more than one schema"). These are just Bridge schema bugs! If it's in '_ui_defs.json', it will work perfectly in-game.

STEP 4: ADD YOUR CUSTOM GUI FILE
1. In Bridge, make sure you also created 'RP/ui/attribute_levelup.json'.
2. Paste the 'RP/ui/attribute_levelup.json (Custom GUI)' code from this tool into that new file.
3. Don't forget your 'en_US.lang' texts! 'README.txt' isn't needed in Bridge.
`;
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    
    const el = elements.find(el => el.id === id);
    if (el) {
      setIsDragging(true);
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
            x: Math.max(0, Math.round((mouseX - dragOffset.x) / 10) * 10),
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
      x: 350,
      y: 250,
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
          {appPhase === 'builder' && (
             <nav className="flex gap-4 text-xs font-medium uppercase tracking-wider text-[#999]">
               <span onClick={() => setViewMode('designer')} className={`cursor-pointer transition-colors ${viewMode === 'designer' ? 'text-blue-400 font-bold' : 'hover:text-white'}`}>GUI Designer</span>
               {toggleLocation === 'book' && (
                 <span onClick={() => setViewMode('book_editor')} className={`cursor-pointer transition-colors ${viewMode === 'book_editor' ? 'text-blue-400 font-bold' : 'hover:text-white'}`}>Book Editor</span>
               )}
               <span onClick={() => setViewMode('export')} className={`cursor-pointer transition-colors ${viewMode === 'export' ? 'text-blue-400 font-bold' : 'hover:text-white'}`}>Code & Export</span>
             </nav>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSettings(true)} className="p-1.5 text-[#aaa] hover:text-white hover:bg-[#333] rounded transition-colors" title="Settings">
             <Key className="w-4 h-4" />
          </button>
          {appPhase === 'builder' && (
             <>
               <div className="text-[10px] text-[#777] font-mono mr-4 ml-2">PROJECT: attribute_levelup.json</div>
               <button className="px-3 py-1 bg-[#444] text-white text-[11px] font-bold uppercase rounded hover:bg-[#555] transition-colors flex items-center gap-1">
                  <Play className="w-3 h-3" />
                  Preview
               </button>
               <button onClick={() => setViewMode('export')} className="px-3 py-1 bg-[#3498db] text-white text-[11px] font-bold uppercase rounded hover:bg-[#2980b9] transition-colors flex items-center gap-1">
                  <Download className="w-3 h-3" /> Export to Bridge
               </button>
             </>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        
        {appPhase === 'setup' ? (
           <div className="flex-1 flex flex-col items-center justify-center bg-[#121212] p-8">
              <div className="max-w-md w-full bg-[#212121] border border-[#333] rounded shadow-2xl p-6">
                 <h2 className="text-xl font-bold uppercase tracking-wider text-white mb-2">GUI Configuration</h2>
                 <p className="text-[#aa4444] text-xs font-bold mb-2 uppercase tracking-wide">⚠️ Bedrock Limitation</p>
                 <p className="text-[#888] text-sm mb-6">On PC, the mouse cursor is locked inside the HUD. You also cannot create "fake" keybinds. Because of this, custom GUIs must be injected into an existing screen that uses a cursor (like the Inventory Screen).</p>
                 
                 <div className="flex flex-col gap-4 mb-8">
                    <div className="flex flex-col gap-1.5">
                       <label className="text-[11px] font-bold text-[#aaa] uppercase tracking-wider">Button Location</label>
                       <select 
                          value={toggleLocation} 
                          onChange={(e) => setToggleLocation(e.target.value as 'inventory'|'book')}
                          className="bg-[#111] border border-[#333] px-3 py-2 rounded text-white text-sm outline-none focus:border-blue-500"
                       >
                          <option value="inventory">Inventory Screen (Recommended)</option>
                          <option value="book">Book Screen (Item)</option>
                       </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                       <label className="text-[11px] font-bold text-[#aaa] uppercase tracking-wider">Toggle Button Name</label>
                       <input 
                          type="text" 
                          value={toggleName} 
                          onChange={(e) => setToggleName(e.target.value)}
                          placeholder="e.g. Open Stats"
                          className="bg-[#111] border border-[#333] px-3 py-2 rounded text-white text-sm outline-none focus:border-blue-500"
                       />
                    </div>
                 </div>

                 <button 
                    onClick={handleStartBuilder}
                    className="w-full py-3 bg-[#4CAF50] text-white font-bold uppercase tracking-wide rounded hover:bg-[#45a049] transition-colors shadow-lg"
                 >
                    Start Creating GUI
                 </button>
              </div>
           </div>
        ) : (viewMode === 'designer' || viewMode === 'book_editor') ? (
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
             onPointerDown={() => setSelectedId(null)}
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
                        zIndex: isSelected ? 10 : 1,
                        backgroundImage: (el.type === 'panel' || el.type === 'image') && el.props.previewImage ? `url(${el.props.previewImage})` : 'none',
                        backgroundSize: '100% 100%',
                        backgroundRepeat: 'no-repeat'
                     }}
                     className={`
                        ${el.type === 'panel' && !el.props.previewImage ? 'bg-[#c6c6c6] border-[2px] border-t-white border-l-white border-b-[#555] border-r-[#555]' : ''}
                        ${el.type === 'button' ? 'bg-[#d0d0d0] border-[2px] border-t-white border-l-white border-b-[#555] border-r-[#555] flex items-center justify-center active:border-t-[#555] active:border-l-[#555] active:border-b-white active:border-r-white' : ''}
                        ${el.type === 'image' && !el.props.previewImage ? 'bg-[#333] opacity-80' : ''}
                     `}
                   >
                     {el.type === 'label' && (
                        <div className="w-full h-full flex items-center font-mono text-[#404040]" style={{fontSize: '16px', textShadow: '2px 2px 0px #eee'}}>{el.props.text || 'Label'}</div>
                     )}
                     {el.type === 'button' && (
                         <div className="w-full h-full flex items-center justify-center font-mono text-[#404040] text-sm pointer-events-none select-none">
                            {el.props.text ? el.props.text : el.name}
                         </div>
                     )}
                     
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

          <div className="absolute left-6 top-6 flex flex-col gap-1 z-20 shadow-xl">
             <div className="w-10 h-10 bg-[#1e1e1e] border-2 border-blue-500 rounded flex items-center justify-center text-blue-400 cursor-pointer shadow-[0_0_10px_rgba(59,130,246,0.3)]" title="Selection Tool">
               <MousePointer2 className="w-4 h-4 text-blue-400" />
            </div>
          </div>

          <div className="absolute bottom-4 left-4 flex gap-4 pointer-events-none">
             <div className="text-[10px] text-[#777] uppercase tracking-widest font-mono bg-[#111]/80 px-2 py-1 rounded backdrop-blur">
               Preview: GUI_Scale_Modern
             </div>
              <div className="text-[10px] text-[#777] uppercase tracking-widest font-mono bg-[#111]/80 px-2 py-1 rounded backdrop-blur">
               Snap to Grid: 10px
             </div>
          </div>
        </main>

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

                     {(selectedElement.type === 'label' || selectedElement.type === 'button') && (
                        <div className="flex flex-col gap-2">
                           <span className="text-[10px] font-bold text-[#666] uppercase">Text Content</span>
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-[#888]">Label Text</label>
                              <input 
                                 type="text" 
                                 value={selectedElement.props.text || ''} 
                                 onChange={(e) => updateSelectedProp('text', e.target.value)}
                                 className="bg-[#111] border border-[#333] rounded px-2 py-1.5 text-[11px] outline-none text-green-400 focus:border-green-500 font-mono transition-colors w-full"
                              />
                           </div>
                        </div>
                     )}

                     {(selectedElement.type === 'image' || selectedElement.type === 'panel') && (
                        <div className="flex flex-col gap-2">
                           <span className="text-[10px] font-bold text-[#666] uppercase">Texture Settings</span>
                           <div className="flex flex-col gap-1 mb-2">
                              <label className="text-[9px] text-[#888]">Bedrock Texture Path</label>
                              <input 
                                 type="text" 
                                 value={selectedElement.props.texture || ''} 
                                 onChange={(e) => updateSelectedProp('texture', e.target.value)}
                                 placeholder="textures/ui/..."
                                 className="bg-[#111] border border-[#333] rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono transition-colors w-full"
                              />
                           </div>
                           <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-[#888]">Local Preview Image</label>
                              <label className="cursor-pointer bg-[#333] border border-[#444] rounded px-2 py-1.5 text-[11px] text-center text-[#aaa] hover:bg-[#3a3a3a] hover:text-white transition-colors flex items-center justify-center gap-2">
                                 <Upload className="w-3.5 h-3.5" />
                                 {selectedElement.props.previewImage ? 'Change Image...' : 'Upload Image...'}
                                 <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden"
                                    onChange={(e) => {
                                       const file = e.target.files?.[0];
                                       if (file) {
                                          const reader = new FileReader();
                                          reader.onload = (ev) => {
                                             updateSelectedProp('previewImage', ev.target?.result as string);
                                          };
                                          reader.readAsDataURL(file);
                                       }
                                    }}
                                 />
                              </label>
                              {selectedElement.props.previewImage && (
                                 <button 
                                    onClick={() => {
                                       const { previewImage, ...newProps } = selectedElement.props;
                                       setElements(prev => prev.map(el => el.id === selectedId ? { ...el, props: newProps } : el));
                                    }}
                                    className="text-[9px] text-red-400 hover:text-red-300 mt-1 self-start"
                                 >
                                    Remove Preview
                                 </button>
                              )}
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

                     {/* JSON Context */}
                     <div className="h-[1px] bg-[#333] w-full" />
                     <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                           <span className="text-[10px] font-bold text-[#666] uppercase">JSON Context</span>
                           <span className="text-[8px] bg-[#333] px-1 py-0.5 rounded text-[#aaa]">Generated</span>
                        </div>
                        <div className="bg-[#111] border border-[#333] p-2.5 rounded h-32 font-mono text-[10px] text-[#aaa] overflow-auto whitespace-pre leading-relaxed shadow-inner custom-scrollbar relative w-full">
                           <span className="text-blue-400">"{selectedElement.name.replace(/ /g, '_').toLowerCase()}"</span>: {"{\n"}
                           &nbsp;&nbsp;<span className="text-purple-400">"type"</span>: <span className="text-green-400">"{selectedElement.type}"</span>,\n
                           &nbsp;&nbsp;<span className="text-purple-400">"size"</span>: <span className="text-[#dcdcaa]">[{selectedElement.width}, {selectedElement.height}]</span>,\n
                           &nbsp;&nbsp;<span className="text-purple-400">"offset"</span>: <span className="text-[#dcdcaa]">[{selectedElement.x}, {selectedElement.y}]</span>,\n
                           {selectedElement.type === 'label' && (
                              <>&nbsp;&nbsp;<span className="text-purple-400">"text"</span>: <span className="text-green-400">"{selectedElement.props.text}"</span>,\n</>
                           )}
                           {selectedElement.props.texture && (
                              <>&nbsp;&nbsp;<span className="text-purple-400">"texture"</span>: <span className="text-green-400">"{selectedElement.props.texture}"</span>,\n</>
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
                     onClick={() => setSelectedFile('README.txt')}
                     className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${selectedFile === 'README.txt' ? 'bg-[#3498db]/20 text-blue-400' : 'text-[#aaa] hover:bg-[#333]'}`}
                  >
                     <FileJson className="w-3.5 h-3.5" />
                     <span>README.txt</span>
                  </div>
                  <div 
                     onClick={() => setSelectedFile('RP/ui/attribute_levelup.json')}
                     className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${selectedFile === 'RP/ui/attribute_levelup.json' ? 'bg-[#3498db]/20 text-blue-400' : 'text-[#aaa] hover:bg-[#333]'}`}
                  >
                     <FileJson className="w-3.5 h-3.5" />
                     <span>RP/ui/attribute_levelup.json (Custom GUI)</span>
                  </div>
                  <div 
                     onClick={() => setSelectedFile(toggleLocation === 'book' ? 'RP/ui/custom_book_injection.json' : 'RP/ui/custom_inventory_injection.json')}
                     className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${(selectedFile === 'RP/ui/custom_inventory_injection.json' || selectedFile === 'RP/ui/custom_book_injection.json') ? 'bg-[#3498db]/20 text-blue-400' : 'text-[#aaa] hover:bg-[#333]'}`}
                  >
                     <FileJson className="w-3.5 h-3.5" />
                     <span>{toggleLocation === 'book' ? 'RP/ui/custom_book_injection.json (Modifications)' : 'RP/ui/custom_inventory_injection.json (Modifications)'}</span>
                  </div>
                  <div 
                     onClick={() => setSelectedFile('RP/ui/_ui_defs.json')}
                     className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${selectedFile === 'RP/ui/_ui_defs.json' ? 'bg-[#3498db]/20 text-blue-400' : 'text-[#aaa] hover:bg-[#333]'}`}
                  >
                     <FileJson className="w-3.5 h-3.5" />
                     <span>RP/ui/_ui_defs.json</span>
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
                     if (selectedFile === 'README.txt') text = getReadmeText();
                     if (selectedFile === 'RP/ui/attribute_levelup.json') text = generateBridgeJSON();
                     if (selectedFile === 'RP/ui/custom_inventory_injection.json' || selectedFile === 'RP/ui/custom_book_injection.json') {
                         text = toggleLocation === 'book' ? generateBookJSON() : generateToggleJSON();
                     }
                     if (selectedFile === 'RP/ui/_ui_defs.json') text = generateUIDefsJSON();
                     if (selectedFile === 'RP/texts/en_US.lang') {
                        const allElements = [...guiElements, ...bookElements];
                        const labels = allElements.filter(e=>e.type==='label').map(e => `label.${e.name.replace(/ /g, '_').toLowerCase()} = ${e.props.text}`).join('\n');
                        const toggleStr = `label.open_custom_gui = ${toggleName}`;
                        text = `## Text bindings for attribute_levelup.json\n\n${toggleStr}\n${labels}`;
                     }
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
                     {selectedFile === 'README.txt' && getReadmeText()}
                     {selectedFile === 'RP/ui/_ui_defs.json' && generateUIDefsJSON()}
                     {selectedFile === 'RP/ui/attribute_levelup.json' && generateBridgeJSON()}
                     {(selectedFile === 'RP/ui/custom_inventory_injection.json' || selectedFile === 'RP/ui/custom_book_injection.json') && (toggleLocation === 'book' ? generateBookJSON() : generateToggleJSON())}
                     {selectedFile === 'RP/texts/en_US.lang' && (
                        `## Text bindings for attribute_levelup.json\n\n` + 
                        `label.open_custom_gui = ${toggleName}\n` +
                        `${[...guiElements, ...bookElements].filter(e=>e.type==='label').map(e => `label.${e.name.replace(/ /g, '_').toLowerCase()} = ${e.props.text}`).join('\n')}`
                     )}
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
            <span className="text-[10px] text-[#888] font-medium tracking-wide">Ready for Bridge IDE.</span>
          </div>
          {appPhase === 'builder' && selectedElement && (
            <>
               <div className="h-4 w-[1px] bg-[#333]"></div>
               <div className="flex items-center gap-3">
               <span className="text-[10px] text-[#555] font-mono">X: {selectedElement.x}</span>
               <span className="text-[10px] text-[#555] font-mono">Y: {selectedElement.y}</span>
               </div>
            </>
          )}
        </div>
        <div className="text-[10px] text-[#666] tracking-wider uppercase">Drag & Drop GUI Builder | v1.1.0</div>
      </footer>

      {showSettings && (
         <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-sm bg-[#212121] border border-[#333] rounded shadow-2xl p-6">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">API Settings</h3>
                  <button onClick={() => setShowSettings(false)} className="text-[#888] hover:text-white"><X className="w-5 h-5"/></button>
               </div>
               <div className="flex flex-col gap-2 mb-6">
                  <label className="text-[11px] font-bold text-[#aaa] uppercase tracking-wider">Gemini API Key</label>
                  <input 
                     type="password"
                     value={apiKey}
                     onChange={(e) => saveApiKey(e.target.value)}
                     placeholder="AIzaSy..."
                     className="bg-[#111] border border-[#333] px-3 py-2 rounded text-white text-sm outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-[#555] leading-tight">Key is stored locally in your browser. Required to generate Bedrock JSON logic with AI.</p>
               </div>
               <button onClick={() => setShowSettings(false)} className="w-full py-2 bg-[#3498db] text-white font-bold uppercase rounded hover:bg-[#2980b9] text-xs">Save & Close</button>
            </div>
         </div>
      )}

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

