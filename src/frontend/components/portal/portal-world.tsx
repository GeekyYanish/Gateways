"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Clone, Preload, useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { useTheme } from "@/frontend/lib/theme/use-theme";

const PORTAL_MODEL = "/art/portal/nice-portal.glb";
const MINECRAFT_WORLD_MODEL = "/art/portal/minecraft.glb";

/**
 * The standing stones flanking the gate.
 *
 * NOT the raw 16 MB source in `assets/`. That file is 213,188 triangles of
 * uncompressed float32 geometry; it ships through gltf-transform first:
 *
 *   npx --yes @gltf-transform/cli optimize \
 *     assets/pillar_175_height.glb public/art/portal/pillar.glb \
 *     --simplify false --compress meshopt --texture-compress webp
 *
 * 16.75 MB → 3.08 MB. `meshopt` rather than `draco`, which compresses further
 * but whose decoder drei only wires from a gstatic CDN — meshopt's comes from
 * the bundled `three-stdlib` and `useGLTF` enables it with no configuration.
 *
 * `--simplify false` is a finding, not an oversight. The mesh is chunked at the
 * 16-bit index limit, so almost every edge is a locked border and meshoptimizer
 * collapses 1–5% at any tolerance from 0.001 to 0.05. Decimating this asset
 * properly needs a DCC tool, not a CLI pass. The triangle count therefore stands
 * — see the note on PILLARS below for why that is survivable.
 */
const PILLAR_MODEL = "/art/portal/pillar.glb";

/**
 * Where the four stones stand, and how tall each one is in world units.
 *
 * These are the sites the realm crystals used to occupy, keeping their
 * near-tall / far-short depth cue: the two nearest the camera read as the
 * gate's own posts, the pair behind them set the scale of the valley.
 *
 * FOUR is the whole budget. Each is ~213k triangles sharing one geometry (see
 * `Clone` below), so this is ~850k triangles submitted across four draw calls.
 * That is heavy but fine on a real GPU; the 4fps figure in VOXEL-3D.md was
 * SwiftShader, a software rasterizer, and this route is already a deliberate 3D
 * showpiece. Adding a fifth is not free — measure before you do.
 */
const PILLARS = [
  // Exact mirrored pairs. The previous left values were closer in depth and
  // taller than their right equivalents, which made their silhouettes stack.
  { x: -7.0, z: -2.8, height: 3.2, rotation: -1.3 },
  { x: 7.0, z: -2.8, height: 3.2, rotation: 1.3 },
  { x: -9.0, z: -5.2, height: 2.4, rotation: -3.9 },
  { x: 9.0, z: -5.2, height: 2.4, rotation: 3.9 },
] as const;


/**
 * Height of the IMPLIED ground at a grid cell.
 *
 * Nothing draws this any more — the procedural terrain it used to describe was
 * removed once the backdrop image supplied its own ground. It survives purely
 * as the placement curve for props: it keeps the four pillars at slightly
 * different heights, rising toward the back, instead of a flat row.
 */
function terrainHeightAt(x: number, z: number): number {
  const edge = Math.max(0, Math.abs(x) - 5) * 0.34;
  const ridge = Math.max(0, -z - 3) * 0.11;
  const variation =
    Math.sin(x * 1.37 + z * 0.81) * 0.28 +
    Math.cos(x * 0.52 - z * 1.19) * 0.2;
  return Math.max(0.3, 0.75 + edge + ridge + variation);
}

/**
 * The y a thing must sit at to stand ON the ground here, rather than in it.
 *
 * `-1.55` is the offset the old terrain composed its columns with, kept so the
 * curve still lines up with where that ground used to be — and therefore with
 * the ruin platform, which was positioned against it. Cells were unit-wide and
 * centred on integers, hence the rounding.
 *
 * Placing props by hand instead did not work: the curve rises 0.34 per unit
 * past |x| = 5 with a sine variation on top, so eyeballed values buried the far
 * pillars to their capitals while the near ones floated.
 */
function groundLevelAt(x: number, z: number): number {
  return terrainHeightAt(Math.round(x), Math.round(z)) - 1.55;
}

/**
 * The supplied Minecraft world is the environmental backdrop, not another
 * foreground prop. It sits beyond the portal ruin and fills the horizon while
 * the existing terrain remains the playable-looking approach to the gate.
 *
 * Its source dimensions are intentionally not baked into the placement. The
 * measured offset keeps the world centred and planted on its own lowest point,
 * so a re-export of the GLB will not suddenly move the landscape off-screen.
 */
