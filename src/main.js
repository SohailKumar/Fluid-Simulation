// Import required libraries
import * as THREE from 'three';
import * as tf from '@tensorflow/tfjs';

//DEBUG FLAG
const debug = false;

const initial_noise_flag = true

// texture updates every SIMINTRV * VISINTRV / 1000 seconds
// 1000 / SIMINTRV * VISINTRV  updates every second
let SIMULATION_INTERVAL = 100 //milliseconds. 10 iterations per second
let VISUALIZATION_INTERVAL = 2 // update texture every 5 iterations. 2 per second
// let VISUALIZATION_MODE = "vorticity"
let VISUALIZATION_MODE = "velocity"
let step = 0
// Simulation parameters
const Nx = 100; // resolution x-dir
const Ny = 100; // resolution y-dir
const rho0 = 100; // average density
const tau = 1.8; // collision timescale
const Nt = 1000; // number of timesteps. simulation will take Nt * SIM_INT / 1000 seconds

const randSeed = 123

// Lattice speeds and weights
const NL = 9;
// center, N, NE, E, SE, S, SW, W, NW
const cxs = [0, 0, 1, 1, 1, 0, -1, -1, -1];
const cys = [0, 1, 1, 0, -1, -1, -1, 0, 1];
const weights = [4 / 9, 1 / 9, 1 / 36, 1 / 9, 1 / 36, 1 / 9, 1 / 36, 1 / 9, 1 / 36];

// Initialize simulation variables
// console.log("inits:",ones.toString(), rand.toString())
let F = resetF()

function resetF() {
    return tf.tidy(() => { return tf.ones([Ny, Nx, NL]).add(tf.randomNormal([Ny, Nx, NL], 0, 0.01, 'float32', randSeed)) });
}

// create collisions
let objectMask = tf.zeros([Ny, Nx])
let objectMaskArr = objectMask.dataSync()
const grayValue = 128; // Gray level for R, G, B
const alphaValue = 255; // Full opacity

// initialize visualization array
let visualArr = Array.from({ length: Ny }, () => Array(Nx).fill(0));

// Define functions to get current render dimensions
function getRenderWidth() {

    return window.innerWidth / 2; // Adjust based on your needs
}

function getRenderHeight() {

    return window.innerHeight / 2; // Adjust based on your needs
}

function setCanvSizes() {
    canvContainer.style.width = getRenderHeight() + 'px'; // Set the width in pixels
    canvContainer.style.height = getRenderHeight() + 'px'; // Set the height in pixels
    simCanvas.height = getRenderHeight()
    simCanvas.width = getRenderHeight()
    UICanvas.height = getRenderHeight()
    UICanvas.width = getRenderHeight()
}


const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const resetButton = document.getElementById('resetButton');
const advanceButton = document.getElementById('advanceButton');
const addCircleButton = document.getElementById('addCircleButton');
let isAddingCircle = false;
let circleCenter = null;
let overlayCenter = null;
const instructionBox = document.getElementById('instructionBox');


const canvContainer = document.getElementById('canvasContainer')
const simCanvas = document.getElementById('fluidCanvas')
const UICanvas = document.getElementById('UICanvas')


const ctx = UICanvas.getContext('2d');
console.log(ctx)

let intervalId = -1

let isPaused = true;

startButton.addEventListener('click', () => {
    start()
});
function start() {
    isPaused = false;
    startButton.disabled = true
    pauseButton.disabled = false
    if (debug) console.log("paused", isPaused)
    simulate(Nt)
}

pauseButton.addEventListener('click', () => {
    pause()
});

function pause() {
    isPaused = true;
    clearInterval(intervalId)
    pauseButton.disabled = true
    startButton.disabled = false
}

resetButton.addEventListener('click', () => {
    reset()
});
function reset() {
    clearInterval(intervalId)
    step = 0
    isPaused = true
    pauseButton.disabled = true
    startButton.disabled = false
    F.dispose()
    objectMask.dispose()
    F = resetF()
    objectMask = tf.zeros([Ny, Nx])
    objectMaskArr = objectMask.arraySync()
    initialize_sim()
    renderer.render(scene, camera);
}

advanceButton.addEventListener('click', async () => {
    await advance()
});
async function advance() {
    const tempInt = VISUALIZATION_INTERVAL
    VISUALIZATION_INTERVAL = 1
    step += 1
    await updateSimulation(step);
    VISUALIZATION_INTERVAL = tempInt
}

