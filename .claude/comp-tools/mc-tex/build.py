"""mc-tex: the game's own textures for /tcomp/'s Minecraft.

Takes what tcomp/minecraft.js draws out of a Minecraft Java client jar and
packs it into tcomp/mc-tex/:

  tiles.png   block, item, particle and sky textures, 16x16 cells, 16 a row
  gui.png     the interface sprites at their own sizes, shelf-packed
  logo.png    the title wordmark (1024x256) over the edition line (512x64)
  tex.json    where each of those is, by the name minecraft.js knows it by,
              the glyphs of font/ascii.png, and the jar's version

    python .claude/comp-tools/mc-tex/build.py [client.jar]

With no path it takes the newest release in %APPDATA%/.minecraft/versions.
Standard library only (pngio.py beside this file reads and writes the PNGs).
The game loads these from beside its own script and paints anything they
lack itself, so a name missing here is a drawing, not a hole.
"""
import glob, json, os, re, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pngio

REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(REPO, 'tcomp', 'mc-tex')
TEXROOT = 'assets/minecraft/textures/'

# the tints the game's colour maps give a plains biome, and a half-grown stem
GRASS, FOLIAGE, WATER, STEM = '#91bd59', '#77ab2f', '#3f76e4', '#a0d714'


def B(n): return 'block/' + n
def It(n): return 'item/' + n