function MinecraftBackdrop() {
  const { scene } = useGLTF(MINECRAFT_WORLD_MODEL);
  const group = useRef<THREE.Group>(null);

  const { offset, scale } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const centre = new THREE.Vector3();
    box.getCenter(centre);
    const span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);

    return {
      offset: new THREE.Vector3(-centre.x, -box.min.y, -centre.z),
      // Forty world units places the model's front edge at the pillar line. It
      // fills the frame without advancing past the portal into the UI layer.
      scale: 40 / span,
    };
  }, [scene]);

  useEffect(() => {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = false;
      object.receiveShadow = false;

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      materials.forEach((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return;
        [material.map, material.emissiveMap, material.alphaMap].forEach(
          (texture) => {
            if (!texture) return;
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestMipmapNearestFilter;
            texture.needsUpdate = true;
          },
        );
      });
    });
  }, [scene]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const mobile = state.size.width < 700;
    group.current.position.x = THREE.MathUtils.damp(
      group.current.position.x,
      state.pointer.x * (mobile ? -0.18 : -0.5),
      2.4,
      delta,
    );
    group.current.rotation.y = THREE.MathUtils.damp(
      group.current.rotation.y,
      state.pointer.x * 0.018,
      2.4,
      delta,
    );
  });

  return (
    <group ref={group} position={[0, -1.58, -22.5]}>
      <group scale={scale} rotation-y={-0.08}>
        <group position={offset}>
          <primitive object={scene} />
        </group>
      </group>
    </group>
  );
}

function PortalRelic({ energized }: { energized: boolean }) {
  const model = useGLTF(PORTAL_MODEL);
  const group = useRef<THREE.Group>(null);
  const portalMaterials = useRef<THREE.MeshStandardMaterial[]>([]);

  useEffect(() => {
    const materials: THREE.MeshStandardMaterial[] = [];

    model.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;

      const list = Array.isArray(object.material)
        ? object.material
        : [object.material];

      list.forEach((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return;

        const textures = [
          material.map,
          material.emissiveMap,
          material.alphaMap,
          material.normalMap,
        ];
        textures.forEach((texture) => {
          if (!texture) return;
          texture.magFilter = THREE.NearestFilter;
          texture.minFilter = THREE.NearestMipmapNearestFilter;
          texture.needsUpdate = true;
        });

        if (/portal|beacon/i.test(material.name)) {
          materials.push(material);
          material.transparent = true;
        }
      });
    });

    portalMaterials.current = materials;
  }, [model.scene]);

  useFrame((state, delta) => {
    const pulse = (Math.sin(state.clock.elapsedTime * 2.1) + 1) * 0.5;
    const target = energized ? 3.8 : 2.25;

    portalMaterials.current.forEach((material) => {
      material.emissiveIntensity = THREE.MathUtils.damp(
        material.emissiveIntensity,
        target + pulse * 0.75,
        6,
        delta,
      );
    });

    if (group.current) {
      group.current.position.y =
        -0.58 + Math.sin(state.clock.elapsedTime * 0.78) * 0.025;
      group.current.rotation.y = THREE.MathUtils.damp(
        group.current.rotation.y,
        state.pointer.x * 0.055,
        4,
        delta,
      );
    }
  });

  return (
    <group
      ref={group}
      position={[-3.73, -0.58, -1.28]}
      scale={4.18}
    >
      <primitive object={model.scene} />
    </group>
  );
}