addCircleButton.addEventListener('click', () => {
    addCircleMode()

});
function addCircleMode() {
    if (isAddingCircle) {
        UICanvas.removeEventListener('mousemove', circleOverlay)
        ctx.clearRect(0, 0, UICanvas.width, UICanvas.height);
    }
    isAddingCircle = !isAddingCircle;
    circleCenter = null;
    instructionBox.hidden = !instructionBox.hidden
    updateInstructions("Click in the simulation box to define the center of the circle.");
}

UICanvas.addEventListener('click', (event) => {
    drawCircle(event)
})
function drawCircle(event) {
    if (!isAddingCircle) return;

    const canvasRect = UICanvas.getBoundingClientRect();
    const mouseX = event.clientX - canvasRect.left;
    const mouseY = event.clientY - canvasRect.top;

    // Convert mouse coordinates to simulation coordinates
    const simX = Math.floor((mouseX / canvasRect.width) * Nx);
    const simY = Ny - Math.floor((mouseY / canvasRect.height) * Ny);

    if (!circleCenter) {
        // First click: define center
        circleCenter = { x: simX, y: simY };
        overlayCenter = { x: mouseX, y: mouseY };
        UICanvas.addEventListener('mousemove', circleOverlay)
        updateInstructions("Click again to set the radius.")
        console.log(`Circle center set at (${simX}, ${simY}). Click again to set the radius.`);
    } else {
        // Second click: define radius
        const dx = simX - circleCenter.x;
        const dy = simY - circleCenter.y;
        const radius = Math.sqrt(dx * dx + dy * dy);

        console.log(`Circle radius set to ${radius}. Adding circle to the mask.`);
        const cyl = createCylinderMask(circleCenter.x, circleCenter.y, radius);
        collisonAddObject(cyl)
        cyl.dispose()
        // Reset adding mode
        isAddingCircle = false;
        circleCenter = null;
        overlayCenter = null;
        instructionBox.hidden = true
        UICanvas.removeEventListener('mousemove', circleOverlay)
        ctx.clearRect(0, 0, UICanvas.width, UICanvas.height);
        visualize()
    }

}
// Function to update the instruction box
function updateInstructions(message) {
    instructionBox.textContent = message; // Update the text content
}

const circleOverlay = (event) => {
    if (!isAddingCircle) return;

    const canvasRect = UICanvas.getBoundingClientRect();
    const mouseX = event.clientX - canvasRect.left;
    const mouseY = event.clientY - canvasRect.top;

    // Convert mouse coordinates to simulation coordinates
    const simX = Math.floor((mouseX / canvasRect.width) * Nx);
    const simY = Ny - Math.floor((mouseY / canvasRect.height) * Ny);

    const dx = mouseX - overlayCenter.x;
    const dy = mouseY - overlayCenter.y;
    const radius = Math.sqrt(dx * dx + dy * dy);
    
    
    // Clear the canvas and draw the circle
    ctx.clearRect(0, 0, UICanvas.width, UICanvas.height);
    drawTranslucentCircle(overlayCenter.x, overlayCenter.y, radius);
}
function drawTranslucentCircle(x, y, radius) {
    // console.log(`Circle overlay set at (${x}, ${y}) with radius ${radius}. Click again to set the radius.`);
    ctx.fillStyle = 'rgba(128, 128, 128, 0.3)'; // Translucent blue fill
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.7)'; // Semi-translucent blue border
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();
}


// RENDERER INITIALIZATION

// Initialize Three.js Renderer
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

const renderer = new THREE.WebGLRenderer({ canvas: simCanvas });
renderer.setSize(getRenderHeight(), getRenderHeight());
UICanvas.width = renderer.width
UICanvas.height = renderer.height

renderer.setClearColor(0x808080)
// document.body.prepend(renderer.domElement);

// Add a plane for visualization
let textureData = new Uint8Array(Nx * Ny * 4); // RGBA
if (debug) console.log(textureData)
let texture = new THREE.DataTexture(textureData, Nx, Ny, THREE.RGBAFormat)
texture.needsUpdate = true
const planeGeometry = new THREE.PlaneGeometry(2, 2);
const planeMaterial = new THREE.MeshBasicMaterial({ map: texture });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
// scene.background = new THREE.Color(0x808080); // Set background to gray
scene.add(plane);
renderer.render(scene, camera);


