# Requirements Document

## Introduction

为主仪表盘新增"图片拼接工具"模块（位于柏拉图分析之后），提供基于 Fabric.js 的图片拼接、编辑与标注工作台。支持多图上传、水平/垂直拼接、画布缩放平移、文字/形状/画笔标注、撤销重做及高清 PNG 导出。

## Glossary

- **Dashboard**: 主仪表盘应用，基于 Vite + React + TypeScript + Tailwind CSS 构建
- **Image_Stitcher_Module**: 图片拼接工具模块，包含画布管理、拼接引擎、标注工具集和辅助输出功能
- **Canvas_Manager**: 画布管理器，负责初始化响应式 Fabric.js 画布并处理缩放与平移交互
- **Stitching_Engine**: 拼接引擎，负责执行水平拼接和垂直拼接算法
- **Annotation_Toolset**: 标注工具集，提供选择、文字、形状、画笔等编辑工具
- **Fabric_Canvas**: 基于 Fabric.js 的 HTML5 Canvas 实例
- **DASHBOARD_TABS**: 仪表盘 Tab 注册数组，定义所有可用 Tab 的 ID 和顺序
- **PUBLIC_DASHBOARD_TABS**: 无需管理员模式即可访问的公开 Tab 子集
- **LazyWorkspace**: 仪表盘中用于懒加载模块的 Suspense 包装组件
- **State_Snapshot**: Fabric.js Canvas 的 JSON 序列化状态快照，用于撤销/重做

## Requirements

### Requirement 1: Tab 注册与懒加载

**User Story:** As a dashboard user, I want to see an "图片拼接" tab in the dashboard navigation after the Pareto analysis tab, so that I can access the image stitching workspace.

#### Acceptance Criteria

1. THE Dashboard SHALL include 'image-stitcher' as an entry in the DASHBOARD_TABS array, positioned immediately after 'pareto-analysis'
2. THE Dashboard SHALL display the label "图片拼接" for the 'image-stitcher' tab in the tab navigation strip
3. THE Dashboard SHALL include the 'image-stitcher' tab in PUBLIC_DASHBOARD_TABS so that it is visible without admin mode
4. THE Dashboard SHALL lazy-load the Image_Stitcher_Module using React.lazy and dynamic import
5. WHEN the 'image-stitcher' tab is selected, THE Dashboard SHALL render the Image_Stitcher_Module wrapped in a LazyWorkspace component

### Requirement 2: 画布初始化与交互

**User Story:** As a user, I want a responsive canvas workspace with Figma-like zoom and pan controls, so that I can comfortably view and edit stitched images at any scale.

#### Acceptance Criteria

1. WHEN the Image_Stitcher_Module mounts, THE Canvas_Manager SHALL initialize a Fabric_Canvas that fills the available workspace area responsively
2. WHEN the user scrolls the mouse wheel over the Fabric_Canvas, THE Canvas_Manager SHALL zoom the canvas in or out centered on the cursor position
3. WHILE the user holds the spacebar key, THE Canvas_Manager SHALL switch to pan mode allowing click-drag to pan the canvas viewport
4. WHILE the user holds the spacebar key, THE Canvas_Manager SHALL display a grab cursor to indicate pan mode is active
5. WHEN the user releases the spacebar key, THE Canvas_Manager SHALL return to the previously active tool mode

### Requirement 3: 图片上传

**User Story:** As a user, I want to upload multiple images via drag-and-drop or file picker, so that I can prepare images for stitching.

#### Acceptance Criteria

1. THE Image_Stitcher_Module SHALL provide a drop zone area that accepts image files (PNG, JPG, JPEG, WebP)
2. WHEN the user drags image files over the drop zone, THE Image_Stitcher_Module SHALL display a visual highlight indicating the drop target is active
3. WHEN the user drops image files onto the drop zone, THE Stitching_Engine SHALL load each image and add it to the upload queue in drop order
4. WHEN the user clicks the drop zone, THE Image_Stitcher_Module SHALL open a file picker dialog allowing multiple image file selection
5. WHEN the user selects files via the file picker, THE Stitching_Engine SHALL load each image and add it to the upload queue in selection order
6. IF a dropped or selected file is not a supported image format, THEN THE Image_Stitcher_Module SHALL display an error message identifying the unsupported file

### Requirement 4: 垂直拼接算法

**User Story:** As a user, I want to vertically stitch uploaded images so that they are arranged top-to-bottom with consistent width scaling.

#### Acceptance Criteria

1. THE Image_Stitcher_Module SHALL provide a "垂直拼接" action button
2. WHEN the user clicks "垂直拼接", THE Stitching_Engine SHALL identify the widest image's pixel width as the base width
3. WHEN the user clicks "垂直拼接", THE Stitching_Engine SHALL proportionally scale each image to match the base width while preserving aspect ratio
4. WHEN the user clicks "垂直拼接", THE Stitching_Engine SHALL arrange all scaled images sequentially along the Y-axis in upload order (top to bottom)
5. WHEN the user clicks "垂直拼接", THE Stitching_Engine SHALL set the Fabric_Canvas height to the sum of all scaled image heights
6. WHEN the user clicks "垂直拼接", THE Stitching_Engine SHALL set the Fabric_Canvas width to the base width

### Requirement 5: 水平拼接算法

**User Story:** As a user, I want to horizontally stitch uploaded images so that they are arranged left-to-right with consistent height scaling.