function PortalMotes({ energized }: { energized: boolean }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const values = new Float32Array(150 * 3);

    for (let i = 0; i < 150; i += 1) {
      const angle = i * 2.399963;
      const radius = 0.8 + ((i * 47) % 100) / 38;
      values[i * 3] = Math.cos(angle) * radius;
      values[i * 3 + 1] = ((i * 71) % 100) / 18 - 0.7;
      values[i * 3 + 2] = Math.sin(angle) * radius * 0.45 - 0.35;
    }

    return values;
  }, []);

  useFrame((state, delta) => {
    if (!points.current) return;
    points.current.rotation.y += delta * (energized ? 0.23 : 0.11);
    points.current.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.08;
    const material = points.current.material as THREE.PointsMaterial;
    material.opacity = THREE.MathUtils.damp(
      material.opacity,
      energized ? 0.95 : 0.66,
      5,
      delta,
    );
  });

  return (
    <points ref={points} position={[0, 1.25, 0.2]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#cf7cff"
        size={0.065}
        sizeAttenuation
        transparent
        opacity={0.7}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function RealmPillars() {
  const { scene } = useGLTF(PILLAR_MODEL);

  // Same nearest-neighbour filtering PortalRelic applies, for the same reason:
  // smooth-sampled stone beside a pixel-art ruin reads as a different game.
  useEffect(() => {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const list = Array.isArray(object.material)
        ? object.material
        : [object.material];

      list.forEach((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return;
        [material.map, material.normalMap, material.roughnessMap].forEach(
          (texture) => {
            if (!texture) return;
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestMipmapNearestFilter;
            texture.needsUpdate = true;
          },
        );
      });
    });
  }, [scene]);

  /**
   * Ground the model and centre it on its own footprint, MEASURED rather than
   * hardcoded.
   *
   * The source art is a Sketchfab export: Z-up, origin nowhere near the base,
   * and `gltf-transform optimize` flattens the scene graph and quantizes
   * positions, which moves all of that again. Hand-copied offsets would be
   * numbers from one export of one file, silently wrong after the next.
   * A Box3 asks the geometry where it actually is.
   */
  const { offset, modelHeight } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const centre = new THREE.Vector3();
    box.getCenter(centre);
    return {
      // Centre on X/Z, but plant the BASE on Y — a pillar is placed by where it
      // meets the ground, not by its middle.
      offset: new THREE.Vector3(-centre.x, -box.min.y, -centre.z),
      modelHeight: box.max.y - box.min.y,
    };
  }, [scene]);

  return (
    <>
      {PILLARS.map((pillar) => (
        <group
          key={`${pillar.x}-${pillar.z}`}
          // Both sides sample the same positive-X ground profile so their
          // mirrored pair also shares an exact baseline.
          position={[
            pillar.x,
            groundLevelAt(Math.abs(pillar.x), pillar.z),
            pillar.z,
          ]}
        >
          {/* Scale lives on an inner group so it cannot reach the light below —
              three.js scales a pointLight's `distance` with its parent, and at
              the ~0.03 scale these run at, the falloff would collapse to
              nothing and the stones would go unlit. */}
          <group
            scale={pillar.height / modelHeight}
            // Mirrored rotations expose corresponding faces on each side.
            rotation-y={pillar.rotation}
          >
            <group position={offset}>
              {/* Clone, NOT <primitive object={scene}>. A primitive REPARENTS
                  the object it is given, so four of them would move the single
                  loaded scene around and leave one pillar standing. Clone spawns
                  four objects sharing one geometry and one material. */}
              <Clone object={scene} castShadow receiveShadow />
            </group>
          </group>

          {/* The crystals' lights, kept. They are four of the scene's six
              sources, and dropping them flattens the whole ruin. Raised to a
              third of the pillar's height so the stone is lit from partway up
              like a brazier rather than glowing off the floor. */}
          <pointLight
            position={[0, pillar.height * 0.38, 0]}
            color={Math.abs(pillar.x) < 8 ? "#54e8df" : "#d474ff"}
            intensity={2.3}
            distance={4.5}
          />
        </group>
      ))}
    </>
  );
}


function CameraRig({ energized }: { energized: boolean }) {
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const { camera } = state;
    const mobile = state.size.width < 700;
    const baseZ = mobile ? 14.6 : 12.4;
    const baseY = mobile ? 4.15 : 3.85;
    const energyPush = energized ? -0.45 : 0;

    camera.position.x = THREE.MathUtils.damp(
      camera.position.x,
      state.pointer.x * (mobile ? 0.35 : 0.9),
      3.2,
      delta,
    );
    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      baseY - state.pointer.y * 0.32,
      3.2,
      delta,
    );
    camera.position.z = THREE.MathUtils.damp(
      camera.position.z,
      baseZ + energyPush,
      3.2,
      delta,
    );

    target.set(state.pointer.x * 0.18, mobile ? 1.05 : 1.25, -0.35);
    camera.lookAt(target);
  });

  return null;
}

