# Implementation Plan: Image Stitcher Tool (图片拼接工具)

## Overview

Implement a Fabric.js-based image stitching, annotation, and export workspace as a new dashboard tab. The module is fully client-side, uses pure functions for stitching calculations, JSON snapshots for undo/redo, and integrates into the existing dashboard tab system.

## Tasks

- [ ] 1. Set up module structure and types
  - [x] 1.1 Create `client/src/pages/dashboard/components/image-stitcher/types.ts` with shared types (`ToolMode`, `StitchDirection`, `ImageEntry`, `HistoryState`, `CanvasManagerAPI`, `StitchLayout`, `ToolState`)
    - Define all interfaces and type aliases as specified in the design
    - _Requirements: All (foundational types)_

  - [x] 1.2 Register the 'image-stitcher' tab in the dashboard tab system
    - Add 'image-stitcher' to `DASHBOARD_TABS` array immediately after 'pareto-analysis'
    - Add 'image-stitcher' to `PUBLIC_DASHBOARD_TABS`
    - Add label "图片拼接" for the tab
    - Add lazy import for `ImageStitcherWorkspace` component
    - Render inside `<LazyWorkspace>` when tab is active
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.3 Create the top-level `ImageStitcherWorkspace.tsx` component shell
    - Create file at `client/src/pages/dashboard/components/ImageStitcherWorkspace.tsx`
    - Set up basic layout with toolbar area and canvas container
    - Manage `ToolState` via `useState`
    - Wire up placeholder slots for toolbar, drop zone, and canvas
    - _Requirements: 1.5_

- [ ] 2. Implement stitching engine (pure functions)
  - [x] 2.1 Implement `computeVerticalStitch` in `client/src/pages/dashboard/components/image-stitcher/stitchingEngine.ts`
    - Accept `ImageEntry[]`, return `StitchLayout`
    - Find max width as base width
    - Scale each image proportionally to base width
    - Compute Y positions as cumulative sum of scaled heights
    - Set canvas dimensions (width = base width, height = sum of scaled heights)
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 2.2 Implement `computeHorizontalStitch` in the same file
    - Accept `ImageEntry[]`, return `StitchLayout`
    - Find max height as base height
    - Scale each image proportionally to base height
    - Compute X positions as cumulative sum of scaled widths
    - Set canvas dimensions (width = sum of scaled widths, height = base height)
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 2.3 Write property test: Vertical stitch layout correctness
    - **Property 1: Vertical stitch layout correctness**
    - Generate random arrays of `{width, height}` pairs with positive dimensions
    - Verify canvas width = max image width, each image scaled to base width, Y positions are cumulative, X = 0, canvas height = sum of scaled heights
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6**

  - [ ]* 2.4 Write property test: Horizontal stitch layout correctness
    - **Property 2: Horizontal stitch layout correctness**
    - Generate random arrays of `{width, height}` pairs with positive dimensions
    - Verify canvas height = max image height, each image scaled to base height, X positions are cumulative, Y = 0, canvas width = sum of scaled widths
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6**

- [ ] 3. Implement image upload and drop zone
  - [x] 3.1 Create `ImageDropZone.tsx` component
    - Implement drag-and-drop with visual highlight on dragover
    - Implement click-to-open file picker (multiple selection)
    - Validate MIME types (PNG, JPEG, WebP); show error for unsupported files
    - Load images into `HTMLImageElement`, extract natural dimensions
    - Call `onImagesLoaded` callback with ordered `ImageEntry[]`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 3.2 Write property test: Image queue order preservation
    - **Property 3: Image queue order preservation**
    - Generate random sequences of image entries, verify output order matches input order
    - **Validates: Requirements 3.3, 3.5**

  - [ ]* 3.3 Write property test: Unsupported file rejection
    - **Property 4: Unsupported file rejection**
    - Generate random MIME types not in accepted set, verify rejection and queue unchanged
    - **Validates: Requirements 3.6**

- [ ] 4. Implement canvas manager with zoom and pan
  - [x] 4.1 Create `useCanvasManager.ts` hook
    - Initialize `fabric.Canvas` on mount, dispose on unmount
    - Use ResizeObserver to fill container responsively
    - Implement mouse wheel zoom centered on cursor (clamped 0.1x–5x)
    - Implement spacebar hold → pan mode (grab cursor, drag to pan)
    - Restore previous tool mode on spacebar release
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 4.2 Write property test: Zoom centered on cursor position
    - **Property 12: Zoom centered on cursor position**
    - Generate random cursor positions and zoom deltas, verify canvas point under cursor remains at same screen position
    - **Validates: Requirements 2.2**

  - [ ]* 4.3 Write property test: Tool mode restoration after spacebar release
    - **Property 13: Tool mode restoration after spacebar release**
    - Generate random tool modes, simulate spacebar hold/release, verify mode restored
    - **Validates: Requirements 2.5**

