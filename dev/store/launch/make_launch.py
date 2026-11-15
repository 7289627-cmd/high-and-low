"""Superseded: launch art (adaptive layers, splash, @capacitor/assets sources) is now generated together with the app icons
by ../icons/make_final_icons.py. This stub just runs it so old instructions keep working."""
import pathlib, runpy
runpy.run_path(str(pathlib.Path(__file__).resolve().parent.parent / 'icons/make_final_icons.py'), run_name='__main__')
