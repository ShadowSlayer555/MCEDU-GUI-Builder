import React, { useState, useRef, MouseEvent, useEffect } from "react";
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
  Upload,
  List,
  SlidersHorizontal,
  TextCursorInput,
  CheckSquare,
  Sparkles,
  Users,
  Terminal,
  GripVertical,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown
} from "lucide-react";

type ElementType =
  | "button"
  | "label"
  | "image"
  | "dropdown"
  | "slider"
  | "textfield"
  | "toggle"
  | "player_picker";

interface EditorElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  props: Record<string, string>;
  variableActions?: {
    varId: string;
    amount: number | string;
    actionType?: "increment" | "set";
    required?: boolean;
  }[];
  variableActionsTarget?: {
    varId: string;
    amount: number | string;
    actionType?: "increment" | "set";
    required?: boolean;
  }[];
}

type ViewMode = "designer" | "variables" | "export" | "triggers";
type AppPhase = "setup" | "builder";

interface GuiSlide {
  id: string;
  name: string;
  slideType: "interactive" | "text_display";
  elements: EditorElement[];
}

interface CustomTrigger {
  id: string;
  type: "itemUse" | "blockBreak" | "entityHit" | "chatCommand" | "aiGenerated";
  config: any;
}

interface ProjectData {
  id: string;
  name: string;
  variables?: Variable[];
  guiSlides: GuiSlide[];
  customTriggers: CustomTrigger[];
  openedFrom: "book" | "modded_item" | "hidden";
  moddedItemName: string;
  bookElements: EditorElement[];
  activeSlideId: string;
}

const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const MC_EVENTS = [
  "custom_item",
  "xpGained",
  "playerBreakBlock",
  "playerPlaceBlock",
  "buttonPush",
  "chatSend",
  "entityDie",
  "entityHurt",
  "entityHitEntity",
  "entityHitBlock",
  "itemCompleteUse",
  "itemReleaseUse",
  "itemStartUse",
  "itemUse",
  "itemUseOn",
  "playerJoin",
  "playerLeave",
  "playerSpawn",
  "weatherChange",
  "tick",
  "complex_script",
];

interface VariableIncrement {
  event: string;
  amount: number;
  aiGeneratedCode?: string;
  customItemId?: string;
  destroyItemOnUse?: boolean;
  xpThreshold?: number;
}

interface VariableHUD {
  enabled: boolean;
  style: "text" | "bar" | "icons" | "solid_bar" | "squares";
  color: string;
  iconText?: string;
  maxOverride?: number;
}

interface Variable {
  id: string;
  name: string;
  scope: "player" | "global";
  min: number | null;
  max: number | null;
  increments: VariableIncrement[];
  hud?: VariableHUD;
}

