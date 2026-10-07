"use client";

import { useEffect, useRef, useState } from "react";

export default function StlViewer({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Loading model…");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      try {
        const THREE = await import("three");
        const { STLLoader } =
          await import("three/examples/jsm/loaders/STLLoader.js");
        const { OrbitControls } =
          await import("three/examples/jsm/controls/OrbitControls.js");
        const geometry = await new Promise<import("three").BufferGeometry>(
          (res, rej) => new STLLoader().load(url, res, undefined, rej),
        ).catch(() => null);
        if (disposed) return;
        if (!geometry) return setStatus("Couldn't load the model preview.");
        setStatus("");

        const w = el.clientWidth;
        const h = el.clientHeight;
        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
        });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        el.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000);
        geometry.computeVertexNormals();
        geometry.center();
        geometry.computeBoundingSphere();
        const r = geometry.boundingSphere?.radius ?? 1;
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({
            color: 0x4f8cff,
            metalness: 0.1,
            roughness: 0.6,
          }),
        );
        scene.add(mesh);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 1.6));
        const dir = new THREE.DirectionalLight(0xffffff, 1.4);
        dir.position.set(1, 2, 3);
        scene.add(dir);
        camera.position.set(r * 1.6, r * 1.2, r * 2.2);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        let raf = 0;
        const tick = () => {
          controls.update();
          renderer.render(scene, camera);
          raf = requestAnimationFrame(tick);
        };
        tick();
        cleanup = () => {
          cancelAnimationFrame(raf);
          controls.dispose();
          geometry.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch (err) {
        console.error(err);
        if (!disposed)
          setStatus(
            `Couldn't render the preview: ${err instanceof Error ? err.message : err}`,
          );
      }
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [url]);

  return (
    <div className="viewer">
      <div ref={ref} className="viewer-canvas" />
      {status ? <p className="muted viewer-status">{status}</p> : null}
    </div>
  );
}