# ── the atlas tiles, by minecraft.js's names ──────────────────────────────
# A spec is a texture path, or a dict: src (path), tint, layers [(path, tint)],
# frame (of an animation strip), crop [x, y, w, h], mode ('crack' | 'opaque'),
# chest ('front' | 'side' | 'top').
TILES = {
    'grass_top': {'src': B('grass_block_top'), 'tint': GRASS},
    'grass_side': {'layers': [(B('grass_block_side'), None), (B('grass_block_side_overlay'), GRASS)]},
    'dirt': B('dirt'), 'stone': B('stone'), 'cobble': B('cobblestone'), 'planks': B('oak_planks'),
    'log_side': B('oak_log'), 'log_top': B('oak_log_top'), 'leaves': {'src': B('oak_leaves'), 'tint': FOLIAGE},
    'sand': B('sand'), 'gravel': B('gravel'), 'bedrock': B('bedrock'),
    'water': {'src': B('water_still'), 'tint': WATER, 'mode': 'opaque'}, 'lava': B('lava_still'),
    'glass': B('glass'), 'snow_top': B('snow'), 'snow_side': B('grass_block_snow'),
    'ore_coal': B('coal_ore'), 'ore_iron': B('iron_ore'), 'ore_gold': B('gold_ore'), 'ore_dia': B('diamond_ore'),
    'ore_red': B('redstone_ore'), 'ore_lapis': B('lapis_ore'), 'ore_emerald': B('emerald_ore'),
    'table_top': B('crafting_table_top'), 'table_side': B('crafting_table_side'), 'table_front': B('crafting_table_front'),
    'furn_side': B('furnace_side'), 'furn_front': B('furnace_front'), 'furn_lit': B('furnace_front_on'), 'furn_top': B('furnace_top'),
    'torch': B('torch'), 'tallgrass': {'src': B('short_grass'), 'tint': GRASS}, 'dandelion': B('dandelion'), 'poppy': B('poppy'),
    'wheat0': B('wheat_stage1'), 'wheat1': B('wheat_stage3'), 'wheat2': B('wheat_stage5'), 'wheat3': B('wheat_stage7'),
    'farmland': B('farmland_moist'), 'wool': B('white_wool'),
    'carrot0': B('carrots_stage0'), 'carrot1': B('carrots_stage1'), 'carrot2': B('carrots_stage2'), 'carrot3': B('carrots_stage3'),
    'potato0': B('potatoes_stage0'), 'potato1': B('potatoes_stage1'), 'potato2': B('potatoes_stage2'), 'potato3': B('potatoes_stage3'),
    'bed_top': B('red_bed_head_up'), 'bed_side': B('red_bed_head_east'),
    'tnt_side': B('tnt_side'), 'tnt_top': B('tnt_top'), 'tnt_bottom': B('tnt_bottom'),
    'chest_front': {'chest': 'front'}, 'chest_side': {'chest': 'side'}, 'chest_top': {'chest': 'top'},
    'cactus_top': B('cactus_top'), 'cactus_side': B('cactus_side'), 'cactus_bottom': B('cactus_bottom'),
    'sugarcane': B('sugar_cane'),
    'pumpkin_top': B('pumpkin_top'), 'pumpkin_side': B('pumpkin_side'), 'melon_top': B('melon_top'), 'melon_side': B('melon_side'),
    'pstem': {'src': B('pumpkin_stem'), 'tint': STEM}, 'mstem': {'src': B('melon_stem'), 'tint': STEM},
    'obsidian': B('obsidian'), 'stonebrick': B('stone_bricks'),
    'sandstone_top': B('sandstone_top'), 'sandstone_side': B('sandstone'), 'sandstone_bottom': B('sandstone_bottom'),
    'bricks': B('bricks'), 'bookshelf_side': B('bookshelf'), 'ladder': B('ladder'), 'rlamp': B('redstone_lamp_on'),
    'cake_top': B('cake_top'), 'cake_side': B('cake_side'), 'cake_inner': B('cake_inner'),
    'etable_top': B('enchanting_table_top'), 'etable_side': B('enchanting_table_side'), 'etable_bottom': B('enchanting_table_bottom'),
    'anvil_top': B('anvil_top'), 'anvil_side': B('anvil'),
    'mushroom': B('brown_mushroom'), 'mushroom_r': B('red_mushroom'), 'clay': B('clay'),
    'fire0': B('fire_0'), 'fire1': B('fire_1'),
    'puff': {'src': 'particle/generic_7'}, 'h_heart': {'src': 'particle/heart'},
    # items
    'i_stick': It('stick'), 'i_coal': It('coal'), 'i_charcoal': It('charcoal'), 'i_iron': It('iron_ingot'), 'i_gold': It('gold_ingot'),
    'i_diamond': It('diamond'), 'i_flint': It('flint'), 'i_feather': It('feather'), 'i_leather': It('leather'), 'i_string': It('string'),
    'i_gunpowder': It('gunpowder'), 'i_bone': It('bone'), 'i_bonemeal': It('bone_meal'), 'i_arrow': It('arrow'),
    'i_bow': It('bow'), 'i_bow_p0': It('bow_pulling_0'), 'i_bow_p1': It('bow_pulling_1'), 'i_bow_p2': It('bow_pulling_2'),
    'i_seeds': It('wheat_seeds'), 'i_wheat': It('wheat'), 'i_bread': It('bread'), 'i_apple': It('apple'),
    'i_pork_raw': It('porkchop'), 'i_pork': It('cooked_porkchop'), 'i_beef_raw': It('beef'), 'i_beef': It('cooked_beef'),
    'i_mutton_raw': It('mutton'), 'i_mutton': It('cooked_mutton'), 'i_chicken_raw': It('chicken'), 'i_chicken': It('cooked_chicken'),
    'i_flesh': It('rotten_flesh'),
    'i_redstone': It('redstone'), 'i_lapis': It('lapis_lazuli'), 'i_emerald': It('emerald'), 'i_ender_pearl': It('ender_pearl'),
    'i_slimeball': It('slime_ball'), 'i_ink_sac': It('ink_sac'), 'i_egg': It('egg'), 'i_paper': It('paper'), 'i_book': It('book'),
    'i_sugar': It('sugar'), 'i_bucket': It('bucket'), 'i_water_bucket': It('water_bucket'), 'i_lava_bucket': It('lava_bucket'),
    'i_milk_bucket': It('milk_bucket'), 'i_flint_steel': It('flint_and_steel'), 'i_ench_book': It('enchanted_book'),
    'i_carrot': It('carrot'), 'i_potato': It('potato'), 'i_baked_potato': It('baked_potato'), 'i_golden_carrot': It('golden_carrot'),
    'i_golden_apple': It('golden_apple'), 'i_cookie': It('cookie'), 'i_melon_slice': It('melon_slice'), 'i_pumpkin_pie': It('pumpkin_pie'),
    'i_bowl': It('bowl'), 'i_mushroom_stew': It('mushroom_stew'), 'i_clay_ball': It('clay_ball'), 'i_brick': It('brick'),
    'i_seeds_pumpkin': It('pumpkin_seeds'), 'i_seeds_melon': It('melon_seeds'), 'i_cake': It('cake'),
    'i_compass': It('compass_16'), 'i_oak_sign': It('oak_sign'),
}
for k in range(10):   # the game's own alpha form of each crack stage (its order-independent-transparency set), else derived from the multiply one
    TILES['crack%d' % k] = {'src': B('destroy_oit_stage_%d' % k), 'alt': {'src': B('destroy_stage_%d' % k), 'mode': 'crack'}}
