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
  Upload,
  List,
  SlidersHorizontal,
  TextCursorInput,
  CheckSquare,
  Sparkles,
  Users,
  Terminal
} from 'lucide-react';

type ElementType = 'panel' | 'button' | 'label' | 'image' | 'dropdown' | 'slider' | 'textfield' | 'toggle' | 'player_picker';

interface EditorElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  props: Record<string, string>;
  variableActions?: { varId: string; amount: number; required?: boolean }[];
  variableActionsTarget?: { varId: string; amount: number; required?: boolean }[];
}

type ViewMode = 'designer' | 'variables' | 'export' | 'triggers';
type AppPhase = 'setup' | 'builder';

interface CustomTrigger {
    id: string;
    type: 'itemUse' | 'blockBreak' | 'entityHit' | 'chatCommand' | 'aiGenerated';
    config: any;
}

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const MC_EVENTS = [
  'playerBreakBlock', 'playerPlaceBlock', 'buttonPush', 'chatSend', 'entityDie', 'entityHurt', 
  'entityHitEntity', 'entityHitBlock', 'itemCompleteUse', 'itemReleaseUse', 
  'itemStartUse', 'itemUse', 'itemUseOn', 
  'playerJoin', 'playerLeave', 'playerSpawn', 'weatherChange', 'tick', 'complex_script'
];

interface VariableIncrement {
  event: string;
  amount: number;
  aiGeneratedCode?: string;
}

interface Variable {
  id: string;
  name: string;
  scope: 'player' | 'global';
  min: number | null;
  max: number | null;
  increments: VariableIncrement[];
}