// SIMULATION INITIALIZATION

function initialize_sim() {
    // create cylinder
    const cylinderMask = createCylinderMask(Nx / 4, Ny / 2, Ny / 6)

    collisonAddObject(cylinderMask)
    cylinderMask.dispose()
    // F
    if (debug) console.log("F before init: ", F.toString())
    // Assuming TensorFlow.js tensors and Nx, rho0, and idxs are predefined

    set_initial_conditions(initial_noise_flag)

    F = tf.tidy(() => {
        // Compute rho = sum(F, axis=2)
        // Compute rho and expand its dimensions
        const rho = F.sum(2).expandDims(2);

        // Scale all slices of F by rho0 / rho
        const temp = F.mul(rho0).div(rho); // Scale the entire tensor
        rho.dispose()
        return temp
    });


    if (debug) console.log("F init:", F.toString())
    const rho = tf.tidy(() => { return F.sum(2) });
    const ux = tf.tidy(() => { return F.mul(cxs).sum(2).div(rho) });
    const uy = tf.tidy(() => { return F.mul(cys).sum(2).div(rho) });
    if (debug) console.log(ux.toString(), uy.toString())
    if (VISUALIZATION_MODE === "velocity") {
        visualArr = getNormalizedVel(ux, uy)
        visualize()
    } else if (VISUALIZATION_MODE === "vorticity") {
        visualArr = getNormalizedVorticity(ux, uy)
        visualize()
    }

    tf.dispose([rho, ux, uy])
}

function set_initial_conditions(noiseFlag) {
    F = tf.tidy(() => {

        const noiseLevel = noiseFlag ? 0.5 : 0; // Scale of the random noise
        // console.log("noise: ", noiseLevel)
        const initialBoostMask = createCylinderMask(Nx / 2, Ny / 2 - 10, Ny / 20)

        // Create the base tensor
        const baseTensor = tf.tensor([0, -.25, 0, 0, 0, 0, 0, -.5, -1.5])
            .reshape([1, 1, 9])
            .tile([Ny, Nx, 1]);

        // Create a mask to isolate the 8th element (index 7)
        const mask = tf.tensor([0, 1, 0, 0, 0, 0, 0, 1, 1])
            .reshape([1, 1, 9])
            .tile([Ny, Nx, 1]);

        // Generate random noise for the 8th element
        const noise = tf.randomUniform([Ny, Nx, 9], -noiseLevel, noiseLevel)
            .mul(mask); // Apply the mask to restrict noise to the 8th element

        // Add the noise to the base tensor
        const leftwardBoost = baseTensor.add(noise);

        // console.log(leftwardBoost.toString())

        const tempF = F.add(leftwardBoost.where(initialBoostMask.expandDims(-1), tf.zerosLike(leftwardBoost)));
        // console.log(maskedBoost.toString())
        tf.dispose([baseTensor, mask, noise, leftwardBoost, initialBoostMask])

        return tempF
    });
    if (debug) console.log(F.toString())
}

function collisonAddObject(newObjectMask) {
    objectMask = tf.tidy(() => {
        return objectMask.add(newObjectMask).cast('bool')
    });
    objectMaskArr = objectMask.arraySync()
    if (debug) {
        console.log("New Object Mask: ", objectMaskArr)
    }
}

function createCylinderMask(centerX, centerY, radius) {

    // Create X and Y meshgrid
    const X = tf.tile(tf.range(0, Nx).reshape([1, Nx]), [Ny, 1]); // Repeat for rows
    const Y = tf.tile(tf.range(0, Ny).reshape([Ny, 1]), [1, Nx]); // Repeat for columns

    // Cylinder boundary condition
    const cylinder = tf.tidy(() => {
        const xOffset = X.sub(centerX); // X - Nx/4
        const yOffset = Y.sub(centerY); // Y - Ny/2
        const radiusSquared = tf.scalar(radius ** 2); // (Ny/4)^2
        const cyl = xOffset.square().add(yOffset.square()).less(radiusSquared); // Check boundary
        tf.dispose([xOffset, yOffset, radiusSquared])
        return cyl
    });

    // Print the result as boolean array (optional for debug)
    if (debug) cylinder.array().then(array => console.log("cylinder:", array));
    return cylinder
}


