// Add this to your viewer initialization code (typically in wwwroot/viewer.js or similar)

let viewer;
let selectedElements = new Set();
let originalColors = new Map();

// Initialize viewer with selection enabled
function initializeViewer(container, urn) {
const options = {
env: ‘AutodeskProduction2’,
api: ‘streamingV2’,
getAccessToken: getForgeToken
};

```
Autodesk.Viewing.Initializer(options, () => {
    const config = {
        extensions: ['Autodesk.DocumentBrowser']
    };
    
    viewer = new Autodesk.Viewing.GuiViewer3D(container, config);
    viewer.start();

    const documentId = 'urn:' + urn;
    Autodesk.Viewing.Document.load(documentId, onDocumentLoadSuccess, onDocumentLoadFailure);
    
    // Add click event listener for element selection
    viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, onSelectionChanged);
});
```

}

function onDocumentLoadSuccess(doc) {
const viewables = doc.getRoot().getDefaultGeometry();
viewer.loadDocumentNode(doc, viewables);
}

function onDocumentLoadFailure(viewerErrorCode) {
console.error(‘onDocumentLoadFailure() - errorCode:’ + viewerErrorCode);
}

// Handle selection changes
function onSelectionChanged(event) {
const dbIds = event.dbIdArray;
if (dbIds.length > 0) {
console.log(‘Selected element IDs:’, dbIds);
}
}

// Get all child elements recursively
function getAllChildren(model, dbId, callback) {
const children = [];

```
function traverse(id) {
    const tree = model.getInstanceTree();
    tree.enumNodeChildren(id, (childId) => {
        children.push(childId);
        traverse(childId);
    });
}

traverse(dbId);
callback(children);
```

}

// Apply color overlay to element and its children
function applyColorOverlay(dbId, color = new THREE.Vector4(1, 0, 0, 0.5), includeChildren = true) {
const model = viewer.model;

```
if (!model) {
    console.error('Model not loaded');
    return;
}

// Store original color if not already stored
if (!originalColors.has(dbId)) {
    const it = viewer.model.getInstanceTree();
    it.enumNodeFragments(dbId, (fragId) => {
        const material = viewer.model.getFragmentList().getMaterial(fragId);
        if (material) {
            originalColors.set(dbId, {
                color: material.color.clone(),
                opacity: material.opacity
            });
        }
    });
}

// Apply color to main element
viewer.setThemingColor(dbId, color);
selectedElements.add(dbId);

// Apply color to children if requested
if (includeChildren) {
    getAllChildren(model, dbId, (children) => {
        children.forEach(childId => {
            // Store original colors for children
            if (!originalColors.has(childId)) {
                const it = viewer.model.getInstanceTree();
                it.enumNodeFragments(childId, (fragId) => {
                    const material = viewer.model.getFragmentList().getMaterial(fragId);
                    if (material) {
                        originalColors.set(childId, {
                            color: material.color.clone(),
                            opacity: material.opacity
                        });
                    }
                });
            }
            
            viewer.setThemingColor(childId, color);
            selectedElements.add(childId);
        });
        
        console.log(`Applied color overlay to element ${dbId} and ${children.length} children`);
    });
}
```

}

// Remove color overlay
function removeColorOverlay(dbId, includeChildren = true) {
const model = viewer.model;

```
if (!model) {
    console.error('Model not loaded');
    return;
}

// Clear theming for main element
viewer.clearThemingColors(dbId);
selectedElements.delete(dbId);

// Clear theming for children if requested
if (includeChildren) {
    getAllChildren(model, dbId, (children) => {
        children.forEach(childId => {
            viewer.clearThemingColors(childId);
            selectedElements.delete(childId);
        });
    });
}
```

}

// Clear all overlays
function clearAllOverlays() {
viewer.clearThemingColors();
selectedElements.clear();
originalColors.clear();
}

// Example: Select element on click and apply overlay
function enableClickSelection(color = new THREE.Vector4(0, 1, 0, 0.6)) {
viewer.addEventListener(Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, (event) => {
const selection = viewer.getSelection();

```
    if (selection.length > 0) {
        selection.forEach(dbId => {
            if (selectedElements.has(dbId)) {
                // If already selected, remove overlay
                removeColorOverlay(dbId, true);
            } else {
                // Apply overlay with children
                applyColorOverlay(dbId, color, true);
            }
        });
    }
});
```

}

// UI Control functions
function addSelectionControls() {
const toolbar = viewer.getToolbar(true);
const controlGroup = new Autodesk.Viewing.UI.ControlGroup(‘selection-controls’);

```
// Button to toggle selection mode
const selectButton = new Autodesk.Viewing.UI.Button('select-with-children');
selectButton.setToolTip('Select with children');
selectButton.setIcon('adsk-icon-select');
selectButton.onClick = () => {
    enableClickSelection(new THREE.Vector4(0, 0.8, 0.2, 0.5));
};

// Button to clear all selections
const clearButton = new Autodesk.Viewing.UI.Button('clear-selections');
clearButton.setToolTip('Clear all selections');
clearButton.setIcon('adsk-icon-clear');
clearButton.onClick = () => {
    clearAllOverlays();
};

controlGroup.addControl(selectButton);
controlGroup.addControl(clearButton);
toolbar.addControl(controlGroup);
```

}

// Call this after viewer is loaded
viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
addSelectionControls();
enableClickSelection();
});

// Export functions for external use
window.viewerControls = {
applyColorOverlay,
removeColorOverlay,
clearAllOverlays,
getSelectedElements: () => Array.from(selectedElements)
};