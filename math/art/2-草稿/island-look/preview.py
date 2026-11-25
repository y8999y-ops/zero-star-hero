import json, sys
from PIL import Image
A = sys.argv[1]; L = json.load(open(A + "/layout.json"))
g = Image.open(A + "/ground.png").convert("RGBA")
items = [(o["at"][1] + o["size"][1] - 40, n, o["at"]) for n, o in L["objects"].items()] + [(p["y"] + p["h"], p["art"], (p["x"], p["y"])) for p in L["props"] + L["buildings"]]
for _, n, at in sorted(items): g.alpha_composite(Image.open(f"{A}/{n}.png").convert("RGBA"), tuple(at))
g.save(sys.argv[2])
