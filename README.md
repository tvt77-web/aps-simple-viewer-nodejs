# 📖 Step-by-Step Tutorial: APS Viewer Extension Development

## Complete Guide to Finding, Coloring, and Hiding Elements

This tutorial will teach you how to create an APS Viewer extension that can:

1. Find elements by their properties
1. Get all child DBIDs from the tree
1. Change element colors with overlays
1. Hide/show and make elements transparent

-----

## Table of Contents

1. [Part 1: Basic Extension Setup](#part-1-basic-extension-setup)
1. [Part 2: Finding Elements by Properties](#part-2-finding-elements-by-properties)
1. [Part 3: Getting Child DBIDs from Tree](#part-3-getting-child-dbids-from-tree)
1. [Part 4: Changing Element Colors](#part-4-changing-element-colors)
1. [Part 5: Hide/Show/Ghost Elements](#part-5-hideShowghost-elements)
1. [Part 6: Complete Working Example](#part-6-complete-working-example)

-----

## Part 1: Basic Extension Setup

### Step 1.1: Create Your Extension File

Create a new file called `MyUtilityExtension.js`:

```javascript
class MyUtilityExtension extends Autodesk.Viewing.Extension {
    constructor(viewer, options) {
        super(viewer, options);
        this.viewer = viewer;
    }

    load() {
        console.log('MyUtilityExtension loaded!');
        return true;
    }

    unload() {
        console.log('MyUtilityExtension unloaded');
        return true;
    }
}

// Register the extension
Autodesk.Viewing.theExtensionManager.registerExtension(
    'MyUtilityExtension',
    MyUtilityExtension
);
```

### Step 1.2: Load Your Extension

In your main HTML file, after the viewer is initialized:

```javascript
viewer.loadExtension('MyUtilityExtension');
```

**What this does:**

- Creates a new extension class that extends `Autodesk.Viewing.Extension`
- `load()` is called when extension loads
- `unload()` is called when extension unloads
- Extension is registered with a unique name

-----

## Part 2: Finding Elements by Properties

### Step 2.1: Understanding the Problem

You want to find all elements in the model that have specific property values. For example:

- Find all “Walls”
- Find all elements with “Fire Rating = 2 Hour”
- Find all “Windows” of a specific type

### Step 2.2: Get All Elements in the Model

First, we need to get all elements (leaf nodes) in the model:

```javascript
getAllLeafNodes(tree) {
    const leafIds = [];
    const rootId = tree.getRootId();
    
    tree.enumNodeChildren(rootId, (dbId) => {
        // Check if this node has no children (is a leaf)
        if (!tree.getChildCount(dbId)) {
            leafIds.push(dbId);
        }
    }, true); // true means recursive
    
    return leafIds;
}
```

**Add this to your extension class.**

**What this does:**

- Gets the root of the tree
- Recursively walks through all nodes
- Collects nodes that have no children (leaf nodes = actual elements)
- Returns array of all element DBIDs

### Step 2.3: Get Properties Efficiently

Use `getBulkProperties` to get properties for many elements at once:

```javascript
async getBulkProperties(dbIds, propertyNames) {
    return new Promise((resolve, reject) => {
        this.viewer.model.getBulkProperties(
            dbIds,
            { propFilter: propertyNames },
            resolve,
            reject
        );
    });
}
```

**Add this to your extension class.**

**What this does:**

- Wraps the callback-based API in a Promise (so we can use async/await)
- Gets properties for multiple elements in one call (much faster than looping)
- `propFilter` limits which properties we get (faster)

### Step 2.4: Find Elements by Property

Now combine the above to find elements:

```javascript
async findElementsByProperty(propertyName, propertyValue) {
    const model = this.viewer.model;
    const tree = model.getInstanceTree();
    
    // Step 1: Get all elements
    const leafIds = this.getAllLeafNodes(tree);
    console.log(`Searching ${leafIds.length} elements...`);
    
    // Step 2: Get their properties
    const results = await this.getBulkProperties(leafIds, [propertyName]);
    
    // Step 3: Filter matching elements
    const matchingIds = results
        .filter(result => {
            // Find the property we're looking for
            const prop = result.properties.find(p => 
                p.displayName === propertyName
            );
            // Check if it matches our value
            return prop && prop.displayValue === propertyValue;
        })
        .map(result => result.dbId);
    
    console.log(`Found ${matchingIds.length} elements with ${propertyName} = ${propertyValue}`);
    return matchingIds;
}
```

**Add this to your extension class.**

**How to use:**

```javascript
// Find all walls
const wallIds = await ext.findElementsByProperty('Category', 'Walls');

// Find all doors
const doorIds = await ext.findElementsByProperty('Category', 'Doors');

// Find by any property
const fireRatedIds = await ext.findElementsByProperty('Fire Rating', '2 Hour');
```

### Step 2.5: Find by Multiple Properties

Sometimes you need to match multiple criteria:

```javascript
async findElementsByMultipleProperties(criteria) {
    const model = this.viewer.model;
    const tree = model.getInstanceTree();
    
    // Get all elements
    const leafIds = this.getAllLeafNodes(tree);
    
    // Get all property names we need
    const propNames = Object.keys(criteria);
    
    // Get properties
    const results = await this.getBulkProperties(leafIds, propNames);
    
    // Filter by ALL criteria
    const matchingIds = results
        .filter(result => {
            // Check if ALL properties match
            return propNames.every(propName => {
                const prop = result.properties.find(p => 
                    p.displayName === propName
                );
                return prop && prop.displayValue === criteria[propName];
            });
        })
        .map(result => result.dbId);
    
    console.log(`Found ${matchingIds.length} matching elements`);
    return matchingIds;
}
```

**Add this to your extension class.**

**How to use:**

```javascript
// Find exterior walls with fire rating
const ids = await ext.findElementsByMultipleProperties({
    'Category': 'Walls',
    'Type': 'Exterior',
    'Fire Rating': '2 Hour'
});
```

-----

## Part 3: Getting Child DBIDs from Tree

### Step 3.1: Understanding the Tree Structure

The model has a hierarchy:

```
Building
├── Level 1
│   ├── Wall (parent)
│   │   ├── Wall Layer 1 (child)
│   │   ├── Wall Layer 2 (child)
│   │   └── Wall Core (child)
│   └── Door (parent)
│       ├── Door Frame (child)
│       └── Door Panel (child)
```

When you find a “Wall”, you need to also get all its layers to properly select/color it.

### Step 3.2: Get All Children Recursively

```javascript
getAllChildren(tree, parentId, resultSet) {
    tree.enumNodeChildren(parentId, (childId) => {
        // Add this child
        resultSet.add(childId);
        
        // Recursively get this child's children
        this.getAllChildren(tree, childId, resultSet);
    }, false); // false = not recursive (we handle it ourselves)
}
```

**Add this to your extension class.**

**What this does:**

- Takes a parent DBID
- Gets all its children
- Recursively gets children of children
- Stores all DBIDs in a Set (no duplicates)

### Step 3.3: Get All DBIDs (Parent + Children)

```javascript
getElementWithChildren(dbId) {
    const tree = this.viewer.model.getInstanceTree();
    const allIds = new Set();
    
    // Add the parent
    allIds.add(dbId);
    
    // Add all children
    this.getAllChildren(tree, dbId, allIds);
    
    return Array.from(allIds);
}
```

**Add this to your extension class.**

**How to use:**

```javascript
// Get a wall and all its layers
const wallId = 1234;
const allWallIds = ext.getElementWithChildren(wallId);
console.log(`Wall ${wallId} has ${allWallIds.length} parts`);
```

### Step 3.4: Update Find Methods to Include Children

Modify your `findElementsByProperty` method:

```javascript
async findElementsByProperty(propertyName, propertyValue) {
    const model = this.viewer.model;
    const tree = model.getInstanceTree();
    
    const leafIds = this.getAllLeafNodes(tree);
    const results = await this.getBulkProperties(leafIds, [propertyName]);
    
    const matchingIds = results
        .filter(result => {
            const prop = result.properties.find(p => p.displayName === propertyName);
            return prop && prop.displayValue === propertyValue;
        })
        .map(result => result.dbId);
    
    // NEW: Get all children for each matching element
    const allIds = new Set();
    for (const dbId of matchingIds) {
        allIds.add(dbId);
        this.getAllChildren(tree, dbId, allIds);
    }
    
    return Array.from(allIds);
}
```

**Now when you find elements, you automatically get all their children too!**

-----

## Part 4: Changing Element Colors

### Step 4.1: Understanding Color System

APS Viewer uses `THREE.Vector4` for colors:

- Format: `(red, green, blue, alpha)`
- Values: 0 to 1 (not 0 to 255!)
- Alpha: 1 = opaque, 0 = transparent

**Examples:**

```javascript
Red:    new THREE.Vector4(1, 0, 0, 1)
Green:  new THREE.Vector4(0, 1, 0, 1)
Blue:   new THREE.Vector4(0, 0, 1, 1)
Yellow: new THREE.Vector4(1, 1, 0, 1)
Orange: new THREE.Vector4(1, 0.5, 0, 1)
Purple: new THREE.Vector4(0.5, 0, 1, 1)
Semi-transparent Red: new THREE.Vector4(1, 0, 0, 0.5)
```

### Step 4.2: Apply Color to Elements

```javascript
colorElements(dbIds, red, green, blue, alpha = 1) {
    const color = new THREE.Vector4(red, green, blue, alpha);
    const model = this.viewer.model;
    
    // Apply color to each element
    dbIds.forEach(dbId => {
        this.viewer.setThemingColor(dbId, color, model);
    });
    
    // CRITICAL: Refresh the view
    this.viewer.impl.invalidate(true);
}
```

**Add this to your extension class.**

**What this does:**

- Creates a color vector
- Applies it to each element
- `setThemingColor` creates an overlay (doesn’t change the original model)
- `invalidate(true)` forces the viewer to redraw

**How to use:**

```javascript
// Color walls red
const wallIds = await ext.findElementsByProperty('Category', 'Walls');
ext.colorElements(wallIds, 1, 0, 0, 1); // Red
```

### Step 4.3: Helper Method for Hex Colors

Most people think in hex colors (#FF0000), so add a helper:

```javascript
hexToRgb(hex) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    
    return { r, g, b };
}

colorElementsByHex(dbIds, hexColor, alpha = 1) {
    const rgb = this.hexToRgb(hexColor);
    this.colorElements(dbIds, rgb.r, rgb.g, rgb.b, alpha);
}
```

**Add these to your extension class.**

**How to use:**

```javascript
// Color doors red using hex
ext.colorElementsByHex(doorIds, '#FF0000');

// Color walls blue with 50% transparency
ext.colorElementsByHex(wallIds, '#0000FF', 0.5);
```

### Step 4.4: Clear Colors

```javascript
clearColors(dbIds = null) {
    if (dbIds === null) {
        // Clear ALL colors
        this.viewer.clearThemingColors(this.viewer.model);
    } else {
        // Clear specific elements
        const model = this.viewer.model;
        dbIds.forEach(dbId => {
            this.viewer.clearThemingColors(model, dbId);
        });
    }
    
    // Refresh view
    this.viewer.impl.invalidate(true);
}
```

**Add this to your extension class.**

**How to use:**

```javascript
// Clear all colors
ext.clearColors();

// Clear specific elements
ext.clearColors(wallIds);
```

### Step 4.5: Common Color Presets

Add these helper methods for convenience:

```javascript
colorRed(dbIds) {
    this.colorElements(dbIds, 1, 0, 0, 1);
}

colorGreen(dbIds) {
    this.colorElements(dbIds, 0, 1, 0, 1);
}

colorBlue(dbIds) {
    this.colorElements(dbIds, 0, 0, 1, 1);
}

colorYellow(dbIds) {
    this.colorElements(dbIds, 1, 1, 0, 1);
}

colorOrange(dbIds) {
    this.colorElements(dbIds, 1, 0.5, 0, 1);
}

colorGray(dbIds) {
    this.colorElements(dbIds, 0.5, 0.5, 0.5, 1);
}
```

**How to use:**

```javascript
ext.colorRed(wallIds);
ext.colorGreen(doorIds);
```

-----

## Part 5: Hide/Show/Ghost Elements

### Step 5.1: Understanding Visibility Modes

The viewer has three visibility states:

1. **Visible** - Element is shown normally
1. **Hidden** - Element is completely invisible
1. **Ghosted** - Element is semi-transparent (like X-ray)

### Step 5.2: Hide Elements

```javascript
hideElements(dbIds) {
    // Make sure ghosting is OFF
    this.viewer.setGhosting(false);
    
    // Hide the elements
    this.viewer.hide(dbIds);
}
```

**Add this to your extension class.**

**How to use:**

```javascript
// Hide all walls
const wallIds = await ext.findElementsByProperty('Category', 'Walls');
ext.hideElements(wallIds);
```

### Step 5.3: Show Elements

```javascript
showElements(dbIds) {
    this.viewer.show(dbIds);
}

showAll() {
    this.viewer.setGhosting(false);
    this.viewer.showAll();
    this.viewer.isolate([]); // Clear any isolation
}
```

**Add these to your extension class.**

**How to use:**

```javascript
// Show specific elements
ext.showElements(wallIds);

// Show everything
ext.showAll();
```

### Step 5.4: Ghost (Make Transparent)

This is the tricky one! When ghosting is enabled, `hide()` makes elements transparent instead of invisible:

```javascript
ghostElements(dbIds, enable = true) {
    // Enable or disable ghosting mode
    this.viewer.setGhosting(enable);
    
    if (enable) {
        // In ghost mode, hide() makes transparent
        this.viewer.hide(dbIds);
    } else {
        // Turn off ghosting and show elements
        this.viewer.show(dbIds);
    }
}
```

**Add this to your extension class.**

**How it works:**

1. Call `setGhosting(true)` to enable ghost mode
1. Call `hide(dbIds)` - but in ghost mode, this makes elements transparent!
1. To un-ghost, call `setGhosting(false)` and `show(dbIds)`

**How to use:**

```javascript
// Make walls transparent
ext.ghostElements(wallIds, true);

// Make them solid again
ext.ghostElements(wallIds, false);
```

### Step 5.5: Isolate Elements

Show only specific elements (hide everything else):

```javascript
isolateElements(dbIds, fitToView = true) {
    this.viewer.setGhosting(false);
    this.viewer.isolate(dbIds);
    
    if (fitToView && dbIds.length > 0) {
        this.viewer.fitToView(dbIds);
    }
}
```

**Add this to your extension class.**

**How to use:**

```javascript
// Show only doors
const doorIds = await ext.findElementsByProperty('Category', 'Doors');
ext.isolateElements(doorIds);

// Show everything again
ext.showAll();
```

### Step 5.6: Toggle Visibility

```javascript
toggleVisibility(dbIds) {
    // Check if first element is visible
    const isVisible = this.viewer.isNodeVisible(dbIds[0]);
    
    if (isVisible) {
        this.hideElements(dbIds);
    } else {
        this.showElements(dbIds);
    }
    
    return !isVisible; // Return new state
}
```

**Add this to your extension class.**

**How to use:**

```javascript
// Toggle walls on/off
const newState = ext.toggleVisibility(wallIds);
console.log('Walls are now', newState ? 'visible' : 'hidden');
```

-----

## Part 6: Complete Working Example

### Step 6.1: Complete Extension Code

Here’s the complete extension with all features:

```javascript
class MyUtilityExtension extends Autodesk.Viewing.Extension {
    constructor(viewer, options) {
        super(viewer, options);
        this.viewer = viewer;
    }

    load() {
        console.log('MyUtilityExtension loaded!');
        return true;
    }

    // ============================================
    // FINDING ELEMENTS
    // ============================================
    
    getAllLeafNodes(tree) {
        const leafIds = [];
        const rootId = tree.getRootId();
        
        tree.enumNodeChildren(rootId, (dbId) => {
            if (!tree.getChildCount(dbId)) {
                leafIds.push(dbId);
            }
        }, true);
        
        return leafIds;
    }

    async getBulkProperties(dbIds, propertyNames) {
        return new Promise((resolve, reject) => {
            this.viewer.model.getBulkProperties(
                dbIds,
                { propFilter: propertyNames },
                resolve,
                reject
            );
        });
    }

    async findElementsByProperty(propertyName, propertyValue) {
        const model = this.viewer.model;
        const tree = model.getInstanceTree();
        
        const leafIds = this.getAllLeafNodes(tree);
        const results = await this.getBulkProperties(leafIds, [propertyName]);
        
        const matchingIds = results
            .filter(result => {
                const prop = result.properties.find(p => p.displayName === propertyName);
                return prop && prop.displayValue === propertyValue;
            })
            .map(result => result.dbId);
        
        // Get all children
        const allIds = new Set();
        for (const dbId of matchingIds) {
            allIds.add(dbId);
            this.getAllChildren(tree, dbId, allIds);
        }
        
        return Array.from(allIds);
    }

    async findElementsByMultipleProperties(criteria) {
        const model = this.viewer.model;
        const tree = model.getInstanceTree();
        
        const leafIds = this.getAllLeafNodes(tree);
        const propNames = Object.keys(criteria);
        const results = await this.getBulkProperties(leafIds, propNames);
        
        const matchingIds = results
            .filter(result => {
                return propNames.every(propName => {
                    const prop = result.properties.find(p => p.displayName === propName);
                    return prop && prop.displayValue === criteria[propName];
                });
            })
            .map(result => result.dbId);
        
        const allIds = new Set();
        for (const dbId of matchingIds) {
            allIds.add(dbId);
            this.getAllChildren(tree, dbId, allIds);
        }
        
        return Array.from(allIds);
    }

    // ============================================
    // GETTING CHILDREN
    // ============================================
    
    getAllChildren(tree, parentId, resultSet) {
        tree.enumNodeChildren(parentId, (childId) => {
            resultSet.add(childId);
            this.getAllChildren(tree, childId, resultSet);
        }, false);
    }

    getElementWithChildren(dbId) {
        const tree = this.viewer.model.getInstanceTree();
        const allIds = new Set();
        
        allIds.add(dbId);
        this.getAllChildren(tree, dbId, allIds);
        
        return Array.from(allIds);
    }

    // ============================================
    // COLORING ELEMENTS
    // ============================================
    
    colorElements(dbIds, red, green, blue, alpha = 1) {
        const color = new THREE.Vector4(red, green, blue, alpha);
        const model = this.viewer.model;
        
        dbIds.forEach(dbId => {
            this.viewer.setThemingColor(dbId, color, model);
        });
        
        this.viewer.impl.invalidate(true);
    }

    hexToRgb(hex) {
        hex = hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;
        return { r, g, b };
    }

    colorElementsByHex(dbIds, hexColor, alpha = 1) {
        const rgb = this.hexToRgb(hexColor);
        this.colorElements(dbIds, rgb.r, rgb.g, rgb.b, alpha);
    }

    clearColors(dbIds = null) {
        if (dbIds === null) {
            this.viewer.clearThemingColors(this.viewer.model);
        } else {
            const model = this.viewer.model;
            dbIds.forEach(dbId => {
                this.viewer.clearThemingColors(model, dbId);
            });
        }
        this.viewer.impl.invalidate(true);
    }

    // Color presets
    colorRed(dbIds) { this.colorElements(dbIds, 1, 0, 0, 1); }
    colorGreen(dbIds) { this.colorElements(dbIds, 0, 1, 0, 1); }
    colorBlue(dbIds) { this.colorElements(dbIds, 0, 0, 1, 1); }
    colorYellow(dbIds) { this.colorElements(dbIds, 1, 1, 0, 1); }
    colorOrange(dbIds) { this.colorElements(dbIds, 1, 0.5, 0, 1); }

    // ============================================
    // VISIBILITY CONTROL
    // ============================================
    
    hideElements(dbIds) {
        this.viewer.setGhosting(false);
        this.viewer.hide(dbIds);
    }

    showElements(dbIds) {
        this.viewer.show(dbIds);
    }

    showAll() {
        this.viewer.setGhosting(false);
        this.viewer.showAll();
        this.viewer.isolate([]);
    }

    ghostElements(dbIds, enable = true) {
        this.viewer.setGhosting(enable);
        if (enable) {
            this.viewer.hide(dbIds);
        } else {
            this.viewer.show(dbIds);
        }
    }

    isolateElements(dbIds, fitToView = true) {
        this.viewer.setGhosting(false);
        this.viewer.isolate(dbIds);
        
        if (fitToView && dbIds.length > 0) {
            this.viewer.fitToView(dbIds);
        }
    }

    toggleVisibility(dbIds) {
        const isVisible = this.viewer.isNodeVisible(dbIds[0]);
        if (isVisible) {
            this.hideElements(dbIds);
        } else {
            this.showElements(dbIds);
        }
        return !isVisible;
    }

    unload() {
        this.showAll();
        this.clearColors();
        console.log('MyUtilityExtension unloaded');
        return true;
    }
}

// Register extension
Autodesk.Viewing.theExtensionManager.registerExtension(
    'MyUtilityExtension',
    MyUtilityExtension
);
```

### Step 6.2: Real-World Usage Example

```javascript
// Load the extension
viewer.loadExtension('MyUtilityExtension').then(async (ext) => {
    
    console.log('=== Example 1: Find and Color Walls ===');
    const wallIds = await ext.findElementsByProperty('Category', 'Walls');
    console.log(`Found ${wallIds.length} wall elements`);
    ext.colorElementsByHex(wallIds, '#FF0000'); // Red walls
    
    await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
    
    console.log('=== Example 2: Find and Ghost Doors ===');
    const doorIds = await ext.findElementsByProperty('Category', 'Doors');
    console.log(`Found ${doorIds.length} door elements`);
    ext.colorElementsByHex(doorIds, '#00FF00'); // Green doors
    ext.ghostElements(doorIds); // Make transparent
    
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('=== Example 3: Find by Multiple Properties ===');
    const exteriorWalls = await ext.findElementsByMultipleProperties({
        'Category': 'Walls',
        'Type': 'Exterior'
    });
    console.log(`Found ${exteriorWalls.length} exterior walls`);
    ext.colorElementsByHex(exteriorWalls, '#0000FF'); // Blue
    
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('=== Example 4: Isolate Windows ===');
    const windowIds = await ext.findElementsByProperty('Category', 'Windows');
    ext.isolateElements(windowIds); // Show only windows
    
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('=== Example 5: Reset ===');
    ext.showAll();
    ext.clearColors();
    
    console.log('Demo complete!');
});
```

### Step 6.3: Interactive Example with Toolbar Button

Add a button to test your extension:

```javascript
class MyUtilityExtension extends Autodesk.Viewing.Extension {
    // ... (all previous code)

    load() {
        console.log('MyUtilityExtension loaded!');
        this.createToolbarButton();
        return true;
    }

    createToolbarButton() {
        // Create button
        this.button = new Autodesk.Viewing.UI.Button('color-walls-btn');
        this.button.setToolTip('Color Walls Red');
        this.button.setIcon('adsk-icon-properties');
        
        // Button click handler
        this.button.onClick = async () => {
            const wallIds = await this.findElementsByProperty('Category', 'Walls');
            this.colorRed(wallIds);
            console.log(`Colored ${wallIds.length} walls red`);
        };
        
        // Add to toolbar
        const toolbar = this.viewer.toolbar;
        let group = toolbar.getControl('my-tools-group');
        if (!group) {
            group = new Autodesk.Viewing.UI.ControlGroup('my-tools-group');
            toolbar.addControl(group);
        }
        group.addControl(this.button);
    }

    unload() {
        // Clean up button
        if (this.button) {
            const toolbar = this.viewer.toolbar;
            const group = toolbar.getControl('my-tools-group');
            if (group) {
                group.removeControl(this.button);
                if (group.getNumberOfControls() === 0) {
                    toolbar.removeControl(group);
                }
            }
        }
        
        this.showAll();
        this.clearColors();
        return true;
    }
}
```

-----

## Troubleshooting Common Issues

### Issue 1: Elements Not Found

**Problem:** `findElementsByProperty` returns empty array

**Solutions:**

1. Check property name spelling:
   
   ```javascript
   // Get properties of one element to see exact names
   viewer.getProperties(dbId, (props) => {
       console.log('Available properties:', props.properties);
   });
   ```
1. Property might be called something else:
- Try `'Category'` vs `'Revit Category'`
- Try `'Family'` vs `'Family Name'`

### Issue 2: Children Not Selected

**Problem:** Only parent highlights, not full element

**Solution:** Make sure you’re using the updated `findElementsByProperty` that includes children:

```javascript
// This should be in your code:
const allIds = new Set();
for (const dbId of matchingIds) {
    allIds.add(dbId);
    this.getAllChildren(tree, dbId, allIds);
}
return Array.from(allIds);
```

### Issue 3: Colors Not Showing

**Problem:** Called `colorElements` but nothing changed

**Solutions:**

1. Make sure you called `invalidate()`:
   
   ```javascript
   this.viewer.impl.invalidate(true);
   ```
1. RGB values must be 0-1, not 0-255:
   
   ```javascript
   // WRONG
   ext.colorElements(ids, 255, 0, 0, 1);
   
   // CORRECT
   ext.colorElements(ids, 1, 0, 0, 1);
   ```

### Issue 4: Ghost Mode Not Working

**Problem:** Elements disappear instead of becoming transparent

**Solution:** Must enable ghosting mode BEFORE hiding:

```javascript
// CORRECT ORDER
this.viewer.setGhosting(true);  // 1. Enable ghost mode
this.viewer.hide(dbIds);         // 2. Hide makes transparent

// WRONG ORDER
this.viewer.hide(dbIds);         // Elements disappear!
this.viewer.setGhosting(true);   // Too late!
```

### Issue 5: Model Not Loaded

**Problem:** Extension loads but methods fail with “Cannot read property of undefined”

**Solution:** Make sure model is loaded before calling methods:

```javascript
viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
    viewer.loadExtension('MyUtilityExtension').then(ext => {
        // Now safe to use extension methods
    });
});
```

-----

## Performance Tips

### Tip 1: Cache Search Results

If you’re searching for the same thing multiple times:

```javascript
constructor(viewer, options) {
    super(viewer, options);
    this.viewer = viewer;
    this.searchCache = new Map(); // Add cache
}

async findElementsByProperty(propertyName, propertyValue, useCache = true) {
    const cacheKey = `${propertyName}:${propertyValue}`;
    
    // Check cache
    if (useCache && this.searchCache.has(cacheKey)) {
        console.log('Returning cached result');
        return this.searchCache.get(cacheKey);
    }
    
    // ... do the search ...
    
    // Store in cache
    if (useCache) {
        this.searchCache.set(cacheKey, allIds);
    }
    
    return allIds;
}
```

### Tip 2: Batch Operations

Don’t color elements one at a time:

```javascript
// BAD - Slow
for (const id of wallIds) {
    ext.colorElements([id], 1, 0, 0, 1);
}

// GOOD - Fast
ext.colorElements(wallIds, 1, 0, 0, 1);
```

### Tip 3: Limit Properties

Only request properties you need:

```javascript
// BAD - Gets ALL properties
const results = await this.getBulkProperties(dbIds);

// GOOD - Gets only what you need
const results = await this.getBulkProperties(dbIds, ['Category', 'Family']);
```

-----

## Summary

You’ve learned how to:

✅ **Find elements by properties**

- Use `getBulkProperties` for efficiency
- Filter by single or multiple properties
- Search any property in the model

✅ **Get all child DBIDs**

- Understand tree hierarchy
- Recursively traverse children
- Include all parts of an element

✅ **Change element colors**

- Use THREE.Vector4 for colors
- Apply color overlays
- Use hex colors for convenience
- Clear colors when done

✅ **Control visibility**

- Hide elements completely
- Show hidden elements
- Make elements transparent (ghost)
- Isolate specific elements

This extension is production-ready and covers all your user story requirements!

-----

## Next Steps

1. Copy the complete extension code
1. Save as `MyUtilityExtension.js`
1. Include in your HTML
1. Load with `viewer.loadExtension('MyUtilityExtension')`
1. Start using the methods!

**Need help?** Re-read the relevant section above. Each part is explained step-by-step!