// SIMULATION

// Simulation main loop
function simulate(total_steps) {
    // console.log("F start:",F.toString())
    intervalId = setInterval(async () => {
        // if (!isPaused) {
        //     step += 1
        //     updateSimulation(step);
        // }
        step += 1
        updateSimulation(step);
        if (step === total_steps) {
            clearInterval(intervalId)
            isPaused = true
            pauseButton.disabled = true
            startButton.disabled = true
        }
    }, SIMULATION_INTERVAL); // Update every second
}

async function updateSimulation(step) {
    if (debug) console.log("vis_intrv", VISUALIZATION_INTERVAL)

    // Drift
    // Map and process all velocity components
    const shiftedF = cxs.map((cx, i) => {
        return tf.tidy(() => {
            let f = tf.gather(F, i, 2); // Slice a single component
            f = tfRoll(f, cx, 1); // Roll along the x-axis
            f = tfRoll(f, cys[i], 0); // Roll along the y-axis
            return f.expandDims(2); // Expand dimensions to retain shape
        })
    });
    F = tf.tidy(() => {
        // Concatenate along the last axis to combine all components
        return tf.concat(shiftedF, 2);
    });
    tf.dispose(shiftedF)

    // console.log("F post-drift:",F.toString())

    // reflective boundaries

    // Step 1: Extract boundary data using the cylinder mask

    const maskIndices = await tf.whereAsync(objectMask); // Get indices where mask is true
    if (debug) console.log(maskIndices.toString(), F.toString())
    // Step 2: Reorder the velocity directions
    const reorderedBndryF = tf.tidy(() => {
        const bndryF = tf.gatherND(F, maskIndices); // Extract rows corresponding to the mask
        // console.log(bndryF.toString())
        const reord = bndryF.gather([0, 5, 6, 7, 8, 1, 2, 3, 4], 1);
        bndryF.dispose()
        return reord
    });

    // Debugging: Print shape or values (optional)
    // reorderedBndryF.print();
    // Apply Collision
    F = tf.tidy(() => {
        return tf.tensorScatterUpdate(F, maskIndices, reorderedBndryF)
    });
    tf.dispose(reorderedBndryF)

    // Calculate fluid variables
    const rho = tf.tidy(() => { return F.sum(2) });
    const ux = tf.tidy(() => { return F.mul(cxs).sum(2).div(rho) });
    const uy = tf.tidy(() => { return F.mul(cys).sum(2).div(rho) });
    // console.log("Rho:",rho.toString())
    // console.log("uX: ", ux.shape, ux.toString())
    // console.log("uY: ", uy.shape, uy.toString())


    // Equilibrium
    const we = weights.map((w, i) => {
        // console.log(w, i)
        return tf.tidy(() => {
            const temp = rho.mul(tf.scalar(w))
            const cAdded = ux.mul(tf.scalar(cxs[i])).add(uy.mul(tf.scalar(cys[i])))
            const term0 = tf.scalar(1)
            const term1 = cAdded.mul(tf.scalar(3))
            const term2 = tf.scalar(9).mul(tf.pow(cAdded, 2)).div(tf.scalar(2))
            const term3 = tf.scalar(3).mul((ux.square().add(uy.square()))).div(tf.scalar(2))
            const tempops = term0.add(term1).add(term2).sub(term3)
            const final = temp.mul(tempops)
            tf.dispose([temp, cAdded, term0, term1, term2, term3, tempops])
            return final
        });
    });
    const Feq = tf.tidy(() => {
        // console.log("weights", we.toString());
        return tf.stack(we, 2);
    });
    tf.dispose(we)
    // console.log("feq", Feq.toString())
    // console.log("F precol:", F.toString())
    F = tf.tidy(() => { return F.add(F.sub(Feq).mul(-1.0 / tau)) });
    tf.dispose(Feq)
    if (debug) console.log("F postcol:", F.toString())

    if (debug) console.log("step vis_int:", step, VISUALIZATION_INTERVAL)
    // Visualization
    if (step % VISUALIZATION_INTERVAL === 0) {
        console.log("Visualizing step ", step)
        if (VISUALIZATION_MODE === "vorticity") {
            visualArr = getNormalizedVorticity(ux, uy)
            visualize()
        } else if (VISUALIZATION_MODE === "velocity") {
            visualArr = getNormalizedVel(ux, uy)
            visualize()

        }

    }

    tf.dispose([rho, ux, uy])
}