#### Acceptance Criteria

1. THE Image_Stitcher_Module SHALL provide a "水平拼接" action button
2. WHEN the user clicks "水平拼接", THE Stitching_Engine SHALL identify the tallest image's pixel height as the base height
3. WHEN the user clicks "水平拼接", THE Stitching_Engine SHALL proportionally scale each image to match the base height while preserving aspect ratio
4. WHEN the user clicks "水平拼接", THE Stitching_Engine SHALL arrange all scaled images sequentially along the X-axis in upload order (left to right)
5. WHEN the user clicks "水平拼接", THE Stitching_Engine SHALL set the Fabric_Canvas width to the sum of all scaled image widths
6. WHEN the user clicks "水平拼接", THE Stitching_Engine SHALL set the Fabric_Canvas height to the base height

### Requirement 6: 选择工具

**User Story:** As a user, I want to select, move, scale, and delete objects on the canvas, so that I can adjust the layout after stitching.

#### Acceptance Criteria

1. THE Annotation_Toolset SHALL provide a selection tool button
2. WHEN the selection tool is active and the user clicks an object on the Fabric_Canvas, THE Annotation_Toolset SHALL select that object and display resize handles
3. WHEN an object is selected, THE Annotation_Toolset SHALL allow the user to drag the object to reposition it
4. WHEN an object is selected, THE Annotation_Toolset SHALL allow the user to drag resize handles to scale the object
5. WHEN an object is selected and the user presses the Delete key, THE Annotation_Toolset SHALL remove the object from the Fabric_Canvas

### Requirement 7: 文字工具

**User Story:** As a user, I want to add editable text annotations on the canvas, so that I can label or describe parts of the stitched image.

#### Acceptance Criteria

1. THE Annotation_Toolset SHALL provide a text tool button
2. WHEN the text tool is active and the user clicks on the Fabric_Canvas, THE Annotation_Toolset SHALL create an editable text box at the click position
3. THE Annotation_Toolset SHALL allow the user to modify the text color of a selected text box
4. THE Annotation_Toolset SHALL allow the user to modify the font size of a selected text box
5. WHEN the user double-clicks a text box, THE Annotation_Toolset SHALL enter inline editing mode for that text box

### Requirement 8: 形状工具

**User Story:** As a user, I want to draw rectangles and arrows on the canvas, so that I can highlight and point to specific areas.

#### Acceptance Criteria

1. THE Annotation_Toolset SHALL provide a shape tool with rectangle and arrow sub-options
2. WHEN the rectangle sub-option is active and the user click-drags on the Fabric_Canvas, THE Annotation_Toolset SHALL draw a hollow rectangle with a red stroke
3. THE Annotation_Toolset SHALL render rectangles with no fill and a visible red border for emphasis marking
4. WHEN the arrow sub-option is active and the user click-drags on the Fabric_Canvas, THE Annotation_Toolset SHALL draw an arrow line from the drag start point to the drag end point
5. THE Annotation_Toolset SHALL render arrows with an arrowhead indicator at the end point

### Requirement 9: 画笔工具

**User Story:** As a user, I want to free-draw on the canvas with adjustable brush settings, so that I can make freehand annotations.

#### Acceptance Criteria

1. THE Annotation_Toolset SHALL provide a brush tool button
2. WHEN the brush tool is active, THE Fabric_Canvas SHALL enter free drawing mode
3. THE Annotation_Toolset SHALL allow the user to adjust the brush stroke thickness
4. THE Annotation_Toolset SHALL allow the user to adjust the brush stroke color
5. WHEN the user draws on the Fabric_Canvas in free drawing mode, THE Annotation_Toolset SHALL render the stroke with the configured thickness and color

### Requirement 10: 撤销与重做

**User Story:** As a user, I want to undo and redo my actions, so that I can correct mistakes without starting over.

#### Acceptance Criteria

1. THE Image_Stitcher_Module SHALL provide Undo and Redo action buttons
2. WHEN the canvas state changes, THE Image_Stitcher_Module SHALL record a State_Snapshot of the Fabric_Canvas JSON serialization
3. WHEN the user clicks Undo, THE Image_Stitcher_Module SHALL restore the Fabric_Canvas to the previous State_Snapshot
4. WHEN the user clicks Redo, THE Image_Stitcher_Module SHALL restore the Fabric_Canvas to the next State_Snapshot in the history
5. IF no previous State_Snapshot exists, THEN THE Image_Stitcher_Module SHALL disable the Undo button
6. IF no next State_Snapshot exists, THEN THE Image_Stitcher_Module SHALL disable the Redo button

### Requirement 11: 高清 PNG 导出

**User Story:** As a user, I want to export the canvas as a high-resolution PNG image, so that I can save and share the final stitched and annotated result.

#### Acceptance Criteria

1. THE Image_Stitcher_Module SHALL provide an "导出 PNG" action button
2. WHEN the user clicks "导出 PNG", THE Image_Stitcher_Module SHALL export all elements on the Fabric_Canvas as a PNG image at the original stitch resolution
3. WHEN exporting, THE Image_Stitcher_Module SHALL render the PNG at the canvas logical dimensions regardless of the current viewport zoom level
4. WHEN exporting, THE Image_Stitcher_Module SHALL trigger a browser file download with the generated PNG file
5. THE exported PNG SHALL include all visible objects (images, text, shapes, brush strokes) in their current positions