for k in range(4):   # ExperienceOrbRenderer's first four sizes: values 1-2, 3-6, 7-16, 17-36
    TILES['xporb%d' % k] = {'src': 'entity/experience/experience_orb', 'crop': [16 * k, 0, 16, 16]}
for tier, name in [('wood', 'wooden'), ('stone', 'stone'), ('iron', 'iron'), ('gold', 'golden'), ('diamond', 'diamond')]:
    for kind, vk in [('pick', 'pickaxe'), ('axe', 'axe'), ('shovel', 'shovel'), ('sword', 'sword'), ('hoe', 'hoe')]:
        TILES['i_%s_%s' % (tier, kind)] = It('%s_%s' % (name, vk))
for tier, name in [('leather', 'leather'), ('iron', 'iron'), ('gold', 'golden'), ('diamond', 'diamond')]:
    for kind, vk in [('helm', 'helmet'), ('chest', 'chestplate'), ('legs', 'leggings'), ('boots', 'boots')]:
        if tier == 'leather':   # undyed leather: the base in the default #A06540, the untinted overlay on top
            TILES['i_leather_' + kind] = {'layers': [(It('leather_' + vk), '#a06540'), (It('leather_%s_overlay' % vk), None)]}
        else:
            TILES['i_%s_%s' % (tier, kind)] = It('%s_%s' % (name, vk))
