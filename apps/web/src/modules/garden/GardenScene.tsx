import { useEffect, useRef } from "react";
import * as THREE from "three";

import { buildPlantBlueprint } from "@geoflora/rendering";
import type { PlantRecord } from "@geoflora/shared";

interface GardenSceneProps {
  plants: PlantRecord[];
}

export function GardenScene({ plants }: GardenSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0d221c");
    scene.fog = new THREE.Fog("#0d221c", 18, 100);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 220);
    camera.position.set(0, 8, 16);
    camera.lookAt(0, 2.5, 0);

    const hemi = new THREE.HemisphereLight("#f3f2e0", "#08221c", 1.4);
    const directional = new THREE.DirectionalLight("#ffe8b2", 1.1);
    directional.position.set(12, 18, 8);
    scene.add(hemi, directional);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(42, 48),
      new THREE.MeshStandardMaterial({
        color: "#163329",
        roughness: 0.92,
        metalness: 0.05
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    const groups: Array<{ group: THREE.Group; sway: number; seed: number }> = [];

    for (const plant of plants.slice(0, 80)) {
      const blueprint = buildPlantBlueprint(plant);
      const group = new THREE.Group();
      group.position.set(plant.worldOffset.x * 0.12, 0, plant.worldOffset.z * 0.12);

      for (const primitive of blueprint.primitives) {
        const geometry = createGeometry(primitive.kind);
        const material = new THREE.MeshStandardMaterial({
          color: primitive.color,
          transparent: primitive.opacity < 1,
          opacity: primitive.opacity,
          roughness: primitive.kind === "torus" ? 0.25 : 0.7,
          metalness: primitive.kind === "octahedron" ? 0.24 : 0.08,
          emissive: primitive.kind === "torus" ? new THREE.Color(primitive.color).multiplyScalar(0.16) : new THREE.Color("#000000")
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...primitive.position);
        mesh.rotation.set(...primitive.rotation);
        mesh.scale.set(...primitive.scale);
        group.add(mesh);
      }

      scene.add(group);
      groups.push({
        group,
        sway: blueprint.swayAmount,
        seed: plant.dna.patternSeed
      });
    }

    const resize = () => {
      const width = mount.clientWidth || 1;
      const height = mount.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const clock = new THREE.Clock();
    let frameId = 0;

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      groups.forEach(({ group, sway, seed }) => {
        group.rotation.z = Math.sin(elapsed * 0.5 + seed * 0.001) * sway * 0.8;
        group.rotation.x = Math.cos(elapsed * 0.3 + seed * 0.002) * sway * 0.18;
      });

      camera.position.x = Math.sin(elapsed * 0.12) * 2.2;
      camera.lookAt(0, 2.5, 0);
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => material.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      });
    };
  }, [plants]);

  return <div className="garden-scene" ref={mountRef} />;
}

function createGeometry(kind: "cylinder" | "cone" | "sphere" | "octahedron" | "torus") {
  switch (kind) {
    case "cylinder":
      return new THREE.CylinderGeometry(0.5, 1, 1, 8);
    case "cone":
      return new THREE.ConeGeometry(0.7, 1.4, 6);
    case "octahedron":
      return new THREE.OctahedronGeometry(0.8);
    case "torus":
      return new THREE.TorusGeometry(0.9, 0.18, 10, 28);
    case "sphere":
    default:
      return new THREE.SphereGeometry(0.7, 12, 12);
  }
}

