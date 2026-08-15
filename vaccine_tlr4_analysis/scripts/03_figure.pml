# =====================================================================
# 03_figure.pml -- figure de publication de l'interface TLR4 / Vaccin
#
# GENERE AUTOMATIQUEMENT par scripts/02_interface_analysis.py.
# Les residus et les interactions listes ci-dessous sont ceux reellement
# detectes dans la structure -- rien n'est ecrit a la main.
# Ne pas editer : relancer le script Python pour regenerer.
#
# UTILISATION, depuis le dossier vaccine_tlr4_analysis :
#     PyMOL> cd C:/Users/outhmane/vaccine_tlr4_analysis
#     PyMOL> @scripts/03_figure.pml
#
# PRODUIT :
#     results/figures/fig1_overview.png   vue d'ensemble du complexe
#     results/figures/fig2_interface.png  reseau d'interactions, etiquete
#     results/figures/fig3_surface.png    empreinte d'interface en surface
#     sessions/interface.pse              session rechargeable et modifiable
# =====================================================================

reinitialize
load structures/complex.pdb, complex

# --- deux objets distincts (obligatoire pour les reglages par objet) --
create tlr4,   complex and chain A and polymer
create vaccin, complex and chain B and polymer
delete complex

hide everything
show cartoon, tlr4 or vaccin
color grey70,   tlr4
color palecyan, vaccin

# --- residus d'interface ---------------------------------------------
select if_tlr4,   tlr4   and resi 27+28+29+30+41+42+43+44+45+47+48+49+50+51+264+339+361+362+365+382+383+384+408+409+431+433+435+456+458+480+505+507+528+529+550+552+553+578+603+605+606
select if_vaccin, vaccin and resi 4+7+14+17+37+38+129+178+179+180+202+203+205+225+226+245+246+247+266+286+287+288+289+291+467+471+474+475+476+477
select polar_tlr4,   tlr4   and resi 27+41+42+44+48+50+264+339+362+431+433+435+456+458+505+528+550+552+578+603+605+606
select polar_vaccin, vaccin and resi 4+14+17+38+129+178+180+203+205+226+245+266+289+291+467+475

# --- rendu general ----------------------------------------------------
bg_color white
set ray_opaque_background, 1
set ray_shadows, 0
set antialias, 2
set cartoon_fancy_helices, 1
set cartoon_smooth_loops, 1
set specular, 0.15
set ambient, 0.28
set direct, 0.55
set depth_cue, 0
set stick_radius, 0.16
set dash_width, 2.6
set dash_gap, 0.32
set dash_radius, 0.045
set label_size, 15
set label_color, black
set label_outline_color, white
set label_position, (0, 0, 3)
set transparency_mode, 2
set surface_quality, 1

# =====================================================================
# FIGURE 1 -- vue d'ensemble : qui se lie a qui, et ou
# =====================================================================
color orange, if_tlr4
color red,    if_vaccin
set cartoon_transparency, 0.0, tlr4
set cartoon_transparency, 0.0, vaccin
orient tlr4 or vaccin
png results/figures/fig1_overview.png, width=3000, height=2200, dpi=300, ray=1

# =====================================================================
# FIGURE 2 -- reseau d'interactions polaires, etiquete
# =====================================================================
set cartoon_transparency, 0.75, tlr4
set cartoon_transparency, 0.65, vaccin
color grey80,   tlr4
color palecyan, vaccin

show sticks, (polar_tlr4 or polar_vaccin) and sidechain
color orange,   polar_tlr4 and elem C
color firebrick, polar_vaccin and elem C
color red,   (polar_tlr4 or polar_vaccin) and elem O
color blue,  (polar_tlr4 or polar_vaccin) and elem N
color yellow,(polar_tlr4 or polar_vaccin) and elem S
hide sticks, hydro

python
from pymol import cmd

