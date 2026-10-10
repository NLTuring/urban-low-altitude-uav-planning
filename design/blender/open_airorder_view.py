"""Prepare a normal editable Blender workspace for the saved campus asset."""
import bpy,os,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
scene=bpy.data.scenes.get('AIRORDER — 示范园区')
if scene and (len(bpy.data.scenes)!=1 or any(o.name.startswith('FIELD_ATLAS') for o in bpy.data.objects)):
    raise RuntimeError('Run only in the independent AIRORDER project; other open scenes must be preserved.')
if scene:
    for win in bpy.context.window_manager.windows:
        win.scene=scene
        if bpy.data.workspaces.get('Layout'):win.workspace=bpy.data.workspaces['Layout']
        for area in win.screen.areas:
            if area.type=='VIEW_3D':
                sp=area.spaces.active
                sp.clip_end=5000
                sp.overlay.show_floor=False;sp.overlay.show_axis_x=False;sp.overlay.show_axis_y=False
                sp.overlay.show_extras=False;sp.overlay.show_relationship_lines=False
                sp.shading.type='MATERIAL'
                sp.region_3d.view_rotation=scene.camera.rotation_euler.to_quaternion()
                sp.region_3d.view_location=(0,0,20)
                sp.region_3d.view_distance=680
                sp.region_3d.view_perspective='ORTHO'
    bpy.ops.object.select_all(action='DESELECT')
    scene.cycles.device='CPU'
    bpy.ops.wm.save_as_mainfile(filepath=str(root/'blender'/'空序-示范园区-v1.blend'),check_existing=False)
    (root/'blender'/'opened-project.json').write_text(json.dumps({'pid':os.getpid(),'file':bpy.data.filepath,'scenes':[s.name for s in bpy.data.scenes],'active_scene':scene.name},ensure_ascii=False,indent=2),encoding='utf-8')