export default function App() {
  const [variables, setVariables] = useState<Variable[]>([]);
  const [bpUuid1, setBpUuid1] = useState(generateUUID);
  const [bpUuid2, setBpUuid2] = useState(generateUUID);
  const [bpUuid3, setBpUuid3] = useState(generateUUID);
  const [rpUuid1, setRpUuid1] = useState(generateUUID);
  const [rpUuid2, setRpUuid2] = useState(generateUUID);
  const [appPhase, setAppPhase] = useState<AppPhase>('setup');
  const [customTriggers, setCustomTriggers] = useState<CustomTrigger[]>([]);
  const [inGameLogs, setInGameLogs] = useState(false);
  const [openedFrom, setOpenedFrom] = useState<'book' | 'modded_item' | 'hidden'>('book');
  const [moddedItemName, setModdedItemName] = useState('my_mod:magic_wand');
  const [baseBPManifest, setBaseBPManifest] = useState("");
  const [baseRPManifest, setBaseRPManifest] = useState("");

  
  const [guiElements, setGuiElements] = useState<EditorElement[]>([]);
  const [bookElements, setBookElements] = useState<EditorElement[]>([]);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>('designer');
  const [selectedFile, setSelectedFile] = useState<string>('BP/scripts/main.js');
  
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
  const [aiVarPrompt, setAiVarPrompt] = useState("");
  const [isGeneratingVar, setIsGeneratingVar] = useState(false);
  
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('GEMINI_API_KEY') || '');
  const [showSettings, setShowSettings] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  const handleStartBuilder = () => {
    setGuiElements([
      { id: Math.random().toString(36).substr(2, 9), type: 'panel', x: 200, y: 150, width: 400, height: 220, name: 'Main Background', props: { texture: 'textures/gui/new_bg.png' } },
      { id: Math.random().toString(36).substr(2, 9), type: 'label', x: 200, y: 100, width: 400, height: 20, name: 'Title', props: { text: 'My Custom UI' } },
      { id: Math.random().toString(36).substr(2, 9), type: 'button', x: 200, y: 250, width: 200, height: 30, name: 'Close Button', props: { text: 'Close', action: 'close_gui' } }
    ]);
    setSelectedFile('BP/scripts/main.js');
    setAppPhase('builder');
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('GEMINI_API_KEY', key);
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
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           system_instruction: { parts: [{ text: "You are an expert at Minecraft Bedrock script API development." }] },
           contents: [{ role: "user", parts: [{ text: `You are assisting a developer working on a custom Bedrock add-on. They provided this request for a new stat or variable to track using the Script API: "${aiVarPrompt}". Generate a JSON object with this exact structure: { "name": "VariableName", "scope": "player" | "global", "increments": [ { "event": "complex_script", "amount": 1, "customCode": "// Define custom AI logic for this variable here!\\n// world.afterEvents.entityDie.subscribe((event) => { /* logic involving player */ });" } ] } Return ONLY valid JSON. Omit all markdown formatting. The variable name must be alphanumeric and under 16 characters.` }] }]
        })
      });
      const data = await response.json();
      if (data.candidates && data.candidates[0].content.parts[0].text) {
         let text = data.candidates[0].content.parts[0].text;
         text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
         const newVar = JSON.parse(text);
         setVariables(prev => [...prev, {
            id: generateUUID(),
            name: newVar.name || "AIVar",
            scope: newVar.scope === 'global' ? 'global' : 'player',
            min: null, max: null,
            increments: newVar.increments?.map((inc: any) => ({
                event: inc.event || 'complex_script',
                amount: inc.amount || 1,
                aiGeneratedCode: inc.customCode
            })) || []
         }]);
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

  const generateBPManifest = () => {
    let base = null;
    try {
        if (baseBPManifest.trim() !== '') {
            base = JSON.parse(baseBPManifest);
        }
    } catch(e) {}
    
    if (base) {
        if (!base.modules) base.modules = [];
        if (!base.dependencies) base.dependencies = [];
        
        // Add script module if missing
        if (!base.modules.some((m: any) => m.type === "script")) {
            base.modules.push({
                "type": "script",
                "language": "javascript",
                "uuid": bpUuid3,
                "version": [1, 0, 0],
                "entry": "scripts/main.js"
            });
        }
        
        // Add required dependencies if missing
        if (!base.dependencies.some((d: any) => d.module_name === "@minecraft/server")) {
            base.dependencies.push({ "module_name": "@minecraft/server", "version": "1.14.0" });
        }
        if (!base.dependencies.some((d: any) => d.module_name === "@minecraft/server-ui")) {
            base.dependencies.push({ "module_name": "@minecraft/server-ui", "version": "1.3.0" });
        }
        
        return JSON.stringify(base, null, 4);
    }
    
    return JSON.stringify({
      "format_version": 2,
      "metadata": {
        "authors": ["Umbra_Atelier"],
        "generated_with": { "bridge": ["2.7.54"] }
      },
      "header": {
        "name": "EDU-GUI-MOD BP",
        "description": "Script API UI Behavior Pack",
        "min_engine_version": [1, 21, 120],
        "uuid": bpUuid1,
        "version": [1, 0, 0]
      },
      "modules": [
        {
          "type": "data",
          "uuid": bpUuid2,
          "version": [1, 0, 0]
        },
        {
          "type": "script",
          "language": "javascript",
          "uuid": bpUuid3,
          "version": [1, 0, 0],
          "entry": "scripts/main.js"
        }
      ],
      "dependencies": [
        {
          "uuid": rpUuid1,
          "version": [1, 0, 0]
        },
        {
          "module_name": "@minecraft/server",
          "version": "1.14.0"
        },
        {
          "module_name": "@minecraft/server-ui",
          "version": "1.3.0"
        }
      ]
    }, null, 4);
  };

  const generateRPManifest = () => {
    let base = null;
    try {
        if (baseRPManifest.trim() !== '') {
            base = JSON.parse(baseRPManifest);
        }
    } catch(e) {}
    
    if (base) {
        return JSON.stringify(base, null, 4);
    }

    return JSON.stringify({
      "format_version": 2,
      "metadata": {
        "authors": ["Umbra_Atelier"],
        "generated_with": { "bridge": ["2.7.54"] }
      },
      "header": {
        "name": "EDU-GUI-MOD RP",
        "description": "Custom UI Resource Pack",
        "min_engine_version": [1, 21, 120],
        "uuid": rpUuid1,
        "version": [1, 0, 0]
      },
      "modules": [
        {
          "type": "resources",
          "uuid": rpUuid2,
          "version": [1, 0, 0]
        }
      ],
      "dependencies": [
        {
          "uuid": bpUuid1,
          "version": [1, 0, 0]
        }
      ]
    }, null, 4);
  };

  const generateScriptAPI = () => {
    const isModal = guiElements.some(e => ['dropdown', 'slider', 'textfield', 'toggle', 'player_picker'].includes(e.type));
    const buttons = guiElements.filter(e => e.type === 'button');
    const labels = guiElements.filter(e => e.type === 'label');
    const inputs = guiElements.filter(e => ['dropdown', 'slider', 'textfield', 'toggle', 'player_picker'].includes(e.type));
    
    const title = labels[0]?.props.text || "Custom UI";

    let formType = isModal ? 'ModalFormData' : 'ActionFormData';
    let formBuilder = `const form = new ${formType}();\n  form.title("${title}");`;
    
    // Dynamic body builder for bound variables
    const bodyLines = labels.slice(1).map(l => {
       if (l.props.boundVariable) {
          let v = variables.find(v => v.id === l.props.boundVariable);
          if (v) {
             const labelPrefix = ['0', 'value', 'var', '0.0', '1'].includes(l.props.text.trim()) ? '' : l.props.text + ' ';
             return `"${labelPrefix}" + getVar("${v.scope}", "${v.name}", player)`;
          }
       }
       return `"${l.props.text}"`;
    });
    
    if (!isModal && bodyLines.length > 0) {
       formBuilder += `\n  form.body(${bodyLines.join(' + "\\n" + ')});`;
    }

    let logicCode = "";

    const generateVarActionCode = (btnActions?: {varId: string; amount: number; required?: boolean}[], targetName: string = "player") => {
        if (!btnActions || btnActions.length === 0) return '';
        let code = '';
        const requiredActions = btnActions.filter(a => a.required);
        if (requiredActions.length > 0) {
            code += `let canExecute = true;\n      `;
            requiredActions.forEach((action, i) => {
                let v = variables.find(v => v.id === action.varId);
                if (v && v.min !== null && action.amount < 0) {
                    code += `let val${i} = getVar("${v.scope}", "${v.name}", ${targetName});\n      if ((val${i} + (${action.amount})) < ${v.min}) { canExecute = false; ${targetName}.sendMessage("§cNot enough ${v.name}!"); }\n      `;
                }
            });
            code += `if (!canExecute) return;\n      `;
        }
        code += btnActions.map(action => {
            let v = variables.find(v => v.id === action.varId);
            if (!v) return '';
            return `let val_${v.name} = getVar("${v.scope}", "${v.name}", ${targetName});
      setVar("${v.scope}", "${v.name}", ${targetName}, val_${v.name} + (${action.amount}), ${v.min !== null ? v.min : 'null'}, ${v.max !== null ? v.max : 'null'});
      ${targetName}.sendMessage("§a${v.name} is now: " + getVar("${v.scope}", "${v.name}", ${targetName}));`;
        }).join('\n      ');
        return code;
    };

    if (isModal) {
      if (inputs.some(i => i.type === 'player_picker')) {
          formBuilder = `const allPlayers = world.getAllPlayers();\n  const playerNames = allPlayers.length > 0 ? allPlayers.map(p => p.name) : ["No players online"];\n  ` + formBuilder;
      }

      const formFields = inputs.map((input, index) => {
         const name = input.props.text || input.name;
         if (input.type === 'dropdown') {
            const options = (input.props.dropdownOptions || "Option 1, Option 2").split(',').map(o => `"${o.trim()}"`).join(', ');
            const defaultIdx = input.props.dropdownDefault || '0';
            return `form.dropdown("${name}", [${options}], ${defaultIdx});`;
         }
         if (input.type === 'player_picker') {
            return `form.dropdown("${name}", playerNames, 0);`;
         }
         if (input.type === 'slider') {
            const min = input.props.sliderMin || '0';
            const max = input.props.sliderMax || '100';
            const step = input.props.sliderStep || '1';
            const defaultVal = input.props.sliderDefault || '0';
            return `form.slider("${name}", ${min}, ${max}, ${step}, ${defaultVal});`;
         }
         if (input.type === 'textfield') {
            const placeholder = input.props.textFieldPlaceholder || 'Placeholder';
            const defaultVal = input.props.textFieldDefault || '';
            const args = `"${name}", "${placeholder}"${defaultVal ? `, "${defaultVal}"` : ''}`;
            return `form.textField(${args});`;
         }
         if (input.type === 'toggle') {
            const defaultVal = input.props.toggleDefault === 'true' ? 'true' : 'false';
            return `form.toggle("${name}", ${defaultVal});`;
         }
         return '';
      }).join('\n  ');
      
      const submitBtn = buttons[0];
      const submitText = submitBtn ? (submitBtn.props.text || submitBtn.name) : "Submit";
      
      formBuilder += `\n  ${formFields}`;
      formBuilder += `\n  form.submitButton("${submitText}");`;

      logicCode = `const formValues = response.formValues;\n    player.sendMessage("Form submitted!");`;
      
      inputs.forEach((input, index) => {
         if (input.type === 'textfield' && input.props.correctAnswer && input.variableActions?.length) {
            logicCode += `\n    if (formValues[${index}] === "${input.props.correctAnswer}") {`;
            logicCode += `\n        player.sendMessage("§aCorrect Answer!");`;
            logicCode += `\n        ${generateVarActionCode(input.variableActions)}`;
            logicCode += `\n    } else { player.sendMessage("§cIncorrect Answer."); }`;
         }
         if (input.type === 'player_picker' && (input.variableActions?.length || input.variableActionsTarget?.length)) {
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
      const actionUIElements = guiElements.filter(e => e.type === 'button' || e.type === 'image');

      const btnCode = actionUIElements.map((el) => {
          if (el.type === 'image') {
              let iconStr = el.props.texture ? `, "${el.props.texture}"` : '';
              return `.button(""${iconStr})`;
          } else {
              let text = el.props.text || el.name;
              let iconStr = el.props.texture ? `, "${el.props.texture}"` : '';
              return `.button("${text}"${iconStr})`;
          }
      }).join("\n    ");
      
      if (actionUIElements.length > 0) {
        formBuilder += `\n  form\n    ${btnCode};`;
      }
      
      logicCode = actionUIElements.map((el, i) => {
          if (el.type === 'image') return '';
          let actionCode = generateVarActionCode(el.variableActions);
          return `if (response.selection === ${i}) {
      // Player clicked ${el.props.text || el.name}
      player.sendMessage("You clicked ${el.props.text || el.name}!");
      ${actionCode}
    }`;
      }).filter(Boolean).join(" else ");
    }

    const triggerEventCode = variables.map(v => {
       return (v.increments || []).map(inc => {
          let resolvedEventName = inc.event;
          if (resolvedEventName === 'blockBreak') resolvedEventName = 'playerBreakBlock';
          if (resolvedEventName === 'blockPlace') resolvedEventName = 'playerPlaceBlock';
          
          if (resolvedEventName === 'tick') {
             return `system.runInterval(() => {
  for (const p of world.getAllPlayers()) {
    let val = getVar("${v.scope}", "${v.name}", p);
    setVar("${v.scope}", "${v.name}", p, val + (${inc.amount}), ${v.min !== null ? v.min : 'null'}, ${v.max !== null ? v.max : 'null'});
  }
}, 20); // Runs once every second (20 ticks)`;
          } else if (resolvedEventName === 'complex_script') {
             return inc.aiGeneratedCode || `// TODO: Define custom AI logic for "${v.name}" here!\n// world.afterEvents.entityHurt.subscribe((event) => { /* logic */ });`;
          } else {
             return `try {
  world.afterEvents.${resolvedEventName}.subscribe((event) => {
    let p = event.player || event.sourceEntity || event.source;
    if (${v.scope === 'player' ? `p && p.typeId === 'minecraft:player'` : `true`}) {
      let val = getVar("${v.scope}", "${v.name}", p);
      setVar("${v.scope}", "${v.name}", p, val + (${inc.amount}), ${v.min !== null ? v.min : 'null'}, ${v.max !== null ? v.max : 'null'});
    }
  });
} catch(err) {
  console.warn("Could not bind event '${resolvedEventName}' - it may be a legacy name or unsupported in this Minecraft version.");
}`;
          }
       }).join('\n\n');
    }).filter(Boolean).join('\n\n');

    let customTriggersCode = '';
    if (openedFrom === 'hidden' && customTriggers.length > 0) {
        customTriggersCode = `// --- Custom Triggers ---\n` + customTriggers.map(t => {
           if (t.type === 'itemUse') return `world.afterEvents.itemUse.subscribe((event) => {\n  if (event.itemStack.typeId === "${t.config.itemId || 'minecraft:stick'}") {\n    system.runTimeout(() => { showCustomUI(event.source); }, 5);\n  }\n});`;
           if (t.type === 'blockBreak') return `world.afterEvents.playerBreakBlock.subscribe((event) => {\n  if (event.block.typeId === "${t.config.blockId || 'minecraft:dirt'}") {\n    system.runTimeout(() => { showCustomUI(event.player); }, 5);\n  }\n});`;
           if (t.type === 'entityHit') return `world.afterEvents.entityHitEntity.subscribe((event) => {\n  if (event.hitEntity.typeId === "${t.config.entityId || 'minecraft:cow'}" && event.damagingEntity.typeId === "minecraft:player") {\n    system.runTimeout(() => { showCustomUI(event.damagingEntity); }, 5);\n  }\n});`;
           if (t.type === 'chatCommand') return `world.beforeEvents.chatSend.subscribe((event) => {\n  if (event.message === "${t.config.command || '!showgui'}") {\n    event.cancel = true;\n    system.runTimeout(() => { showCustomUI(event.sender); }, 5);\n  }\n});`;
           if (t.type === 'aiGenerated') return `// AI Generated code from prompt: "${t.config.prompt}"\n${t.config.code || '// Not generated yet'}`;
           return '';
        }).join('\n\n');
    }

    const bookGiveCode = openedFrom === 'book' ? `
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
` : '';

    const interceptorCode = inGameLogs ? `
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
` : '';

    return `import { world, system } from "@minecraft/server";
import { ${formType} } from "@minecraft/server-ui";
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

${bookGiveCode}

// --- UI Activation ---
${openedFrom === 'hidden' ? `// Form is configured as hidden. Call showCustomUI(player) from your own scripts to open it.` : `world.afterEvents.itemUse.subscribe((event) => {
  if (event.itemStack.typeId === "${openedFrom === 'book' ? 'custom:gui_book' : moddedItemName}") {
    const player = event.source;
    
    // UI must be shown on a slight delay to avoid item use overlap cancelling it
    system.runTimeout(() => {
       showCustomUI(player);
    }, 5);
  }
});`}

${customTriggersCode}

export function showCustomUI(player) {
  ${formBuilder}

  form.show(player).then((response) => {
    if (response.canceled) return;
    
    ${logicCode}
  }).catch(e => {
    console.error(e);
  });
}
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
               <span onClick={() => setViewMode('variables')} className={`cursor-pointer transition-colors ${viewMode === 'variables' ? 'text-blue-400 font-bold' : 'hover:text-white'}`}>Variables</span>
               {openedFrom === 'hidden' && (
                   <span onClick={() => setViewMode('triggers')} className={`cursor-pointer transition-colors ${viewMode === 'triggers' ? 'text-blue-400 font-bold' : 'hover:text-white'}`}>Triggers</span>
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
               <button onClick={() => setInGameLogs(!inGameLogs)} className={`px-3 py-1 text-[11px] font-bold uppercase rounded transition-colors flex items-center gap-1 ${inGameLogs ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-[#444] text-[#aaa] hover:bg-[#555] hover:text-white'}`}>
                  <Terminal className="w-3 h-3" /> {inGameLogs ? 'Ingame Logs: ON' : 'Ingame Logs: OFF'}
               </button>
               <button onClick={() => {
                   let allCode = "BP/scripts/main.js:\n" + generateScriptAPI() + "\n\n";
                   if (openedFrom === 'book') {
                       allCode += "BP/items/custom_gui_book.json:\n" + JSON.stringify({
                          "format_version": "1.20.50", "minecraft:item": { "description": { "identifier": "custom:gui_book", "menu_category": { "category": "equipment" } }, "components": { "minecraft:icon": "gui_book", "minecraft:display_name": { "value": "GUI Book" }, "minecraft:max_stack_size": 1, "minecraft:hand_equipped": true, "minecraft:cooldown": { "category": "gui_book", "duration": 0.5 } } }
                       }, null, 2) + "\n\n";
                       allCode += "RP/items/custom_gui_book.json:\n" + JSON.stringify({
                          "format_version": "1.20.50", "minecraft:item": { "description": { "identifier": "custom:gui_book" }, "components": { "minecraft:icon": "gui_book" } }
                       }, null, 2) + "\n\n";
                   }
                   allCode += "BP/manifest.json:\n" + generateBPManifest() + "\n\n";
                   allCode += "RP/manifest.json:\n" + generateRPManifest() + "\n\n";
                   let langBookText = openedFrom === 'book' ? `item.custom:gui_book.name=GUI Book\n\n` : '';
                   allCode += "RP/texts/en_US.lang:\n" + `${langBookText}${[...guiElements, ...bookElements].filter(e=>e.type==='label').map(e => `label.${e.name.replace(/ /g, '_').toLowerCase()} = ${e.props.text}`).join('\n')}` + "\n\n";
                   navigator.clipboard.writeText(allCode);
                   alert("Debug Logs Copied!");
               }} className="px-3 py-1 bg-yellow-600 text-white text-[11px] font-bold uppercase rounded hover:bg-yellow-500 transition-colors flex items-center gap-1">
                  <FileJson className="w-3 h-3" /> Copy Debug Logs
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
                 <p className="text-[#888] text-sm mb-6">Configure how your custom Mod UI is accessed in-game by the player.</p>
                 
                 <div className="flex flex-col gap-4 mb-8">
                    <div className="flex flex-col gap-1.5">
                       <label className="text-[11px] font-bold text-[#aaa] uppercase tracking-wider">GUI Opened From</label>
                       <select 
                          value={openedFrom} 
                          onChange={(e) => setOpenedFrom(e.target.value as 'book' | 'modded_item' | 'hidden')}
                          className="bg-[#111] border border-[#333] px-3 py-2 rounded text-white text-sm outline-none focus:border-blue-500"
                       >
                          <option value="book">Book (Given to all on spawn)</option>
                          <option value="modded_item">Modded Item</option>
                          <option value="hidden">Hidden (Triggered by Variables/AI Code)</option>
                       </select>
                    </div>

                    {openedFrom === 'modded_item' && (
                       <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold text-[#aaa] uppercase tracking-wider">Item Identifier</label>
                          <input 
                             type="text" 
                             value={moddedItemName} 
                             onChange={(e) => setModdedItemName(e.target.value)}
                             placeholder="my_namespace:item_id"
                             className="bg-[#111] border border-[#333] px-3 py-2 rounded text-white text-sm outline-none focus:border-blue-500 font-mono"
                          />
                          <p className="text-[10px] text-yellow-500/80 mt-1 leading-relaxed">
                            <strong>Note for Vanilla Items:</strong> Normal items like <code>minecraft:stick</code> do not trigger right-click events in the air! You must use a vanilla item that naturally has a right-click action (like <code>minecraft:compass</code>) or stick to custom items.
                          </p>
                       </div>
                    )}
                 </div>

                 <button 
                    onClick={handleStartBuilder}
                    className="w-full py-3 bg-[#4CAF50] text-white font-bold uppercase tracking-wide rounded hover:bg-[#45a049] transition-colors shadow-lg"
                 >
                    Start Creating GUI
                 </button>
              </div>
           </div>
        ) : viewMode === 'designer' ? (
          <>
            {/* Left Sidebar: Assets & Layers */}
        <aside className="w-64 border-r border-[#333] flex flex-col bg-[#212121] shrink-0">
          <div className="p-3 border-b border-[#333]">
            <div className="text-[10px] font-bold text-[#666] uppercase mb-2">GUI Toolbox</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => addElement('panel')} className="h-8 bg-[#333] border border-[#444] rounded flex items-center justify-center gap-2 text-xs text-[#aaa] hover:bg-[#3a3a3a] hover:border-[#555] cursor-pointer">
                 <Square className="w-3 h-3" /> Panel
              </button>
               <button onClick={() => addElement('button')} className="h-8 bg-[#333] border border-[#444] rounded flex items-center justify-center gap-2 text-xs text-[#aaa] hover:bg-[#3a3a3a] hover:border-[#555] cursor-pointer">
                 <MousePointer2 className="w-3 h-3" /> Button
              </button>
              <button onClick={() => addElement('label')} className="h-8 bg-[#333] border border-[#444] rounded flex items-center justify-center gap-2 text-xs text-[#aaa] hover:bg-[#3a3a3a] hover:border-[#555] cursor-pointer">
                 <Type className="w-3 h-3" /> Label
              </button>
               <button onClick={() => addElement('image')} className="h-8 bg-[#333] border border-[#444] rounded flex items-center justify-center gap-2 text-xs text-[#aaa] hover:bg-[#3a3a3a] hover:border-[#555] cursor-pointer">
                 <ImageIcon className="w-3 h-3" /> Image
              </button>
              <button onClick={() => addElement('dropdown')} className="h-8 bg-[#333] border border-[#444] rounded flex items-center justify-center gap-2 text-xs text-[#aaa] hover:bg-[#3a3a3a] hover:border-[#555] cursor-pointer">
                 <List className="w-3 h-3" /> Dropdown
              </button>
              <button onClick={() => addElement('slider')} className="h-8 bg-[#333] border border-[#444] rounded flex items-center justify-center gap-2 text-xs text-[#aaa] hover:bg-[#3a3a3a] hover:border-[#555] cursor-pointer">
                 <SlidersHorizontal className="w-3 h-3" /> Slider
              </button>
              <button onClick={() => addElement('textfield')} className="h-8 bg-[#333] border border-[#444] rounded flex items-center justify-center gap-2 text-[10px] text-[#aaa] hover:bg-[#3a3a3a] hover:border-[#555] cursor-pointer">
                 <TextCursorInput className="w-3 h-3" /> TextField
              </button>
              <button onClick={() => addElement('toggle')} className="h-8 bg-[#333] border border-[#444] rounded flex items-center justify-center gap-2 text-xs text-[#aaa] hover:bg-[#3a3a3a] hover:border-[#555] cursor-pointer">
                 <CheckSquare className="w-3 h-3" /> Toggle
              </button>
              <button onClick={() => addElement('player_picker')} className="h-8 bg-[#333] border border-[#444] rounded flex flex-col items-center justify-center gap-0.5 text-[9px] text-[#aaa] hover:bg-[#3a3a3a] hover:border-[#555] cursor-pointer" style={{ gridColumn: 'span 2' }}>
                 <div className="flex items-center gap-1.5"><Users className="w-3 h-3" /> Player Picker</div>
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
                     {el.type === 'dropdown' && <List className="w-3 h-3 text-[#aaa]" />}
                     {el.type === 'slider' && <SlidersHorizontal className="w-3 h-3 text-[#aaa]" />}
                     {el.type === 'textfield' && <TextCursorInput className="w-3 h-3 text-[#aaa]" />}
                     {el.type === 'toggle' && <CheckSquare className="w-3 h-3 text-[#aaa]" />}
                    <span className={`text-[11px] truncate ${selectedId === el.id ? 'text-white' : 'text-[#aaa]'}`}>{el.name}</span>
                  </div>
               ))}
            </div>
          </div>
        </aside>

        {/* Center: Canvas Viewport */}
        <main 
           className="flex-1 bg-[#202020] relative overflow-hidden flex items-center justify-center shadow-inner"
           onPointerMove={handlePointerMove}
           onPointerUp={handlePointerUp}
           onPointerLeave={handlePointerUp}
        >
          {/* Grid Background */}
          <div 
            className="absolute inset-0 pointer-events-none" 
            style={{ 
               backgroundImage: 'radial-gradient(#3c3c3c 1px, transparent 1px)', 
               backgroundSize: '12px 12px',
               opacity: 0.8
            }}
          />
          
          {/* Main Working Canvas */}
          <div 
             ref={canvasRef}
             className="relative w-[800px] h-[500px] bg-transparent border border-[#3C3D3F] overflow-hidden rounded-sm"
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
                        border: isSelected ? '2px solid #5A8F43' : (el.type === 'panel' ? '2px solid transparent' : '1px solid transparent'),
                        boxShadow: isSelected ? '0 0 0 2px rgba(90, 143, 67, 0.4)' : (el.type === 'panel' && !el.props.previewImage ? '0px 2px 4px rgba(0,0,0,0.4)' : 'none'),
                        zIndex: isSelected ? 10 : 1,
                        backgroundImage: (el.type === 'panel' || el.type === 'image') && el.props.previewImage ? `url(${el.props.previewImage})` : 'none',
                        backgroundSize: '100% 100%',
                        backgroundRepeat: 'no-repeat',
                        borderRadius: el.type === 'panel' ? '4px' : '2px',
                     }}
                     className={`
                        ${el.type === 'panel' && !el.props.previewImage ? 'bg-[#313233] border-[#1E1E1E]' : ''}
                        ${el.type === 'button' ? 'bg-[#3C3D3F] border-[#1E1E1E] flex items-center justify-center hover:bg-[#5A5B5D] active:border-white' : ''}
                        ${el.type === 'image' && !el.props.previewImage ? 'bg-[#2E2E2E] opacity-80' : ''}
                        ${['dropdown', 'textfield', 'player_picker'].includes(el.type) ? 'bg-[#1E1E20] border-[#111112] shadow-inner flex items-center px-3' : ''}
                        ${el.type === 'slider' ? 'bg-transparent flex flex-col justify-center' : ''}
                        ${el.type === 'toggle' ? 'bg-transparent flex items-center gap-2' : ''}
                     `}
                   >
                     {el.type === 'label' && (
                        <div className="w-full h-full flex items-center font-sans text-white text-sm" style={{textShadow: '0px 1px 2px rgba(0,0,0,0.8)'}}>{el.props.text || 'Label'}</div>
                     )}
                     {el.type === 'button' && (
                         <div className="w-full h-full flex items-center justify-center font-sans text-white text-sm drop-shadow pointer-events-none select-none">
                            {el.props.text ? el.props.text : el.name}
                         </div>
                     )}
                     {['dropdown', 'textfield', 'player_picker'].includes(el.type) && (
                        <div className="text-white text-sm font-sans truncate w-full pointer-events-none select-none drop-shadow flex justify-between items-center">
                           <span>{el.type === 'textfield' ? (el.props.textFieldDefault || el.props.textFieldPlaceholder || el.props.text || el.name) : (el.type === 'player_picker' ? (el.props.text || 'Select Player...') : (el.props.text || el.name))}</span>
                           {el.type === 'player_picker' && <Users className="w-3 h-3 text-[#aaa]" />}
                        </div>
                     )}
                     {el.type === 'slider' && (
                        <>
                           <div className="text-white text-sm font-sans mb-1.5 drop-shadow pointer-events-none select-none">{el.props.text || el.name} ({el.props.sliderDefault || '0'})</div>
                           <div className="w-full h-2 bg-[#1E1E20] border border-[#111112] rounded-full relative shadow-inner">
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-5 bg-[#3C3D3F] hover:bg-[#5A5B5D] border border-white rounded-sm" />
                              <div className="absolute top-0 left-0 w-1/2 h-full bg-[#5A8F43] rounded-l-full pointer-events-none" />
                           </div>
                        </>
                     )}
                     {el.type === 'toggle' && (
                        <>
                           <div className="w-10 h-5 border border-[#111112] bg-[#1E1E20] rounded-full flex items-center p-0.5 shadow-inner">
                              {el.props.toggleDefault === 'true' ? (
                                  <div className="w-9 h-full flex justify-end">
                                      <div className="w-4 h-full bg-[#5A8F43] rounded-full shadow-sm" />
                                  </div>
                              ) : (
                                  <div className="w-9 h-full flex justify-start">
                                      <div className="w-4 h-full bg-[#3C3D3F] rounded-full shadow-sm border border-[#1E1E1E]" />
                                  </div>
                              )}
                           </div>
                           <div className="text-white text-sm font-sans font-medium drop-shadow pointer-events-none select-none">{el.props.text || el.name}</div>
                        </>
                     )}
                     
                     {isSelected && (
                        <>
                           <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-[#5A8F43] border-2 border-white rounded-sm" />
                           <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-[#5A8F43] border-2 border-white rounded-sm" />
                           <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-[#5A8F43] border-2 border-white rounded-sm" />
                           <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-[#5A8F43] border-2 border-white rounded-sm" />
                        </>
                     )}
                   </div>
                );
             })}
          </div>

          <div className="absolute left-6 top-6 flex flex-col gap-2 z-20">
             <div className="w-10 h-10 bg-[#313233] border border-[#1E1E1E] rounded shadow-md flex items-center justify-center text-white cursor-pointer hover:bg-[#3C3D3F] hover:border-white transition-all shadow-[0_4px_10px_rgba(0,0,0,0.5)]" title="Selection Tool">
               <MousePointer2 className="w-4 h-4 text-[#5A8F43]" />
            </div>
          </div>

          <div className="absolute bottom-4 left-4 flex gap-4 pointer-events-none">
             <div className="text-xs text-white uppercase tracking-wider font-sans bg-[#1E1E20]/90 border border-[#111112] px-3 py-1.5 rounded-sm shadow-md backdrop-blur">
               Preview: Ore UI (1.21+)
             </div>
              <div className="text-xs text-white uppercase tracking-wider font-sans bg-[#1E1E20]/90 border border-[#111112] px-3 py-1.5 rounded-sm shadow-md backdrop-blur">
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

                     {(selectedElement.type === 'label' || selectedElement.type === 'button' || ['dropdown', 'slider', 'textfield', 'toggle'].includes(selectedElement.type)) && (
                        <div className="flex flex-col gap-2">
                           <span className="text-[10px] font-bold text-[#666] uppercase">Text Content</span>
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-[#888]">Label / Button Text</label>
                              <input 
                                 type="text" 
                                 value={selectedElement.props.text || ''} 
                                 onChange={(e) => updateSelectedProp('text', e.target.value)}
                                 className="bg-[#111] border border-[#333] rounded px-2 py-1.5 text-[11px] outline-none text-green-400 focus:border-green-500 font-mono transition-colors w-full"
                              />
                           </div>
                           
                           {selectedElement.type === 'dropdown' && (
                              <div className="flex flex-col gap-1 mt-1">
                                <label className="text-[9px] text-[#888]">Options (comma separated)</label>
                                <input 
                                   type="text" 
                                   value={selectedElement.props.dropdownOptions || 'Option 1, Option 2'} 
                                   onChange={(e) => updateSelectedProp('dropdownOptions', e.target.value)}
                                   placeholder="Item 1, Item 2, Item 3"
                                   className="bg-[#111] border border-[#333] rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono w-full"
                                />
                                <label className="text-[9px] text-[#888] mt-1">Default Selected Index</label>
                                <input 
                                   type="number" 
                                   value={selectedElement.props.dropdownDefault || '0'} 
                                   onChange={(e) => updateSelectedProp('dropdownDefault', e.target.value)}
                                   className="bg-[#111] border border-[#333] rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono w-full"
                                />
                              </div>
                           )}

                           {selectedElement.type === 'slider' && (
                              <div className="grid grid-cols-2 gap-2 mt-1">
                                <div className="flex flex-col gap-1">
                                  <label className="text-[9px] text-[#888]">Min Value</label>
                                  <input 
                                     type="number" 
                                     value={selectedElement.props.sliderMin || '0'} 
                                     onChange={(e) => updateSelectedProp('sliderMin', e.target.value)}
                                     className="bg-[#111] border border-[#333] rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono w-full"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[9px] text-[#888]">Max Value</label>
                                  <input 
                                     type="number" 
                                     value={selectedElement.props.sliderMax || '100'} 
                                     onChange={(e) => updateSelectedProp('sliderMax', e.target.value)}
                                     className="bg-[#111] border border-[#333] rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono w-full"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[9px] text-[#888]">Step Size</label>
                                  <input 
                                     type="number" 
                                     value={selectedElement.props.sliderStep || '1'} 
                                     onChange={(e) => updateSelectedProp('sliderStep', e.target.value)}
                                     className="bg-[#111] border border-[#333] rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono w-full"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[9px] text-[#888]">Default Value</label>
                                  <input 
                                     type="number" 
                                     value={selectedElement.props.sliderDefault || '0'} 
                                     onChange={(e) => updateSelectedProp('sliderDefault', e.target.value)}
                                     className="bg-[#111] border border-[#333] rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono w-full"
                                  />
                                </div>
                              </div>
                           )}

                           {selectedElement.type === 'textfield' && (
                              <div className="flex flex-col gap-1 mt-1">
                                <label className="text-[9px] text-[#888]">Placeholder Text</label>
                                <input 
                                   type="text" 
                                   value={selectedElement.props.textFieldPlaceholder || 'Placeholder'} 
                                   onChange={(e) => updateSelectedProp('textFieldPlaceholder', e.target.value)}
                                   className="bg-[#111] border border-[#333] rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono w-full"
                                />
                                <label className="text-[9px] text-[#888] mt-1">Default Value</label>
                                <input 
                                   type="text" 
                                   value={selectedElement.props.textFieldDefault || ''} 
                                   onChange={(e) => updateSelectedProp('textFieldDefault', e.target.value)}
                                   className="bg-[#111] border border-[#333] rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono w-full"
                                />
                                <label className="text-[9px] text-[#888] mt-1 text-green-400">Correct Answer (Trigger Actions)</label>
                                <input 
                                   type="text" 
                                   value={selectedElement.props.correctAnswer || ''} 
                                   onChange={(e) => updateSelectedProp('correctAnswer', e.target.value)}
                                   placeholder="Case sensitive string..."
                                   className="bg-[#111] border border-green-900 rounded px-2 py-1.5 text-[11px] outline-none text-green-400 focus:border-green-500 font-mono w-full"
                                />
                              </div>
                           )}

                           {selectedElement.type === 'toggle' && (
                              <div className="flex flex-col gap-1 mt-1">
                                <label className="text-[9px] text-[#888]">Default State</label>
                                <select
                                   value={selectedElement.props.toggleDefault || 'false'}
                                   onChange={(e) => updateSelectedProp('toggleDefault', e.target.value)}
                                   className="bg-[#111] border border-[#333] rounded px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500 font-mono w-full"
                                >
                                  <option value="false">Unchecked</option>
                                  <option value="true">Checked</option>
                                </select>
                              </div>
                           )}

                        </div>
                     )}

                     {selectedElement.type === 'label' && variables.length > 0 && (
                        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-[#333]">
                           <span className="text-[10px] font-bold text-[#666] uppercase">Bind to Variable (optional)</span>
                           <select 
                              value={selectedElement.props.boundVariable || ''} 
                              onChange={(e) => updateSelectedProp('boundVariable', e.target.value)}
                              className="bg-[#111] border border-[#333] text-xs text-white rounded p-1.5 focus:border-[#3498db] outline-none"
                           >
                              <option value="">None</option>
                              {variables.map(v => <option key={v.id} value={v.id}>{v.name} ({v.scope})</option>)}
                           </select>
                        </div>
                     )}

                     {['button', 'textfield', 'player_picker'].includes(selectedElement.type) && variables.length > 0 && (
                        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-[#333]">
                           <div className="flex items-center justify-between">
                             <span className="text-[10px] font-bold text-[#666] uppercase">{selectedElement.type === 'player_picker' ? 'Action on Executor' : 'Variable Modifiers'}</span>
                             <button onClick={() => {
                                 const acts = selectedElement.variableActions || [];
                                 setElements(prev => prev.map(el => el.id === selectedId ? { ...el, variableActions: [...acts, { varId: variables[0].id, amount: 1, required: false }] } : el));
                             }} className="text-[#3498db] text-[10px] font-bold uppercase hover:underline">+ Add Action</button>
                           </div>
                           <div className="flex flex-col gap-2">
                              {selectedElement.variableActions?.map((act, idx) => (
                                 <div key={idx} className="flex flex-col gap-1 bg-[#111] p-1.5 rounded border border-[#333]">
                                    <div className="flex gap-1 items-center">
                                       <select value={act.varId} onChange={(e) => {
                                          const acts = [...(selectedElement.variableActions||[])];
                                          acts[idx].varId = e.target.value;
                                          setElements(prev => prev.map(el => el.id === selectedId ? { ...el, variableActions: acts } : el));
                                       }} className="bg-[#222] border border-[#444] text-[10px] text-white rounded p-1 flex-1">
                                          {variables.map(v => <option key={v.id} value={v.id}>{v.name} ({v.scope})</option>)}
                                       </select>
                                       <span className="text-[#888] text-[10px] font-bold">+</span>
                                       <input type="number" value={act.amount} onChange={(e) => {
                                          const acts = [...(selectedElement.variableActions||[])];
                                          acts[idx].amount = parseFloat(e.target.value);
                                          setElements(prev => prev.map(el => el.id === selectedId ? { ...el, variableActions: acts } : el));
                                       }} className="bg-[#222] border border-[#444] text-[10px] text-white rounded p-1 w-12 text-center" />
                                       <button onClick={() => {
                                          const acts = [...(selectedElement.variableActions||[])];
                                          acts.splice(idx, 1);
                                          setElements(prev => prev.map(el => el.id === selectedId ? { ...el, variableActions: acts } : el));
                                       }} className="text-red-400 text-[10px] font-bold px-1 hover:text-red-300">X</button>
                                    </div>
                                    <label className="flex items-center gap-1.5 cursor-pointer mt-1">
                                       <input type="checkbox" checked={!!act.required} onChange={(e) => {
                                          const acts = [...(selectedElement.variableActions||[])];
                                          acts[idx].required = e.target.checked;
                                          setElements(prev => prev.map(el => el.id === selectedId ? { ...el, variableActions: acts } : el));
                                       }} className="accent-[#3498db]" />
                                       <span className="text-[9px] text-[#aaa]">Required (Fail if exceeded condition)</span>
                                    </label>
                                 </div>
                              ))}
                           </div>

                           {selectedElement.type === 'player_picker' && (
                              <>
                                 <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#333]">
                                   <span className="text-[10px] font-bold text-orange-400 uppercase">Action on Target</span>
                                   <button onClick={() => {
                                       const acts = selectedElement.variableActionsTarget || [];
                                       setElements(prev => prev.map(el => el.id === selectedId ? { ...el, variableActionsTarget: [...acts, { varId: variables[0].id, amount: 1, required: false }] } : el));
                                   }} className="text-[#3498db] text-[10px] font-bold uppercase hover:underline">+ Add Action</button>
                                 </div>
                                 <div className="flex flex-col gap-2">
                                    {selectedElement.variableActionsTarget?.map((act, idx) => (
                                       <div key={idx} className="flex flex-col gap-1 bg-[#111] p-1.5 rounded border border-[#5a3a14]">
                                          <div className="flex gap-1 items-center">
                                             <select value={act.varId} onChange={(e) => {
                                                const acts = [...(selectedElement.variableActionsTarget||[])];
                                                acts[idx].varId = e.target.value;
                                                setElements(prev => prev.map(el => el.id === selectedId ? { ...el, variableActionsTarget: acts } : el));
                                             }} className="bg-[#2a1a0f] border border-[#5a3a14] text-[10px] text-orange-300 rounded p-1 flex-1">
                                                {variables.map(v => <option key={v.id} value={v.id}>{v.name} ({v.scope})</option>)}
                                             </select>
                                             <span className="text-[#888] text-[10px] font-bold">+</span>
                                             <input type="number" value={act.amount} onChange={(e) => {
                                                const acts = [...(selectedElement.variableActionsTarget||[])];
                                                acts[idx].amount = parseFloat(e.target.value);
                                                setElements(prev => prev.map(el => el.id === selectedId ? { ...el, variableActionsTarget: acts } : el));
                                             }} className="bg-[#2a1a0f] border border-[#5a3a14] text-[10px] text-orange-300 rounded p-1 w-12 text-center" />
                                             <button onClick={() => {
                                                const acts = [...(selectedElement.variableActionsTarget||[])];
                                                acts.splice(idx, 1);
                                                setElements(prev => prev.map(el => el.id === selectedId ? { ...el, variableActionsTarget: acts } : el));
                                             }} className="text-red-400 text-[10px] font-bold px-1 hover:text-red-300">X</button>
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              </>
                           )}

                        </div>
                     )}

                     {['image', 'panel', 'button'].includes(selectedElement.type) && (
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
                           {selectedElement.type === 'dropdown' && (
                              <>
                              &nbsp;&nbsp;<span className="text-purple-400">"options"</span>: <span className="text-green-400">"{selectedElement.props.dropdownOptions || 'Option 1, Option 2'}"</span>,\n
                              &nbsp;&nbsp;<span className="text-purple-400">"defaultIndex"</span>: <span className="text-[#dcdcaa]">{selectedElement.props.dropdownDefault || '0'}</span>,\n
                              </>
                           )}
                           {selectedElement.type === 'slider' && (
                              <>
                              &nbsp;&nbsp;<span className="text-purple-400">"min"</span>: <span className="text-[#dcdcaa]">{selectedElement.props.sliderMin || '0'}</span>,\n
                              &nbsp;&nbsp;<span className="text-purple-400">"max"</span>: <span className="text-[#dcdcaa]">{selectedElement.props.sliderMax || '100'}</span>,\n
                              &nbsp;&nbsp;<span className="text-purple-400">"step"</span>: <span className="text-[#dcdcaa]">{selectedElement.props.sliderStep || '1'}</span>,\n
                              &nbsp;&nbsp;<span className="text-purple-400">"default"</span>: <span className="text-[#dcdcaa]">{selectedElement.props.sliderDefault || '0'}</span>,\n
                              </>
                           )}
                           {selectedElement.type === 'textfield' && (
                              <>
                              &nbsp;&nbsp;<span className="text-purple-400">"placeholder"</span>: <span className="text-green-400">"{selectedElement.props.textFieldPlaceholder || 'Placeholder'}"</span>,\n
                              &nbsp;&nbsp;<span className="text-purple-400">"default"</span>: <span className="text-green-400">"{selectedElement.props.textFieldDefault || ''}"</span>,\n
                              </>
                           )}
                           {selectedElement.type === 'toggle' && (
                              <>
                              &nbsp;&nbsp;<span className="text-purple-400">"default"</span>: <span className="text-green-400">{selectedElement.props.toggleDefault === 'true' ? 'true' : 'false'}</span>,\n
                              </>
                           )}
                           {selectedElement.type === 'button' && selectedElement.variableActions && selectedElement.variableActions.length > 0 && (
                              <>&nbsp;&nbsp;<span className="text-purple-400">"variable_actions"</span>: <span className="text-[#dcdcaa]">{JSON.stringify(selectedElement.variableActions)}</span>,\n</>
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
      ) : viewMode === 'variables' ? (
         <div className="flex-1 overflow-auto p-6 bg-[#1a1a1a] flex flex-col gap-6">
            <div className="flex justify-between items-center bg-[#222] p-4 rounded border border-[#333]">
               <div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-wider">Dynamic Variables</h3>
                  <p className="text-xs text-[#888]">Track global and player-specific stats using Bedrock Dynamic Properties.</p>
               </div>
               <button onClick={() => setVariables([...variables, { id: generateUUID(), name: 'newVariable', scope: 'player', min: 0, max: null, increments: [] }])} className="bg-[#3498db] text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider hover:bg-[#2980b9] transition-colors shadow-lg">
                  + Add Variable
               </button>
            </div>

            <div className="bg-[#111] border border-[#333] rounded p-4 flex flex-col gap-2">
               <h4 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" /> AI Variable Settings
               </h4>
               <p className="text-[10px] text-[#888]">Describe a stat or variable to track (e.g., "tracks blocks broken", "tracks x axis position", "mana").</p>
               <div className="flex gap-2">
                  <input 
                     type="text" 
                     value={aiVarPrompt} 
                     onChange={e => setAiVarPrompt(e.target.value)} 
                     placeholder="E.g., Track how many times player jumps..."
                     className="bg-[#222] border border-[#444] rounded px-3 py-1.5 text-xs text-white outline-none flex-1 focus:border-purple-500"
                  />
                  <button onClick={handleGenerateVariable} disabled={isGeneratingVar} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-4 py-1.5 rounded text-[11px] font-bold tracking-wider uppercase disabled:opacity-50 flex items-center gap-2">
                     {isGeneratingVar ? <span className="animate-spin relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span></span> : "Generate"}
                  </button>
               </div>
            </div>

            {variables.length === 0 && (
               <div className="text-center py-12 text-[#666] font-mono text-sm border border-dashed border-[#444] rounded">
                  No variables defined yet. Creating variables will let you track counts when events happen in-game.
               </div>
            )}

            {variables.map((v, i) => (
               <div key={v.id} className="bg-[#212121] border border-[#333] rounded overflow-hidden">
                  <div className="bg-[#2a2a2a] p-3 border-b flex items-center justify-between border-[#333]">
                     <div className="flex items-center gap-4">
                        <select
                           value={v.scope}
                           onChange={(e) => {
                              const newVars = [...variables];
                              newVars[i].scope = e.target.value as 'player' | 'global';
                              setVariables(newVars);
                           }}
                           className="bg-[#111] border border-[#444] text-xs text-white rounded outline-none p-1.5 focus:border-[#007acc]"
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
                     <button onClick={() => setVariables(variables.filter(x => x.id !== v.id))} className="text-red-400 hover:text-red-300 text-xs font-bold uppercase">Delete</button>
                  </div>
                  <div className="p-4 flex flex-col gap-4">
                     {/* Min Max constraints */}
                     <div className="flex gap-4">
                        <div className="flex flex-col gap-1">
                           <label className="text-[10px] font-bold text-[#888] uppercase">Minimum Value</label>
                           <input type="number" value={v.min ?? ''} className="bg-[#111] border border-[#333] p-1.5 rounded text-white font-mono text-sm w-24" onChange={(e) => {
                              const newVars = [...variables];
                              newVars[i].min = e.target.value ? parseInt(e.target.value) : null;
                              setVariables(newVars);
                           }} />
                        </div>
                        <div className="flex flex-col gap-1">
                           <label className="text-[10px] font-bold text-[#888] uppercase">Maximum Value (Optional)</label>
                           <input type="number" value={v.max ?? ''} className="bg-[#111] border border-[#333] p-1.5 rounded text-white font-mono text-sm w-24" onChange={(e) => {
                              const newVars = [...variables];
                              newVars[i].max = e.target.value ? parseInt(e.target.value) : null;
                              setVariables(newVars);
                           }} />
                        </div>
                     </div>

                     {/* Increments */}
                     <div>
                        <div className="flex items-center justify-between mb-2">
                           <label className="text-[10px] font-bold text-[#888] uppercase">Triggers (Increment when...)</label>
                           <button onClick={() => {
                               const newVars = [...variables];
                               newVars[i].increments = newVars[i].increments || [];
                               newVars[i].increments.push({ event: 'playerJoin', amount: 1 });
                               setVariables(newVars);
                           }} className="text-[#3498db] text-xs font-bold uppercase hover:underline">+ Add Event</button>
                        </div>
                        <div className="flex flex-col gap-2">
                           {(v.increments || []).map((inc, incIdx) => (
                              <div key={incIdx} className="flex gap-2 items-center bg-[#181818] p-2 rounded border border-[#2a2a2a]">
                                 <select value={inc.event} onChange={e => {
                                      const newVars = [...variables];
                                      newVars[i].increments[incIdx].event = e.target.value;
                                      setVariables(newVars);
                                 }} className="bg-[#111] border border-[#333] text-xs p-1.5 rounded text-white outline-none focus:border-[#007acc] flex-1">
                                    {MC_EVENTS.map(evt => <option key={evt} value={evt}>{evt}</option>)}
                                 </select>
                                 <span className="text-white text-xs font-mono font-bold">BY</span>
                                 <input type="number" value={inc.amount} onChange={e => {
                                      const newVars = [...variables];
                                      newVars[i].increments[incIdx].amount = parseFloat(e.target.value);
                                      setVariables(newVars);
                                 }} className="bg-[#111] border border-[#333] p-1 text-white font-mono text-sm rounded w-16" />
                                 <button onClick={() => {
                                      const newVars = [...variables];
                                      newVars[i].increments.splice(incIdx, 1);
                                      setVariables(newVars);
                                 }} className="text-red-400 font-bold ml-2 text-xs">X</button>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>
            ))}
         </div>
      ) : viewMode === 'triggers' ? (
         <div className="flex-1 p-6 overflow-auto bg-[#1e1e1e] flex flex-col gap-6">
            <div className="flex justify-between items-center bg-[#252526] py-3 px-4 rounded border border-[#333]">
               <div>
                  <h2 className="text-white font-bold text-lg">Custom Script Triggers</h2>
                  <p className="text-[#aaa] text-xs">Since GUI is set to Hidden, choose events to open your GUI code.</p>
               </div>
               <button onClick={() => setCustomTriggers([...customTriggers, { id: generateUUID(), type: 'itemUse', config: {} }])} className="px-4 py-2 bg-[#007acc] text-white font-bold text-xs uppercase tracking-wider rounded hover:bg-[#005999] transition-colors">
                  + Add Trigger
               </button>
            </div>

            {customTriggers.map((trigger, i) => (
               <div key={trigger.id} className="bg-[#252526] border border-[#333] rounded">
                  <div className="bg-[#2a2d2e] p-3 border-b border-[#333] flex justify-between items-center rounded-t">
                     <span className="text-white font-bold text-sm tracking-wide">Trigger #{i + 1}</span>
                     <button onClick={() => setCustomTriggers(customTriggers.filter(t => t.id !== trigger.id))} className="text-red-400 font-bold text-xs uppercase hover:underline">Remove</button>
                  </div>
                  <div className="p-4 flex flex-col gap-4">
                     <div className="flex gap-4 items-end">
                        <div className="flex flex-col gap-1.5 flex-1">
                           <label className="text-[10px] uppercase font-bold text-[#888] tracking-wider">Trigger Event</label>
                           <select 
                              value={trigger.type} 
                              onChange={(e) => {
                                 const newTriggers = [...customTriggers];
                                 newTriggers[i].type = e.target.value as any;
                                 setCustomTriggers(newTriggers);
                              }}
                              className="bg-[#111] border border-[#333] px-3 py-2 text-white text-sm outline-none rounded"
                           >
                              <option value="itemUse">Using an Item in Hand (Right Click)</option>
                              <option value="blockBreak">Breaking a Specific Block</option>
                              <option value="entityHit">Hitting a Specific Entity (Mob)</option>
                              <option value="chatCommand">Typing a Chat Command</option>
                              <option value="aiGenerated">✨ AI Generative Trigger</option>
                           </select>
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1 w-full">
                           {trigger.type === 'itemUse' && (
                              <><label className="text-[10px] uppercase font-bold text-[#888] tracking-wider">Item ID</label><input type="text" placeholder="minecraft:stick" value={trigger.config.itemId || ''} onChange={e => { const newTriggers = [...customTriggers]; newTriggers[i].config.itemId = e.target.value; setCustomTriggers(newTriggers); }} className="bg-[#111] border border-[#333] px-3 py-2 text-white text-sm outline-none rounded font-mono" /></>
                           )}
                           {trigger.type === 'blockBreak' && (
                              <><label className="text-[10px] uppercase font-bold text-[#888] tracking-wider">Block ID</label><input type="text" placeholder="minecraft:dirt" value={trigger.config.blockId || ''} onChange={e => { const newTriggers = [...customTriggers]; newTriggers[i].config.blockId = e.target.value; setCustomTriggers(newTriggers); }} className="bg-[#111] border border-[#333] px-3 py-2 text-white text-sm outline-none rounded font-mono" /></>
                           )}
                           {trigger.type === 'entityHit' && (
                              <><label className="text-[10px] uppercase font-bold text-[#888] tracking-wider">Entity ID</label><input type="text" placeholder="minecraft:cow" value={trigger.config.entityId || ''} onChange={e => { const newTriggers = [...customTriggers]; newTriggers[i].config.entityId = e.target.value; setCustomTriggers(newTriggers); }} className="bg-[#111] border border-[#333] px-3 py-2 text-white text-sm outline-none rounded font-mono" /></>
                           )}
                           {trigger.type === 'chatCommand' && (
                              <><label className="text-[10px] uppercase font-bold text-[#888] tracking-wider">Chat Command</label><input type="text" placeholder="!showgui" value={trigger.config.command || ''} onChange={e => { const newTriggers = [...customTriggers]; newTriggers[i].config.command = e.target.value; setCustomTriggers(newTriggers); }} className="bg-[#111] border border-[#333] px-3 py-2 text-white text-sm outline-none rounded font-mono" /></>
                           )}
                           {trigger.type === 'aiGenerated' && (
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Describe the event in plain English</label>
                                <textarea 
                                  placeholder="When the player enters water, or when they eat an apple..."
                                  value={trigger.config.prompt || ''}
                                  onChange={e => { const newTriggers = [...customTriggers]; newTriggers[i].config.prompt = e.target.value; setCustomTriggers(newTriggers); }}
                                  className="bg-[#111] border border-blue-900 px-3 py-2 text-white text-sm outline-none rounded min-h-[60px]"
                                />
                                <button className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-3 rounded text-xs transition-colors" disabled={trigger.config.isGenerating} onClick={async () => {
                                   const newTriggers = [...customTriggers];
                                   newTriggers[i].config.isGenerating = true;
                                   setCustomTriggers(newTriggers);
                                   try {
                                     const res = await fetch('/api/generate-trigger', {
                                       method: 'POST',
                                       headers: { 'Content-Type': 'application/json' },
                                       body: JSON.stringify({ prompt: trigger.config.prompt || '' })
                                     });
                                     const data = await res.json();
                                     newTriggers[i].config.code = data.result;
                                   } catch(e) {
                                     alert('Failed to generate code.');
                                   } finally {
                                     newTriggers[i].config.isGenerating = false;
                                     setCustomTriggers([...newTriggers]);
                                   }
                                }}>{trigger.config.isGenerating ? 'Generating...' : '✨ Generate Script'}</button>
                                {trigger.config.code && (
                                   <div className="mt-2">
                                      <label className="text-[10px] uppercase font-bold text-[#888] tracking-wider">Generated Code</label>
                                      <textarea readOnly value={trigger.config.code} className="w-full bg-[#1e1e1e] border border-[#333] px-2 py-1 text-green-400 text-[11px] font-mono rounded min-h-[100px] mt-1 custom-scrollbar"></textarea>
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
                  <div className="mt-2 mb-2 text-[10px] font-bold text-[#888] uppercase tracking-wider px-2">
                    Behavior Pack
                  </div>
                  <div 
                     onClick={() => setSelectedFile('BP/manifest.json')}
                     className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${selectedFile === 'BP/manifest.json' ? 'bg-[#3498db]/20 text-blue-400' : 'text-[#aaa] hover:bg-[#333]'}`}
                  >
                     <FileJson className="w-3.5 h-3.5 text-yellow-400" />
                     <span className="text-yellow-400">BP/manifest.json</span>
                  </div>
                  <div 
                     onClick={() => setSelectedFile('BP/scripts/main.js')}
                     className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${selectedFile === 'BP/scripts/main.js' ? 'bg-[#3498db]/20 text-blue-400' : 'text-[#aaa] hover:bg-[#333]'}`}
                  >
                     <FileJson className="w-3.5 h-3.5 text-yellow-400" />
                     <span className="text-yellow-400">BP/scripts/main.js</span>
                  </div>
                  {openedFrom === 'book' && (
                  <div 
                     onClick={() => setSelectedFile('BP/items/custom_gui_book.json')}
                     className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${selectedFile === 'BP/items/custom_gui_book.json' ? 'bg-[#3498db]/20 text-blue-400' : 'text-[#aaa] hover:bg-[#333]'}`}
                  >
                     <FileJson className="w-3.5 h-3.5 text-yellow-400" />
                     <span className="text-yellow-400">BP/items/custom_gui_book.json</span>
                  </div>
                  )}

                  <div className="mt-4 mb-2 text-[10px] font-bold text-[#888] uppercase tracking-wider px-2">
                    Resource Pack
                  </div>
                  <div 
                     onClick={() => setSelectedFile('RP/manifest.json')}
                     className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${selectedFile === 'RP/manifest.json' ? 'bg-[#3498db]/20 text-blue-400' : 'text-[#aaa] hover:bg-[#333]'}`}
                  >
                     <FileJson className="w-3.5 h-3.5" />
                     <span>RP/manifest.json</span>
                  </div>
                  {openedFrom === 'book' && (
                  <>
                  <div 
                     onClick={() => setSelectedFile('RP/items/custom_gui_book.json')}
                     className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${selectedFile === 'RP/items/custom_gui_book.json' ? 'bg-[#3498db]/20 text-blue-400' : 'text-[#aaa] hover:bg-[#333]'}`}
                  >
                     <FileJson className="w-3.5 h-3.5" />
                     <span>RP/items/custom_gui_book.json</span>
                  </div>
                  <div 
                     onClick={() => setSelectedFile('RP/textures/item_texture.json')}
                     className={`p-2 rounded flex items-center gap-2 cursor-pointer text-xs ${selectedFile === 'RP/textures/item_texture.json' ? 'bg-[#3498db]/20 text-blue-400' : 'text-[#aaa] hover:bg-[#333]'}`}
                  >
                     <FileJson className="w-3.5 h-3.5" />
                     <span>RP/textures/item_texture.json</span>
                  </div>
                  </>
                  )}
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
                     if (selectedFile === 'BP/manifest.json') text = generateBPManifest();
                     if (selectedFile === 'RP/manifest.json') text = generateRPManifest();
                     if (selectedFile === 'BP/scripts/main.js') text = generateScriptAPI();
                     if (selectedFile === 'BP/items/custom_gui_book.json') {
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
                     if (selectedFile === 'RP/items/custom_gui_book.json') {
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
                     if (selectedFile === 'RP/textures/item_texture.json') {
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
                     if (selectedFile === 'RP/texts/en_US.lang') {
                        const allElements = [...guiElements, ...bookElements];
                        const labels = allElements.filter(e=>e.type==='label').map(e => `label.${e.name.replace(/ /g, '_').toLowerCase()} = ${e.props.text}`).join('\n');
                        let langBookText = openedFrom === 'book' ? `item.custom:gui_book.name=GUI Book\n\n` : '';
                        text = `${langBookText}${labels}`;
                     }
                     navigator.clipboard.writeText(text);
                     alert(`Copied ${selectedFile} to clipboard!`);
                 }} className="w-full py-2 bg-[#333] hover:bg-[#444] text-white text-xs font-bold uppercase rounded transition-colors border border-[#555]">
                    Copy Current File
                 </button>
               </div>
            </aside>
            <main className="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden">
               <div className="h-10 bg-[#252525] border-b border-[#333] flex items-center justify-between px-4 shrink-0">
                  <div className="text-[11px] font-mono text-[#888]">{selectedFile}</div>
                  
                  {['BP/manifest.json', 'RP/manifest.json'].includes(selectedFile) && (
                    <div className="flex gap-4 items-center">
                      <span className="text-[#888] text-[10px]">Note: You only need these files for a new mod. Try pasting modules into your existing manifest.</span>
                      <button onClick={() => {
                        setBpUuid1(generateUUID());
                        setBpUuid2(generateUUID());
                        setBpUuid3(generateUUID());
                        setRpUuid1(generateUUID());
                        setRpUuid2(generateUUID());
                      }} className="bg-[#333] hover:bg-[#444] text-[10px] text-white px-2 py-1 rounded transition-colors border border-[#555]">
                        Regenerate UUIDs
                      </button>
                    </div>
                  )}
               </div>

               {selectedFile === 'BP/manifest.json' && (
                   <div className="p-4 bg-[#252525] border-b border-[#333]">
                      <label className="text-xs text-[#888] block mb-2 font-bold uppercase">Base BP Manifest (Paste your un-modded manifest here to inject scripts/dependencies)</label>
                      <textarea className="w-full h-32 bg-[#111] border border-[#444] p-2 text-[#dcdcaa] font-mono text-[11px] outline-none rounded focus:border-[#3498db]" value={baseBPManifest} onChange={(e) => setBaseBPManifest(e.target.value)} placeholder="Paste your original behaviour pack manifest.json here..."></textarea>
                   </div>
               )}
               {selectedFile === 'RP/manifest.json' && (
                   <div className="p-4 bg-[#252525] border-b border-[#333]">
                      <label className="text-xs text-[#888] block mb-2 font-bold uppercase">Base RP Manifest (Paste your un-modded manifest here)</label>
                      <textarea className="w-full h-32 bg-[#111] border border-[#444] p-2 text-[#dcdcaa] font-mono text-[11px] outline-none rounded focus:border-[#3498db]" value={baseRPManifest} onChange={(e) => setBaseRPManifest(e.target.value)} placeholder="Paste your original resource pack manifest.json here..."></textarea>
                   </div>
               )}
               
               <div className="bg-[#3a2a1a] border-b border-[#dd9b3b] text-[#ffd9a3] p-3 text-xs leading-relaxed">
                  <div className="font-bold flex items-center gap-1.5 mb-1"><span role="img" aria-label="warning">⚠️</span> JSON UI Deprecation Warning (Minecraft 1.21.0+)</div>
                  Minecraft Bedrock is replacing <b>JSON UI</b> with a hardcoded engine called <b>Ore UI</b> (such as the new Inventory, Death Screen, etc). Ore UI <u>cannot</u> be modified via resource packs.
                  Modifying files like <code>recipe_inventory_screen_content</code> may break the game UI entirely.
                  <br/><br/>
                  <b>Modern Solution:</b> Export your GUI as a Behavior Pack Script using the new <b>BP/scripts/main.js (Script API)</b> export option on the left. It uses strictly supported <code>@minecraft/server-ui</code> ActionFormData which works natively in 1.21+!
               </div>

               {guiElements.some(e => ['dropdown', 'slider', 'textfield', 'toggle'].includes(e.type)) && guiElements.some(e => e.type === 'label') && (
                  <div className="bg-[#3a1a1a] border-b border-[#dd3b3b] text-[#ffa3a3] p-3 text-xs leading-relaxed">
                     <div className="font-bold flex items-center gap-1.5 mb-1"><span role="img" aria-label="error">⚠️</span> Missing Labels Warning</div>
                     You have added both <b>Form Inputs</b> (Dropdown, Slider, etc.) and <b>Labels</b>. 
                     Because Minecraft's <code>ModalFormData</code> does not support text bodies natively, your labels will be hidden in the exported Script API code.
                     Only the very first label will be preserved as the Form Title.
                  </div>
               )}

               <div className="flex-1 p-4 overflow-auto custom-scrollbar">
                  <pre className="text-[12px] font-mono text-[#dcdcaa] leading-relaxed">
                     {selectedFile === 'BP/manifest.json' && generateBPManifest()}
                     {selectedFile === 'RP/manifest.json' && generateRPManifest()}
                     {selectedFile === 'BP/scripts/main.js' && generateScriptAPI()}
                     {selectedFile === 'BP/items/custom_gui_book.json' && JSON.stringify({
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
}, null, 2)}
                     {selectedFile === 'RP/items/custom_gui_book.json' && JSON.stringify({
  "format_version": "1.20.50",
  "minecraft:item": {
    "description": {
      "identifier": "custom:gui_book"
    },
    "components": {
      "minecraft:icon": "gui_book"
    }
  }
}, null, 2)}
                     {selectedFile === 'RP/textures/item_texture.json' && JSON.stringify({
  "resource_pack_name": "custom",
  "texture_name": "atlas.items",
  "texture_data": {
    "gui_book": {
      "textures": "textures/items/book_normal"
    }
  }
}, null, 2)}
                     {selectedFile === 'RP/texts/en_US.lang' && (
                        (openedFrom === 'book' ? `item.custom:gui_book.name=GUI Book\n\n` : '') +
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