# (objet1, resi1, atome1, objet2, resi2, atome2, distance)
HBONDS = [
    ("vaccin", 203, "NZ", "tlr4", 528, "OG", 2.46),
    ("tlr4", 362, "NZ", "vaccin", 289, "OE1", 2.54),
    ("tlr4", 606, "NH2", "vaccin", 180, "OG1", 2.58),
    ("tlr4", 362, "NZ", "vaccin", 291, "OE1", 2.60),
    ("vaccin", 129, "NH1", "tlr4", 605, "OE2", 2.64),
    ("vaccin", 226, "NH2", "tlr4", 505, "OE1", 2.65),
    ("vaccin", 14, "NH1", "tlr4", 27, "O", 2.65),
    ("vaccin", 203, "NZ", "tlr4", 552, "OG", 2.67),
    ("vaccin", 180, "OG1", "tlr4", 578, "OE1", 2.67),
    ("vaccin", 467, "NH2", "tlr4", 42, "OE2", 2.68),
    ("tlr4", 362, "NZ", "vaccin", 291, "OE2", 2.68),
    ("tlr4", 606, "NH2", "vaccin", 178, "OD2", 2.71),
    ("vaccin", 17, "NH2", "tlr4", 27, "OE1", 2.72),
    ("tlr4", 264, "NH1", "vaccin", 291, "OE1", 2.73),
    ("vaccin", 129, "NH2", "tlr4", 603, "OE2", 2.73),
    ("vaccin", 266, "NZ", "tlr4", 431, "O", 2.75),
    ("vaccin", 17, "NH1", "tlr4", 27, "OE2", 2.76),
    ("vaccin", 467, "NH2", "tlr4", 42, "OE1", 2.76),
    ("vaccin", 129, "NH1", "tlr4", 603, "OE2", 2.78),
    ("tlr4", 606, "NH2", "vaccin", 178, "OD1", 2.79),
    ("vaccin", 17, "NH1", "tlr4", 27, "OE1", 2.81),
    ("vaccin", 38, "NH1", "tlr4", 50, "OD2", 2.83),
    ("vaccin", 17, "NH2", "tlr4", 27, "OE2", 2.84),
    ("tlr4", 456, "ND1", "vaccin", 205, "OE2", 2.87),
    ("vaccin", 4, "ND2", "tlr4", 44, "OD1", 2.90),
    ("tlr4", 339, "ND2", "vaccin", 289, "OE1", 2.91),
    ("vaccin", 467, "NE", "tlr4", 42, "OE1", 2.91),
    ("vaccin", 475, "ND1", "tlr4", 41, "O", 2.92),
    ("vaccin", 203, "NZ", "tlr4", 550, "OD1", 2.93),
    ("tlr4", 264, "NH2", "vaccin", 291, "OE2", 2.94),
    ("tlr4", 433, "ND2", "vaccin", 245, "OD2", 2.95),
    ("vaccin", 289, "NE2", "tlr4", 339, "OD1", 2.97),
    ("tlr4", 606, "NE", "vaccin", 178, "OD1", 3.05),
    ("tlr4", 264, "NH2", "vaccin", 291, "OE1", 3.12),
    ("vaccin", 38, "NH1", "tlr4", 48, "O", 3.18),
    ("vaccin", 226, "NE", "tlr4", 505, "O", 3.25),
    ("tlr4", 50, "N", "vaccin", 38, "NH1", 3.26),
    ("vaccin", 38, "NH2", "tlr4", 48, "O", 3.31)
]
SALTS = [
    ("vaccin", 291, "OE1", "tlr4", 362, "NZ", 2.60),
    ("tlr4", 605, "OE2", "vaccin", 129, "NH1", 2.64),
    ("tlr4", 50, "OD1", "vaccin", 38, "NH1", 2.67),
    ("tlr4", 42, "OE2", "vaccin", 467, "NH2", 2.68),
    ("vaccin", 291, "OE2", "tlr4", 362, "NZ", 2.68),
    ("vaccin", 178, "OD2", "tlr4", 606, "NH2", 2.71),
    ("tlr4", 27, "OE1", "vaccin", 17, "NH2", 2.72),
    ("vaccin", 291, "OE1", "tlr4", 264, "NH1", 2.73),
    ("tlr4", 603, "OE2", "vaccin", 129, "NH2", 2.73),
    ("tlr4", 27, "OE2", "vaccin", 17, "NH1", 2.76),
    ("tlr4", 42, "OE1", "vaccin", 467, "NH2", 2.76),
    ("tlr4", 603, "OE2", "vaccin", 129, "NH1", 2.78),
    ("vaccin", 178, "OD1", "tlr4", 606, "NH2", 2.79),
    ("tlr4", 27, "OE1", "vaccin", 17, "NH1", 2.81),
    ("tlr4", 50, "OD2", "vaccin", 38, "NH1", 2.83),
    ("tlr4", 27, "OE2", "vaccin", 17, "NH2", 2.84),
    ("vaccin", 205, "OE2", "tlr4", 456, "ND1", 2.87),
    ("tlr4", 42, "OE1", "vaccin", 467, "NE", 2.91),
    ("tlr4", 550, "OD1", "vaccin", 203, "NZ", 2.93),
    ("vaccin", 291, "OE2", "tlr4", 264, "NH2", 2.94),
    ("vaccin", 178, "OD1", "tlr4", 606, "NE", 3.05),
    ("vaccin", 291, "OE1", "tlr4", 264, "NH2", 3.12),
    ("vaccin", 245, "OD1", "tlr4", 458, "NE2", 3.43),
    ("vaccin", 291, "OE2", "tlr4", 264, "NH1", 3.78),
    ("vaccin", 245, "OD2", "tlr4", 435, "NZ", 3.99)
]