/**
 * THE BACKDROP PALETTE — everything behind the ruin, per theme.
 *
 * The sky and lighting palette surrounding the supplied Minecraft world.
 *
 *   dark  — a sakura garden at night: deep indigo sky under a crescent moon,
 *           blossom and lantern warmth on the ground, hills gone violet.
 *   light — flat vector daylight: vivid sky blue, bright grass, and distant
 *           peaks hazed toward the sky the way real distance behaves.
 *
 * `sky` is used for BOTH background and fog, and they must never diverge — a
 * shared value is what makes far geometry dissolve into the horizon instead of
 * stopping at a visible edge. It is themed at all because the canvas is opaque
 * (`alpha: false`) and covers the frame, so CSS behind it can never show.
 *
 * Nothing here touches the ruin, the portal or the pillars. Those are the
 * subject; this is the room they stand in.
 *
 * KNOWN ISSUE — the light theme's GROUND renders far darker than these values
 * suggest, closer to a blue-grey slate than the vivid green below. The sky,
 * fog, distant hills and lighting all read correctly; it is only the instanced
 * terrain. Confirmed by pixel-sampling the render, and confirmed NOT to be:
 * the palette (a forced magenta did not appear either), effect ordering (the
 * console logs the light values), terrain self-shadowing, shadow-camera
 * clipping, or ambient/hemisphere intensity — none of which moved it.
 * Remaining suspects are the renderer's ACES tone mapping crushing saturated
 * mid-tones, or the fog reaching further than its near-plane implies. Worth an
 * hour with the three.js inspector rather than more guessing.
 */
const SCENE = {
  dark: {
    /**
     * The CSS gradient is the open sky. This is the colour distant geometry
     * fogs toward so the GLB world dissolves into it instead of ending abruptly.
     */
    sky: "#1c1636",
    /**
     * Where fog starts and finishes swallowing the ground.
     *
     * Tight at night — the murk IS the mood, and it hides the far terrain the
     * way the reference's darkness does. Daylight has to push it much further
     * out or the fog washes the grass to flat sky-blue before it ever reaches
     * the camera: the terrain sits 12+ units away and the old shared near-plane
     * of 11 fogged essentially all of it.
     */
    fog: [25, 58],
    ambient: "#a189cc",
    /**
     * How much light reaches surfaces the sun never touches.
     *
     * Night wants deep shadow, so this stays low and the terrain's unlit faces
     * go almost black — that is the murk. Daylight cannot: with a 2.6-intensity
     * sun and this much ambient, every step of the terrain that faces away from
     * it renders near-black, which is what the fog used to be hiding. Pull the
     * fog back to show the grass and the shadows are suddenly the problem, so
     * the two move together.
     */
    ambientIntensity: 0.68,
    hemiSky: "#9b7fc8",
    hemiGround: "#1d1428",
    hemiIntensity: 0.9,
    sun: "#d5d9ff",
    sunIntensity: 1.8,
    terrain: {
      top: {
        grass: "#4f7d32",
        rock: "#747477",
        slope: "#416f2c",
        patch: "#699447",
        pathA: "#8a795b",
        pathB: "#6f604a",
      },
      side: {
        grass: "#62412f",
        rock: "#55545a",
        slope: "#563a2b",
        patch: "#694631",
        pathA: "#705540",
        pathB: "#5c4637",
      },
    },
  },
  light: {
    sky: "#a9c9dd",
    // Not as far out as it wants to be. Push past ~45 and the stepped mountains
    // stop being hazed at all and read as bare white boxes on the horizon; this
    // is the window where the grass keeps its colour and the far hills still
    // dissolve.
    fog: [30, 68],
    ambient: "#dceef9",
    ambientIntensity: 1.5,
    hemiSky: "#a9d8f5",
    hemiGround: "#6ba847",
    hemiIntensity: 1.5,
    sun: "#fff4dc",
    sunIntensity: 2.2,
    terrain: {
      top: {
        grass: "#67a63d",
        rock: "#919196",
        slope: "#559334",
        patch: "#7ab84d",
        pathA: "#b39a6a",
        pathB: "#96805b",
      },
      side: {
        grass: "#79513a",
        rock: "#6d6d72",
        slope: "#6c4833",
        patch: "#82583d",
        pathA: "#87664a",
        pathB: "#73563f",
      },
    },
  },
} as const;