const VariableHighlightInput = ({ value, onChange, placeholder, className, variablesList = [], ...props }: any) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const handleScroll = (e: React.UIEvent<HTMLInputElement>) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const valStr = (value || "").toString();

  // We place the input FIRST (z-10) and the overlay SECOND (z-20 pointer-events-none).
  // The overlay has the exact same padding, font, and text-align as the input.
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ padding: 0 }}>
      {/* Actual input layer (white text) */}
      <input
        type="text"
        value={value}
        onChange={onChange}
        onScroll={handleScroll}
        spellCheck={false}
        placeholder={placeholder}
        className="block w-full h-full bg-transparent px-2 py-1.5 font-mono text-[11px] outline-none z-10 relative text-white caret-white"
        {...props}
      />
      {/* Overlay highlight layer - intercepts variables and colors them blue */}
      <div 
         ref={scrollRef}
         aria-hidden="true"
         className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none px-2 py-1.5 font-mono text-[11px] whitespace-pre overflow-hidden z-20 flex items-center"
      >
        {!valStr ? null : (
           valStr.split(/(\{.*?\})/g).map((part: string, i: number) => {
             if (part.startsWith('{') && part.endsWith('}')) {
                 const varName = part.substring(1, part.length - 1);
                 const isValid = variablesList.some((v: any) => v.name === varName);
                 if (isValid) {
                     return <span key={i} className="text-[#60a5fa] bg-[#3b82f6]/30 font-bold rounded-[2px]" style={{ padding: '0 1px', margin: '0 -1px' }}>{part}</span>;
                 }
                 // If invalid, keep it red/transparent to indicate it wasn't captured, but let's just make it transparent as regular text
                 return <span key={i} className="text-transparent">{part}</span>;
             }
             return <span key={i} className="text-transparent">{part}</span>;
           })
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [variables, setVariables] = useState<Variable[]>([]);
  const [bpUuid1, setBpUuid1] = useState(generateUUID);
  const [bpUuid2, setBpUuid2] = useState(generateUUID);
  const [bpUuid3, setBpUuid3] = useState(generateUUID);
  const [rpUuid1, setRpUuid1] = useState(generateUUID);
  const [rpUuid2, setRpUuid2] = useState(generateUUID);
  const [projectName, setProjectName] = useState("untitled_project");
  
  const [projectsList, setProjectsList] = useState<ProjectData[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>("");

  const [appPhase, setAppPhase] = useState<AppPhase | "dashboard">("setup");
  const [customTriggers, setCustomTriggers] = useState<CustomTrigger[]>([]);
  const [inGameLogs, setInGameLogs] = useState(false);
  const [openedFrom, setOpenedFrom] = useState<
    "book" | "modded_item" | "hidden"
  >("book");
  const [moddedItemName, setModdedItemName] = useState("my_mod:magic_wand");
  const [baseBPManifest, setBaseBPManifest] = useState("");
  const [baseRPManifest, setBaseRPManifest] = useState("");

  const [guiSlides, setGuiSlides] = useState<GuiSlide[]>([
    {
      id: "main",
      name: "Main GUI",
      slideType: "interactive",
      elements: [],
    },
  ]);
  const [activeSlideId, setActiveSlideId] = useState<string>("main");
  const [showSlideModal, setShowSlideModal] = useState(false);

  const [bookElements, setBookElements] = useState<EditorElement[]>([]);

  const guiElements = guiSlides.find((s) => s.id === activeSlideId)?.elements || [];
  const setGuiElements = (updater: React.SetStateAction<EditorElement[]>) => {
    setGuiSlides((prev) =>
      prev.map((s) => {
        if (s.id === activeSlideId) {
          const nextElements =
            typeof updater === "function" ? updater(s.elements) : updater;
          return { ...s, elements: nextElements };
        }
        return s;
      }),
    );
  };

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("designer");
  const [selectedFile, setSelectedFile] =
    useState<string>("BP/scripts/main.js");

  const elements = viewMode === "book_editor" ? bookElements : guiElements;
  const setElements = (value: React.SetStateAction<EditorElement[]>) => {
    if (viewMode === "book_editor") {
      setBookElements(value);
    } else {
      setGuiElements(value);
    }
  };

  const handleLayerDragStart = (e: React.DragEvent, id: string) => {
    setDraggedLayerId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleLayerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleLayerDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedLayerId || draggedLayerId === targetId) {
      setDraggedLayerId(null);
      return;
    }

    const items = [...elements];
    const draggedIndex = items.findIndex((el) => el.id === draggedLayerId);
    const targetIndex = items.findIndex((el) => el.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [reorderedItem] = items.splice(draggedIndex, 1);
      items.splice(targetIndex, 0, reorderedItem);
      setElements(items);
    }

    setDraggedLayerId(null);
  };

  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiVarPrompt, setAiVarPrompt] = useState("");
  const [isGeneratingVar, setIsGeneratingVar] = useState(false);

  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem("GEMINI_API_KEY") || "",
  );
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getActiveProjectData = (): ProjectData => ({
    id: activeProjectId || generateUUID(),
    name: projectName,
    guiSlides,
    customTriggers,
    openedFrom,
    moddedItemName,
    bookElements: bookElements || [],
    activeSlideId
  });

  const saveCurrentToList = () => {
    setProjectsList((prev) => {
      let pData = getActiveProjectData();
      if (prev.length === 0) return [pData];
      const exists = prev.some(p => p.id === pData.id);
      if (exists) {
        return prev.map(p => p.id === pData.id ? pData : p);
      }
      return [...prev, pData];
    });
  };

  const handleSaveProject = () => {
    saveCurrentToList();
    const isMultiOutput = projectsList.length > 1;
    
    // We can either export exactly the active project or the whole list.
    // However, the standard save saves the entire multi-project array if there's more than one.
    const projectData = {
      isMultiProject: true,
      projectsList: projectsList.map(p => p.id === activeProjectId ? getActiveProjectData() : p),
      variables, // export global variables at root
      bpUuid1,
      bpUuid2,
      bpUuid3,
      rpUuid1,
      rpUuid2,
      baseBPManifest,
      baseRPManifest,
      // fallback old fields
      projectName,
      customTriggers,
      openedFrom,
      moddedItemName,
      guiSlides,
      bookElements,
    };
    const jsonStr = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${isMultiOutput ? "merged_gui_workspace" : projectName.replace(/[^a-z0-9_-]/gi, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadProjectData = (data: any) => {
    if (data.bpUuid1) setBpUuid1(data.bpUuid1);
    if (data.bpUuid2) setBpUuid2(data.bpUuid2);
    if (data.bpUuid3) setBpUuid3(data.bpUuid3);
    if (data.rpUuid1) setRpUuid1(data.rpUuid1);
    if (data.rpUuid2) setRpUuid2(data.rpUuid2);
    if (data.baseBPManifest !== undefined)
      setBaseBPManifest(data.baseBPManifest);
    if (data.baseRPManifest !== undefined)
      setBaseRPManifest(data.baseRPManifest);

    let incomingList: ProjectData[] = [];
    let incomingVars: Variable[] = data.variables || [];
    
    if (data.isMultiProject && data.projectsList) {
       incomingList = data.projectsList;
       // Extract any old project-level variables just in case
       incomingList.forEach(p => {
         if (p.variables) {
            p.variables.forEach((v: Variable) => {
                if (!incomingVars.some(iv => iv.name === v.name)) {
                   incomingVars.push(v);
                }
            });
         }
       });
    } else {
       // Single legacy format
       let parsedSlides: GuiSlide[] = data.guiSlides || [];
       if (!data.guiSlides && data.guiElements) {
         const hasInputs = data.guiElements.some((el: any) =>
           ["dropdown", "slider", "textfield", "toggle", "player_picker"].includes(el.type),
         );
         const numLabels = data.guiElements.filter((el: any) => el.type === "label").length;
         parsedSlides = [{
           id: "main",
           name: "Main GUI",
           slideType: !hasInputs && numLabels > 1 ? "text_display" : "interactive",
           elements: data.guiElements,
         }];
       }
       if (parsedSlides.length === 0) {
         parsedSlides = [{
            id: "main",
            name: "Main Screen",
            slideType: "interactive",
            elements: []
         }];
       }

       incomingList = [{
         id: generateUUID(),
         name: data.projectName || "imported_project",
         guiSlides: parsedSlides,
         customTriggers: data.customTriggers || [],
         openedFrom: data.openedFrom || "book",
         moddedItemName: data.moddedItemName || "my_mod:magic_wand",
         bookElements: data.bookElements || [],
         activeSlideId: parsedSlides[0]?.id || "main"
       }];
    }

    const allAvailableVars = [...variables, ...incomingVars];

    incomingVars.forEach(iv => {
        if (!iv.id) iv.id = generateUUID();
        if (iv.increments) {
            iv.increments = iv.increments.filter(inc => MC_EVENTS.includes(inc.event));
        }
    });

    // Cleanup deprecated/invalid fields
    incomingList.forEach(p => {
        if (p.customTriggers) {
             const validTriggerTypes = ["itemUse", "blockBreak", "entityHit", "chatCommand", "aiGenerated"];
             p.customTriggers = p.customTriggers.filter(t => validTriggerTypes.includes(t.type));
        }

        p.guiSlides.forEach((slide: GuiSlide) => {
            slide.elements.forEach(el => {
                if (el.props.boundVariable) {
                    let matchedVar = allAvailableVars.find(v => v.id === el.props.boundVariable || v.name === el.props.boundVariable);
                    if (!matchedVar) {
                        delete el.props.boundVariable;
                    } else {
                        el.props.boundVariable = matchedVar.id;
                    }
                }
                
                if (el.variableActions) {
                     el.variableActions = el.variableActions.filter(act => {
                         if (act.varId.startsWith("_NAV_")) return true;
                         let matchedVar = allAvailableVars.find(v => v.id === act.varId || v.name === act.varId);
                         if (!matchedVar) return false;
                         act.varId = matchedVar.id;
                         return true;
                     });
                     if (el.variableActions.length === 0) {
                        delete el.variableActions;
                     }
                }

                if (el.variableActionsTarget) {
                    el.variableActionsTarget = el.variableActionsTarget.filter(act => {
                        if (act.varId.startsWith("_NAV_")) return true;
                        let matchedVar = allAvailableVars.find(v => v.id === act.varId || v.name === act.varId);
                        if (!matchedVar) return false;
                        act.varId = matchedVar.id;
                        return true;
                    });
                    if (el.variableActionsTarget.length === 0) {
                       delete el.variableActionsTarget;
                    }
                }
            });
        });
    });

    setProjectsList(prev => {
       const newList = [...prev, ...incomingList];
       return newList;
    });
    
    setVariables(prev => {
       const newVars = [...prev];
       incomingVars.forEach(iv => {
           if (!newVars.some(v => v.name === iv.name)) {
               newVars.push(iv);
           }
       });
       return newVars;
    });

    if (appPhase !== "dashboard") {
       setAppPhase("dashboard");
    }
  };

  const handleLoadProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          loadProjectData(data);
        } catch (err) {
          alert("Failed to load project: Invalid file format.");
        }
      };
      reader.readAsText(file);
    }
    if (event.target) {
      event.target.value = "";
    }
  };

  const openProject = (projId: string) => {
    const p = projectsList.find(p => p.id === projId);
    if (!p) return;
    setActiveProjectId(p.id);
    setProjectName(p.name);
    setGuiSlides(p.guiSlides || []);
    setCustomTriggers(p.customTriggers || []);
    setOpenedFrom(p.openedFrom || "book");
    setModdedItemName(p.moddedItemName || "my_mod:magic_wand");
    setBookElements(p.bookElements || []);
    setActiveSlideId(p.activeSlideId || p.guiSlides[0]?.id || "main");
    setAppPhase("builder");
  };

  const canvasRef = useRef<HTMLDivElement>(null);

  const handleStartBuilder = (initialType: "interactive" | "text_display" = "interactive") => {
    setGuiSlides([
      {
        id: "main",
        name: "Main GUI",
        slideType: initialType,
        elements: [
          {
            id: Math.random().toString(36).substr(2, 9),
            type: "label",
            x: 200,
            y: 100,
            width: 400,
            height: 20,
            name: "Title",
            props: { text: "My Custom UI" },
          },
          {
            id: Math.random().toString(36).substr(2, 9),
            type: "button",
            x: 200,
            y: 250,
            width: 200,
            height: 30,
            name: "Close Button",
            props: { text: "Close", action: "close_gui" },
          },
        ]
      }
    ]);
    setActiveSlideId("main");
    setSelectedFile("BP/scripts/main.js");
    setAppPhase("builder");
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem("GEMINI_API_KEY", key);
  };

  const handleGenerateVariable = async () => {
    if (!aiVarPrompt) return;
    if (!apiKey) {
      alert("Please configure your Gemini API Key in Settings first.");
      setShowSettings(true);
      return;
    }
    setIsGeneratingVar(true);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: "You are an expert at Minecraft Bedrock script API development.",
                },
              ],
            },
            generationConfig: { responseMimeType: "application/json" },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `You are assisting a developer working on a custom Bedrock add-on. They provided this request for a new stat or variable to track using the Script API: "${aiVarPrompt}". Generate a JSON object with this exact structure: { "name": "VariableName", "scope": "player" | "global", "increments": [ { "event": "complex_script", "amount": 1, "customCode": "// Define custom AI logic for this variable here!\\n// world.afterEvents.entityDie.subscribe((event) => { /* logic involving player */ });" } ] } Return ONLY valid JSON. Omit all markdown formatting. The variable name must be alphanumeric and under 16 characters.`,
                  },
                ],
              },
            ],
          }),
        },
      );
      const data = await response.json();
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        let text = data.candidates[0].content.parts[0].text;
        text = text
          .replace(/```json/gi, "")
          .replace(/```/g, "")
          .trim();
        const newVar = JSON.parse(text);
        setVariables((prev) => [
          ...prev,
          {
            id: generateUUID(),
            name: newVar.name || "AIVar",
            scope: newVar.scope === "global" ? "global" : "player",
            min: null,
            max: null,
            increments:
              newVar.increments?.map((inc: any) => ({
                event: inc.event || "complex_script",
                amount: inc.amount || 1,
                aiGeneratedCode: inc.customCode,
              })) || [],
          },
        ]);
        setAiVarPrompt("");
      } else {
        throw new Error("Invalid response format");
      }
    } catch (e: any) {
      alert("Failed to generate variable: " + e.message);
    } finally {
      setIsGeneratingVar(false);
    }
  };

  const handleGenerateLogic = async () => {
    if (!selectedId || !aiPrompt) return;
    if (!apiKey) {
      alert("Please configure your Gemini API Key in Settings first.");
      setShowSettings(true);
      return;
    }

    setIsGenerating(true);
    const el = elements.find((e) => e.id === selectedId);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: "You are an expert at Minecraft Bedrock UI JSON programming.",
                },
              ],
            },
            generationConfig: { responseMimeType: "application/json" },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `You are assisting a developer working on a custom GUI in Minecraft Bedrock edition. 
        They selected a "${el?.type}" UI element and provided this instruction: "${aiPrompt}".
        Generate the raw JSON object snippet that implements this logic for Bedrock (e.g., button_mappings for a button, or bindings for a label).
        Return ONLY valid JSON. Omit all markdown formatting like \`\`\`json. Return just the JSON object string.`,
                  },
                ],
              },
            ],
          }),
        },
      );
      const data = await response.json();
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        let text = data.candidates[0].content.parts[0].text;
        text = text
          .replace(/```json/gi, "")
          .replace(/```/g, "")
          .trim();
        updateSelectedProp("bedrockCode", text);
        setAiPrompt("");
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error("AI Generation Error:", err);
      alert(
        "Failed to generate logic via AI. Ensure your API key is correct and valid.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const generateBPManifest = () => {
    let base = null;
    try {
      if (baseBPManifest.trim() !== "") {
        base = JSON.parse(baseBPManifest);
      }
    } catch (e) {}

    if (base) {
      if (!base.modules) base.modules = [];
      if (!base.dependencies) base.dependencies = [];

      // Add script module if missing
      if (!base.modules.some((m: any) => m.type === "script")) {
        base.modules.push({
          type: "script",
          language: "javascript",
          uuid: bpUuid3,
          version: [1, 0, 0],
          entry: "scripts/main.js",
        });
      }

      // Add required dependencies if missing
      if (
        !base.dependencies.some(
          (d: any) => d.module_name === "@minecraft/server",
        )
      ) {
        base.dependencies.push({
          module_name: "@minecraft/server",
          version: "1.14.0",
        });
      }
      if (
        !base.dependencies.some(
          (d: any) => d.module_name === "@minecraft/server-ui",
        )
      ) {
        base.dependencies.push({
          module_name: "@minecraft/server-ui",
          version: "1.3.0",
        });
      }

      return JSON.stringify(base, null, 4);
    }

    return JSON.stringify(
      {
        format_version: 2,
        metadata: {
          authors: ["Umbra_Atelier"],
          generated_with: { bridge: ["2.7.54"] },
        },
        header: {
          name: projectName,
          description: "Script API UI Behavior Pack",
          min_engine_version: [1, 21, 120],
          uuid: bpUuid1,
          version: [1, 0, 0],
        },
        modules: [
          {
            type: "data",
            uuid: bpUuid2,
            version: [1, 0, 0],
          },
          {
            type: "script",
            language: "javascript",
            uuid: bpUuid3,
            version: [1, 0, 0],
            entry: "scripts/main.js",
          },
        ],
        dependencies: [
          {
            uuid: rpUuid1,
            version: [1, 0, 0],
          },
          {
            module_name: "@minecraft/server",
            version: "1.14.0",
          },
          {
            module_name: "@minecraft/server-ui",
            version: "1.3.0",
          },
        ],
      },
      null,
      4,
    );
  };

  const generateRPManifest = () => {
    let base = null;
    try {
      if (baseRPManifest.trim() !== "") {
        base = JSON.parse(baseRPManifest);
      }
    } catch (e) {}

    if (base) {
      return JSON.stringify(base, null, 4);
    }

    return JSON.stringify(
      {
        format_version: 2,
        metadata: {
          authors: ["Umbra_Atelier"],
          generated_with: { bridge: ["2.7.54"] },
        },
        header: {
          name: projectName,
          description: "Custom UI Resource Pack",
          min_engine_version: [1, 21, 120],
          uuid: rpUuid1,
          version: [1, 0, 0],
        },
        modules: [
          {
            type: "resources",
            uuid: rpUuid2,
            version: [1, 0, 0],
          },
        ],
        dependencies: [
          {
            uuid: bpUuid1,
            version: [1, 0, 0],
          },
        ],
      },
      null,
      4,
    );
  };

  const generateScriptAPI = () => {
    let guiFunctionsCode = "";

    guiSlides.forEach((slide) => {
      const isModal = slide.elements.some((e) =>
        ["dropdown", "slider", "textfield", "toggle", "player_picker"].includes(
          e.type,
        ),
      );
      const buttons = slide.elements.filter((e) => e.type === "button");
      const labels = slide.elements.filter((e) => e.type === "label");
      const inputs = slide.elements.filter((e) =>
        ["dropdown", "slider", "textfield", "toggle", "player_picker"].includes(
          e.type,
        ),
      );

      const title = labels[0]?.props.text || "Custom UI";

      let formType = isModal ? "ModalFormData" : "ActionFormData";
      let formBuilder = `const form = new ${formType}();\n  form.title("${title}");`;

      const replaceVars = (str: string) => {
        let newStr = str;
        variables.forEach((v) => {
          newStr = newStr.replace(
            new RegExp(`\\{${v.name}\\}`, "g"),
            `\${getVar("${v.scope}", "${v.name}", player)}`,
          );
        });
        return newStr;
      };

      const formatString = (val: string) => {
        const replaced = replaceVars(val);
        if (replaced !== val) return `\`${replaced}\``;
        return `"${val}"`;
      };

      // Dynamic body builder for bound variables
      const bodyLines = labels.slice(1).map((l) => {
        // Legacy boundVariable check
        if (l.props.boundVariable) {
          let v = variables.find((v) => v.id === l.props.boundVariable);
          if (v) {
            const labelPrefix = ["0", "value", "var", "0.0", "1"].includes(
              l.props.text.trim(),
            )
              ? ""
              : l.props.text + " ";
            return `\`${labelPrefix}\${getVar("${v.scope}", "${v.name}", player)}\``;
          }
        }
        return formatString(l.props.text);
      });

      if (!isModal && bodyLines.length > 0) {
        formBuilder += `\n  form.body(${bodyLines.join(' + "\\n" + ')});`;
      }

      let logicCode = "";

      const generateVarActionCode = (
        btnActions?: {
          varId: string;
          amount: number | string;
          actionType?: "increment" | "set";
          required?: boolean;
        }[],
        targetName: string = "player",
      ) => {
        if (!btnActions || btnActions.length === 0) return "";
        let code = "";

        const resolveAmount = (amountVal: number | string) => {
          if (typeof amountVal === "number") return `(${amountVal})`;
          if (typeof amountVal === "string") {
            let isNegative = false;
            let strippedAmount = amountVal;
            if (strippedAmount.startsWith("-")) {
              isNegative = true;
              strippedAmount = strippedAmount.substring(1);
            }
            
            if (strippedAmount.startsWith("{") && strippedAmount.endsWith("}")) {
              const name = strippedAmount.slice(1, -1);
              const elIndex = inputs.findIndex(
                (i) => (i.props.text || i.name) === name,
              );
              
              let valExp = "";
              if (elIndex >= 0) {
                valExp = `(parseFloat(formValues[${elIndex}]) || 0)`;
              } else {
                const v = variables.find((v) => v.name === name);
                if (v) {
                  valExp = `getVar("${v.scope}", "${v.name}", ${targetName})`;
                } else {
                  valExp = "0";
                }
              }
              return isNegative ? `-(${valExp})` : `(${valExp})`;
            }
            return `(${parseFloat(amountVal) || 0})`;
          }
          return `(0)`;
        };

        const requiredActions = btnActions.filter((a) => a.required && !a.varId.startsWith("_NAV_"));
        if (requiredActions.length > 0) {
          code += `let canExecute = true;\n      `;
          requiredActions.forEach((action, i) => {
            let v = variables.find((v) => v.id === action.varId);
            if (v && v.min !== null) {
              const checkVal = action.actionType === "set" ? resolveAmount(action.amount) : `(val${i} + ${resolveAmount(action.amount)})`;
              code += `let val${i} = getVar("${v.scope}", "${v.name}", ${targetName});\n      if (${checkVal} < ${v.min}) { canExecute = false; ${targetName}.sendMessage("§cNot enough ${v.name}!"); }\n      `;
            }
          });
          code += `if (!canExecute) return;\n      `;
        }
        code += btnActions
          .map((action) => {
            if (action.varId.startsWith("_NAV_")) {
              const targetSlideId = action.varId.replace("_NAV_", "");
              return `system.runTimeout(() => { showCustomUI_${targetSlideId}(player); }, 1);`;
            }
            let v = variables.find((v) => v.id === action.varId);
            if (!v) return "";
            const newVal = action.actionType === "set" ? resolveAmount(action.amount) : `val_${v.name} + ${resolveAmount(action.amount)}`;
            return `{
          let val_${v.name} = getVar("${v.scope}", "${v.name}", ${targetName});
          setVar("${v.scope}", "${v.name}", ${targetName}, ${newVal}, ${v.min !== null ? v.min : "null"}, ${v.max !== null ? v.max : "null"});
          ${targetName}.sendMessage("§a${v.name} is now: " + getVar("${v.scope}", "${v.name}", ${targetName}));
        }`;
          })
          .join("\n      ");
        return code;
      };

      if (isModal) {
        if (inputs.some((i) => i.type === "player_picker")) {
          formBuilder =
            `const allPlayers = world.getAllPlayers();\n  const playerNames = allPlayers.length > 0 ? allPlayers.map(p => p.name) : ["No players online"];\n  ` +
            formBuilder;
        }

        const formFields = inputs
          .map((input, index) => {
            const name = input.props.text || input.name;
            
            if (input.type === "dropdown") {
              const options = (
                input.props.dropdownOptions || "Option 1, Option 2"
              )
                .split(",")
                .map((o) => `"${o.trim()}"`)
                .join(", ");
              const defaultIdx = input.props.dropdownDefault || "0";
              return `form.dropdown(${formatString(name)}, [${options}], ${defaultIdx});`;
            }
            if (input.type === "player_picker") {
              return `form.dropdown(${formatString(name)}, playerNames, 0);`;
            }
            if (input.type === "slider") {
              const min = input.props.sliderMin || "0";
              const max = input.props.sliderMax || "100";
              const step = input.props.sliderStep || "1";
              const defaultVal = input.props.sliderDefault || "0";
              return `form.slider(${formatString(name)}, ${min}, ${max}, ${step}, ${defaultVal});`;
            }
            if (input.type === "textfield") {
              const placeholder =
                input.props.textFieldPlaceholder || "Placeholder";
              const defaultVal = input.props.textFieldDefault || "";
              const formattedDefault = defaultVal
                ? `, ${formatString(defaultVal)}`
                : "";
              const args = `${formatString(name)}, ${formatString(placeholder)}${formattedDefault}`;
              return `form.textField(${args});`;
            }
            if (input.type === "toggle") {
              const defaultVal =
                input.props.toggleDefault === "true" ? "true" : "false";
              return `form.toggle(${formatString(name)}, ${defaultVal});`;
            }
            return "";
          })
          .join("\n  ");

        const submitBtn = buttons[0];
        const submitText = submitBtn
          ? submitBtn.props.text || submitBtn.name
          : "Submit";

        formBuilder += `\n  ${formFields}`;
        formBuilder += `\n  form.submitButton("${submitText}");`;

        logicCode = `const formValues = response.formValues;\n    player.sendMessage("Form submitted!");`;

        inputs.forEach((input, index) => {
          if (
            input.type === "textfield" &&
            input.props.correctAnswer &&
            input.variableActions?.length
          ) {
            logicCode += `\n    if (formValues[${index}] === "${input.props.correctAnswer}") {`;
            logicCode += `\n        player.sendMessage("§aCorrect Answer!");`;
            logicCode += `\n        ${generateVarActionCode(input.variableActions)}`;
            logicCode += `\n    } else { player.sendMessage("§cIncorrect Answer."); }`;
          }
          if (
            input.type === "player_picker" &&
            (input.variableActions?.length || input.variableActionsTarget?.length)
          ) {
            logicCode += `\n    const targetPlayerIndex_${index} = formValues[${index}];\n    const targetPlayer_${index} = allPlayers[targetPlayerIndex_${index}];`;
            logicCode += `\n    if (targetPlayer_${index}) {`;
            if (input.variableActions?.length) {
              logicCode += `\n        ${generateVarActionCode(input.variableActions, "player")}`;
            }
            if (input.variableActionsTarget?.length) {
              logicCode += `\n        ${generateVarActionCode(input.variableActionsTarget, `targetPlayer_${index}`)}`;
            }
            logicCode += `\n    }`;
          }
        });

        if (submitBtn) {
          logicCode += `\n    ${generateVarActionCode(submitBtn.variableActions)}`;
        }
      } else {
        const actionUIElements = slide.elements.filter(
          (e) => e.type === "button" || e.type === "image",
        );

        const btnCode = actionUIElements
          .map((el) => {
            if (el.type === "image") {
              let iconStr = el.props.texture ? `, "${el.props.texture}"` : "";
              return `.button(""${iconStr})`;
            } else {
              let text = el.props.text || el.name;
              let iconStr = el.props.texture ? `, "${el.props.texture}"` : "";
              return `.button("${text}"${iconStr})`;
            }
          })
          .join("\n    ");

        if (actionUIElements.length > 0) {
          formBuilder += `\n  form\n    ${btnCode};`;
        }

        logicCode = actionUIElements
          .map((el, i) => {
            if (el.type === "image" && !el.variableActions?.length) return "";
            if (el.type === "image") {
               let actionCode = generateVarActionCode(el.variableActions);
               return `if (response.selection === ${i}) {\n      ${actionCode}\n    }`;
            }
            let actionCode = generateVarActionCode(el.variableActions);
            return `if (response.selection === ${i}) {
        // Player clicked ${el.props.text || el.name}
        player.sendMessage("You clicked ${el.props.text || el.name}!");
        ${actionCode}
      }`;
          })
          .filter(Boolean)
          .join(" else ");
      }

      guiFunctionsCode += `
export function showCustomUI_${slide.id}(player) {
  ${formBuilder}

  system.run(() => {
    form.show(player).then((response) => {
      if (response.canceled && (response.cancelationReason === "UserBusy" || response.cancelationReason === "userBusy" || response.cancelationReason === "user_busy")) {
        system.runTimeout(() => { showCustomUI_${slide.id}(player); }, 5);
        return;
      }
      if (response.canceled) return;
      
      ${logicCode}
      
    }).catch(e => {
      console.error(e);
      if (e && e.message && /busy/i.test(e.message)) {
        system.runTimeout(() => { showCustomUI_${slide.id}(player); }, 5);
      }
    });
  });
}
`;
    });

    const triggerEventCode = variables
      .map((v) => {
        return (v.increments || [])
          .map((inc) => {
            let resolvedEventName = inc.event;
            if (resolvedEventName === "blockBreak")
              resolvedEventName = "playerBreakBlock";
            if (resolvedEventName === "blockPlace")
              resolvedEventName = "playerPlaceBlock";

            if (resolvedEventName === "tick") {
              return `system.runInterval(() => {
  for (const p of world.getAllPlayers()) {
    let val = getVar("${v.scope}", "${v.name}", p);
    setVar("${v.scope}", "${v.name}", p, val + (${inc.amount}), ${v.min !== null ? v.min : "null"}, ${v.max !== null ? v.max : "null"});
  }
}, 20); // Runs once every second (20 ticks)`;
            } else if (resolvedEventName === "xpGained") {
              const LAST_CHECKED = `lastCheckedXpFor_${v.name.replace(/[^a-zA-Z0-9_]/g, "_")}`;
              const THRESHOLD = inc.xpThreshold || 1;
              return `try {
  world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    if (player.getDynamicProperty("${LAST_CHECKED}") === undefined) {
      player.setDynamicProperty("${LAST_CHECKED}", player.getTotalXp());
    }
  });

  system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
      let lastCheckedXp = player.getDynamicProperty("${LAST_CHECKED}");
      if (lastCheckedXp === undefined) {
        player.setDynamicProperty("${LAST_CHECKED}", player.getTotalXp());
        continue;
      }
      
      const currentXp = player.getTotalXp();
      const xpGained = currentXp - lastCheckedXp;
      const threshold = ${THRESHOLD};
      
      if (xpGained >= threshold) {
        const pointsToAward = Math.floor(xpGained / threshold) * (${inc.amount});
        let val = getVar("${v.scope}", "${v.name}", player);
        setVar("${v.scope}", "${v.name}", player, val + pointsToAward, ${v.min !== null ? v.min : "null"}, ${v.max !== null ? v.max : "null"});
        
        lastCheckedXp += Math.floor(xpGained / threshold) * threshold;
        player.setDynamicProperty("${LAST_CHECKED}", lastCheckedXp);
      } else if (xpGained < 0) {
        player.setDynamicProperty("${LAST_CHECKED}", currentXp);
      }
    }
  }, 5);
} catch (err) { console.error("Error setting up xpGained tracking:", err); }`;
            } else if (resolvedEventName === "complex_script") {
              const safeCode = (inc.aiGeneratedCode || `// TODO: Define custom AI logic for "${v.name}" here!\n// world.afterEvents.entityHurt.subscribe((event) => { /* logic */ });`).replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
              return `try {\n${safeCode}\n} catch(err) { console.error("Error setting up complex script:", err); }`;
            } else if (resolvedEventName === "custom_item") {
              return `try {
  world.afterEvents.itemUse.subscribe((event) => {
    if (event.itemStack.typeId === "${inc.customItemId || "minecraft:stick"}") {
      let p = event.source;
      if (${v.scope === "player" ? `p && p.typeId === 'minecraft:player'` : `true`}) {
        let val = getVar("${v.scope}", "${v.name}", p);
        setVar("${v.scope}", "${v.name}", p, val + (${inc.amount}), ${v.min !== null ? v.min : "null"}, ${v.max !== null ? v.max : "null"});
${inc.destroyItemOnUse ? `        // Destroy item on use\n        try {\n          const inv = p.getComponent('inventory').container;\n          let itemIndex = -1;\n          for(let i=0; i<inv.size; i++) {\n             const curItem = inv.getItem(i);\n             if (curItem && curItem.typeId === "${inc.customItemId || "minecraft:stick"}") { itemIndex = i; break; }\n          }\n          if (itemIndex > -1) { inv.setItem(itemIndex); /* setting undefined removes it */ }\n        } catch(e) {}` : ""}
      }
    }
  });
} catch(err) {}`;
            } else {
              return `try {
  world.afterEvents.${resolvedEventName}.subscribe((event) => {
    let p = event.player || event.sourceEntity || event.source;
    if (${v.scope === "player" ? `p && p.typeId === 'minecraft:player'` : `true`}) {
      let val = getVar("${v.scope}", "${v.name}", p);
      setVar("${v.scope}", "${v.name}", p, val + (${inc.amount}), ${v.min !== null ? v.min : "null"}, ${v.max !== null ? v.max : "null"});
    }
  });
} catch(err) {
  console.warn("Could not bind event '${resolvedEventName}' - it may be a legacy name or unsupported in this Minecraft version.");
}`;
            }
          })
          .join("\n\n");
      })
      .filter(Boolean)
      .join("\n\n");

    const hudVariables = variables.filter((v) => v.hud?.enabled);
    let hudCode = "";
    if (hudVariables.length > 0) {
      hudCode = `
// --- HUD Actionbar Display ---
system.runInterval(() => {
  for (const p of world.getAllPlayers()) {
    let actionbarLines = [];
${hudVariables.map(v => {
  let color = v.hud?.color || "§f";
  if (v.hud?.style === "bar" || v.hud?.style === "solid_bar" || v.hud?.style === "squares") {
    let maxSrc = v.max !== null ? parseFloat(v.max as any) : (v.hud?.maxOverride || 100);
    let filledChar = "|"; let emptyChar = "|";
    let filledColor = "§a"; let emptyColor = "§7";
    
    if (v.hud?.style === "solid_bar") {
       filledChar = "█"; emptyChar = "▒";
       filledColor = color; emptyColor = "§8";
    } else if (v.hud?.style === "squares") {
       filledChar = "🟩"; emptyChar = "⬛";
       filledColor = ""; emptyColor = "";
       // For squares, use the chosen color just for the prefix name
    } else {
       filledChar = "|"; emptyChar = "|";
       filledColor = color; emptyColor = "§7";
    }

    return `    {
      let val = getVar("${v.scope}", "${v.name}", p);
      let max = ${maxSrc};
      let ratio = Math.max(0, Math.min(1, val / max));
      let filled = Math.round(ratio * 10);
      let empty = 10 - filled;
      actionbarLines.push("${color}${v.name}: " + "${filledColor}" + "${filledChar}".repeat(filled) + "${emptyColor}" + "${emptyChar}".repeat(empty));
    }`;
  } else if (v.hud?.style === "icons") {
    let icon = (v.hud?.iconText || "⭐").replace(/"/g, '\\"');
    return `    {
      let val = getVar("${v.scope}", "${v.name}", p);
      if (val > 0) {
        actionbarLines.push("${color}" + "${icon}".repeat(Math.max(0, Math.min(val, 20))));
      } else {
        actionbarLines.push("${color}${v.name}: 0");
      }
    }`;
  } else {
    return `    {
      let val = getVar("${v.scope}", "${v.name}", p);
      actionbarLines.push("${color}${v.name}: " + val);
    }`;
  }
}).join("\n")}
    if (actionbarLines.length > 0) {
      if (p.onScreenDisplay && p.onScreenDisplay.setActionBar) {
         p.onScreenDisplay.setActionBar(actionbarLines.join("   "));
      } else {
         p.runCommand(\`titleraw @s actionbar {"rawtext":[{"text":"\${actionbarLines.join("   ")}"}]}\`);
      }
    }
  }
}, 5);`;
    }

    let customTriggersCode = "";
    if (openedFrom === "hidden" && customTriggers.length > 0) {
      customTriggersCode =
        `// --- Custom Triggers ---\n` +
        customTriggers
          .map((t) => {
            if (t.type === "itemUse")
              return `try {\n  world.afterEvents.itemUse.subscribe((event) => {\n    if (event.itemStack.typeId === "${t.config.itemId || "minecraft:stick"}") {\n      system.runTimeout(() => { showCustomUI(event.source); }, 20);\n    }\n  });\n} catch(e) { console.error(e); }`;
            if (t.type === "blockBreak")
              return `try {\n  world.afterEvents.playerBreakBlock.subscribe((event) => {\n    if (event.block.typeId === "${t.config.blockId || "minecraft:dirt"}") {\n      system.runTimeout(() => { showCustomUI(event.player); }, 20);\n    }\n  });\n} catch(e) { console.error(e); }`;
            if (t.type === "entityHit")
              return `try {\n  world.afterEvents.entityHitEntity.subscribe((event) => {\n    if (event.hitEntity.typeId === "${t.config.entityId || "minecraft:cow"}" && event.damagingEntity.typeId === "minecraft:player") {\n      system.runTimeout(() => { showCustomUI(event.damagingEntity); }, 20);\n    }\n  });\n} catch(e) { console.error(e); }`;
            if (t.type === "chatCommand")
              return `try {\n  world.beforeEvents.chatSend.subscribe((event) => {\n    if (event.message.trim().toLowerCase() === "${(t.config.command || "!showgui").trim().toLowerCase()}") {\n      event.cancel = true;\n      system.runTimeout(() => { showCustomUI(event.sender); }, 20);\n    }\n  });\n} catch(e) { console.error(e); }`;
            if (t.type === "aiGenerated") {
              const safeCode = (t.config.code?.replace(/\n/g, "\n  ") || "// Not generated yet").replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
              return `try {\n  // AI Generated code from prompt: "${t.config.prompt}"\n  ${safeCode}\n} catch(e) { console.error(e); }`;
            }
            return "";
          })
          .join("\n\n");
    }

    const bookGiveCode =
      openedFrom === "book"
        ? `
// Automatically give GUI Book to players on first join
world.afterEvents.playerSpawn.subscribe((event) => {
  if (event.initialSpawn) {
     const player = event.player;
     system.runTimeout(() => {
        if (!player.hasTag("has_gui_book")) {
            player.runCommandAsync("give @s custom:gui_book 1").catch(e=>{});
            player.addTag("has_gui_book");
        }
     }, 20);
  }
});
`
        : "";

    const interceptorCode = inGameLogs
      ? `
// --- Console Interceptor (In-Game Logs) ---
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
console.log = function(...args) {
    originalLog(...args);
    try { world.sendMessage("[LOG] " + args.map(a => String(a)).join(" ")); } catch(e) {}
};
console.warn = function(...args) {
    originalWarn(...args);
    try { world.sendMessage("§e[WARN] " + args.map(a => String(a)).join(" ") + "§r"); } catch(e) {}
};
console.error = function(...args) {
    originalError(...args);
    try { world.sendMessage("§c[ERROR] " + args.map(a => String(a)).join(" ") + "§r"); } catch(e) {}
};
`
      : "";

    return `import { world, system } from "@minecraft/server";
import { ModalFormData, ActionFormData } from "@minecraft/server-ui";
${interceptorCode}
/**
 * Script API Custom UI Generated Code
 * 
 * To use this script, place it in: Behavior_Pack/scripts/main.js
 * Dependencies in manifest.json: "@minecraft/server" , "@minecraft/server-ui"
 */

// --- Dynamic Variables Helper Functions (Properties) ---
function getVar(scope, varName, player) {
    try {
        let source = scope === 'player' ? player : world;
        return source.getDynamicProperty(varName) ?? 0;
    } catch (e) {
        return 0;
    }
}

function setVar(scope, varName, player, val, min, max) {
    try {
        let source = scope === 'player' ? player : world;
        if (min !== null && val < min) val = min;
        if (max !== null && val > max) val = max;
        source.setDynamicProperty(varName, val);
    } catch (e) {
        console.error("Failed to set property " + varName + ": " + e);
    }
}

// --- Variable Event Triggers ---
${triggerEventCode}

${hudCode}

${bookGiveCode}

// --- UI Activation ---
${
  openedFrom === "hidden"
    ? `// Form is configured as hidden. Call showCustomUI(player) from your own scripts to open it.`
    : `world.afterEvents.itemUse.subscribe((event) => {
  if (event.itemStack.typeId === "${openedFrom === "book" ? "custom:gui_book" : moddedItemName}") {
    const player = event.source;
    
    // UI must be shown on a slight delay to avoid item use overlap cancelling it
    system.runTimeout(() => {
       showCustomUI(player);
    }, 20);
  }
});`
}

${customTriggersCode}

${guiFunctionsCode}

export function showCustomUI(player) {
  showCustomUI_${guiSlides[0]?.id || "main"}(player);
}
`;
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);

    const el = elements.find((el) => el.id === id);
    if (el) {
      setIsDragging(true);
      const parentRect = canvasRef.current?.getBoundingClientRect();
      if (parentRect) {
        const mouseX = e.clientX - parentRect.left;
        const mouseY = e.clientY - parentRect.top;
        setDragOffset({
          x: mouseX - el.x,
          y: mouseY - el.y,
        });
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging && selectedId && canvasRef.current) {
      const parentRect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - parentRect.left;
      const mouseY = e.clientY - parentRect.top;

      setElements((prev) =>
        prev.map((el) => {
          if (el.id === selectedId) {
            return {
              ...el,
              x: Math.max(0, Math.round((mouseX - dragOffset.x) / 10) * 10),
              y: Math.max(0, Math.round((mouseY - dragOffset.y) / 10) * 10),
            };
          }
          return el;
        }),
      );
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const addElement = (type: ElementType) => {
    const activeSlide = guiSlides.find(s => s.id === activeSlideId);
    if (!activeSlide && viewMode !== "book_editor") return;

    if (viewMode !== "book_editor" && activeSlide) {
      if (activeSlide.slideType === "interactive" && type === "label") {
        if (activeSlide.elements.some(e => e.type === "label")) {
          alert("Interactive GUIs can only have 1 single label (the title) at the top.");
          return;
        }
      }
      if (activeSlide.slideType === "text_display" && ["dropdown", "slider", "textfield", "toggle", "player_picker"].includes(type)) {
        alert("Text Display GUIs cannot contain interactive inputs. Please add an Interactive Slide for inputs.");
        return;
      }
    }

    const newEl: EditorElement = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: 350,
      y: 250,
      width: type === "label" ? 100 : 150,
      height: type === "label" ? 20 : 40,
      name: `New ${type}`,
      props: {},
    };
    setElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const handleAddSlide = () => {
    if (viewMode === "book_editor") return;
    setShowSlideModal(true);
  };

  const handleMoveSlide = (direction: -1 | 1) => {
    const currentIndex = guiSlides.findIndex(s => s.id === activeSlideId);
    if (currentIndex < 0) return;
    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= guiSlides.length) return;
    
    setGuiSlides((prev) => {
      const next = [...prev];
      const temp = next[currentIndex];
      next[currentIndex] = next[newIndex];
      next[newIndex] = temp;
      return next;
    });
  };

  const handleDeleteSlide = () => {
    if (guiSlides.length <= 1) {
      alert("Cannot delete the only remaining slide.");
      return;
    }
    setGuiSlides((prev) => {
      const next = prev.filter((s) => s.id !== activeSlideId);
      setActiveSlideId(next[0].id);
      return next;
    });
  };

  const confirmAddSlide = (slideType: "interactive" | "text_display") => {
    const newSlideId = "slide_" + generateUUID().split("-")[0];
    const lastSlide = guiSlides[guiSlides.length - 1];

    const newSlide: GuiSlide = {
      id: newSlideId,
      name: slideType === "interactive" ? "Interactive Slide" : "Text Slide",
      slideType: slideType,
      elements: [
        {
          id: Math.random().toString(36).substr(2, 9),
          type: "label",
          x: 200,
          y: 100,
          width: 400,
          height: 20,
          name: "Title",
          props: { text: "New GUI Title" },
        },
        // Auto-added back button
        {
          id: Math.random().toString(36).substr(2, 9),
          type: "button",
          x: 200,
          y: 250,
          width: 200,
          height: 32,
          name: "Back Button",
          props: { text: "§cBack", texture: "textures/ui/arrow_left" },
          variableActions: [{ varId: `_NAV_${lastSlide.id}`, amount: 1 }]
        }
      ]
    };
    
    // Auto-add next button to last slide
    const currentSlideBtn: EditorElement = {
      id: Math.random().toString(36).substr(2, 9),
      type: "button",
      x: 350,
      y: 250,
      width: 200,
      height: 32,
      name: `Open ${newSlide.name}`,
      props: { text: "§aNext Page", texture: "textures/ui/arrow_right" },
      variableActions: [{ varId: `_NAV_${newSlideId}`, amount: 1 }]
    };
    
    setGuiSlides((prev) => {
      const next = prev.map(s => s.id === lastSlide.id ? { ...s, elements: [...s.elements, currentSlideBtn] } : s);
      return [...next, newSlide];
    });
    
    setActiveSlideId(newSlideId);
    setShowSlideModal(false);
  };

  const updateSelectedProp = (key: string, value: string) => {
    if (!selectedId) return;
    setElements((prev) =>
      prev.map((el) => {
        if (el.id === selectedId) {
          return {
            ...el,
            props: { ...el.props, [key]: value },
          };
        }
        return el;
      }),
    );
  };

  const handleMoveElement = (direction: -1 | 1) => {
    if (!selectedId) return;
    setElements((prev) => {
      const currentIndex = prev.findIndex((el) => el.id === selectedId);
      if (currentIndex < 0) return prev;
      
      const elType = prev[currentIndex].type;
      
      const getCategory = (type: string) => {
        if (type === "label") return "label";
        if (["dropdown", "slider", "textfield", "toggle", "player_picker"].includes(type)) return "input";
        if (["button", "image"].includes(type)) return "button";
        return "other";
      };
      
      const myCategory = getCategory(elType);
      
      let swapIndex = -1;
      if (direction === -1) {
         for (let i = currentIndex - 1; i >= 0; i--) {
            if (getCategory(prev[i].type) === myCategory) {
               swapIndex = i;
               break;
            }
         }
      } else {
         for (let i = currentIndex + 1; i < prev.length; i++) {
            if (getCategory(prev[i].type) === myCategory) {
               swapIndex = i;
               break;
            }
         }
      }
      
      if (swapIndex !== -1) {
         const next = [...prev];
         const temp = next[currentIndex];
         next[currentIndex] = next[swapIndex];
         next[swapIndex] = temp;
         return next;
      }
      return prev;
    });
  };

  const handleDeleteElement = (id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateSelectedDimensions = (width: number, height: number) => {
    if (!selectedId) return;
    setElements((prev) =>
      prev.map((el) => {
        if (el.id === selectedId) {
          return { ...el, width, height };
        }
        return el;
      }),
    );
  };

  const selectedElement = elements.find((el) => el.id === selectedId);

  return (
    <div className="w-full h-screen bg-zinc-950 text-zinc-200 font-sans flex flex-col overflow-hidden select-none">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#4CAF50] rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">Bg</span>
            </div>
            <span className="font-bold text-sm tracking-tight uppercase">
              BlockGui.Edu
            </span>
          </div>
          <div className="h-6 w-[1px] bg-zinc-700"></div>
          {appPhase === "builder" && (
            <nav className="flex gap-4 text-xs font-medium uppercase tracking-wider text-zinc-400">
              <span
                onClick={() => setViewMode("designer")}
                className={`cursor-pointer transition-colors ${viewMode === "designer" ? "text-blue-400 font-bold" : "hover:text-white"}`}
              >
                GUI Designer
              </span>
              <span
                onClick={() => setViewMode("variables")}
                className={`cursor-pointer transition-colors ${viewMode === "variables" ? "text-blue-400 font-bold" : "hover:text-white"}`}
              >
                Variables
              </span>
              {openedFrom === "hidden" && (
                <span
                  onClick={() => setViewMode("triggers")}
                  className={`cursor-pointer transition-colors ${viewMode === "triggers" ? "text-blue-400 font-bold" : "hover:text-white"}`}
                >
                  Triggers
                </span>
              )}
              <span
                onClick={() => setViewMode("export")}
                className={`cursor-pointer transition-colors ${viewMode === "export" ? "text-blue-400 font-bold" : "hover:text-white"}`}
              >
                Code & Export
              </span>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleLoadProject}
            ref={fileInputRef}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-zinc-800 text-zinc-200 text-[11px] font-bold uppercase rounded hover:bg-zinc-700 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <FolderOpen className="w-3.5 h-3.5" /> Load Project
          </button>
          {appPhase === "builder" && (
            <button
              onClick={handleSaveProject}
              className="px-3 py-1.5 bg-green-600 text-white text-[11px] font-bold uppercase rounded hover:bg-green-500 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Save Project
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            title="Settings"
          >
            <Key className="w-4 h-4" />
          </button>
          {appPhase === "builder" && (
            <>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="text-xs bg-transparent text-zinc-400 font-mono mr-4 ml-2 border-b border-transparent hover:border-zinc-700 focus:border-blue-500 outline-none px-1"
              />
              <button className="px-3 py-1.5 bg-blue-600 text-white text-[11px] font-bold uppercase rounded hover:bg-blue-500 transition-colors flex items-center gap-1.5 shadow-sm">
                <Play className="w-3.5 h-3.5" />
                Preview
              </button>
              <button
                onClick={() => setInGameLogs(!inGameLogs)}
                className={`px-3 py-1.5 text-[11px] font-bold uppercase rounded transition-colors flex items-center gap-1.5 shadow-sm ${inGameLogs ? "bg-green-600 text-white hover:bg-green-500" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"}`}
              >
                <Terminal className="w-3.5 h-3.5" />{" "}
                {inGameLogs ? "Ingame Logs: ON" : "Ingame Logs: OFF"}
              </button>
              
              {projectsList.length > 0 && (
                <button
                  onClick={() => { saveCurrentToList(); setAppPhase("dashboard"); }}
                  className="px-3 py-1.5 bg-zinc-800 text-white text-[11px] border border-zinc-700 font-bold uppercase rounded hover:bg-zinc-700 transition-colors flex items-center gap-1.5 shadow-sm ml-2"
                >
                   Return to Dashboard
                </button>
              )}
              <button
                onClick={() => {
                  let allCode =
                    "BP/scripts/main.js:\n" + generateScriptAPI() + "\n\n";
                  if (openedFrom === "book") {
                    allCode +=
                      "BP/items/custom_gui_book.json:\n" +
                      JSON.stringify(
                        {
                          format_version: "1.20.50",
                          "minecraft:item": {
                            description: {
                              identifier: "custom:gui_book",
                              menu_category: { category: "equipment" },
                            },
                            components: {
                              "minecraft:icon": "gui_book",
                              "minecraft:display_name": { value: "GUI Book" },
                              "minecraft:max_stack_size": 1,
                              "minecraft:hand_equipped": true,
                              "minecraft:cooldown": {
                                category: "gui_book",
                                duration: 0.5,
                              },
                            },
                          },
                        },
                        null,
                        2,
                      ) +
                      "\n\n";
                    allCode +=
                      "RP/items/custom_gui_book.json:\n" +
                      JSON.stringify(
                        {
                          format_version: "1.20.50",
                          "minecraft:item": {
                            description: { identifier: "custom:gui_book" },
                            components: { "minecraft:icon": "gui_book" },
                          },
                        },
                        null,
                        2,
                      ) +
                      "\n\n";
                  }
                  allCode +=
                    "BP/manifest.json:\n" + generateBPManifest() + "\n\n";
                  allCode +=
                    "RP/manifest.json:\n" + generateRPManifest() + "\n\n";
                  const allGuiElts = guiSlides.flatMap(s => s.elements);
                  let langBookText =
                    openedFrom === "book"
                      ? `item.custom:gui_book.name=GUI Book\n\n`
                      : "";
                  allCode +=
                    "RP/texts/en_US.lang:\n" +
                    `${langBookText}${[...allGuiElts, ...bookElements]
                      .filter((e) => e.type === "label")
                      .map(
                        (e) =>
                          `label.${e.name.replace(/ /g, "_").toLowerCase()} = ${e.props.text}`,
                      )
                      .join("\n")}` +
                    "\n\n";
                  navigator.clipboard.writeText(allCode);
                  alert("Debug Logs Copied!");
                }}
                className="px-3 py-1 bg-yellow-600 text-white text-[11px] font-bold uppercase rounded hover:bg-yellow-500 transition-colors flex items-center gap-1"
              >
                <FileJson className="w-3 h-3" /> Copy Debug Logs
              </button>
              <button
                onClick={() => setViewMode("export")}
                className="px-3 py-1 bg-[#3498db] text-white text-[11px] font-bold uppercase rounded hover:bg-[#2980b9] transition-colors flex items-center gap-1"
              >
                <Download className="w-3 h-3" /> Export to Bridge
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {appPhase === "setup" ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#121212] p-8">
            <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded shadow-2xl p-6">
              <h2 className="text-xl font-bold uppercase tracking-wider text-white mb-2">
                GUI Configuration
              </h2>
              <p className="text-zinc-500 text-sm mb-6">
                Configure how your custom Mod UI is accessed in-game by the
                player.
              </p>

              <div className="flex flex-col gap-4 mb-8">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    GUI Opened From
                  </label>
                  <select
                    value={openedFrom}
                    onChange={(e) =>
                      setOpenedFrom(
                        e.target.value as "book" | "modded_item" | "hidden",
                      )
                    }
                    className="bg-zinc-950 border border-zinc-800 px-3 py-2 rounded text-white text-sm outline-none focus:border-blue-500"
                  >
                    <option value="book">Book (Given to all on spawn)</option>
                    <option value="modded_item">Modded Item</option>
                    <option value="hidden">
                      Hidden (Triggered by Variables/AI Code)
                    </option>
                  </select>
                </div>

                {openedFrom === "modded_item" && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      Item Identifier
                    </label>
                    <input
                      type="text"
                      value={moddedItemName}
                      onChange={(e) => setModdedItemName(e.target.value)}
                      placeholder="my_namespace:item_id"
                      className="bg-zinc-950 border border-zinc-800 px-3 py-2 rounded text-white text-sm outline-none focus:border-blue-500 font-mono"
                    />
                    <p className="text-[10px] text-yellow-500/80 mt-1 leading-relaxed">
                      <strong>Note for Vanilla Items:</strong> Normal items like{" "}
                      <code>minecraft:stick</code> do not trigger right-click
                      events in the air! You must use a vanilla item that
                      naturally has a right-click action (like{" "}
                      <code>minecraft:compass</code>) or stick to custom items.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-4 w-full">
                <button
                  onClick={() => handleStartBuilder("interactive")}
                  className="flex-1 py-3 bg-[#3498db] text-white font-bold text-sm rounded hover:bg-[#2980b9] transition-colors shadow-lg"
                >
                  Create Interactive GUI<br/><span className="text-[10px] opacity-75 font-normal">(With Inputs & Data)</span>
                </button>
                <button
                  onClick={() => handleStartBuilder("text_display")}
                  className="flex-1 py-3 bg-[#9b59b6] text-white font-bold text-sm rounded hover:bg-[#8e44ad] transition-colors shadow-lg"
                >
                  Create Text Display GUI<br/><span className="text-[10px] opacity-75 font-normal">(Multiple Text Blocks)</span>
                </button>
              </div>
            </div>
          </div>
        ) : appPhase === "dashboard" ? (
          <div className="flex-1 flex flex-col bg-[#121212] p-8 overflow-y-auto w-full">
            <div className="max-w-4xl w-full mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold uppercase tracking-wider text-white">
                  Workspace Dashboard
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                       saveCurrentToList();
                       setAppPhase("setup");
                       setActiveProjectId("");
                       setProjectName("untitled_project");
                       // do not reset variables, they are workspace-wide
                       setGuiSlides([]);
                       setBookElements([]);
                       setCustomTriggers([]);
                    }}
                    className="px-4 py-2 bg-zinc-800 text-zinc-200 text-xs font-bold uppercase rounded hover:bg-zinc-700 transition-colors shadow-sm"
                  >
                    + New Project
                  </button>
                  <button
                    onClick={() => {
                        // Merge all projects
                        if (projectsList.length === 0) return;
                        
                        let mergedSlides: GuiSlide[] = [];
                        let mergedCustomTriggers: CustomTrigger[] = [];
                        let mergedBookElements: EditorElement[] = [];
                        
                        projectsList.forEach((proj, idx) => {
                            mergedSlides = [...mergedSlides, ...(proj.guiSlides||[])];
                            mergedCustomTriggers = [...mergedCustomTriggers, ...(proj.customTriggers||[])];
                            mergedBookElements = [...mergedBookElements, ...(proj.bookElements||[])];
                        });
                        
                        // Create Hub Slide to link to all other GUI's first slides
                        const hubSlideId = "slide_" + generateUUID().split("-")[0];
                        const hubSlide: GuiSlide = {
                           id: hubSlideId,
                           name: "Workspace Hub",
                           slideType: "interactive",
                           elements: [
                              {
                                 id: generateUUID(),
                                 type: "label",
                                 name: "Hub Title",
                                 props: { text: "§lWorkspace Hub§r\\nSelect a project GUI to open:" },
                                 x: 0, y: 0
                              },
                              ...projectsList.map((p, idx) => ({
                                 id: generateUUID(),
                                 type: "button",
                                 name: p.name || `Project ${idx + 1}`,
                                 props: { 
                                     text: p.name || `Project ${idx + 1}`, 
                                     action: p.guiSlides?.[0]?.id ? `open_form_${p.guiSlides[0].id}` : "",
                                     style: "default"
                                 },
                                 x: 0, y: (idx + 1) * 30
                              } as any))
                           ]
                        };
                        
                        mergedSlides = [hubSlide, ...mergedSlides];
                        
                        setActiveProjectId("MERGED");
                        setProjectName("Merged_Mod");
                        setGuiSlides(mergedSlides);
                        setCustomTriggers(mergedCustomTriggers);
                        setBookElements(mergedBookElements);
                        setOpenedFrom("modded_item"); // force multiple starting points or command start?
                        setModdedItemName("my_mod:gui_orb");
                        setAppPhase("builder");
                        setViewMode("export");
                    }}
                    className="px-4 py-2 bg-[#3498db] text-white text-xs font-bold uppercase rounded hover:bg-[#2980b9] transition-colors shadow-sm"
                  >
                    Export All (Merged Mod)
                  </button>
                </div>
              </div>
              <p className="text-zinc-500 text-sm mb-6">
                Manage all GUI projects within your workspace. When you export, all projects will be merged into a single behavior/resource pack so they work together inside Minecraft without conflicts.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projectsList.map(p => (
                  <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 shadow-lg relative group transition-colors hover:border-zinc-700 cursor-pointer" onClick={() => openProject(p.id)}>
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-white font-bold text-lg truncate pr-4">{p.name || "Untitled"}</h3>
                      {activeProjectId === p.id && (
                        <span className="bg-blue-500 text-white text-[9px] uppercase font-bold px-1.5 py-0.5 rounded shadow">Active</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-zinc-400">
                      <span>Slides: {p.guiSlides?.length || 0}</span>
                      <span>Variables: {p.variables?.length || 0}</span>
                      <span>Triggers: {p.customTriggers?.length || 0}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3">
                      <span className="text-[10px] uppercase font-mono text-zinc-600 bg-zinc-950 px-2 py-1 rounded">
                         opened via: {p.openedFrom}
                      </span>
                      <button className="text-[10px] uppercase font-bold text-blue-400 hover:text-blue-300">
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : viewMode === "designer" ? (
          <>
            {/* Left Sidebar: Assets & Layers */}
            <aside className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-900 shrink-0">
              <div className="p-3 border-b border-zinc-800">
                <div className="text-[10px] font-bold text-zinc-500 uppercase mb-2">
                  GUI Toolbox
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => addElement("button")}
                    className="h-8 bg-zinc-800 border border-zinc-700 rounded flex items-center justify-center gap-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600 transition-colors shadow-sm cursor-pointer"
                  >
                    <MousePointer2 className="w-3 h-3" /> Button
                  </button>
                  {(!guiSlides.find(s => s.id === activeSlideId) || guiSlides.find(s => s.id === activeSlideId)?.slideType === "text_display" || (guiSlides.find(s => s.id === activeSlideId)?.slideType === "interactive" && !guiSlides.find(s => s.id === activeSlideId)?.elements.some(e => e.type === "label"))) && (
                    <button
                      onClick={() => addElement("label")}
                      className="h-8 bg-zinc-800 border border-zinc-700 rounded flex items-center justify-center gap-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600 transition-colors shadow-sm cursor-pointer"
                    >
                      <Type className="w-3 h-3" /> Label
                    </button>
                  )}
                  <button
                    onClick={() => addElement("image")}
                    className="h-8 bg-zinc-800 border border-zinc-700 rounded flex items-center justify-center gap-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600 transition-colors shadow-sm cursor-pointer"
                  >
                    <ImageIcon className="w-3 h-3" /> Image
                  </button>
                  {(!guiSlides.find(s => s.id === activeSlideId) || guiSlides.find(s => s.id === activeSlideId)?.slideType === "interactive") && (
                    <>
                      <button
                        onClick={() => addElement("dropdown")}
                        className="h-8 bg-zinc-800 border border-zinc-700 rounded flex items-center justify-center gap-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600 transition-colors shadow-sm cursor-pointer"
                      >
                        <List className="w-3 h-3" /> Dropdown
                      </button>
                      <button
                        onClick={() => addElement("slider")}
                        className="h-8 bg-zinc-800 border border-zinc-700 rounded flex items-center justify-center gap-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600 transition-colors shadow-sm cursor-pointer"
                      >
                        <SlidersHorizontal className="w-3 h-3" /> Slider
                      </button>
                      <button
                        onClick={() => addElement("textfield")}
                        className="h-8 bg-zinc-800 border border-zinc-700 rounded flex items-center justify-center gap-2 text-[10px] text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600 transition-colors shadow-sm cursor-pointer"
                      >
                        <TextCursorInput className="w-3 h-3" /> TextField
                      </button>
                      <button
                        onClick={() => addElement("toggle")}
                        className="h-8 bg-zinc-800 border border-zinc-700 rounded flex items-center justify-center gap-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600 transition-colors shadow-sm cursor-pointer"
                      >
                        <CheckSquare className="w-3 h-3" /> Toggle
                      </button>
                      <button
                        onClick={() => addElement("player_picker")}
                        className="h-8 bg-zinc-800 border border-zinc-700 rounded flex flex-col items-center justify-center gap-0.5 text-[9px] text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600 transition-colors shadow-sm cursor-pointer"
                        style={{ gridColumn: "span 2" }}
                      >
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3 h-3" /> Player Picker
                        </div>
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col">
                {viewMode !== "book_editor" && (
                  <div className="p-3 border-b border-zinc-800 bg-zinc-900 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">GUI Slides</div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleMoveSlide(-1)} className="text-zinc-400 hover:text-white" title="Move Slide Up" disabled={guiSlides.findIndex(s => s.id === activeSlideId) <= 0}>
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleMoveSlide(1)} className="text-zinc-400 hover:text-white" title="Move Slide Down" disabled={guiSlides.findIndex(s => s.id === activeSlideId) >= guiSlides.length - 1}>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-[1px] h-3 bg-zinc-700 mx-1" />
                        <button onClick={handleAddSlide} className="text-zinc-400 hover:text-white" title="Add New Slide">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={handleDeleteSlide} className="text-zinc-400 hover:text-red-400" title="Delete Current Slide" disabled={guiSlides.length <= 1}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <select
                      value={activeSlideId}
                      onChange={(e) => setActiveSlideId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 text-blue-300 font-medium text-xs p-1.5 rounded outline-none focus:border-blue-500 shadow-inner"
                    >
                      {guiSlides.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.slideType === "interactive" ? "Interactive" : "Text Display"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="p-3 bg-zinc-900 border-b border-zinc-800 text-[10px] font-bold text-zinc-500 flex justify-between items-center uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> Layers
                  </span>
                  <span>({elements.length})</span>
                </div>
                <div className="flex-1 bg-zinc-950 overflow-y-auto px-1.5 py-2 scrollbar-thin scrollbar-thumb-zinc-700">
                  {elements
                    .slice()
                    .reverse()
                    .map((el) => (
                      <div
                        key={el.id}
                        draggable
                        onDragStart={(e) => handleLayerDragStart(e, el.id)}
                        onDragOver={handleLayerDragOver}
                        onDrop={(e) => handleLayerDrop(e, el.id)}
                        onDragEnd={() => setDraggedLayerId(null)}
                        onClick={() => setSelectedId(el.id)}
                        className={`p-2 rounded-md flex items-center gap-2 mb-1 cursor-pointer transition-colors border shadow-sm ${selectedId === el.id ? "bg-zinc-800 border-zinc-700 text-white" : "border-transparent text-zinc-400 hover:bg-zinc-800/50"} ${draggedLayerId === el.id ? "opacity-50" : ""}`}
                      >
                        <GripVertical className="w-3 h-3 text-[#555] cursor-grab active:cursor-grabbing" />
                        {el.type === "button" && (
                          <MousePointer2 className="w-3 h-3 text-zinc-400" />
                        )}
                        {el.type === "label" && (
                          <Type className="w-3 h-3 text-zinc-400" />
                        )}
                        {el.type === "image" && (
                          <ImageIcon className="w-3 h-3 text-zinc-400" />
                        )}
                        {el.type === "dropdown" && (
                          <List className="w-3 h-3 text-zinc-400" />
                        )}
                        {el.type === "slider" && (
                          <SlidersHorizontal className="w-3 h-3 text-zinc-400" />
                        )}
                        {el.type === "textfield" && (
                          <TextCursorInput className="w-3 h-3 text-zinc-400" />
                        )}
                        {el.type === "toggle" && (
                          <CheckSquare className="w-3 h-3 text-zinc-400" />
                        )}
                        <span
                          className={`text-[11px] truncate flex-1 font-medium ${selectedId === el.id ? "text-white" : "text-zinc-400"}`}
                        >
                          {el.name}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteElement(el.id);
                          }}
                          className={`opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400 p-0.5 ${selectedId === el.id ? "opacity-100 text-red-400/50" : ""}`}
                          title="Delete Element"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </aside>

            {/* Center: Canvas Viewport */}
            <main
              className="flex-1 bg-zinc-950 relative overflow-hidden flex flex-col items-center justify-center shadow-[inset_0_2px_15px_rgba(0,0,0,0.5)]"
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              {guiElements.some((e) =>
                ["dropdown", "slider", "textfield", "toggle", "player_picker"].includes(e.type),
              ) &&
                guiElements.some((e) => e.type === "button") && (
                  <div className="absolute top-4 left-4 right-4 z-[60] bg-[#3a2000]/90 backdrop-blur border border-amber-600 shadow-2xl text-amber-200 p-4 text-xs leading-relaxed rounded-md mb-2">
                    <div className="font-bold text-sm flex items-center gap-2 mb-2">
                      <span role="img" aria-label="warning">⚠️</span>
                      Interactive GUI Navigation Warning
                    </div>
                    Minecraft <b>Interactive GUIs</b> (ModalFormData) only allow a single "Submit" button at the very bottom. Added Custom / Navigation buttons will be <b>IGNORED</b> by Minecraft when compiled! Either convert them into variables triggered on submit, or switch to a Text Display GUI.
                  </div>
                )}
              {guiElements.some((e) =>
                ["dropdown", "slider", "textfield", "toggle", "player_picker"].includes(e.type),
              ) &&
                guiElements.filter((e) => e.type === "label").length > 1 && (
                  <div className="absolute top-4 left-4 right-4 z-50 bg-[#3a1a1a]/90 backdrop-blur border border-[#dd3b3b] shadow-2xl text-[#ffa3a3] p-4 text-xs leading-relaxed rounded-md">
                    <div className="font-bold text-sm flex items-center gap-2 mb-2">
                      <span role="img" aria-label="error">
                        ⚠️
                      </span>{" "}
                      Missing Labels Warning
                    </div>
                    You have added both <b>Form Inputs</b> (Dropdown, Slider,
                    etc.) and <b>Labels</b>. Because Minecraft's{" "}
                    <code>ModalFormData</code> does not support text bodies
                    natively, your labels will be hidden in the exported Script
                    API code. Only the very first label will be preserved as the
                    Form Title.
                    <br />
                    <br />
                    <b>Want to show text/variables?</b> If your UI has no inputs (only buttons), it is exported as <code>ActionFormData</code> which fully supports body text! Otherwise, you can type{" "}
                    <code>{"{YourVar}"}</code> directly in the titles or
                    placeholders of Sliders, Dropdowns, and TextFields, and it
                    will automatically replace it with the live variable value!
                  </div>
                )}
              {/* Grid Background */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(#3c3c3c 1px, transparent 1px)",
                  backgroundSize: "12px 12px",
                  opacity: 0.8,
                }}
              />

              {/* Main Working Canvas */}
              <div
                ref={canvasRef}
                className="relative w-[340px] max-h-[460px] flex flex-col bg-[#c6c6c6] border-[3px] border-[#3E3E3E] shadow-2xl user-select-none overflow-hidden"
                onPointerDown={() => setSelectedId(null)}
                style={{
                  boxShadow: "inset 2px 2px 0 rgba(255,255,255,0.6), inset -2px -2px 0 rgba(80,80,80,0.4), 0 10px 30px rgba(0,0,0,0.5)"
                }}
              >
                <div className="flex flex-col p-4 w-full overflow-y-auto custom-scrollbar flex-1">
                  {/* Title (First Label acts as Title) */}
                {elements.filter((e) => e.type === "label").length > 0 && (
                  <div
                    draggable
                    onDragStart={(e) => handleLayerDragStart(e, elements.find((el) => el.type === "label")!.id)}
                    onDragOver={handleLayerDragOver}
                    onDrop={(e) => handleLayerDrop(e, elements.find((el) => el.type === "label")!.id)}
                    onDragEnd={() => setDraggedLayerId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(elements.find((el) => el.type === "label")!.id);
                    }}
                    className={`font-bold text-[#3E3E3E] text-base mb-3 font-sans break-words cursor-pointer px-1 ${
                      selectedId === elements.find((el) => el.type === "label")!.id
                        ? "outline outline-2 outline-blue-500 bg-blue-500/10 rounded-sm"
                        : "hover:bg-black/5 rounded-sm"
                    } ${draggedLayerId === elements.find((el) => el.type === "label")!.id ? "opacity-50" : ""}`}
                    style={{ textShadow: "1px 1px 0 rgba(255,255,255,0.4)" }}
                  >
                    {elements.find((el) => el.type === "label")!.props.text || elements.find((el) => el.type === "label")!.name}
                  </div>
                )}

                {/* Body Text (Remaining Labels) */}
                <div className="flex flex-col gap-1 mb-4">
                  {elements
                    .filter((e) => e.type === "label")
                    .slice(1)
                    .map((el) => (
                      <div
                        key={el.id}
                        draggable
                        onDragStart={(e) => handleLayerDragStart(e, el.id)}
                        onDragOver={handleLayerDragOver}
                        onDrop={(e) => handleLayerDrop(e, el.id)}
                        onDragEnd={() => setDraggedLayerId(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(el.id);
                        }}
                        className={`text-[#3E3E3E] text-sm font-sans break-words cursor-pointer px-1 transition-opacity ${
                          selectedId === el.id
                            ? "outline outline-2 outline-blue-500 bg-blue-500/10 rounded-sm"
                            : "hover:bg-black/5 rounded-sm"
                        } ${draggedLayerId === el.id ? "opacity-30 border-dashed border-2 border-zinc-400" : ""}`}
                      >
                        {el.props.text || el.name}
                      </div>
                    ))}
                </div>

                {/* Form Inputs (ModalFormData only) */}
                <div className="flex flex-col gap-3 mb-4">
                  {elements
                    .filter((e) =>
                      ["dropdown", "slider", "textfield", "toggle", "player_picker"].includes(e.type),
                    )
                    .map((el) => (
                      <div
                        key={el.id}
                        draggable
                        onDragStart={(e) => handleLayerDragStart(e, el.id)}
                        onDragOver={handleLayerDragOver}
                        onDrop={(e) => handleLayerDrop(e, el.id)}
                        onDragEnd={() => setDraggedLayerId(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(el.id);
                        }}
                        className={`flex flex-col gap-1 cursor-pointer p-1 -mx-1 transition-opacity ${
                          selectedId === el.id
                            ? "outline outline-2 outline-blue-500 bg-blue-500/10 rounded-sm"
                            : "hover:bg-black/5 rounded-sm"
                        } ${draggedLayerId === el.id ? "opacity-30 border-dashed border-2 border-zinc-400" : ""}`}
                      >
                        <label className="text-[#3E3E3E] text-sm font-bold flex justify-between items-center pointer-events-none">
                          {el.props.text || el.name}
                        </label>

                        {/* Input Mockups */}
                        {["dropdown", "player_picker"].includes(el.type) && (
                          <div className="w-full h-8 bg-[#313233] border-[2px] border-[#1E1E1E] flex items-center px-2 text-white text-xs shadow-inner pointer-events-none">
                            {el.type === "player_picker" ? "Select Player..." : "Dropdown Option"}
                          </div>
                        )}
                        {el.type === "textfield" && (
                          <div className="w-full h-8 bg-[#111111] border-[2px] border-[#1E1E1E] flex items-center px-2 text-[#999] text-xs shadow-inner pointer-events-none">
                            {el.props.textFieldPlaceholder || "Text field content"}
                          </div>
                        )}
                        {el.type === "slider" && (
                          <div className="w-full h-2 mt-2 bg-[#313233] border border-[#1E1E1E] relative shadow-inner pointer-events-none">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-5 bg-[#C6C6C6] border-2 border-[#1E1E1E] shadow-sm pointer-events-none" />
                          </div>
                        )}
                        {el.type === "toggle" && (
                          <div className="w-10 h-5 border-[2px] border-[#1E1E1E] bg-[#313233] flex items-center p-0.5 shadow-inner pointer-events-none">
                            {el.props.toggleDefault === "true" ? (
                              <div className="w-full flex justify-end pointer-events-none">
                                <div className="w-3 h-full bg-[#5A8F43] border border-[#3C3D3F] pointer-events-none" />
                              </div>
                            ) : (
                              <div className="w-full flex justify-start pointer-events-none">
                                <div className="w-3 h-full bg-[#5A5B5D] border border-[#3C3D3F] pointer-events-none" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                </div>

                {/* Buttons Stack */}
                <div className="flex flex-col gap-1.5 mt-auto">
                  {elements
                    .filter((e) => e.type === "button" || e.type === "image")
                    .map((el) => (
                      <div
                        key={el.id}
                        draggable
                        onDragStart={(e) => handleLayerDragStart(e, el.id)}
                        onDragOver={handleLayerDragOver}
                        onDrop={(e) => handleLayerDrop(e, el.id)}
                        onDragEnd={() => setDraggedLayerId(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(el.id);
                        }}
                        className={`w-full py-2 px-3 bg-[#3C3D3F] border-[2px] border-[#1E1E1E] flex items-center cursor-pointer shadow-[inset_1px_1px_0_rgba(255,255,255,0.2)] transition-opacity ${
                          selectedId === el.id
                            ? "outline outline-2 outline-offset-1 outline-blue-500"
                            : "hover:bg-[#4C4D4F]"
                        } ${draggedLayerId === el.id ? "opacity-30 border-dashed border-2 border-zinc-400" : ""}`}
                      >
                        {el.props.texture ? (
                          <img
                            src={el.props.texture.startsWith("http") ? el.props.texture : `/${el.props.texture}`}
                            alt=""
                            className="w-5 h-5 mr-3 object-contain rounded-sm pointer-events-none"
                            style={{ imageRendering: "pixelated" }}
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        ) : null}
                        <span className="text-white font-sans text-sm tracking-wide truncate pointer-events-none">
                          {el.props.text || el.name}
                        </span>
                      </div>
                    ))}
                </div>
                </div>
              </div>

              <div className="absolute left-6 top-6 flex flex-col gap-2 z-20">
                <div
                  className="w-10 h-10 bg-[#313233] border border-[#1E1E1E] rounded shadow-md flex items-center justify-center text-white cursor-pointer hover:bg-[#3C3D3F] hover:border-white transition-all shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
                  title="Selection Tool"
                >
                  <MousePointer2 className="w-4 h-4 text-[#5A8F43]" />
                </div>
              </div>

              <div className="absolute bottom-4 left-4 flex gap-4 pointer-events-none">
                <div className="text-xs text-white uppercase tracking-wider font-sans bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-sm shadow-md backdrop-blur">
                  Preview: Ore UI (1.21+)
                </div>
                <div className="text-xs text-white uppercase tracking-wider font-sans bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-sm shadow-md backdrop-blur">
                  Snap to Grid: 10px
                </div>
              </div>
            </main>

            <aside className="w-72 border-l border-zinc-800 bg-zinc-900 flex flex-col shrink-0 shadow-xl z-20">
              <div className="p-3 border-b border-zinc-800 bg-zinc-900 sticky top-0">
                <div className="text-[11px] font-bold text-white flex items-center justify-between uppercase">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <Settings2 className="w-3 h-3" /> Properties
                  </span>
                  {selectedId && (
                    <span className="text-zinc-500 text-[9px] lowercase font-mono">
                      #{selectedId}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
                {!selectedId ? (
                  <div className="text-zinc-500 text-xs text-center mt-10 italic">
                    Select an element to view properties
                  </div>
                ) : (
                  selectedElement && (
                    <>
                      {/* Identification */}
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase">
                            Identification
                          </span>
                          <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded p-0.5">
                            <button
                              onClick={() => handleMoveElement(-1)}
                              className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors"
                              title="Move Element Up"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <div className="w-[1px] h-3 bg-zinc-700 mx-0.5" />
                            <button
                              onClick={() => handleMoveElement(1)}
                              className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors"
                              title="Move Element Down"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] text-zinc-500">
                            Element Name
                          </label>
                          <input
                            type="text"
                            value={selectedElement.name}
                            onChange={(e) => {
                              setElements((prev) =>
                                prev.map((el) =>
                                  el.id === selectedId
                                    ? { ...el, name: e.target.value }
                                    : el,
                                ),
                              );
                            }}
                            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono transition-colors"
                          />
                        </div>
                      </div>

                      <div className="h-[1px] bg-zinc-800 w-full" />

                      {/* Geometry */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase">
                          Geometry & Position
                        </span>
                        <div className="text-[10px] text-zinc-500 mb-2 leading-relaxed bg-zinc-950 p-2 rounded border border-zinc-800/50">
                          Minecraft Bedrock generated forms are strictly governed by the game engine. Custom positioning (X, Y) and sizing (Width, Height) are not supported with Script API. The preview reflects realistic form grouping.
                        </div>
                      </div>

                      <div className="h-[1px] bg-zinc-800 w-full" />

                      {(selectedElement.type === "label" ||
                        selectedElement.type === "button" ||
                        ["dropdown", "slider", "textfield", "toggle"].includes(
                          selectedElement.type,
                        )) && (
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase">
                            Text Content
                          </span>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-zinc-500">
                              Label / Button Text
                            </label>
                            <VariableHighlightInput
                              variablesList={variables}
                              value={selectedElement.props.text || ""}
                              onChange={(e: any) =>
                                updateSelectedProp("text", e.target.value)
                              }
                              className="bg-zinc-950 border border-zinc-800 rounded focus-within:border-green-500 transition-colors w-full"
                            />
                            <div className="text-[9px] text-zinc-500 mt-0.5">
                              Tip: You can display a variable's value by wrapping its name in braces, e.g. <span className="font-mono text-zinc-400">{"{cash}"}</span>
                            </div>
                          </div>

                          {selectedElement.type === "dropdown" && (
                            <div className="flex flex-col gap-1 mt-1">
                              <label className="text-[9px] text-zinc-500">
                                Options (comma separated)
                              </label>
                              <VariableHighlightInput
                                variablesList={variables}
                                value={
                                  selectedElement.props.dropdownOptions ||
                                  "Option 1, Option 2"
                                }
                                onChange={(e: any) =>
                                  updateSelectedProp(
                                    "dropdownOptions",
                                    e.target.value,
                                  )
                                }
                                placeholder="Item 1, Item 2, Item 3"
                                className="bg-zinc-950 border border-zinc-800 rounded focus-within:border-blue-500 w-full"
                              />
                              <label className="text-[9px] text-zinc-500 mt-1">
                                Default Selected Index
                              </label>
                              <input
                                type="number"
                                value={
                                  selectedElement.props.dropdownDefault || "0"
                                }
                                onChange={(e) =>
                                  updateSelectedProp(
                                    "dropdownDefault",
                                    e.target.value,
                                  )
                                }
                                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono w-full"
                              />
                            </div>
                          )}

                          {selectedElement.type === "slider" && (
                            <>
                              <div className="grid grid-cols-2 gap-2 mt-1">
                                <div className="flex flex-col gap-1">
                                  <label className="text-[9px] text-zinc-500">
                                    Min Value
                                  </label>
                                  <input
                                    type="number"
                                    value={selectedElement.props.sliderMin || "0"}
                                    onChange={(e) =>
                                      updateSelectedProp(
                                        "sliderMin",
                                        e.target.value,
                                      )
                                    }
                                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono w-full"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[9px] text-zinc-500">
                                    Max Value
                                  </label>
                                  <input
                                    type="number"
                                    value={
                                      selectedElement.props.sliderMax || "100"
                                    }
                                    onChange={(e) =>
                                      updateSelectedProp(
                                        "sliderMax",
                                        e.target.value,
                                      )
                                    }
                                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono w-full"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[9px] text-zinc-500">
                                    Step Size
                                  </label>
                                  <input
                                    type="number"
                                    value={
                                      selectedElement.props.sliderStep || "1"
                                    }
                                    onChange={(e) =>
                                      updateSelectedProp(
                                        "sliderStep",
                                        e.target.value,
                                      )
                                    }
                                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono w-full"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[9px] text-zinc-500">
                                    Default Value
                                  </label>
                                  <input
                                    type="number"
                                    value={
                                      selectedElement.props.sliderDefault || "0"
                                    }
                                    onChange={(e) =>
                                      updateSelectedProp(
                                        "sliderDefault",
                                        e.target.value,
                                      )
                                    }
                                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono w-full"
                                  />
                                </div>
                              </div>
                              <p className="text-[9px] text-zinc-500 mt-2 leading-relaxed">
                                You can use this slider's value as a variable! For example, set a button action's variable increment to <code className="text-zinc-300">{"{SliderName}"}</code> or <code className="text-zinc-300">{"-{SliderName}"}</code> to change a player's variable based on this slider. (Replace SliderName with this slider's title, no spaces).
                              </p>
                            </>
                          )}

                          {selectedElement.type === "textfield" && (
                            <div className="flex flex-col gap-1 mt-1">
                              <label className="text-[9px] text-zinc-500">
                                Placeholder Text
                              </label>
                              <VariableHighlightInput
                                variablesList={variables}
                                value={
                                  selectedElement.props.textFieldPlaceholder ||
                                  "Placeholder"
                                }
                                onChange={(e: any) =>
                                  updateSelectedProp(
                                    "textFieldPlaceholder",
                                    e.target.value,
                                  )
                                }
                                className="bg-zinc-950 border border-zinc-800 rounded focus-within:border-blue-500 w-full"
                              />
                              <label className="text-[9px] text-zinc-500 mt-1">
                                Default Value
                              </label>
                              <VariableHighlightInput
                                variablesList={variables}
                                value={
                                  selectedElement.props.textFieldDefault || ""
                                }
                                onChange={(e: any) =>
                                  updateSelectedProp(
                                    "textFieldDefault",
                                    e.target.value,
                                  )
                                }
                                className="bg-zinc-950 border border-zinc-800 rounded focus-within:border-blue-500 w-full"
                              />
                              <label className="text-[9px] text-zinc-500 mt-1 text-green-400">
                                Correct Answer (Trigger Actions)
                              </label>
                              <VariableHighlightInput
                                variablesList={variables}
                                value={
                                  selectedElement.props.correctAnswer || ""
                                }
                                onChange={(e: any) =>
                                  updateSelectedProp(
                                    "correctAnswer",
                                    e.target.value,
                                  )
                                }
                                placeholder="Case sensitive string..."
                                className="bg-zinc-950 border border-green-900 rounded focus-within:border-green-500 w-full"
                              />
                            </div>
                          )}

                          {selectedElement.type === "toggle" && (
                            <div className="flex flex-col gap-1 mt-1">
                              <label className="text-[9px] text-zinc-500">
                                Default State
                              </label>
                              <select
                                value={
                                  selectedElement.props.toggleDefault || "false"
                                }
                                onChange={(e) =>
                                  updateSelectedProp(
                                    "toggleDefault",
                                    e.target.value,
                                  )
                                }
                                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono w-full"
                              >
                                <option value="false">Unchecked</option>
                                <option value="true">Checked</option>
                              </select>
                            </div>
                          )}
                        </div>
                      )}

                      {selectedElement.type === "label" &&
                        variables.length > 0 && (
                          <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-zinc-800">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase">
                              Bind to Variable (optional)
                            </span>
                            <select
                              value={selectedElement.props.boundVariable || ""}
                              onChange={(e) =>
                                updateSelectedProp(
                                  "boundVariable",
                                  e.target.value,
                                )
                              }
                              className="bg-zinc-950 border border-zinc-800 text-xs text-white rounded p-1.5 focus:border-[#3498db] outline-none"
                            >
                              <option value="">None</option>
                              {variables.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name} ({v.scope})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                      {["button", "textfield", "player_picker"].includes(
                        selectedElement.type,
                      ) &&
                        variables.length > 0 && (
                          <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-zinc-800">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase">
                                {selectedElement.type === "player_picker"
                                  ? "Action on Executor"
                                  : "Variable Modifiers"}
                              </span>
                              <button
                                onClick={() => {
                                  const acts =
                                    selectedElement.variableActions || [];
                                  setElements((prev) =>
                                    prev.map((el) =>
                                      el.id === selectedId
                                        ? {
                                            ...el,
                                            variableActions: [
                                              ...acts,
                                              {
                                                varId: variables[0].id,
                                                amount: 1,
                                                required: false,
                                              },
                                            ],
                                          }
                                        : el,
                                    ),
                                  );
                                }}
                                className="text-[#3498db] text-[10px] font-bold uppercase hover:underline"
                              >
                                + Add Action
                              </button>
                            </div>
                            <div className="flex flex-col gap-2">
                              {selectedElement.variableActions?.map(
                                (act, idx) => (
                                  <div
                                    key={idx}
                                    className="flex flex-col gap-1 bg-zinc-950 p-1.5 rounded border border-zinc-800"
                                  >
                                    <div className="flex gap-1 items-center">
                                      <select
                                        value={act.varId}
                                        onChange={(e) => {
                                          const acts = [
                                            ...(selectedElement.variableActions ||
                                              []),
                                          ];
                                          acts[idx].varId = e.target.value;
                                          setElements((prev) =>
                                            prev.map((el) =>
                                              el.id === selectedId
                                                ? {
                                                    ...el,
                                                    variableActions: acts,
                                                  }
                                                : el,
                                            ),
                                          );
                                        }}
                                        className="bg-zinc-900 border border-zinc-700 text-[10px] text-white rounded p-1 flex-1"
                                      >
                                        {variables.map((v) => (
                                          <option key={v.id} value={v.id}>
                                            {v.name} ({v.scope})
                                          </option>
                                        ))}
                                      </select>
                                      <select
                                        value={act.actionType || "increment"}
                                        onChange={(e) => {
                                          const acts = [
                                            ...(selectedElement.variableActions ||
                                              []),
                                          ];
                                          acts[idx].actionType = e.target.value as "increment" | "set";
                                          setElements((prev) =>
                                            prev.map((el) =>
                                              el.id === selectedId
                                                ? {
                                                    ...el,
                                                    variableActions: acts,
                                                  }
                                                : el,
                                            ),
                                          );
                                        }}
                                        className="bg-zinc-900 border border-zinc-700 text-white text-[9px] rounded p-1 outline-none w-14"
                                      >
                                        <option value="increment">Inc (+)</option>
                                        <option value="set">Set (=)</option>
                                      </select>
                                      <VariableHighlightInput
                                        variablesList={variables}
                                        value={act.amount}
                                        onChange={(e: any) => {
                                          const acts = [
                                            ...(selectedElement.variableActions ||
                                              []),
                                          ];
                                          const val = e.target.value;
                                          acts[idx].amount = val;
                                          setElements((prev) =>
                                            prev.map((el) =>
                                              el.id === selectedId
                                                ? {
                                                    ...el,
                                                    variableActions: acts,
                                                  }
                                                : el,
                                            ),
                                          );
                                        }}
                                        className="bg-zinc-900 border border-zinc-700 rounded w-[60px]"
                                      />
                                      <button
                                        onClick={() => {
                                          const acts = [
                                            ...(selectedElement.variableActions ||
                                              []),
                                          ];
                                          acts.splice(idx, 1);
                                          setElements((prev) =>
                                            prev.map((el) =>
                                              el.id === selectedId
                                                ? {
                                                    ...el,
                                                    variableActions: acts,
                                                  }
                                                : el,
                                            ),
                                          );
                                        }}
                                        className="text-red-400 text-[10px] font-bold px-1 hover:text-red-300"
                                      >
                                        X
                                      </button>
                                    </div>
                                    <label className="flex items-center gap-1.5 cursor-pointer mt-1">
                                      <input
                                        type="checkbox"
                                        checked={!!act.required}
                                        onChange={(e) => {
                                          const acts = [
                                            ...(selectedElement.variableActions ||
                                              []),
                                          ];
                                          acts[idx].required = e.target.checked;
                                          setElements((prev) =>
                                            prev.map((el) =>
                                              el.id === selectedId
                                                ? {
                                                    ...el,
                                                    variableActions: acts,
                                                  }
                                                : el,
                                            ),
                                          );
                                        }}
                                        className="accent-[#3498db]"
                                      />
                                      <span className="text-[9px] text-zinc-400">
                                        Required (Fail if exceeded condition)
                                      </span>
                                    </label>
                                  </div>
                                ),
                              )}
                            </div>

                            {selectedElement.type === "player_picker" && (
                              <>
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800">
                                  <span className="text-[10px] font-bold text-orange-400 uppercase">
                                    Action on Target
                                  </span>
                                  <button
                                    onClick={() => {
                                      const acts =
                                        selectedElement.variableActionsTarget ||
                                        [];
                                      setElements((prev) =>
                                        prev.map((el) =>
                                          el.id === selectedId
                                            ? {
                                                ...el,
                                                variableActionsTarget: [
                                                  ...acts,
                                                  {
                                                    varId: variables[0].id,
                                                    amount: 1,
                                                    required: false,
                                                  },
                                                ],
                                              }
                                            : el,
                                        ),
                                      );
                                    }}
                                    className="text-[#3498db] text-[10px] font-bold uppercase hover:underline"
                                  >
                                    + Add Action
                                  </button>
                                </div>
                                <div className="flex flex-col gap-2">
                                  {selectedElement.variableActionsTarget?.map(
                                    (act, idx) => (
                                      <div
                                        key={idx}
                                        className="flex flex-col gap-1 bg-zinc-950 p-1.5 rounded border border-[#5a3a14]"
                                      >
                                        <div className="flex gap-1 items-center">
                                          <select
                                            value={act.varId}
                                            onChange={(e) => {
                                              const acts = [
                                                ...(selectedElement.variableActionsTarget ||
                                                  []),
                                              ];
                                              acts[idx].varId = e.target.value;
                                              setElements((prev) =>
                                                prev.map((el) =>
                                                  el.id === selectedId
                                                    ? {
                                                        ...el,
                                                        variableActionsTarget:
                                                          acts,
                                                      }
                                                    : el,
                                                ),
                                              );
                                            }}
                                            className="bg-[#2a1a0f] border border-[#5a3a14] text-[10px] text-orange-300 rounded p-1 flex-1"
                                          >
                                            {variables.map((v) => (
                                              <option key={v.id} value={v.id}>
                                                {v.name} ({v.scope})
                                              </option>
                                            ))}
                                          </select>
                                          <select
                                            value={act.actionType || "increment"}
                                            onChange={(e) => {
                                              const acts = [
                                                ...(selectedElement.variableActionsTarget ||
                                                  []),
                                              ];
                                              acts[idx].actionType = e.target.value as "increment" | "set";
                                              setElements((prev) =>
                                                prev.map((el) =>
                                                  el.id === selectedId
                                                    ? {
                                                        ...el,
                                                        variableActionsTarget: acts,
                                                      }
                                                    : el,
                                                ),
                                              );
                                            }}
                                            className="bg-zinc-900 border border-zinc-700 text-white text-[9px] rounded p-1 outline-none w-14"
                                          >
                                            <option value="increment">Inc (+)</option>
                                            <option value="set">Set (=)</option>
                                          </select>
                                          <VariableHighlightInput
                                            variablesList={variables}
                                            value={act.amount}
                                            onChange={(e: any) => {
                                              const acts = [
                                                ...(selectedElement.variableActionsTarget ||
                                                  []),
                                              ];
                                              const val = e.target.value;
                                              acts[idx].amount = val;
                                              setElements((prev) =>
                                                prev.map((el) =>
                                                  el.id === selectedId
                                                    ? {
                                                        ...el,
                                                        variableActionsTarget:
                                                          acts,
                                                      }
                                                    : el,
                                                ),
                                              );
                                            }}
                                            className="bg-[#2a1a0f] border border-[#5a3a14] rounded w-[60px]"
                                          />
                                          <button
                                            onClick={() => {
                                              const acts = [
                                                ...(selectedElement.variableActionsTarget ||
                                                  []),
                                              ];
                                              acts.splice(idx, 1);
                                              setElements((prev) =>
                                                prev.map((el) =>
                                                  el.id === selectedId
                                                    ? {
                                                        ...el,
                                                        variableActionsTarget:
                                                          acts,
                                                      }
                                                    : el,
                                                ),
                                              );
                                            }}
                                            className="text-red-400 text-[10px] font-bold px-1 hover:text-red-300"
                                          >
                                            X
                                          </button>
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        )}

                      {["image", "button"].includes(
                        selectedElement.type,
                      ) && (
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase">
                            Texture Settings
                          </span>
                          <div className="flex flex-col gap-1 mb-2">
                            <label className="text-[9px] text-zinc-500">
                              Bedrock Texture Path
                            </label>
                            <input
                              type="text"
                              value={selectedElement.props.texture || ""}
                              onChange={(e) =>
                                updateSelectedProp("texture", e.target.value)
                              }
                              placeholder="textures/ui/..."
                              className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono transition-colors w-full"
                            />
                            {selectedElement.type === "button" && (
                             <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed">
                              Setting a texture on a button displays the image beside the button text in Minecraft natively.
                             </p>
                            )}
                            {selectedElement.type === "image" && (
                             <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed">
                              Minecraft Script API handles image dimensions automatically when rendered in forms. Explicit width/height sizing is ignored.
                             </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-zinc-500">
                              Local Preview Image
                            </label>
                            <label className="cursor-pointer bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-center text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors flex items-center justify-center gap-2">
                              <Upload className="w-3.5 h-3.5" />
                              {selectedElement.props.previewImage
                                ? "Change Image..."
                                : "Upload Image..."}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                      updateSelectedProp(
                                        "previewImage",
                                        ev.target?.result as string,
                                      );
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                            {selectedElement.props.previewImage && (
                              <button
                                onClick={() => {
                                  const { previewImage, ...newProps } =
                                    selectedElement.props;
                                  setElements((prev) =>
                                    prev.map((el) =>
                                      el.id === selectedId
                                        ? { ...el, props: newProps }
                                        : el,
                                    ),
                                  );
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
                      <div className="h-[1px] bg-zinc-800 w-full" />
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-[#3498db]">
                          <Wand2 className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">
                            AI Event Builder
                          </span>
                        </div>
                        <p className="text-[9px] text-zinc-400 leading-tight">
                          Describe what this element should do. AI will generate
                          the Bedrock JSON logic bindings.
                        </p>
                        <textarea
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder="e.g., Increase player strength by 1 when clicked... or show player health amount"
                          className="bg-zinc-950 border border-zinc-800 rounded p-2 text-[11px] outline-none text-white focus:border-blue-500 font-sans transition-colors resize-none h-16 w-full"
                        />
                        <button
                          onClick={handleGenerateLogic}
                          disabled={isGenerating || !aiPrompt}
                          className="py-1.5 px-3 bg-[#3498db] text-white text-[10px] font-bold uppercase rounded hover:bg-[#2980b9] transition-colors w-full flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isGenerating ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Code2 className="w-3 h-3" />
                          )}
                          {isGenerating
                            ? "Generating Logic..."
                            : "Generate Bedrock Logic"}
                        </button>
                      </div>

                      {/* JSON Context */}
                      <div className="h-[1px] bg-zinc-800 w-full" />
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase">
                            JSON Context
                          </span>
                          <span className="text-[8px] bg-zinc-800 px-1 py-0.5 rounded text-zinc-400">
                            Generated
                          </span>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded h-32 font-mono text-[10px] text-zinc-400 overflow-auto whitespace-pre leading-relaxed shadow-inner custom-scrollbar relative w-full">
                          <span className="text-blue-400">
                            "
                            {selectedElement.name
                              .replace(/ /g, "_")
                              .toLowerCase()}
                            "
                          </span>
                          : {"{\n"}
                          &nbsp;&nbsp;
                          <span className="text-purple-400">"type"</span>:{" "}
                          <span className="text-green-400">
                            "{selectedElement.type}"
                          </span>
                          ,\n &nbsp;&nbsp;
                          <span className="text-purple-400">"size"</span>:{" "}
                          <span className="text-[#dcdcaa]">
                            [{selectedElement.width}, {selectedElement.height}]
                          </span>
                          ,\n &nbsp;&nbsp;
                          <span className="text-purple-400">
                            "offset"
                          </span>:{" "}
                          <span className="text-[#dcdcaa]">
                            [{selectedElement.x}, {selectedElement.y}]
                          </span>
                          ,\n
                          {selectedElement.type === "label" && (
                            <>
                              &nbsp;&nbsp;
                              <span className="text-purple-400">
                                "text"
                              </span>:{" "}
                              <span className="text-green-400">
                                "{selectedElement.props.text}"
                              </span>
                              ,\n
                            </>
                          )}
                          {selectedElement.type === "dropdown" && (
                            <>
                              &nbsp;&nbsp;
                              <span className="text-purple-400">"options"</span>
                              :{" "}
                              <span className="text-green-400">
                                "
                                {selectedElement.props.dropdownOptions ||
                                  "Option 1, Option 2"}
                                "
                              </span>
                              ,\n &nbsp;&nbsp;
                              <span className="text-purple-400">
                                "defaultIndex"
                              </span>
                              :{" "}
                              <span className="text-[#dcdcaa]">
                                {selectedElement.props.dropdownDefault || "0"}
                              </span>
                              ,\n
                            </>
                          )}
                          {selectedElement.type === "slider" && (
                            <>
                              &nbsp;&nbsp;
                              <span className="text-purple-400">
                                "min"
                              </span>:{" "}
                              <span className="text-[#dcdcaa]">
                                {selectedElement.props.sliderMin || "0"}
                              </span>
                              ,\n &nbsp;&nbsp;
                              <span className="text-purple-400">
                                "max"
                              </span>:{" "}
                              <span className="text-[#dcdcaa]">
                                {selectedElement.props.sliderMax || "100"}
                              </span>
                              ,\n &nbsp;&nbsp;
                              <span className="text-purple-400">
                                "step"
                              </span>:{" "}
                              <span className="text-[#dcdcaa]">
                                {selectedElement.props.sliderStep || "1"}
                              </span>
                              ,\n &nbsp;&nbsp;
                              <span className="text-purple-400">"default"</span>
                              :{" "}
                              <span className="text-[#dcdcaa]">
                                {selectedElement.props.sliderDefault || "0"}
                              </span>
                              ,\n
                            </>
                          )}
                          {selectedElement.type === "textfield" && (
                            <>
                              &nbsp;&nbsp;
                              <span className="text-purple-400">
                                "placeholder"
                              </span>
                              :{" "}
                              <span className="text-green-400">
                                "
                                {selectedElement.props.textFieldPlaceholder ||
                                  "Placeholder"}
                                "
                              </span>
                              ,\n &nbsp;&nbsp;
                              <span className="text-purple-400">"default"</span>
                              :{" "}
                              <span className="text-green-400">
                                "{selectedElement.props.textFieldDefault || ""}"
                              </span>
                              ,\n
                            </>
                          )}
                          {selectedElement.type === "toggle" && (
                            <>
                              &nbsp;&nbsp;
                              <span className="text-purple-400">"default"</span>
                              :{" "}
                              <span className="text-green-400">
                                {selectedElement.props.toggleDefault === "true"
                                  ? "true"
                                  : "false"}
                              </span>
                              ,\n
                            </>
                          )}
                          {selectedElement.type === "button" &&
                            selectedElement.variableActions &&
                            selectedElement.variableActions.length > 0 && (
                              <>
                                &nbsp;&nbsp;
                                <span className="text-purple-400">
                                  "variable_actions"
                                </span>
                                :{" "}
                                <span className="text-[#dcdcaa]">
                                  {JSON.stringify(
                                    selectedElement.variableActions,
                                  )}
                                </span>
                                ,\n
                              </>
                            )}
                          {selectedElement.props.texture && (
                            <>
                              &nbsp;&nbsp;
                              <span className="text-purple-400">"texture"</span>
                              :{" "}
                              <span className="text-green-400">
                                "{selectedElement.props.texture}"
                              </span>
                              ,\n
                            </>
                          )}
                          {selectedElement.props.bedrockCode ? (
                            <span className="text-yellow-400 whitespace-pre-wrap">
                              {selectedElement.props.bedrockCode
                                .split("\n")
                                .filter(
                                  (_, i) =>
                                    i > 0 &&
                                    i <
                                      selectedElement.props.bedrockCode.split(
                                        "\n",
                                      ).length -
                                        1,
                                )
                                .join("\n")}
                            </span>
                          ) : (
                            <>
                              &nbsp;&nbsp;
                              <span className="text-zinc-500 italic">
                                // Use AI Box above to generate logic...
                              </span>
                              \n
                            </>
                          )}
                          {"\n}"}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteElement(selectedId)}
                        className="mt-4 w-full py-2 bg-red-950/50 border border-red-500/30 text-red-400 rounded text-[10px] uppercase font-bold hover:bg-red-900/50 hover:text-red-300 transition-colors"
                      >
                        Delete Element
                      </button>
                    </>
                  )
                )}
              </div>
            </aside>
          </>
        ) : viewMode === "variables" ? (
          <div className="flex-1 overflow-auto bg-zinc-950">
            <div className="p-6 flex flex-col gap-6">
              <div className="flex justify-between items-center bg-zinc-900 p-4 rounded border border-zinc-800">
                <div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-wider">
                    Dynamic Variables
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Track global and player-specific stats using Bedrock Dynamic
                    Properties.
                  </p>
                </div>
                <button
                  onClick={() =>
                    setVariables([
                      ...variables,
                      {
                        id: generateUUID(),
                        name: "newVariable",
                        scope: "player",
                        min: 0,
                        max: null,
                        increments: [],
                      },
                    ])
                  }
                  className="bg-[#3498db] text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider hover:bg-[#2980b9] transition-colors shadow-lg"
                >
                  + Add Variable
                </button>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded p-4 flex flex-col gap-2">
                <h4 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" /> AI Variable
                  Settings
                </h4>
                <p className="text-[10px] text-zinc-500">
                  Describe a stat or variable to track (e.g., "tracks blocks
                  broken", "tracks x axis position", "mana").
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiVarPrompt}
                    onChange={(e) => setAiVarPrompt(e.target.value)}
                    placeholder="E.g., Track how many times player jumps..."
                    className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white outline-none flex-1 focus:border-purple-500"
                  />
                  <button
                    onClick={handleGenerateVariable}
                    disabled={isGeneratingVar}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-4 py-1.5 rounded text-[11px] font-bold tracking-wider uppercase disabled:opacity-50 flex items-center gap-2"
                  >
                    {isGeneratingVar ? (
                      <span className="animate-spin relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                      </span>
                    ) : (
                      "Generate"
                    )}
                  </button>
                </div>
              </div>

              {variables.length === 0 && (
                <div className="text-center py-12 text-zinc-500 font-mono text-sm border border-dashed border-zinc-700 rounded">
                  No variables defined yet. Creating variables will let you
                  track counts when events happen in-game.
                </div>
              )}

              {variables.map((v, i) => (
                <div
                  key={v.id}
                  className="bg-zinc-900 border border-zinc-800 rounded overflow-hidden"
                >
                  <div className="bg-[#2a2a2a] p-3 border-b flex items-center justify-between border-zinc-800">
                    <div className="flex items-center gap-4">
                      <select
                        value={v.scope}
                        onChange={(e) => {
                          const newVars = [...variables];
                          newVars[i].scope = e.target.value as
                            | "player"
                            | "global";
                          setVariables(newVars);
                        }}
                        className="bg-zinc-950 border border-zinc-700 text-xs text-white rounded outline-none p-1.5 focus:border-[#007acc]"
                      >
                        <option value="player">Player Variable</option>
                        <option value="global">Global Variable</option>
                      </select>
                      <input
                        type="text"
                        value={v.name}
                        onChange={(e) => {
                          const newVars = [...variables];
                          newVars[i].name = e.target.value;
                          setVariables(newVars);
                        }}
                        className="bg-transparent border-none text-white font-mono font-bold outline-none flex-1 max-w-[200px]"
                      />
                    </div>
                    <button
                      onClick={() =>
                        setVariables(variables.filter((x) => x.id !== v.id))
                      }
                      className="text-red-400 hover:text-red-300 text-xs font-bold uppercase"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="p-4 flex flex-col gap-4">
                    {/* Min Max constraints */}
                    <div className="flex gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">
                          Minimum Value
                        </label>
                        <input
                          type="number"
                          value={v.min ?? ""}
                          className="bg-zinc-950 border border-zinc-800 p-1.5 rounded text-white font-mono text-sm w-24"
                          onChange={(e) => {
                            const newVars = [...variables];
                            newVars[i].min = e.target.value
                              ? parseInt(e.target.value)
                              : null;
                            setVariables(newVars);
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">
                          Maximum Value (Optional)
                        </label>
                        <input
                          type="number"
                          value={v.max ?? ""}
                          className="bg-zinc-950 border border-zinc-800 p-1.5 rounded text-white font-mono text-sm w-24"
                          onChange={(e) => {
                            const newVars = [...variables];
                            newVars[i].max = e.target.value
                              ? parseInt(e.target.value)
                              : null;
                            setVariables(newVars);
                          }}
                        />
                      </div>
                    </div>

                    {/* Increments */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">
                          Triggers (Increment when...)
                        </label>
                        <button
                          onClick={() => {
                            const newVars = [...variables];
                            newVars[i].increments = newVars[i].increments || [];
                            newVars[i].increments.push({
                              event: "playerJoin",
                              amount: 1,
                            });
                            setVariables(newVars);
                          }}
                          className="text-[#3498db] text-xs font-bold uppercase hover:underline"
                        >
                          + Add Event
                        </button>
                      </div>
                      <div className="flex flex-col gap-2">
                        {(v.increments || []).map((inc, incIdx) => (
                          <div
                            key={incIdx}
                            className="flex flex-col gap-2 bg-[#181818] p-2 rounded border border-[#2a2a2a]"
                          >
                            <div className="flex gap-2 items-center">
                              <select
                                value={inc.event}
                                onChange={(e) => {
                                  const newVars = [...variables];
                                  newVars[i].increments[incIdx].event =
                                    e.target.value;
                                  setVariables(newVars);
                                }}
                                className="bg-zinc-950 border border-zinc-800 text-xs p-1.5 rounded text-white outline-none focus:border-[#007acc] flex-1"
                              >
                                {MC_EVENTS.map((evt) => (
                                  <option key={evt} value={evt}>
                                    {evt === "xpGained" ? "XP Gained" : (evt === "custom_item" ? "Item Used" : evt === "complex_script" ? "Complex Script" : evt)}
                                  </option>
                                ))}
                              </select>
                              <span className="text-white text-xs font-mono font-bold">
                                BY
                              </span>
                              <input
                                type="number"
                                value={inc.amount}
                                onChange={(e) => {
                                  const newVars = [...variables];
                                  newVars[i].increments[incIdx].amount =
                                    parseFloat(e.target.value);
                                  setVariables(newVars);
                                }}
                                className="bg-zinc-950 border border-zinc-800 p-1 text-white font-mono text-sm rounded w-16"
                              />
                              <button
                                onClick={() => {
                                  const newVars = [...variables];
                                  newVars[i].increments.splice(incIdx, 1);
                                  setVariables(newVars);
                                }}
                                className="text-red-400 font-bold ml-2 text-xs"
                              >
                                X
                              </button>
                            </div>
                            {inc.event === "xpGained" && (
                              <div className="flex gap-2 items-center mt-1">
                                <span className="text-zinc-500 text-xs">Per</span>
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="1"
                                  value={inc.xpThreshold || 1}
                                  onChange={(e) => {
                                    const newVars = [...variables];
                                    newVars[i].increments[incIdx].xpThreshold =
                                      Math.max(1, parseInt(e.target.value) || 1);
                                    setVariables(newVars);
                                  }}
                                  className="bg-zinc-950 border border-zinc-800 p-1 text-white font-mono text-xs rounded w-16 outline-none focus:border-[#007acc]"
                                />
                                <span className="text-zinc-500 text-xs">XP</span>
                              </div>
                            )}
                            {inc.event === "custom_item" && (
                              <div className="flex gap-2 items-center mt-1">
                                <input
                                  type="text"
                                  placeholder="minecraft:stick"
                                  value={inc.customItemId || ""}
                                  onChange={(e) => {
                                    const newVars = [...variables];
                                    newVars[i].increments[incIdx].customItemId =
                                      e.target.value;
                                    setVariables(newVars);
                                  }}
                                  className="bg-zinc-950 border border-zinc-800 p-1 text-white font-mono text-xs rounded w-32 outline-none focus:border-[#007acc]"
                                />
                                <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                                  <input
                                    type="checkbox"
                                    checked={!!inc.destroyItemOnUse}
                                    onChange={(e) => {
                                      const newVars = [...variables];
                                      newVars[i].increments[
                                        incIdx
                                      ].destroyItemOnUse = e.target.checked;
                                      setVariables(newVars);
                                    }}
                                    className="accent-[#3498db]"
                                  />
                                  Destroy Item on Use
                                </label>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* HUD Options (Actionbar) */}
                    <div className="flex flex-col gap-2 p-3 border-t border-zinc-800">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={v.hud?.enabled || false}
                          onChange={(e) => {
                            const newVars = [...variables];
                            newVars[i].hud = { ...(newVars[i].hud || { style: "text", color: "§f" }), enabled: e.target.checked };
                            setVariables(newVars);
                          }}
                          className="accent-[#3498db]"
                        />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase">
                          Show on HUD (Actionbar)
                        </span>
                      </div>
                      {v.hud?.enabled && (
                         <div className="flex flex-col gap-2 bg-[#181818] p-2 rounded border border-[#2a2a2a] mt-1">
                            <div className="flex gap-2">
                                <select
                                 value={v.hud.style}
                                 onChange={(e) => {
                                    const newVars = [...variables];
                                    newVars[i].hud!.style = e.target.value as VariableHUD["style"];
                                    setVariables(newVars);
                                 }}
                                 className="bg-zinc-950 border border-zinc-800 text-xs p-1.5 rounded text-white outline-none focus:border-[#007acc] flex-1"
                               >
                                  <option value="text">Text (e.g. Mana: 10)</option>
                                  <option value="bar">Pipes (e.g. |||||-----)</option>
                                  <option value="solid_bar">Solid Bar (e.g. █ █ █ ▒ ▒)</option>
                                  <option value="squares">Squares (e.g. 🟩🟩⬛⬛)</option>
                                  <option value="icons">Icons (e.g. ⭐⭐⭐)</option>
                               </select>
                               <select
                                 value={v.hud.color}
                                 onChange={(e) => {
                                    const newVars = [...variables];
                                    newVars[i].hud!.color = e.target.value;
                                    setVariables(newVars);
                                 }}
                                 className="bg-zinc-950 border border-zinc-800 text-xs p-1.5 rounded text-white outline-none focus:border-[#007acc] w-24"
                               >
                                  <option value="§f">White</option>
                                  <option value="§c">Red</option>
                                  <option value="§a">Green</option>
                                  <option value="§b">Aqua</option>
                                  <option value="§e">Yellow</option>
                                  <option value="§6">Gold</option>
                                  <option value="§d">Pink</option>
                                  <option value="§5">Purple</option>
                               </select>
                            </div>
                            {v.hud.style === "icons" && (
                               <div className="flex items-center gap-2">
                                  <span className="text-zinc-500 text-xs text-nowrap">Icon:</span>
                                  <input type="text" maxLength={4} value={v.hud.iconText || "⭐"} onChange={(e) => { const newVars = [...variables]; newVars[i].hud!.iconText = e.target.value; setVariables(newVars); }} className="bg-zinc-950 border border-zinc-800 p-1 flex-1 text-white text-xs rounded outline-none focus:border-[#007acc]" />
                               </div>
                            )}
                            {["bar", "solid_bar", "squares"].includes(v.hud.style) && v.max === null && (
                               <div className="flex items-center gap-2">
                                  <span className="text-zinc-500 text-xs text-nowrap">Max Value:</span>
                                  <input type="number" value={v.hud.maxOverride || 100} onChange={(e) => { const newVars = [...variables]; newVars[i].hud!.maxOverride = parseFloat(e.target.value); setVariables(newVars); }} className="bg-zinc-950 border border-zinc-800 p-1 flex-1 text-white text-xs rounded outline-none focus:border-[#007acc]" />
                               </div>
                            )}
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : viewMode === "triggers" ? (
          <div className="flex-1 overflow-auto bg-[#1e1e1e]">
            <div className="p-6 flex flex-col gap-6">
              <div className="flex justify-between items-center bg-[#252526] py-3 px-4 rounded border border-zinc-800">
                <div>
                  <h2 className="text-white font-bold text-lg">
                    Custom Script Triggers
                  </h2>
                  <p className="text-zinc-400 text-xs">
                    Since GUI is set to Hidden, choose events to open your GUI
                    code.
                  </p>
                </div>
                <button
                  onClick={() =>
                    setCustomTriggers([
                      ...customTriggers,
                      { id: generateUUID(), type: "itemUse", config: {} },
                    ])
                  }
                  className="px-4 py-2 bg-[#007acc] text-white font-bold text-xs uppercase tracking-wider rounded hover:bg-[#005999] transition-colors"
                >
                  + Add Trigger
                </button>
              </div>

              {customTriggers.map((trigger, i) => (
                <div
                  key={trigger.id}
                  className="bg-[#252526] border border-zinc-800 rounded"
                >
                  <div className="bg-[#2a2d2e] p-3 border-b border-zinc-800 flex justify-between items-center rounded-t">
                    <span className="text-white font-bold text-sm tracking-wide">
                      Trigger #{i + 1}
                    </span>
                    <button
                      onClick={() =>
                        setCustomTriggers(
                          customTriggers.filter((t) => t.id !== trigger.id),
                        )
                      }
                      className="text-red-400 font-bold text-xs uppercase hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="p-4 flex flex-col gap-4">
                    <div className="flex gap-4 items-end">
                      <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                          Trigger Event
                        </label>
                        <select
                          value={trigger.type}
                          onChange={(e) => {
                            const newTriggers = [...customTriggers];
                            newTriggers[i].type = e.target.value as any;
                            setCustomTriggers(newTriggers);
                          }}
                          className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-white text-sm outline-none rounded"
                        >
                          <option value="itemUse">
                            Using an Item in Hand (Right Click)
                          </option>
                          <option value="blockBreak">
                            Breaking a Specific Block
                          </option>
                          <option value="entityHit">
                            Hitting a Specific Entity (Mob)
                          </option>
                          <option value="chatCommand">
                            Typing a Chat Command
                          </option>
                          <option value="aiGenerated">
                            ✨ AI Generative Trigger
                          </option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-1 w-full">
                        {trigger.type === "itemUse" && (
                          <>
                            <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                              Item ID
                            </label>
                            <input
                              type="text"
                              placeholder="minecraft:stick"
                              value={trigger.config.itemId || ""}
                              onChange={(e) => {
                                const newTriggers = [...customTriggers];
                                newTriggers[i].config.itemId = e.target.value;
                                setCustomTriggers(newTriggers);
                              }}
                              className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-white text-sm outline-none rounded font-mono"
                            />
                          </>
                        )}
                        {trigger.type === "blockBreak" && (
                          <>
                            <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                              Block ID
                            </label>
                            <input
                              type="text"
                              placeholder="minecraft:dirt"
                              value={trigger.config.blockId || ""}
                              onChange={(e) => {
                                const newTriggers = [...customTriggers];
                                newTriggers[i].config.blockId = e.target.value;
                                setCustomTriggers(newTriggers);
                              }}
                              className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-white text-sm outline-none rounded font-mono"
                            />
                          </>
                        )}
                        {trigger.type === "entityHit" && (
                          <>
                            <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                              Entity ID
                            </label>
                            <input
                              type="text"
                              placeholder="minecraft:cow"
                              value={trigger.config.entityId || ""}
                              onChange={(e) => {
                                const newTriggers = [...customTriggers];
                                newTriggers[i].config.entityId = e.target.value;
                                setCustomTriggers(newTriggers);
                              }}
                              className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-white text-sm outline-none rounded font-mono"
                            />
                          </>
                        )}
                        {trigger.type === "chatCommand" && (
                          <>
                            <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                              Chat Command
                            </label>
                            <input
                              type="text"
                              placeholder="!showgui"
                              value={trigger.config.command || ""}
                              onChange={(e) => {
                                const newTriggers = [...customTriggers];
                                newTriggers[i].config.command = e.target.value;
                                setCustomTriggers(newTriggers);
                              }}
                              className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-white text-sm outline-none rounded font-mono"
                            />
                          </>
                        )}
                        {trigger.type === "aiGenerated" && (
                          <div className="flex flex-col gap-2">
                            <label className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">
                              Describe the event in plain English
                            </label>
                            <textarea
                              placeholder="When the player enters water, or when they eat an apple..."
                              value={trigger.config.prompt || ""}
                              onChange={(e) => {
                                const newTriggers = [...customTriggers];
                                newTriggers[i].config.prompt = e.target.value;
                                setCustomTriggers(newTriggers);
                              }}
                              className="bg-zinc-950 border border-blue-900 px-3 py-2 text-white text-sm outline-none rounded min-h-[60px]"
                            />
                            <button
                              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-3 rounded text-xs transition-colors"
                              disabled={trigger.config.isGenerating}
                              onClick={async () => {
                                const newTriggers = [...customTriggers];
                                newTriggers[i].config.isGenerating = true;
                                setCustomTriggers(newTriggers);
                                try {
                                  const res = await fetch(
                                    "/api/generate-trigger",
                                    {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({
                                        prompt: trigger.config.prompt || "",
                                      }),
                                    },
                                  );
                                  const data = await res.json();
                                  newTriggers[i].config.code = data.result;
                                } catch (e) {
                                  alert("Failed to generate code.");
                                } finally {
                                  newTriggers[i].config.isGenerating = false;
                                  setCustomTriggers([...newTriggers]);
                                }
                              }}
                            >
                              {trigger.config.isGenerating
                                ? "Generating..."
                                : "✨ Generate Script"}
                            </button>
                            {trigger.config.code && (
                              <div className="mt-2">
                                <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                                  Generated Code
                                </label>
                                <textarea
                                  readOnly
                                  value={trigger.config.code}
                                  className="w-full bg-[#1e1e1e] border border-zinc-800 px-2 py-1 text-green-400 text-[11px] font-mono rounded min-h-[100px] mt-1 custom-scrollbar"
                                ></textarea>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Export / Code Mode */
          <div className="flex w-full h-full">
            <aside className="w-64 border-r border-zinc-800 bg-zinc-900 flex flex-col shrink-0">
              <div className="p-3 border-b border-zinc-800">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5" /> Bridge Workspace
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                <div className="mt-2 mb-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2">
                  Behavior Pack
                </div>
                <div
                  onClick={() => setSelectedFile("BP/manifest.json")}
                  className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${selectedFile === "BP/manifest.json" ? "bg-[#3498db]/20 text-blue-400" : "text-zinc-400 hover:bg-zinc-800"}`}
                >
                  <FileJson className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-yellow-400">BP/manifest.json</span>
                </div>
                <div
                  onClick={() => setSelectedFile("BP/scripts/main.js")}
                  className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${selectedFile === "BP/scripts/main.js" ? "bg-[#3498db]/20 text-blue-400" : "text-zinc-400 hover:bg-zinc-800"}`}
                >
                  <FileJson className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-yellow-400">BP/scripts/main.js</span>
                </div>
                {openedFrom === "book" && (
                  <div
                    onClick={() =>
                      setSelectedFile("BP/items/custom_gui_book.json")
                    }
                    className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${selectedFile === "BP/items/custom_gui_book.json" ? "bg-[#3498db]/20 text-blue-400" : "text-zinc-400 hover:bg-zinc-800"}`}
                  >
                    <FileJson className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-yellow-400">
                      BP/items/custom_gui_book.json
                    </span>
                  </div>
                )}

                <div className="mt-4 mb-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2">
                  Resource Pack
                </div>
                <div
                  onClick={() => setSelectedFile("RP/manifest.json")}
                  className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${selectedFile === "RP/manifest.json" ? "bg-[#3498db]/20 text-blue-400" : "text-zinc-400 hover:bg-zinc-800"}`}
                >
                  <FileJson className="w-3.5 h-3.5" />
                  <span>RP/manifest.json</span>
                </div>
                {openedFrom === "book" && (
                  <>
                    <div
                      onClick={() =>
                        setSelectedFile("RP/items/custom_gui_book.json")
                      }
                      className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${selectedFile === "RP/items/custom_gui_book.json" ? "bg-[#3498db]/20 text-blue-400" : "text-zinc-400 hover:bg-zinc-800"}`}
                    >
                      <FileJson className="w-3.5 h-3.5" />
                      <span>RP/items/custom_gui_book.json</span>
                    </div>
                    <div
                      onClick={() =>
                        setSelectedFile("RP/textures/item_texture.json")
                      }
                      className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${selectedFile === "RP/textures/item_texture.json" ? "bg-[#3498db]/20 text-blue-400" : "text-zinc-400 hover:bg-zinc-800"}`}
                    >
                      <FileJson className="w-3.5 h-3.5" />
                      <span>RP/textures/item_texture.json</span>
                    </div>
                  </>
                )}
                <div
                  onClick={() => setSelectedFile("RP/texts/en_US.lang")}
                  className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${selectedFile === "RP/texts/en_US.lang" ? "bg-[#3498db]/20 text-blue-400" : "text-zinc-400 hover:bg-zinc-800"}`}
                >
                  <FileJson className="w-3.5 h-3.5" />
                  <span>RP/texts/en_US.lang</span>
                </div>
              </div>
              <div className="p-4 border-t border-zinc-800">
                <button
                  onClick={() => {
                    let text = "";
                    if (selectedFile === "BP/manifest.json")
                      text = generateBPManifest();
                    if (selectedFile === "RP/manifest.json")
                      text = generateRPManifest();
                    if (selectedFile === "BP/scripts/main.js")
                      text = generateScriptAPI();
                    if (selectedFile === "BP/items/custom_gui_book.json") {
                      text = `{
  "format_version": "1.20.50",
  "minecraft:item": {
    "description": {
      "identifier": "custom:gui_book",
      "menu_category": {
        "category": "equipment"
      }
    },
    "components": {
      "minecraft:icon": "gui_book",
      "minecraft:display_name": {
        "value": "GUI Book"
      },
      "minecraft:max_stack_size": 1,
      "minecraft:hand_equipped": true,
      "minecraft:cooldown": {
        "category": "gui_book",
        "duration": 0.5
      }
    }
  }
}`;
                    }
                    if (selectedFile === "RP/items/custom_gui_book.json") {
                      text = `{
  "format_version": "1.20.50",
  "minecraft:item": {
    "description": {
      "identifier": "custom:gui_book"
    },
    "components": {
      "minecraft:icon": "gui_book"
    }
  }
}`;
                    }
                    if (selectedFile === "RP/textures/item_texture.json") {
                      text = `{
  "resource_pack_name": "custom",
  "texture_name": "atlas.items",
  "texture_data": {
    "gui_book": {
      "textures": "textures/items/book_normal"
    }
  }
}`;
                    }
                    if (selectedFile === "RP/texts/en_US.lang") {
                      const allGuiElts = guiSlides.flatMap(s => s.elements);
                      const allElements = [...allGuiElts, ...bookElements];
                      const labels = allElements
                        .filter((e) => e.type === "label")
                        .map(
                          (e) =>
                            `label.${e.name.replace(/ /g, "_").toLowerCase()} = ${e.props.text}`,
                        )
                        .join("\n");
                      let langBookText =
                        openedFrom === "book"
                          ? `item.custom:gui_book.name=GUI Book\n\n`
                          : "";
                      text = `${langBookText}${labels}`;
                    }
                    navigator.clipboard.writeText(text);
                    alert(`Copied ${selectedFile} to clipboard!`);
                  }}
                  className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase rounded transition-colors border border-zinc-600"
                >
                  Copy Current File
                </button>
              </div>
            </aside>
            <main className="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden">
              <div className="h-10 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
                <div className="text-[11px] font-mono text-zinc-500">
                  {selectedFile}
                </div>

                {["BP/manifest.json", "RP/manifest.json"].includes(
                  selectedFile,
                ) && (
                  <div className="flex gap-4 items-center">
                    <span className="text-zinc-500 text-[10px]">
                      Note: You only need these files for a new mod. Try pasting
                      modules into your existing manifest.
                    </span>
                    <button
                      onClick={() => {
                        setBpUuid1(generateUUID());
                        setBpUuid2(generateUUID());
                        setBpUuid3(generateUUID());
                        setRpUuid1(generateUUID());
                        setRpUuid2(generateUUID());
                      }}
                      className="bg-zinc-800 hover:bg-zinc-700 text-[10px] text-white px-2 py-1 rounded transition-colors border border-zinc-600"
                    >
                      Regenerate UUIDs
                    </button>
                  </div>
                )}
              </div>

              {selectedFile === "BP/manifest.json" && (
                <div className="p-4 bg-zinc-900 border-b border-zinc-800">
                  <label className="text-xs text-zinc-500 block mb-2 font-bold uppercase">
                    Base BP Manifest (Paste your un-modded manifest here to
                    inject scripts/dependencies)
                  </label>
                  <textarea
                    className="w-full h-32 bg-zinc-950 border border-zinc-700 p-2 text-[#dcdcaa] font-mono text-[11px] outline-none rounded focus:border-[#3498db]"
                    value={baseBPManifest}
                    onChange={(e) => setBaseBPManifest(e.target.value)}
                    placeholder="Paste your original behaviour pack manifest.json here..."
                  ></textarea>
                </div>
              )}
              {selectedFile === "RP/manifest.json" && (
                <div className="p-4 bg-zinc-900 border-b border-zinc-800">
                  <label className="text-xs text-zinc-500 block mb-2 font-bold uppercase">
                    Base RP Manifest (Paste your un-modded manifest here)
                  </label>
                  <textarea
                    className="w-full h-32 bg-zinc-950 border border-zinc-700 p-2 text-[#dcdcaa] font-mono text-[11px] outline-none rounded focus:border-[#3498db]"
                    value={baseRPManifest}
                    onChange={(e) => setBaseRPManifest(e.target.value)}
                    placeholder="Paste your original resource pack manifest.json here..."
                  ></textarea>
                </div>
              )}

              <div className="bg-[#3a2a1a] border-b border-[#dd9b3b] text-[#ffd9a3] p-3 text-xs leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <span role="img" aria-label="warning">
                    ⚠️
                  </span>{" "}
                  JSON UI Deprecation Warning (Minecraft 1.21.0+)
                </div>
                Minecraft Bedrock is replacing <b>JSON UI</b> with a hardcoded
                engine called <b>Ore UI</b> (such as the new Inventory, Death
                Screen, etc). Ore UI <u>cannot</u> be modified via resource
                packs. Modifying files like{" "}
                <code>recipe_inventory_screen_content</code> may break the game
                UI entirely.
                <br />
                <br />
                <b>Modern Solution:</b> Export your GUI as a Behavior Pack
                Script using the new <b>BP/scripts/main.js (Script API)</b>{" "}
                export option on the left. It uses strictly supported{" "}
                <code>@minecraft/server-ui</code> ActionFormData which works
                natively in 1.21+!
              </div>

              <div className="flex-1 p-4 overflow-auto custom-scrollbar">
                <pre className="text-[12px] font-mono text-[#dcdcaa] leading-relaxed">
                  {selectedFile === "BP/manifest.json" && generateBPManifest()}
                  {selectedFile === "RP/manifest.json" && generateRPManifest()}
                  {selectedFile === "BP/scripts/main.js" && generateScriptAPI()}
                  {selectedFile === "BP/items/custom_gui_book.json" &&
                    JSON.stringify(
                      {
                        format_version: "1.20.50",
                        "minecraft:item": {
                          description: {
                            identifier: "custom:gui_book",
                            menu_category: {
                              category: "equipment",
                            },
                          },
                          components: {
                            "minecraft:icon": "gui_book",
                            "minecraft:display_name": {
                              value: "GUI Book",
                            },
                            "minecraft:max_stack_size": 1,
                            "minecraft:hand_equipped": true,
                            "minecraft:cooldown": {
                              category: "gui_book",
                              duration: 0.5,
                            },
                          },
                        },
                      },
                      null,
                      2,
                    )}
                  {selectedFile === "RP/items/custom_gui_book.json" &&
                    JSON.stringify(
                      {
                        format_version: "1.20.50",
                        "minecraft:item": {
                          description: {
                            identifier: "custom:gui_book",
                          },
                          components: {
                            "minecraft:icon": "gui_book",
                          },
                        },
                      },
                      null,
                      2,
                    )}
                  {selectedFile === "RP/textures/item_texture.json" &&
                    JSON.stringify(
                      {
                        resource_pack_name: "custom",
                        texture_name: "atlas.items",
                        texture_data: {
                          gui_book: {
                            textures: "textures/items/book_normal",
                          },
                        },
                      },
                      null,
                      2,
                    )}
                  {selectedFile === "RP/texts/en_US.lang" &&
                    (openedFrom === "book"
                      ? `item.custom:gui_book.name=GUI Book\n\n`
                      : "") +
                      `${[...guiSlides.flatMap(s => s.elements), ...bookElements]
                        .filter((e) => e.type === "label")
                        .map(
                          (e) =>
                            `label.${e.name.replace(/ /g, "_").toLowerCase()} = ${e.props.text}`,
                        )
                        .join("\n")}`}
                </pre>
              </div>
            </main>
          </div>
        )}
      </div>

      {/* Bottom Console */}
      <footer className="h-8 border-t border-zinc-800 bg-zinc-950 flex items-center px-4 justify-between shrink-0">
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            <span className="text-[10px] text-zinc-500 font-medium tracking-wide">
              Ready for Bridge IDE.
            </span>
          </div>
          {appPhase === "builder" && selectedElement && (
            <>
              <div className="h-4 w-[1px] bg-zinc-800"></div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-[#555] font-mono">
                  X: {selectedElement.x}
                </span>
                <span className="text-[10px] text-[#555] font-mono">
                  Y: {selectedElement.y}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="text-[10px] text-zinc-500 tracking-wider uppercase">
          Drag & Drop GUI Builder | v1.1.0
        </div>
      </footer>

      {showSlideModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl p-6 max-w-lg w-full flex flex-col items-center">
            <h2 className="text-white text-xl font-bold mb-2">Create New GUI Slide</h2>
            <p className="text-zinc-400 text-sm text-center mb-6">
              Choose the type of interface this slide will represent.
            </p>
            <div className="flex gap-4 w-full">
              <button
                onClick={() => confirmAddSlide("interactive")}
                className="flex-1 p-4 bg-[#3498db] text-white font-bold text-sm rounded hover:bg-[#2980b9] transition-colors flex flex-col items-center shadow-lg"
              >
                <span>Interactive GUI</span>
                <span className="text-[10px] opacity-75 font-normal mt-1 text-center">(Forms, Inputs, Data logic)</span>
              </button>
              <button
                onClick={() => confirmAddSlide("text_display")}
                className="flex-1 p-4 bg-[#9b59b6] text-white font-bold text-sm rounded hover:bg-[#8e44ad] transition-colors flex flex-col items-center shadow-lg"
              >
                <span>Text Display GUI</span>
                <span className="text-[10px] opacity-75 font-normal mt-1 text-center">(Multiple Text labels)</span>
              </button>
            </div>
            <button
               onClick={() => setShowSlideModal(false)}
               className="mt-6 text-zinc-500 hover:text-white text-xs underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                API Settings
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Gemini API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => saveApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="bg-zinc-950 border border-zinc-800 px-3 py-2 rounded text-white text-sm outline-none focus:border-blue-500 font-mono"
              />
              <p className="text-[10px] text-[#555] leading-tight">
                Key is stored locally in your browser. Required to generate
                Bedrock JSON logic with AI.
              </p>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="w-full py-2 bg-[#3498db] text-white font-bold uppercase rounded hover:bg-[#2980b9] text-xs"
            >
              Save & Close
            </button>
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
