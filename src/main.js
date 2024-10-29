import * as THREE from 'three';

// Define functions to get current render dimensions
function getRenderWidth() {
    return window.innerWidth / 2; // Adjust based on your needs
}

function getRenderHeight() {
    return window.innerHeight / 2; // Adjust based on your needs
}
console.log(getRenderWidth(), getRenderHeight());

// Set up scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, getRenderWidth() / getRenderHeight(), 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('fluidCanvas') });
renderer.setSize(getRenderWidth(), getRenderHeight());
document.body.prepend(renderer.domElement);

// Create grid dimensions
const rows = 20; // grid height
const cols = 40; // grid width
const marginFactor = .8;
const dotSize = 2;

// Function to create and scale the grid
function createGrid() {
    const geometry = new THREE.BufferGeometry(); // Create a new geometry for the points
    const positions = [];
    
    // Calculate spacing based on current render dimensions
    const spacingX = getRenderWidth() / cols;
    const spacingY = getRenderHeight() / rows;

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            // Calculate position of each point, centering the grid
            const x = j * spacingX - (cols * spacingX) / 2;
            const y = i * spacingY - (rows * spacingY) / 2;
            const z = 0; // Keep points in a flat plane

            // Push point position to the array
            positions.push(x, y, z);
        }
    }

    // Set the position attribute of the geometry
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    // Create material for points
    const material = new THREE.PointsMaterial({ 
        color: 0x0077ff,
        size: dotSize,
        sizeAttenuation: false
    });

    // Create the Points object
    const points = new THREE.Points(geometry, material);
    scene.add(points);
}

// Function to update camera position based on grid size
function updateCamera() {
    // Calculate the width and height of the grid based on spacing
    const gridWidth = getRenderWidth();
    const gridHeight = getRenderHeight();

    // Calculate the camera distance based on the grid dimensions and field of view
    const aspect = camera.aspect; // Aspect ratio
    const fovInRadians = THREE.MathUtils.degToRad(camera.fov);
    
    // Calculate the distance based on the height of the grid and field of view
    const cameraDistance = (gridHeight / 2) / Math.tan(fovInRadians / 2);
    
    // Set camera position and ensure it looks at the center of the grid
    camera.position.set(0, 0, cameraDistance);
    camera.lookAt(0, 0, 0);
}
// Initial grid creation and camera setup
createGrid();
updateCamera();

// Render loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();

// Resize handling
window.addEventListener('resize', () => {
    renderer.setSize(getRenderWidth(), getRenderHeight());
    
    // Update camera aspect ratio
    camera.aspect = getRenderWidth() / getRenderHeight();
    camera.updateProjectionMatrix();
    
    // Clear the current points from the scene
    scene.clear(); 

    // Recreate the grid with the new dimensions
    createGrid();
    
    // Update camera to follow the grid
    updateCamera();
});
