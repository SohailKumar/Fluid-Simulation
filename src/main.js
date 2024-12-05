// Import required libraries
import * as THREE from 'three';
import * as tf from '@tensorflow/tfjs';

//DEBUG FLAG
const debug = false;

// texture updates every SIMINTRV * VISINTRV / 1000 seconds
let SIMULATION_INTERVAL = 100 //milliseconds. 10 iterations per second
let VISUALIZATION_INTERVAL = 2 // update texture every 2 iterations. 5 per second
// let VISUALIZATION_MODE = "vorticity"
let VISUALIZATION_MODE = "velocity"
let step = 0
// Simulation parameters
const Nx = 100; // resolution x-dir
const Ny = 100; // resolution y-dir
const rho0 = 100; // average density
const tau = 1.1; // collision timescale
const Nt = 300; // number of timesteps. simulation will take Nt * SIM_INT / 1000 seconds

const randSeed = 123

// Lattice speeds and weights
const NL = 9;
// center, N, NE, E, SE, S, SW, W, NW
const cxs = [0, 0, 1, 1, 1, 0, -1, -1, -1];
const cys = [0, 1, 1, 0, -1, -1, -1, 0, 1];
const weights = [4 / 9, 1 / 9, 1 / 36, 1 / 9, 1 / 36, 1 / 9, 1 / 36, 1 / 9, 1 / 36];

// Initialize simulation variables
// console.log("inits:",ones.toString(), rand.toString())
let F = tf.tidy(() => {
    const ones = tf.ones([Ny, Nx, NL])
    const rand = tf.randomNormal([Ny, Nx, NL], 0, 0.01, 'float32', randSeed)
    return ones.add(rand)
});

// create collisions
let cylinderMask = tf.ones([Ny, Nx])
let cylinderMaskArr = cylinderMask.dataSync()
const grayValue = 128; // Gray level for R, G, B
const alphaValue = 255; // Full opacity

// Define functions to get current render dimensions
function getRenderWidth() {
    return window.innerWidth / 2; // Adjust based on your needs
}

function getRenderHeight() {
    return window.innerHeight / 2; // Adjust based on your needs
}


const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const resetButton = document.getElementById('resetButton');
const advanceButton = document.getElementById('advanceButton');
let intervalId = -1

let isPaused = true;

startButton.addEventListener('click', () => {
    isPaused = false;
    startButton.disabled = true
    pauseButton.disabled = false
    if (debug) console.log("paused", isPaused)
    simulate(Nt)
});

pauseButton.addEventListener('click', () => {
    isPaused = true;
    clearInterval(intervalId)
    pauseButton.disabled = true
    startButton.disabled = false

});

resetButton.addEventListener('click', () => {
    clearInterval(intervalId)
    step = 0
    isPaused = true
    pauseButton.disabled = true
    startButton.disabled = false
    F = tf.tidy(() => {
        const ones = tf.ones([Ny, Nx, NL])
        const rand = tf.randomNormal([Ny, Nx, NL], 0, 0.01, 'float32', randSeed)
        return ones.add(rand)
    });
    initialize_sim()
});

advanceButton.addEventListener('click', async () => {
    const tempInt = VISUALIZATION_INTERVAL
    VISUALIZATION_INTERVAL = 1
    step += 1
    await updateSimulation(step);
    VISUALIZATION_INTERVAL = tempInt
});

// Initialize Three.js Renderer
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('fluidCanvas') });
renderer.setSize(getRenderWidth(), getRenderHeight());
renderer.setClearColor(0x808080)
document.body.prepend(renderer.domElement);

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


// INITIALIZATION