for mob in ['pig', 'cow', 'sheep', 'chicken', 'squid', 'zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'slime']:
    TILES['i_egg_' + mob] = It(mob + '_spawn_egg')

# ── the GUI sprites ───────────────────────────────────────────────────────
# A spec is a path under gui/, or a dict: src, crop, pad [w, h, x, y] (the
# sprite in a bigger clear box), tile2 (a 16x16 texture at two GUI pixels a
# texel, as the menus draw it), chest (the chest screen's two halves).
S = 'sprites/'
GUI = {
    'hotbar': S + 'hud/hotbar', 'hotbar_sel': S + 'hud/hotbar_selection', 'hotbar_off': S + 'hud/hotbar_offhand_left',
    'xp_bg': S + 'hud/experience_bar_background', 'xp_fg': S + 'hud/experience_bar_progress', 'cross': S + 'hud/crosshair',
    'atk_bg': S + 'hud/crosshair_attack_indicator_background', 'atk_fg': S + 'hud/crosshair_attack_indicator_progress',
    'atk_full': S + 'hud/crosshair_attack_indicator_full',
    'h_cont': S + 'hud/heart/container', 'h_cont_bl': S + 'hud/heart/container_blinking',
    'a_full': S + 'hud/armor_full', 'a_half': S + 'hud/armor_half', 'a_empty': S + 'hud/armor_empty',
    'f_empty': S + 'hud/food_empty', 'f_full': S + 'hud/food_full', 'f_half': S + 'hud/food_half',
    'f_hunger_empty': S + 'hud/food_empty_hunger', 'f_hunger_full': S + 'hud/food_full_hunger', 'f_hunger_half': S + 'hud/food_half_hunger',
    'air': S + 'hud/air', 'air_empty': S + 'hud/air_empty', 'air_pop': S + 'hud/air_bursting',
    'eff_bg': S + 'hud/effect_background', 'eff_bg_amb': S + 'hud/effect_background_ambient',
    'toast': S + 'toast/advancement', 'toast_rc': S + 'toast/recipe',
    'e_helmet': S + 'container/slot/helmet', 'e_chest': S + 'container/slot/chestplate', 'e_legs': S + 'container/slot/leggings',
    'e_boots': S + 'container/slot/boots', 'e_shield': S + 'container/slot/shield', 'e_lapis': S + 'container/slot/lapis_lazuli',
    'p_inv': {'src': 'container/inventory', 'crop': [0, 0, 176, 166]},
    'p_table': {'src': 'container/crafting_table', 'crop': [0, 0, 176, 166]},
    'p_furn': {'src': 'container/furnace', 'crop': [0, 0, 176, 166]},
    'p_chest': {'chest': 3},
    'p_ench': {'src': 'container/enchanting_table', 'crop': [0, 0, 176, 166]},
    'p_anvil': {'src': 'container/anvil', 'crop': [0, 0, 176, 166]},
    'p_cr_items': {'src': 'container/creative_inventory/tab_items', 'crop': [0, 0, 195, 136]},
    'p_cr_search': {'src': 'container/creative_inventory/tab_item_search', 'crop': [0, 0, 195, 136]},
    'p_cr_inv': {'src': 'container/creative_inventory/tab_inventory', 'crop': [0, 0, 195, 136]},
    'flame': S + 'container/furnace/lit_progress', 'burn': S + 'container/furnace/burn_progress',
    'ench_n': S + 'container/enchanting_table/enchantment_slot', 'ench_h': S + 'container/enchanting_table/enchantment_slot_highlighted',
    'ench_d': S + 'container/enchanting_table/enchantment_slot_disabled',
    'anvil_tf': S + 'container/anvil/text_field', 'anvil_tfd': S + 'container/anvil/text_field_disabled', 'anvil_err': S + 'container/anvil/error',
    'scroller': S + 'container/creative_inventory/scroller', 'scroller_d': S + 'container/creative_inventory/scroller_disabled',
    'rbook': S + 'recipe_book/button', 'rbook_h': S + 'recipe_book/button_highlighted',
    'rb_bg': {'src': 'recipe_book', 'crop': [1, 1, 147, 166]},
    'rb_tab': S + 'recipe_book/tab', 'rb_tab_s': S + 'recipe_book/tab_selected',
    'rb_ok': S + 'recipe_book/slot_craftable', 'rb_no': S + 'recipe_book/slot_uncraftable',
    'rb_f0': S + 'recipe_book/filter_disabled', 'rb_f0h': S + 'recipe_book/filter_disabled_highlighted',
    'rb_f1': S + 'recipe_book/filter_enabled', 'rb_f1h': S + 'recipe_book/filter_enabled_highlighted',
    'rb_ff0': S + 'recipe_book/furnace_filter_disabled', 'rb_ff0h': S + 'recipe_book/furnace_filter_disabled_highlighted',
    'rb_ff1': S + 'recipe_book/furnace_filter_enabled', 'rb_ff1h': S + 'recipe_book/furnace_filter_enabled_highlighted',
    'rb_next': S + 'recipe_book/page_forward', 'rb_nexth': S + 'recipe_book/page_forward_highlighted',
    'rb_prev': S + 'recipe_book/page_backward', 'rb_prevh': S + 'recipe_book/page_backward_highlighted',
    'btn': S + 'widget/button', 'btn_h': S + 'widget/button_highlighted', 'btn_d': S + 'widget/button_disabled',
    'field': S + 'widget/text_field', 'field_h': S + 'widget/text_field_highlighted',
    'slider': S + 'widget/slider', 'slider_h': S + 'widget/slider_highlighted',
    'slider_k': S + 'widget/slider_handle', 'slider_kh': S + 'widget/slider_handle_highlighted',
    'tab': S + 'widget/tab', 'tab_h': S + 'widget/tab_highlighted', 'tab_s': S + 'widget/tab_selected', 'tab_sh': S + 'widget/tab_selected_highlighted',
    'iwbg': {'tile2': 'inworld_menu_background'}, 'mbg': {'tile2': 'menu_background'}, 'mlbg': {'tile2': 'menu_list_background'},
    'toast_sys': S + 'toast/system',
    # SpriteIconButton draws these as 15x15 and GuiSpriteScaling's default stretches them to fit
    'ic_bug': {'src': S + 'pause_menu/bug', 'stretch': [15, 15]},
    'ic_report': {'src': S + 'pause_menu/player_reporting', 'stretch': [15, 15]},
    'ic_lang': S + 'icon/language', 'ic_acc': S + 'icon/accessibility',
    'adv_win': {'src': 'advancements/window', 'crop': [0, 0, 252, 140]},
    'adv_bar_o': S + 'advancements/box_obtained', 'adv_bar_u': S + 'advancements/box_unobtained',
    'st_slot': S + 'container/slot', 'st_mined': S + 'statistics/block_mined', 'st_broken': S + 'statistics/item_broken',
    'st_crafted': S + 'statistics/item_crafted', 'st_used': S + 'statistics/item_used', 'st_picked': S + 'statistics/item_picked_up',
    'st_dropped': S + 'statistics/item_dropped',
}
for k, pre in [('n', ''), ('p', 'poisoned_'), ('w', 'withered_'), ('fz', 'frozen_'), ('a', 'absorbing_')]:
    GUI['h_' + k] = S + 'hud/heart/%sfull' % pre
    GUI['h_%s_half' % k] = S + 'hud/heart/%shalf' % pre
    GUI['h_%s_hc' % k] = S + 'hud/heart/%shardcore_full' % pre
    GUI['h_%s_hc_half' % k] = S + 'hud/heart/%shardcore_half' % pre
GUI['h_bl'] = S + 'hud/heart/full_blinking'
GUI['h_bl_half'] = S + 'hud/heart/half_blinking'
GUI['h_bl_hc'] = S + 'hud/heart/hardcore_full_blinking'
GUI['h_bl_hc_half'] = S + 'hud/heart/hardcore_half_blinking'
for n in range(1, 4):
    GUI['lvl_%d' % n] = S + 'container/enchanting_table/level_%d' % n
    GUI['lvl_%dd' % n] = S + 'container/enchanting_table/level_%d_disabled' % n
for col in range(1, 8):
    for row, rn in [('t', 'top'), ('b', 'bottom')]:
        GUI['tab_%s_u%d' % (row, col)] = S + 'container/creative_inventory/tab_%s_unselected_%d' % (rn, col)
        GUI['tab_%s_s%d' % (row, col)] = S + 'container/creative_inventory/tab_%s_selected_%d' % (rn, col)
for task in ['task', 'goal', 'challenge']:
    GUI['adv_%s_o' % task] = S + 'advancements/%s_frame_obtained' % task
    GUI['adv_%s_u' % task] = S + 'advancements/%s_frame_unobtained' % task
EFFECTS = ['speed', 'slowness', 'haste', 'mining_fatigue', 'strength', 'instant_health', 'instant_damage', 'jump_boost',   # the ones the game simulates
           'regeneration', 'resistance', 'fire_resistance', 'water_breathing', 'invisibility', 'night_vision', 'weakness',
           'glowing', 'levitation', 'saturation', 'health_boost']
MOON = ['full_moon', 'waning_gibbous', 'third_quarter', 'waning_crescent', 'new_moon', 'waxing_crescent', 'first_quarter', 'waxing_gibbous']   # MoonPhase's order


class Jar:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path)
        self.missing = []

    def img(self, rel):
        try:
            return pngio.decode(self.z.read(TEXROOT + rel + '.png'), rel)
        except KeyError:
            self.missing.append(rel)
            return None

    def version(self):
        try:
            return json.loads(self.z.read('version.json')).get('id')
        except Exception:
            return None