- [ ] 5. Implement undo/redo history manager
  - [x] 5.1 Create `useHistoryManager.ts` hook
    - Implement `record()` — push `canvas.toJSON()` to past, clear future
    - Implement `undo()` — pop past, push present to future, load state
    - Implement `redo()` — pop future, push present to past, load state
    - Expose `canUndo` / `canRedo` booleans
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 5.2 Write property test: Undo/redo round trip
    - **Property 5: Undo/redo round trip**
    - Generate random sequences of state snapshots, verify undo then redo restores state, and change then undo restores previous state
    - **Validates: Requirements 10.2, 10.3, 10.4**

- [x] 6. Checkpoint - Ensure core engine and hooks work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement annotation toolset
  - [x] 7.1 Implement selection tool behavior in workspace
    - When select mode active: enable default Fabric.js selection
    - Allow move, resize via handles
    - Delete key removes selected object
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 7.2 Write property test: Delete removes object from canvas
    - **Property 6: Delete removes object from canvas**
    - Generate random object counts, verify deletion decrements count and removes target ID
    - **Validates: Requirements 6.5**

  - [x] 7.3 Implement text tool behavior
    - Click on canvas creates editable `fabric.IText` at click position
    - Support color and font size modification for selected text
    - Double-click enters inline editing mode
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 7.4 Write property test: Text creation at click position
    - **Property 7: Text creation at click position**
    - Generate random (x, y) coordinates, verify text object placed at those coordinates
    - **Validates: Requirements 7.2**

  - [x] 7.5 Implement rectangle shape tool
    - Click-drag creates hollow rectangle with red stroke, no fill
    - Dimensions match drag extent
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 7.6 Write property test: Rectangle creation with correct properties
    - **Property 8: Rectangle creation with correct properties**
    - Generate random drag coordinates, verify rect has no fill, red stroke, correct dimensions
    - **Validates: Requirements 8.2, 8.3**

  - [x] 7.7 Implement arrow shape tool
    - Click-drag creates arrow line from start to end point
    - Render arrowhead indicator at end point
    - _Requirements: 8.4, 8.5_

  - [ ]* 7.8 Write property test: Arrow creation with arrowhead
    - **Property 9: Arrow creation with arrowhead**
    - Generate random drag coordinates, verify line connects points with arrowhead at end
    - **Validates: Requirements 8.4, 8.5**

  - [x] 7.9 Implement brush (free drawing) tool
    - Activate `canvas.isDrawingMode` when brush tool selected
    - Apply configured brush width and color to `freeDrawingBrush`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 7.10 Write property test: Brush drawing mode and stroke properties
    - **Property 10: Brush mode and stroke properties**
    - Generate random width/color values, verify `isDrawingMode`, brush width, and brush color match
    - **Validates: Requirements 9.2, 9.3, 9.4, 9.5**

- [ ] 8. Implement toolbar UI
  - [x] 8.1 Create `ImageStitcherToolbar.tsx` component
    - Render tool buttons: select, text, rectangle, arrow, brush
    - Render action buttons: 垂直拼接, 水平拼接, Undo, Redo, 导出 PNG
    - Render property controls: brush width, brush color, font size, font color
    - Highlight active tool, disable undo/redo based on `canUndo`/`canRedo`
    - Wire all callbacks to parent workspace
    - _Requirements: 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1, 11.1_

- [ ] 9. Implement PNG export
  - [x] 9.1 Implement export function in workspace
    - Use `canvas.toDataURL()` at logical canvas dimensions (multiplier = 1/currentZoom or reset viewport)
    - Trigger browser download with generated PNG blob
    - Disable export button when canvas has no objects
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 9.2 Write property test: Export at logical dimensions regardless of zoom
    - **Property 11: Export dimensions**
    - Generate random canvas dimensions and zoom levels, verify exported PNG dimensions equal logical W×H
    - **Validates: Requirements 11.2, 11.3**

- [ ] 10. Wire everything together in workspace
  - [x] 10.1 Integrate all hooks and components in `ImageStitcherWorkspace.tsx`
    - Connect `useCanvasManager` to canvas container ref
    - Connect `useHistoryManager` to canvas instance
    - Wire toolbar actions to stitching engine (load images onto canvas using computed layout)
    - Wire annotation tool mode changes to canvas event handlers
    - Wire export button to export function
    - Show `ImageDropZone` when no images are on canvas
    - Record history snapshot after each state-changing action
    - _Requirements: All (integration)_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- The stitching engine (tasks 2.1–2.4) is the highest-value testing target since it contains pure mathematical logic
- All processing is client-side; no server changes needed
