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

function setupColorControls(viewer) {
    // Create a color picker panel
    const colorPanel = document.createElement('div');
    colorPanel.id = 'color-controls';
    colorPanel.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 100;
        font-family: Arial, sans-serif;
    `;

    colorPanel.innerHTML = `
        <div style="margin-bottom: 10px;">
            <strong>Selection Color:</strong>
        </div>
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <button class="color-btn" data-color="0.2,0.8,0.3,0.6" style="background: rgba(51,204,76,0.6); width: 30px; height: 30px; border: 2px solid #ccc; border-radius: 4px; cursor: pointer;" title="Green"></button>
            <button class="color-btn" data-color="1,0,0,0.6" style="background: rgba(255,0,0,0.6); width: 30px; height: 30px; border: 2px solid #ccc; border-radius: 4px; cursor: pointer;" title="Red"></button>
            <button class="color-btn" data-color="0,0,1,0.6" style="background: rgba(0,0,255,0.6); width: 30px; height: 30px; border: 2px solid #ccc; border-radius: 4px; cursor: pointer;" title="Blue"></button>
            <button class="color-btn" data-color="1,1,0,0.6" style="background: rgba(255,255,0,0.6); width: 30px; height: 30px; border: 2px solid #ccc; border-radius: 4px; cursor: pointer;" title="Yellow"></button>
            <button class="color-btn" data-color="1,0.5,0,0.6" style="background: rgba(255,128,0,0.6); width: 30px; height: 30px; border: 2px solid #ccc; border-radius: 4px; cursor: pointer;" title="Orange"></button>
        </div>
        <div style="font-size: 12px; color: #666; margin-top: 10px;">
            <strong>Tip:</strong> Click elements to select/deselect
        </div>
    `;

    document.body.appendChild(colorPanel);

    // Add event listeners to color buttons
    const colorButtons = colorPanel.querySelectorAll('.color-btn');
    colorButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active state from all buttons
            colorButtons.forEach(b => b.style.border = '2px solid #ccc');
            // Add active state to clicked button
            btn.style.border = '2px solid #000';
            
            // Parse color values
            const [r, g, b, a] = btn.dataset.color.split(',').map(Number);
            
            // Update viewer's selection color
            if (viewer.selectionManager) {
                viewer.selectionManager.setOverlayColor(r, g, b, a);
                console.log(`Color changed to: RGB(${r}, ${g}, ${b}) Alpha: ${a}`);
            }
        });
    });

    // Set first button as active by default
    if (colorButtons.length > 0) {
        colorButtons[0].style.border = '2px solid #000';
    }
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