def hexrgb(h): return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def tint(img, h):
    r, g, b = hexrgb(h)
    w, hh, px = img
    out = bytearray(px)
    for i in range(0, len(out), 4):
        out[i] = out[i] * r // 255; out[i + 1] = out[i + 1] * g // 255; out[i + 2] = out[i + 2] * b // 255
    return [w, hh, out]


def flipv(img):
    w, h, px = img
    out = bytearray(len(px))
    for y in range(h): out[y * w * 4:(y + 1) * w * 4] = px[(h - 1 - y) * w * 4:(h - y) * w * 4]
    return [w, h, out]


def to16(img):
    """an animation strip's first frame; anything bigger box-filtered down, smaller scaled up"""
    w, h, px = img
    if h > w and w and h % w == 0: img = pngio.crop(img, 0, 0, w, w); w = h = img[0]
    if w == 16 and h == 16: return img
    if w > 16 and h > 16 and w % 16 == 0 and h % 16 == 0: return pngio.scale_box(img, 16, 16)
    return pngio.scale_nearest(img, 16, 16)


def crack(img):
    """destroy_stage_N is drawn by multiplying 2 x src x dst into the block: grey
    is no change, darker darkens, lighter lightens. As an alpha overlay: black at
    1 - 2L where it darkens, white at 2L - 1 where it lightens."""
    w, h, px = img
    out = bytearray(len(px))
    for i in range(0, len(px), 4):
        if px[i + 3] < 128: continue
        L = px[i] / 255.0
        a = (1 - 2 * L) if L < 0.5 else (2 * L - 1)
        v = 0 if L < 0.5 else 255
        out[i:i + 4] = bytes((v, v, v, int(round(255 * a))))
    return [w, h, out]