function PortalWorldContents({ energized }: { energized: boolean }) {
  const { resolved } = useTheme();
  const scene = SCENE[resolved];

  return (
    <>
      {/* NO `<color attach="background">`. The canvas remains transparent so
          the CSS sky shows around the GLB; fog blends its far edge into that sky. */}
      <fog attach="fog" args={[scene.sky, scene.fog[0], scene.fog[1]]} />

      {/* The key light is the sky's own source: a cool moon over the night
          garden, a warm sun over the day valley. Ambient and hemisphere carry
          the bounce — lilac off blossom at night, sky-blue over grass by day —
          which is what stops the daylight theme reading as the night scene with
          the brightness turned up. */}
      <ambientLight color={scene.ambient} intensity={scene.ambientIntensity} />
      <hemisphereLight
        args={[scene.hemiSky, scene.hemiGround, scene.hemiIntensity]}
      />
      {/* The shadow camera is sized to contain the whole terrain (x ±15 by
          z −9..7) with margin; the old ±15/12/−8 box clipped its outer edges,
          which can leave `receiveShadow` surfaces sampling the clamped edge of
          the shadow map. Correct on its own terms — but note it did NOT fix the
          dark light-theme ground it was reached for. Widen if terrain grows. */}
      <directionalLight
        position={[-7, 12, 8]}
        color={scene.sun}
        intensity={scene.sunIntensity}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={20}
        shadow-camera-bottom={-14}
        shadow-camera-near={1}
        shadow-camera-far={55}
        shadow-normalBias={0.22}
      />
      <pointLight
        position={[0, 2.2, 1.1]}
        color="#b94cff"
        intensity={energized ? 28 : 18}
        distance={11}
        decay={2}
      />

      {/* Dark mode uses the supplied photographic landscape on `.stage`.
          Keep the 3D Minecraft world exclusive to light mode so the two
          backgrounds never overlap and the 4 MB GLB is not mounted at night. */}
      {resolved === "light" ? (
        <Suspense fallback={null}>
          <MinecraftBackdrop />
        </Suspense>
      ) : null}
      {/* NO generated terrain in either theme. Light gets the Minecraft GLB
          above; dark gets nothing, because the backdrop photograph already has
          its own garden and pond, and the procedural columns rendered as a
          black mass across the bottom half of it — the "blocks blocking the
          background". The ruin carries its own platform, so it still has
          something to stand on. */}
      <PortalMotes energized={energized} />
      {/* Both load a GLB, so they belong inside the boundary — the pillars used
          to be RealmCrystals, which was pure geometry and needed none.

          LIGHT ONLY for the pillars. The night composition is the sakura
          photograph, which is already a full garden scene; standing stones in
          front of it competed with it rather than framing it. Same reasoning as
          the Minecraft world above, with the same side benefit — the 3.1 MB
          pillar GLB is never mounted at night. */}
      <Suspense fallback={null}>
        <PortalRelic energized={energized} />
        {resolved === "light" ? <RealmPillars /> : null}
        <Preload all />
      </Suspense>
      <CameraRig energized={energized} />
    </>
  );
}

export function PortalWorld({ energized }: { energized: boolean }) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return (
    <Canvas
      aria-hidden
      shadows="percentage"
      dpr={[1, 1.7]}
      camera={{ position: [0, 3.85, 12.4], fov: 42, near: 0.1, far: 70 }}
      gl={{
        antialias: true,
        // Transparent so the CSS sky remains visible around the 3D world.
        alpha: true,
        powerPreference: "high-performance",
      }}
      // Matches the scene's own sky in each theme, so the hand-off from
      // fallback to first rendered frame is not a flash of the wrong colour.
      fallback={<div className="portal-sky h-full w-full" />}
      frameloop={reduceMotion ? "demand" : "always"}
    >
      <PortalWorldContents energized={energized} />
    </Canvas>
  );
}

// The ruin is in both themes, so warming it is always worth it.
useGLTF.preload(PORTAL_MODEL);
// PILLAR_MODEL and MINECRAFT_WORLD_MODEL are deliberately NOT preloaded: both
// are light-theme only, and preloading here runs at module scope where the
// theme is not yet known — so a dark-theme visitor would download 3.1 MB and
// 4 MB of geometry they are never shown. They load when their theme mounts
// them, behind the Suspense boundary that already has a null fallback.
