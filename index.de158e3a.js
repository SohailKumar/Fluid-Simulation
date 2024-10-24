// import * as THREE from 'three';
// Set up scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById("fluidCanvas")
});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
// Sample geometry for now (you can later replace with fluid sim logic)
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);
// Move camera and animate cube as placeholder
camera.position.z = 5;
function animate() {
    requestAnimationFrame(animate);
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    renderer.render(scene, camera);
}
animate();
// Resize handling
window.addEventListener("resize", ()=>{
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

//# sourceMappingURL=index.de158e3a.js.map
