# Ore UI and React-Facet Study Guide

## 1. Core Concepts
**Ore UI** is Mojang's modern, React-based UI engine designed to replace older JSON UI configurations in Minecraft: Bedrock Edition and Minecraft Education Edition. 
- It relies on web standards and TypeScript.
- It provides highly performant, observable state management through a system called **@react-facet**.

**@react-facet** (documented at *https://react-facet.mojang.com/* and its GitHub repo *mojang/react-facet*) is a state management library for React. 
- **Observable States (Facets):** Intercepts fast-changing data (like player health, coords) and mutates the DOM directly without triggering expensive React component re-renders.
- **Engine Interfacing:** Uses Shared Facets to bridge data between the C++ Minecraft Bedrock engine and the frontend UI.

## 2. Limitations in Minecraft Modding & Education Edition
- **Hardcoded Engine:** Ore UI is compiled natively into the game engine.
- **No Resource Pack Customization:** You **CANNOT** use traditional client-side resource packs to override or edit Ore UI screens (such as settings, pause menus, inventory). Moving away from traditional `JSON UI` means these files (e.g., `recipe_inventory_screen_content`) are no longer customizable on the client level.
- **Why?** Mojang locked this down to ensure cross-platform stability and performance.

## 3. How to Create Custom UI in Minecraft Education Edition
Because Ore UI source code cannot be directly packed into a Behavior/Resource pack, creators must use officially supported pathways. The primary method is **Server-Form Scripting**:

Using the `@minecraft/server-ui` module within a Behavior Pack (`BP/scripts/main.js`):
1. **ActionFormData:** Used for menus with rich text bodies and buttons.
2. **ModalFormData:** Used for complex forms (dropdowns, sliders, toggles, text fields).
3. **MessageFormData:** Used for simple pop-up prompts (Title, Body, Yes/No buttons).

**How it ties to Ore UI:** 
When a script triggers an `ActionFormData` or `ModalFormData`, the Minecraft Engine receives the layout request and dynamically constructs the visual prompt using the internal **Ore UI** engine. This guarantees the UI looks native, behaves securely, and matches the Education Edition aesthetics perfectly.

## 4. Best Practices for UI Builders
- **Stop targeting JSON UI:** Remove logic that manipulates `JSON UI` for custom interactive screens, as it will break or be ignored in newer versions (1.21+).
- **Leverage `@minecraft/server-ui`:** Focus entirely on expanding UI capabilities matching the Script API (adding toggles, sliders, form submission tracking, multi-page dialogs).
- **Graceful Fallbacks:** For complex UI, if `ActionFormData` provides buttons but you need deep configuration, seamlessly transition the user to a `ModalFormData` screen instead.

## 5. Official References
- **Framework Docs:** https://react-facet.mojang.com/
- **GitHub Repo:** https://github.com/mojang/react-facet
- **Script API:** @minecraft/server-ui Documentation