def chest_face(jar, which):
    """The chest is a block entity in the game, a 14x14x14 box with a lid, drawn
    from entity/chest/normal.png. Our chest is a full cube, so each face is that
    box's face (lid over base, the latch on the front) opened out to 16x16."""
    ch = jar.img('entity/chest/normal')
    if ch is None: return None
    if which == 'top': return pngio.scale_nearest(pngio.crop(ch, 28, 0, 14, 14), 16, 16)
    x = 42 if which == 'front' else 28
    f = pngio.new(14, 14)
    pngio.blit(f, flipv(pngio.crop(ch, x, 33, 14, 10)), 0, 4)   # the base's top row is behind the lid
    pngio.blit(f, flipv(pngio.crop(ch, x, 14, 14, 5)), 0, 0)
    if which == 'front': pngio.blit(f, flipv(pngio.crop(ch, 4, 1, 2, 4)), 6, 3)
    return pngio.scale_nearest(f, 16, 16)


def build_tile(jar, name, spec):
    if isinstance(spec, str): spec = {'src': spec}
    if 'chest' in spec: return chest_face(jar, spec['chest'])
    if 'layers' in spec:
        out = None
        for path, tn in spec['layers']:
            im = jar.img(path)
            if im is None: return None
            im = to16(im)
            if tn: im = tint(im, tn)
            if out is None: out = im
            else: pngio.blit(out, im, 0, 0, over=True)
        return out
    im = jar.img(spec['src'])
    if im is None:
        if 'alt' not in spec: return None
        jar.missing.remove(spec['src'])   # the texture it stands in for is not missing, only preferred
        return build_tile(jar, name, spec['alt'])
    if 'crop' in spec: im = pngio.crop(im, *spec['crop'])
    im = to16(im)
    if spec.get('tint'): im = tint(im, spec['tint'])
    if spec.get('mode') == 'crack': im = crack(im)
    if spec.get('mode') == 'opaque':
        for i in range(3, len(im[2]), 4): im[2][i] = 255
    return im


def build_gui(jar, name, spec):
    if isinstance(spec, str): spec = {'src': spec}
    if 'chest' in spec:   # ContainerScreen: rows x 18 + 17 of the top, then the inventory from y 126
        g = jar.img('gui/container/generic_54')
        if g is None: return None
        rows = spec['chest']
        out = pngio.new(176, rows * 18 + 17 + 96)
        pngio.blit(out, pngio.crop(g, 0, 0, 176, rows * 18 + 17), 0, 0)
        pngio.blit(out, pngio.crop(g, 0, 126, 176, 96), 0, rows * 18 + 17)
        return out
    if 'tile2' in spec:   # drawn at 32 GUI pixels a repeat: every texel two pixels square
        g = jar.img('gui/' + spec['tile2'])
        return pngio.scale_nearest(g, g[0] * 2, g[1] * 2) if g else None
    g = jar.img('gui/' + spec['src'])
    if g is None: return None
    if 'crop' in spec: g = pngio.crop(g, *spec['crop'])
    if 'stretch' in spec: g = pngio.scale_nearest(g, spec['stretch'][0], spec['stretch'][1])
    return g