function initialize_sim() {
    // create cylinder
    cylinderMask = createCylinderMask(Nx / 4, Ny / 2, Ny / 6)
    cylinderMaskArr = cylinderMask.arraySync()
    
    // F
    if (debug) console.log("F before init: ", F.toString())
    // Assuming TensorFlow.js tensors and Nx, rho0, and idxs are predefined
    F = tf.tidy(() => {

        const initialBoostMask = createCylinderMask(Nx / 2, Ny / 2, Ny / 20)
        F = tf.tidy(()=> {
            const leftwardBoost = tf.tensor([0, 0, 0, 0, 0, 0, 0, -1.5, 0]) // Boost for f3
                .reshape([1, 1, 9])
                .tile([Nx, Ny, 1]);
            // console.log(leftwardBoost.toString())

            const maskedBoost = leftwardBoost.where(initialBoostMask.expandDims(-1), tf.zerosLike(leftwardBoost));
            // console.log(maskedBoost.toString())
            return F.add(maskedBoost)
        });
        // Update F[:,:,3]
        // const X = tf.range(0, Nx)
        // const XScaled = tf.scalar((2 * Math.PI)).mul(X).div(tf.scalar(Nx)).mul(4); // Scale X
        // const cosineTerm = tf.cos(XScaled).mul(tf.scalar(0.2)).add(tf.scalar(1)); // 1 + 0.2 * cos(...)
        // const addition = cosineTerm.mul(2).expandDims(1); // 2 * (1 + 0.2 * cos(...))
        // if (debug) console.log("addition", addition.toString())
        // const updatedF = tf.add(tf.slice(F, [0, 0, 3], [-1, -1, 1]), addition);
        // if (debug) console.log(updatedF.toString())
        // F = tf.concat(
        //     [tf.slice(F, [0, 0, 0], [-1, -1, 3])
        //         , updatedF
        //         , tf.slice(F, [0, 0, 4], [-1, -1, -1])],
        //     2
        // );
        if (debug) console.log(F.toString())


        F = tf.tidy(() => {
            // Compute rho = sum(F, axis=2)
            // Compute rho and expand its dimensions
            const rho = F.sum(2).expandDims(2);

            // Scale all slices of F by rho0 / rho
            return F.mul(rho0).div(rho); // Scale the entire tensor
        });

        return F;
    });

    if (debug) console.log("F init:", F.toString())
    const rho = tf.tidy(() => { return F.sum(2) });
    const ux = tf.tidy(() => { return F.mul(cxs).sum(2).div(rho) });
    const uy = tf.tidy(() => { return F.mul(cys).sum(2).div(rho) });
    if (debug) console.log(ux.toString(), uy.toString())
    if (VISUALIZATION_MODE==="velocity"){
        const normalizedVelocity = getNormalizedVel(ux, uy)
        visualize(normalizedVelocity)
    } else if (VISUALIZATION_MODE==="vorticity"){
        const normVort = getNormalizedVorticity(ux,uy)
        visualize(normVort)
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
        return xOffset.square().add(yOffset.square()).less(radiusSquared); // Check boundary
    });

    // Print the result as boolean array (optional for debug)
    if (debug) cylinder.array().then(array => console.log(array));
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
    F = tf.tidy(() => {
        // Map and process all velocity components
        const shiftedF = cxs.map((cx, i) => {
            let f = tf.gather(F, i, 2); // Slice a single component
            f = tfRoll(f, cx, 1); // Roll along the x-axis
            f = tfRoll(f, cys[i], 0); // Roll along the y-axis
            return f.expandDims(2); // Expand dimensions to retain shape
        });


        // Concatenate along the last axis to combine all components
        return tf.concat(shiftedF, 2);
    });
    // console.log("F post-drift:",F.toString())

    // reflective boundaries

    // Step 1: Extract boundary data using the cylinder mask
    // console.log(cylinderMask.toString(), cylinderMask.shape, cylinderMask.dtype)
    const maskIndices = await tf.whereAsync(cylinderMask); // Get indices where mask is true
    console.log(maskIndices.toString())
    // Step 2: Reorder the velocity directions
    const reorderedBndryF = tf.tidy(() => {
        const bndryF = tf.tidy(() => {
            return tf.gatherND(F, maskIndices); // Extract rows corresponding to the mask
        });
        // console.log(bndryF.toString())
        return bndryF.gather([0, 5, 6, 7, 8, 1, 2, 3, 4], 1);
    });

    // Debugging: Print shape or values (optional)
    reorderedBndryF.print();

    // Calculate fluid variables
    const rho = tf.tidy(() => { return F.sum(2) });
    const ux = tf.tidy(() => { return F.mul(cxs).sum(2).div(rho) });
    const uy = tf.tidy(() => { return F.mul(cys).sum(2).div(rho) });
    // console.log("Rho:",rho.toString())
    // console.log("uX: ", ux.shape, ux.toString())
    // console.log("uY: ", uy.shape, uy.toString())

    // Apply Collision
    F = tf.tensorScatterUpdate(F, maskIndices, reorderedBndryF)

    // Equilibrium
    const Feq = tf.tidy(() => {
        const we = weights.map((w, i) => {
            // console.log(w, i)
            const temp = rho.mul(tf.scalar(w))
            const cAdded = ux.mul(tf.scalar(cxs[i])).add(uy.mul(tf.scalar(cys[i])))
            const term0 = tf.scalar(1)
            const term1 = cAdded.mul(tf.scalar(3))
            const term2 = tf.scalar(9).mul(tf.pow(cAdded, 2)).div(tf.scalar(2))
            const term3 = tf.scalar(3).mul((ux.square().add(uy.square()))).div(tf.scalar(2))
            const tempops = term0.add(term1).add(term2).sub(term3)
            return temp.mul(tempops)
        });
        // console.log("weights", we.toString());
        return tf.stack(
            we,
            2
        );
    });
    // console.log("feq", Feq.toString())
    // console.log("F precol:", F.toString())
    F = tf.tidy(() => { return F.add(F.sub(Feq).mul(-1.0 / tau)) });
    if (debug) console.log("F postcol:", F.toString())
    // Apply boundary conditions
    // F = tf.tidy(() => tf.where(tf.logicalNot(cylinder), F, boundaryF.expandDims(-1)));

    if (debug) console.log("step vis_int:", step, VISUALIZATION_INTERVAL)
    // Visualization
    if (step % VISUALIZATION_INTERVAL === 0) {
        console.log(step)
        if (VISUALIZATION_MODE==="vorticity"){
            const vorticity = getNormalizedVorticity(ux, uy)
            visualize(vorticity)
        } else if (VISUALIZATION_MODE==="velocity"){
            const normalizedVelocity = getNormalizedVel(ux, uy)
            visualize(normalizedVelocity)

        }
        
    }
}


