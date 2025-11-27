// SelectionManager.js
// Handles element selection and color overlay functionality for Autodesk Forge Viewer

export class SelectionManager {
constructor(viewer) {
this.viewer = viewer;
this.selectedElements = new Set();
this.originalColors = new Map();
this.selectionEnabled = false;
this.currentColor = new THREE.Vector4(0.2, 0.8, 0.3, 0.6); // Green with transparency
}

```
// Get all child elements recursively
getAllChildren(dbId) {
    return new Promise((resolve) => {
        const children = [];
        const model = this.viewer.model;
        
        if (!model) {
            resolve(children);
            return;
        }

        function traverse(id) {
            const tree = model.getInstanceTree();
            if (tree) {
                tree.enumNodeChildren(id, (childId) => {
                    children.push(childId);
                    traverse(childId);
                });
            }
        }
        
        traverse(dbId);
        resolve(children);
    });
}

// Apply color overlay to element and its children
async applyColorOverlay(dbId, color = null, includeChildren = true) {
    const model = this.viewer.model;
    
    if (!model) {
        console.error('Model not loaded');
        return;
    }

    const overlayColor = color || this.currentColor;

    // Store original color if not already stored
    if (!this.originalColors.has(dbId)) {
        this.storeOriginalColor(dbId);
    }

    // Apply color to main element
    this.viewer.setThemingColor(dbId, overlayColor);
    this.selectedElements.add(dbId);

    // Apply color to children if requested
    if (includeChildren) {
        const children = await this.getAllChildren(dbId);
        children.forEach(childId => {
            if (!this.originalColors.has(childId)) {
                this.storeOriginalColor(childId);
            }
            this.viewer.setThemingColor(childId, overlayColor);
            this.selectedElements.add(childId);
        });
        
        console.log(`Applied color overlay to element ${dbId} and ${children.length} children`);
    }
}

// Store original color for an element
storeOriginalColor(dbId) {
    const it = this.viewer.model.getInstanceTree();
    if (it) {
        it.enumNodeFragments(dbId, (fragId) => {
            const material = this.viewer.model.getFragmentList().getMaterial(fragId);
            if (material && !this.originalColors.has(dbId)) {
                this.originalColors.set(dbId, {
                    color: material.color.clone(),
                    opacity: material.opacity
                });
            }
        });
    }
}

// Remove color overlay
async removeColorOverlay(dbId, includeChildren = true) {
    const model = this.viewer.model;
    
    if (!model) {
        console.error('Model not loaded');
        return;
    }

    // Clear theming for main element
    this.viewer.clearThemingColors(dbId);
    this.selectedElements.delete(dbId);

    // Clear theming for children if requested
    if (includeChildren) {
        const children = await this.getAllChildren(dbId);
        children.forEach(childId => {
            this.viewer.clearThemingColors(childId);
            this.selectedElements.delete(childId);
        });
    }
}

// Clear all overlays
clearAllOverlays() {
    this.viewer.clearThemingColors();
    this.selectedElements.clear();
    this.originalColors.clear();
    console.log('All overlays cleared');
}

// Toggle selection on click
enableClickSelection(color = null) {
    if (this.selectionEnabled) return;
    
    this.selectionEnabled = true;
    const selectionColor = color || this.currentColor;

    this.viewer.addEventListener(Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, async (event) => {
        const selection = this.viewer.getSelection();
        
        if (selection.length > 0) {
            for (const dbId of selection) {
                if (this.selectedElements.has(dbId)) {
                    // If already selected, remove overlay
                    await this.removeColorOverlay(dbId, true);
                } else {
                    // Apply overlay with children
                    await this.applyColorOverlay(dbId, selectionColor, true);
                }
            }
        }
    });

    console.log('Click selection enabled');
}

// Disable click selection
disableClickSelection() {
    this.selectionEnabled = false;
    console.log('Click selection disabled');
}

// Change overlay color
setOverlayColor(r, g, b, alpha = 0.6) {
    this.currentColor = new THREE.Vector4(r, g, b, alpha);
}

// Get selected elements
getSelectedElements() {
    return Array.from(this.selectedElements);
}

// Setup UI controls in viewer toolbar
setupControls() {
    const toolbar = this.viewer.getToolbar(true);
    const controlGroup = new Autodesk.Viewing.UI.ControlGroup('selection-controls');

    // Button to clear all selections
    const clearButton = new Autodesk.Viewing.UI.Button('clear-selections');
    clearButton.setToolTip('Clear all color overlays');
    clearButton.setIcon('adsk-icon-clear');
    clearButton.onClick = () => {
        this.clearAllOverlays();
    };

    // Button to toggle selection info
    const infoButton = new Autodesk.Viewing.UI.Button('selection-info');
    infoButton.setToolTip('Show selected elements count');
    infoButton.setIcon('adsk-icon-info');
    infoButton.onClick = () => {
        const count = this.selectedElements.size;
        alert(`Currently selected elements: ${count}`);
        if (count > 0) {
            console.log('Selected element IDs:', this.getSelectedElements());
        }
    };

    controlGroup.addControl(clearButton);
    controlGroup.addControl(infoButton);
    toolbar.addControl(controlGroup);
}
```

}