def font(jar, name='ascii', codes=range(33, 127)):
    """font/ascii.png (or ascii_sga, the enchanting table's runes): 16x16 cells of
    8x8. A glyph's width is up to its last lit column; minecraft.js adds the
    one-pixel gap. Rows come out in the file's own '#'/'.' form, top row first,
    the baseline under row 6."""
    a = jar.img('font/' + name)
    if a is None: return {}
    w, h, px = a
    cell = w // 16
    out = {}
    for code in codes:
        cx, cy = (code % 16) * cell, (code // 16) * cell
        rows, width = [], 0
        for y in range(cell):
            row = ''
            for x in range(cell):
                on = px[((cy + y) * w + cx + x) * 4 + 3] > 127
                row += '#' if on else '.'
                if on: width = max(width, x + 1)
            rows.append(row)
        if not width: continue
        rows = [r[:width] for r in rows]
        while rows and '#' not in rows[-1]: rows.pop()
        out[chr(code)] = '/'.join(rows)
    return out


def pack(items):
    """shelf-pack [(name, img)] into one sheet, tallest first; returns (sheet, {name: [x, y, w, h]})"""
    items = sorted(items, key=lambda it: (-it[1][1], -it[1][0], it[0]))
    W = 512
    x = y = shelf = 0
    at = {}
    for name, im in items:
        w, h = im[0], im[1]
        if x + w > W: x = 0; y += shelf + 1; shelf = 0
        at[name] = [x, y, w, h]
        x += w + 1; shelf = max(shelf, h)
    sheet = pngio.new(W, y + shelf)
    for name, im in items:
        pngio.blit(sheet, im, at[name][0], at[name][1])
    return sheet, at


def newest_jar():
    base = os.path.join(os.environ.get('APPDATA', ''), '.minecraft', 'versions')
    best = None
    for jar in glob.glob(os.path.join(base, '*', '*.jar')):
        ver = os.path.basename(os.path.dirname(jar))
        if not re.fullmatch(r'\d+(\.\d+)+', ver): continue   # releases only: no snapshots, pre-releases or candidates
        key = [int(p) for p in ver.split('.')]
        if best is None or key > best[0]: best = (key, jar)
    return best and best[1]


def main():
    jar_path = sys.argv[1] if len(sys.argv) > 1 else newest_jar()
    if not jar_path or not os.path.exists(jar_path):
        sys.exit('no client jar: pass its path, or install a release with the launcher')
    jar = Jar(jar_path)
    os.makedirs(OUT, exist_ok=True)

    names = sorted(TILES)
    sheet = pngio.new(256, 16 * ((len(names) + 15) // 16))
    tiles = {}
    for n in names:
        im = build_tile(jar, n, TILES[n])
        if im is None: continue
        k = len(tiles)
        pngio.blit(sheet, im, (k % 16) * 16, (k // 16) * 16)
        tiles[n] = k
    sheet = pngio.crop(sheet, 0, 0, 256, 16 * ((len(tiles) + 15) // 16))
    pngio.write(os.path.join(OUT, 'tiles.png'), sheet)

    gui = []
    for n, spec in GUI.items():
        im = build_gui(jar, n, spec)
        if im is not None: gui.append((n, im))
    for e in EFFECTS:
        im = jar.img('mob_effect/' + e)
        if im is not None: gui.append(('eff_' + e, im))
    gsheet, gat = pack(gui)
    pngio.write(os.path.join(OUT, 'gui.png'), gsheet)

    logo = jar.img('gui/title/minecraft'); ed = jar.img('gui/title/edition')
    lg = {}
    if logo and ed:
        out = pngio.new(max(logo[0], ed[0]), logo[1] + ed[1])
        pngio.blit(out, logo, 0, 0); pngio.blit(out, ed, 0, logo[1])
        pngio.write(os.path.join(OUT, 'logo.png'), out)
        lg = {'logo': [0, 0, logo[0], logo[1]], 'edition': [0, logo[1], ed[0], ed[1]]}

    # the sky's bodies at their own 32x32, in a strip: the sun, then the eight moons in MoonPhase's order
    sun = jar.img('environment/celestial/sun'); moons = [jar.img('environment/celestial/moon/' + m) for m in MOON]
    sky = {}
    if sun and all(moons):
        strip = pngio.new(sun[0] + sum(m[0] for m in moons), max([sun[1]] + [m[1] for m in moons]))
        pngio.blit(strip, sun, 0, 0)
        sky = {'sun': [0, 0, sun[0], sun[1]], 'moon': []}
        x = sun[0]
        for m in moons:
            pngio.blit(strip, m, x, 0)
            sky['moon'].append([x, 0, m[0], m[1]])
            x += m[0]
        pngio.write(os.path.join(OUT, 'sky.png'), strip)

    man = {'version': jar.version(), 'tiles': tiles, 'gui': dict(sorted(gat.items())), 'logo': lg, 'sky': sky,
           'font': font(jar), 'sga': font(jar, 'ascii_sga', range(97, 123))}
    with open(os.path.join(OUT, 'tex.json'), 'w', newline='\n') as f:
        json.dump(man, f, separators=(',', ':'), sort_keys=False)
    print('jar %s (version %s)' % (jar_path, man['version']))
    print('tiles %d, gui sprites %d (sheet %dx%d), glyphs %d + %d runes, sky %s' % (len(tiles), len(gat), gsheet[0], gsheet[1], len(man['font']), len(man['sga']), 'yes' if sky else 'no'))
    if jar.missing: print('missing from the jar:', ', '.join(sorted(set(jar.missing))))


if __name__ == '__main__':
    main()