def draw(pairs, prefix, color):
    made = []
    for i, (o1, r1, a1, o2, r2, a2, d) in enumerate(pairs, 1):
        name = "%s_%02d" % (prefix, i)
        n = cmd.distance(name,
                         "%s and resi %d and name %s" % (o1, r1, a1),
                         "%s and resi %d and name %s" % (o2, r2, a2))
        if n is None or n < 0:
            print("  ATTENTION : %s introuvable (%s %d %s / %s %d %s)"
                  % (name, o1, r1, a1, o2, r2, a2))
            cmd.delete(name)
            continue
        cmd.set("dash_color", color, name)
        made.append(name)
    if made:
        cmd.group(prefix, " ".join(made))
    return len(made)

n_hb = draw(HBONDS, "hbond", "yellow")
n_sb = draw(SALTS, "saltbridge", "magenta")
cmd.hide("labels")          # masque les valeurs numeriques des distances
print(" liaisons hydrogene tracees : %d / %d" % (n_hb, len(HBONDS)))
print(" ponts salins traces        : %d / %d" % (n_sb, len(SALTS)))

# etiquettes de residus, uniquement sur les residus a interaction polaire
cmd.label("(polar_tlr4 or polar_vaccin) and name CA",
          '"%s%s" % (resn.capitalize(), resi)')
python end

orient polar_tlr4 or polar_vaccin
zoom polar_tlr4 or polar_vaccin, 3
png results/figures/fig2_interface.png, width=3000, height=2200, dpi=300, ray=1

# =====================================================================
# FIGURE 3 -- empreinte d'interface en surface
# =====================================================================
hide labels
hide sticks
hide dashes
set cartoon_transparency, 0.0, vaccin
show surface, tlr4
set transparency, 0.0, tlr4
color grey85, tlr4
color tv_orange, if_tlr4
color deepteal, vaccin
orient tlr4 or vaccin
png results/figures/fig3_surface.png, width=3000, height=2200, dpi=300, ray=1

# =====================================================================
# Session sauvegardee : tout est rechargeable et modifiable
# =====================================================================
show dashes
show sticks, (polar_tlr4 or polar_vaccin) and sidechain
hide sticks, hydro
save sessions/interface.pse

print ""
print "=== TERMINE ==="
print "  results/figures/fig1_overview.png"
print "  results/figures/fig2_interface.png"
print "  results/figures/fig3_surface.png"
print "  sessions/interface.pse"
