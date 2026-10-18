# Blender 無頭算圖：匯入 GLB（空檔則建測試場景），自動對準相機，Cycles CPU 輸出 PNG。
import bpy, sys, os, math, mathutils
argv = sys.argv[sys.argv.index("--") + 1:]; src, dst = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
if os.path.getsize(src) > 0: bpy.ops.import_scene.gltf(filepath=src)
else:
    bpy.ops.mesh.primitive_plane_add(size=20); bpy.ops.mesh.primitive_cube_add(location=(0, 0, 1)); bpy.ops.mesh.primitive_cone_add(location=(3, 0, 1.5), depth=3)
objs = [o for o in sc.objects if o.type == "MESH"]; pts = [o.matrix_world @ mathutils.Vector(c) for o in objs for c in o.bound_box]
mn = mathutils.Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))); mx = mathutils.Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))); c = (mn + mx) / 2; r = max((mx - mn).length, 1)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); cam.location = c + mathutils.Vector((r * .9, -r * .9, r * .7)); cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler(); sc.camera = cam
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3; sun.rotation_euler = (math.radians(50), 0, math.radians(30)); sc.collection.objects.link(sun)
w = bpy.data.worlds.new("w"); sc.world = w; w.color = (0.6, 0.7, 0.8)
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 24  # 無 GPU 的 runner 用 CPU 算圖
sc.render.resolution_x, sc.render.resolution_y = 1280, 720; sc.render.filepath = os.path.abspath(dst); bpy.ops.render.render(write_still=True)
print("RENDER ok meshes=%d radius=%.2f -> %s" % (len(objs), r, dst))