function tfRoll(tensor, shift, axis) {
    const size = tensor.shape[axis]; // Get the size along the specified axis
    const normalizedShift = ((shift % size) + size) % size; // Handle negative and large shifts

    if (normalizedShift === 0) {
        return tensor.clone(); // No need to roll if the shift is 0
    }

    const [start, end] = [
        tf.slice(tensor, Array(axis).fill(0).concat([0]), Array(axis).fill(-1).concat([size - normalizedShift])),
        tf.slice(tensor, Array(axis).fill(0).concat([size - normalizedShift]), Array(axis).fill(-1).concat([normalizedShift])),
    ];

    return tf.concat([end, start], axis);
}

function getNormalizedVorticity(ux,uy) {

    // const velocityDirections = tf.stack([tf.tensor(cxs), tf.tensor(cys)], 1);  // Shape: [9, 2]

    // // Compute vx and vy using the D2Q9 directions
    // const vx = F.mul(velocityDirections.slice([0, 0], [9, 1]).squeeze())  // Multiply with x-components
    //     .sum(2).div(rho);  // Sum across the 3rd axis (axis = 2)

    // const vy = F.mul(velocityDirections.slice([0, 1], [9, 1]).squeeze())  // Multiply with y-components
    //     .sum(2).div(rho);  // Sum across the 3rd axis (axis = 2)
    // console.log(vx.shape, vy.shape)

    // const vorticity = tf.tidy(() => {
    //     // Calculate the finite differences (dvy/dx and dvx/dy) using slice with the correct size
    //     const dxVy = vy.slice([1, 0], [vx.shape[0] - 1, vy.shape[1] - 1])
    //         .sub(vy.slice([0, 0], [vx.shape[0] - 1, vy.shape[1] - 1]));  // dvy/dx
    //     const dyVx = vx.slice([0, 1], [vx.shape[0] - 1, vx.shape[1] - 1])
    //         .sub(vx.slice([0, 0], [vx.shape[0] - 1, vx.shape[1] - 1]));  // dvx/dy

    //     return dxVy.sub(dyVx)
    // });

    let canceledUx = tf.tidy(()=>{return tf.zerosLike(ux).where(cylinderMask, ux)})
    let canceledUy = tf.tidy(()=>{return tf.zerosLike(uy).where(cylinderMask, uy)})
    let vorticity = tf.tidy(()=>{
        const dxVy = tfRoll(canceledUx, -1, 0).sub(tfRoll(canceledUx, 1, 0))
        const dyVx = tfRoll(canceledUy, -1, 1).sub(tfRoll(canceledUy, 1, 1))
        return dxVy.sub(dyVx)
    })

    vorticity = tf.fill(vorticity.shape, NaN).where(cylinderMask, vorticity)
    console.log(vorticity.toString())
    // Normalize vorticity to range [0, 1]
    // const minVorticity = vorticity.min().dataSync();
    // const maxVorticity = vorticity.max().dataSync();
    // const normalizedVorticity = vorticity.sub(minVorticity).div(maxVorticity - minVorticity);
    // console.log(normalizedVorticity.toString())
    // return normalizedVorticity.arraySync();
    return vorticity.arraySync();
}

function getNormalizedVel(ux, uy) {
    const velocityMagnitude = tf.tidy(() => ux.square().add(uy.square()).sqrt());
    // console.log("velocs: ", velocityMagnitude.toString())
    const normalizedVelocity = tf.tidy(() => {
        const min = velocityMagnitude.min();
        const max = velocityMagnitude.max();
        // console.log(min.toString(), max.toString())
        return tf.where(
            min.equal(max),
            tf.zerosLike(velocityMagnitude), // All zeros if min == max
            velocityMagnitude.sub(min).div(max.sub(min)) // Normalize
        );
    });

    return normalizedVelocity.arraySync()
}

// Visualization using THREE.js
function visualize(visualArr) {
    // Convert to texture

    // console.log("visualization values:", visualArr)
    if (debug) console.log(cylinderMaskArr)

    for (let y = 0; y < Ny; y++) {
        for (let x = 0; x < Nx; x++) {

            const idx = (y * Ny + x) * 4;
            if (!cylinderMaskArr[y][x]) {
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
    // Start simulation
    initialize_sim()
});

// Resize handling
window.addEventListener('resize', () => {
    renderer.setSize(getRenderWidth(), getRenderHeight());
    renderer.render(scene, camera);
});