function tfRoll(tensor, shift, axis) {
    const size = tensor.shape[axis]; // Get the size along the specified axis
    const normalizedShift = ((shift % size) + size) % size; // Handle negative and large shifts

    if (normalizedShift === 0) {
        return tensor.clone(); // No need to roll if the shift is 0
    }

    const [start, end] = tf.tidy(() => {
        return [
            tf.slice(tensor, Array(axis).fill(0).concat([0]), Array(axis).fill(-1).concat([size - normalizedShift])),
            tf.slice(tensor, Array(axis).fill(0).concat([size - normalizedShift]), Array(axis).fill(-1).concat([normalizedShift])),
        ];

    })
    const rolled = tf.tidy(() => tf.concat([end, start], axis));
    tf.dispose([end, start])
    return rolled
}

function getNormalizedVorticity(ux, uy) {
    return tf.tidy(() => {
        const canceledUx = tf.zerosLike(ux).where(objectMask, ux)
        const canceledUy = tf.zerosLike(uy).where(objectMask, uy)
        const dxVy = tfRoll(canceledUx, -1, 0).sub(tfRoll(canceledUx, 1, 0))
        const dyVx = tfRoll(canceledUy, -1, 1).sub(tfRoll(canceledUy, 1, 1))
        const vorticity = dxVy.sub(dyVx)
        const temp = tf.fill(vorticity.shape, NaN).where(objectMask, vorticity)
        tf.dispose([canceledUx, canceledUy, dxVy, dyVx, vorticity])
        return temp;
    }).arraySync();
}

function getNormalizedVel(ux, uy) {

    // console.log("velocs: ", velocityMagnitude.toString())

    return tf.tidy(() => {
        const velocityMagnitude = ux.square().add(uy.square()).sqrt();
        const min = velocityMagnitude.min();
        const max = velocityMagnitude.max();
        // console.log(min.toString(), max.toString())
        const normed = tf.where(
            min.equal(max),
            tf.zerosLike(velocityMagnitude), // All zeros if min == max
            velocityMagnitude.sub(min).div(max.sub(min)) // Normalize
        );

        tf.dispose([min, max, velocityMagnitude])
        return normed
    }).arraySync()
}

// Visualization using THREE.js
function visualize() {
    // Convert to texture

    // console.log("visualization values:", visualArr)
    if (debug) console.log("objects", objectMaskArr)

    for (let y = 0; y < Ny; y++) {
        for (let x = 0; x < Nx; x++) {

            const idx = (y * Ny + x) * 4;
            if (!objectMaskArr[y][x]) {
                if (VISUALIZATION_MODE === "velocity") {
                    // velocity
                    const color = Math.floor(visualArr[y][x] * 255);
                    // console.log(color)
                    if (textureData[idx] !== color) { // Update only if value changed
                        textureData[idx] = color;
                        textureData[idx + 1] = color;
                        textureData[idx + 2] = 255; // diff shades of blue
                        textureData[idx + 3] = alphaValue;

                    }
                } else if (VISUALIZATION_MODE === "vorticity") {
                    // vorticity
                    const r = Math.min(1, visualArr[y][x] * 2);  // Red increases as vorticity increases
                    const b = Math.max(0, 1 - visualArr[y][x] * 2);  // Blue decreases as vorticity increases
                    // Convert to 0-255 range for RGB values
                    textureData[idx] = r * 255;   // Red channel
                    textureData[idx + 1] = 0;     // Green channel (fixed to 0)
                    textureData[idx + 2] = b * 255; // Blue channel

                }
            } else {
                textureData[idx] = grayValue;
                textureData[idx + 1] = grayValue;
                textureData[idx + 2] = grayValue; // diff shades of blue
                textureData[idx + 3] = alphaValue;
            }
        }
    }

    if (debug) console.log(textureData)

    texture.needsUpdate = true;
    renderer.render(scene, camera);
}

document.addEventListener('DOMContentLoaded', () => {
    setCanvSizes()
    // Start simulation
    initialize_sim()
});

// Resize handling
window.addEventListener('resize', () => {
    renderer.setSize(getRenderHeight(), getRenderHeight());
    setCanvSizes()
    renderer.render(scene, camera);
});