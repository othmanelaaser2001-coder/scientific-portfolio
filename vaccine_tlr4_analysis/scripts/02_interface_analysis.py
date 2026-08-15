#!/usr/bin/env python3
"""
02_interface_analysis.py -- Analyse complete de l'interface d'un complexe
proteine-proteine a deux chaines.

LECTURE SEULE sur la structure. Produit :
  results/tables/interface_residues.csv   residus d'interface des deux partenaires
  results/tables/interactions.csv         contacts detailles (type + distance)
  results/tables/summary.txt              synthese lisible
  scripts/03_figure.pml                   script PyMOL de figure, genere sur mesure

CRITERES GEOMETRIQUES (choisis pour etre defendables en publication) :

  Contact d'interface   atomes lourds a <= 4.0 A  (Cutoff usuel des etudes
                        d'interface proteine-proteine ; 5.0 A egalement
                        rapporte comme peripherie.)

  Liaison hydrogene     D...A <= 3.5 A, H...A <= 2.6 A, angle D-H...A >= 120 deg.
                        Criteres classiques (Baker & Hubbard). Necessite des
                        hydrogenes polaires, presents dans ce fichier.

  Pont salin            distance <= 4.0 A entre un oxygene de carboxylate
                        (Asp OD1/OD2, Glu OE1/OE2, C-ter OXT) et un azote
                        charge positivement (Arg NE/NH1/NH2, Lys NZ,
                        His ND1/NE2). Critere de Barlow & Thornton (1983).

  Contact hydrophobe    carbone de chaine laterale apolaire a <= 4.0 A d'un
                        autre carbone de chaine laterale apolaire, sur des
                        residus hydrophobes.

  Surface enfouie       algorithme de Shrake-Rupley (sonde 1.4 A, 960 points),
                        atomes lourds. BSA = (SASA_A + SASA_B - SASA_AB) / 2.

LIMITE FONDAMENTALE : tous ces criteres sont GEOMETRIQUES et s'appliquent a UNE
conformation. Ils identifient des interactions POSSIBLES, jamais des interactions
STABLES. Voir results/tables/summary.txt pour ce qui est publiable ou non.

UTILISATION :
    python scripts/02_interface_analysis.py structures/complex.pdb A B
"""

import math
import os
import sys
from collections import defaultdict

# --------------------------------------------------------------------------
# Parametres geometriques
CONTACT_CUTOFF = 4.0
PERIPHERY_CUTOFF = 5.0
HB_DA_MAX = 3.5
HB_HA_MAX = 2.6
HB_ANGLE_MIN = 120.0
SALT_CUTOFF = 4.0
PHOBIC_CUTOFF = 4.0
PROBE = 1.4
SASA_POINTS = 960

VDW = {'C': 1.70, 'N': 1.55, 'O': 1.52, 'S': 1.80, 'H': 1.20}

ANION = {'ASP': ('OD1', 'OD2'), 'GLU': ('OE1', 'OE2')}
CATION = {'ARG': ('NE', 'NH1', 'NH2'), 'LYS': ('NZ',), 'HIS': ('ND1', 'NE2')}
PHOBIC_RES = {'ALA', 'VAL', 'LEU', 'ILE', 'MET', 'PHE', 'TRP', 'PRO', 'TYR', 'CYS'}
BACKBONE = {'N', 'CA', 'C', 'O', 'OXT'}

THREE2ONE = {
    'ALA': 'A', 'ARG': 'R', 'ASN': 'N', 'ASP': 'D', 'CYS': 'C', 'GLN': 'Q',
    'GLU': 'E', 'GLY': 'G', 'HIS': 'H', 'ILE': 'I', 'LEU': 'L', 'LYS': 'K',
    'MET': 'M', 'PHE': 'F', 'PRO': 'P', 'SER': 'S', 'THR': 'T', 'TRP': 'W',
    'TYR': 'Y', 'VAL': 'V',
}


class Atom:
    __slots__ = ('name', 'resn', 'chain', 'resi', 'xyz', 'elem', 'idx')

    def __init__(self, line, idx):
        self.name = line[12:16].strip()
        self.resn = line[17:20].strip()
        self.chain = line[21]
        self.resi = int(line[22:26])
        self.xyz = (float(line[30:38]), float(line[38:46]), float(line[46:54]))
        elem = line[76:78].strip()
        self.elem = elem if elem else self.name.lstrip('0123456789')[0]
        self.idx = idx

    @property
    def key(self):
        return (self.chain, self.resi, self.resn)

    def label(self):
        return "%s%d" % (self.resn.capitalize(), self.resi)


def read_pdb(path):
    atoms = []
    with open(path) as fh:
        for line in fh:
            if line.startswith(('ATOM', 'HETATM')) and len(line) >= 54:
                atoms.append(Atom(line, len(atoms)))
    return atoms


def dist(a, b):
    return math.dist(a.xyz, b.xyz)


class Grid:
    """Grille spatiale : evite la comparaison de tous les couples d'atomes."""

    def __init__(self, atoms, cell):
        self.cell = cell
        self.bins = defaultdict(list)
        for a in atoms:
            self.bins[self._key(a.xyz)].append(a)

    def _key(self, p):
        c = self.cell
        return (int(math.floor(p[0] / c)), int(math.floor(p[1] / c)), int(math.floor(p[2] / c)))

    def near(self, xyz):
        i, j, k = self._key(xyz)
        out = []
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                for dk in (-1, 0, 1):
                    out.extend(self.bins.get((i + di, j + dj, k + dk), ()))
        return out


# --------------------------------------------------------------------------
def find_contacts(heavy_a, heavy_b, cutoff):
    """Tous les couples d'atomes lourds inter-chaines sous le seuil."""
    grid = Grid(heavy_a, cutoff)
    pairs = []
    for b in heavy_b:
        for a in grid.near(b.xyz):
            d = dist(a, b)
            if d <= cutoff:
                pairs.append((a, b, d))
    return pairs


def build_hydrogen_map(atoms):
    """Associe chaque hydrogene a l'atome lourd qui le porte (< 1.3 A)."""
    heavy = [a for a in atoms if a.elem != 'H']
    hyd = [a for a in atoms if a.elem == 'H']
    grid = Grid(heavy, 1.5)
    attached = defaultdict(list)
    for h in hyd:
        best, bd = None, 1.3
        for a in grid.near(h.xyz):
            if a.chain != h.chain or a.resi != h.resi:
                continue
            d = dist(a, h)
            if d < bd:
                best, bd = a, d
        if best is not None:
            attached[best.idx].append(h)
    return attached


def angle(p1, p2, p3):
    """Angle p1-p2-p3 en degres."""
    v1 = [p1[i] - p2[i] for i in range(3)]
    v2 = [p3[i] - p2[i] for i in range(3)]
    n1 = math.sqrt(sum(x * x for x in v1))
    n2 = math.sqrt(sum(x * x for x in v2))
    if n1 == 0 or n2 == 0:
        return 0.0
    cos = sum(v1[i] * v2[i] for i in range(3)) / (n1 * n2)
    return math.degrees(math.acos(max(-1.0, min(1.0, cos))))


def find_hbonds(atoms, ch_a, ch_b):
    """Liaisons H inter-chaines, avec hydrogenes explicites et critere d'angle."""
    attached = build_hydrogen_map(atoms)
    heavy = [a for a in atoms if a.elem != 'H']
    acceptors = [a for a in heavy if a.elem in ('N', 'O', 'S')]
    grid = Grid(acceptors, HB_DA_MAX)
    out = []
    for donor in heavy:
        if donor.elem not in ('N', 'O', 'S'):
            continue
        hs = attached.get(donor.idx)
        if not hs:
            continue
        for acc in grid.near(donor.xyz):
            if acc.chain == donor.chain:
                continue
            if {donor.chain, acc.chain} != {ch_a, ch_b}:
                continue
            d_da = dist(donor, acc)
            if d_da > HB_DA_MAX:
                continue
            for h in hs:
                d_ha = dist(h, acc)
                if d_ha > HB_HA_MAX:
                    continue
                ang = angle(donor.xyz, h.xyz, acc.xyz)
                if ang < HB_ANGLE_MIN:
                    continue
                out.append((donor, acc, d_da, d_ha, ang))
                break
    return out


def find_salt_bridges(heavy, ch_a, ch_b):
    anions = [a for a in heavy if a.name in ANION.get(a.resn, ())
              or (a.name == 'OXT')]
    cations = [a for a in heavy if a.name in CATION.get(a.resn, ())]
    grid = Grid(cations, SALT_CUTOFF)
    out = []
    for an in anions:
        for cat in grid.near(an.xyz):
            if an.chain == cat.chain:
                continue
            if {an.chain, cat.chain} != {ch_a, ch_b}:
                continue
            d = dist(an, cat)
            if d <= SALT_CUTOFF:
                out.append((an, cat, d))
    return out


def find_hydrophobic(heavy, ch_a, ch_b):
    sel = [a for a in heavy
           if a.elem == 'C' and a.resn in PHOBIC_RES and a.name not in BACKBONE]
    aa = [a for a in sel if a.chain == ch_a]
    bb = [a for a in sel if a.chain == ch_b]
    grid = Grid(aa, PHOBIC_CUTOFF)
    best = {}
    for b in bb:
        for a in grid.near(b.xyz):
            d = dist(a, b)
            if d <= PHOBIC_CUTOFF:
                k = (a.key, b.key)
                if k not in best or d < best[k][2]:
                    best[k] = (a, b, d)
    return list(best.values())


# --------------------------------------------------------------------------
def sphere_points(n):
    """Points quasi uniformes sur la sphere unite (spirale de Fibonacci)."""
    pts = []
    phi = math.pi * (3.0 - math.sqrt(5.0))
    for i in range(n):
        y = 1 - (2.0 * i) / (n - 1)
        r = math.sqrt(max(0.0, 1 - y * y))
        th = phi * i
        pts.append((math.cos(th) * r, y, math.sin(th) * r))
    return pts


def sasa(atoms, n_points=SASA_POINTS):
    """Shrake-Rupley. Retourne {atom.idx: aire accessible en A^2}."""
    pts = sphere_points(n_points)
    radii = {a.idx: VDW.get(a.elem, 1.70) + PROBE for a in atoms}
    rmax = max(radii.values())
    grid = Grid(atoms, 2 * rmax)
    areas = {}
    for a in atoms:
        ra = radii[a.idx]
        neigh = [b for b in grid.near(a.xyz)
                 if b.idx != a.idx and dist(a, b) < ra + radii[b.idx]]
        acc = 0
        for p in pts:
            x = a.xyz[0] + ra * p[0]
            y = a.xyz[1] + ra * p[1]
            z = a.xyz[2] + ra * p[2]
            buried = False
            for b in neigh:
                rb = radii[b.idx]
                dx = x - b.xyz[0]
                dy = y - b.xyz[1]
                dz = z - b.xyz[2]
                if dx * dx + dy * dy + dz * dz < rb * rb:
                    buried = True
                    break
            if not buried:
                acc += 1
        areas[a.idx] = 4.0 * math.pi * ra * ra * acc / n_points
    return areas


# --------------------------------------------------------------------------
def main():
    pdb = sys.argv[1] if len(sys.argv) > 1 else "structures/complex.pdb"
    ch_a = sys.argv[2] if len(sys.argv) > 2 else "A"
    ch_b = sys.argv[3] if len(sys.argv) > 3 else "B"
    name_a, name_b = "TLR4", "Vaccin"

    atoms = read_pdb(pdb)
    heavy = [a for a in atoms if a.elem != 'H']
    ha = [a for a in heavy if a.chain == ch_a]
    hb_ = [a for a in heavy if a.chain == ch_b]
    if not ha or not hb_:
        print("ERREUR : chaines %s / %s introuvables." % (ch_a, ch_b))
        return 1

    os.makedirs("results/tables", exist_ok=True)

    # --- contacts ---------------------------------------------------------
    pairs = find_contacts(ha, hb_, PERIPHERY_CUTOFF)
    res_min = {}
    for a, b, d in pairs:
        k = (a.key, b.key)
        if k not in res_min or d < res_min[k][0]:
            res_min[k] = (d, a, b)

    core = {k: v for k, v in res_min.items() if v[0] <= CONTACT_CUTOFF}
    iface_a = sorted({k[0] for k in core}, key=lambda x: x[1])
    iface_b = sorted({k[1] for k in core}, key=lambda x: x[1])

    hbonds = find_hbonds(atoms, ch_a, ch_b)
    salts = find_salt_bridges(heavy, ch_a, ch_b)
    phobic = find_hydrophobic(heavy, ch_a, ch_b)

    # --- surface enfouie --------------------------------------------------
    s_all = sasa(heavy)
    s_a = sasa(ha)
    s_b = sasa(hb_)
    sasa_complex = sum(s_all.values())
    sasa_a = sum(s_a.values())
    sasa_b = sum(s_b.values())
    bsa_total = sasa_a + sasa_b - sasa_complex
    bsa_per_side = bsa_total / 2.0

    # --- CSV : interactions ----------------------------------------------
    rows = []
    for donor, acc, d_da, d_ha, ang in hbonds:
        p, q = (donor, acc) if donor.chain == ch_a else (acc, donor)
        role = "donneur TLR4" if donor.chain == ch_a else "donneur vaccin"
        rows.append([
            "Liaison hydrogene", ch_a, p.resn, p.resi, p.name,
            ch_b, q.resn, q.resi, q.name, "%.2f" % d_da,
            "%.2f" % d_ha, "%.0f" % ang, role])
    for an, cat, d in salts:
        p, q = (an, cat) if an.chain == ch_a else (cat, an)
        role = "TLR4 anionique" if an.chain == ch_a else "TLR4 cationique"
        rows.append([
            "Pont salin", ch_a, p.resn, p.resi, p.name,
            ch_b, q.resn, q.resi, q.name, "%.2f" % d, "", "", role])
    for a, b, d in phobic:
        rows.append([
            "Contact hydrophobe", ch_a, a.resn, a.resi, a.name,
            ch_b, b.resn, b.resi, b.name, "%.2f" % d, "", "", ""])
    for (ka, kb), (d, a, b) in sorted(core.items(), key=lambda x: x[1][0]):
        rows.append([
            "Contact vdW", ch_a, ka[2], ka[1], a.name,
            ch_b, kb[2], kb[1], b.name, "%.2f" % d, "", "", ""])

    header = ["type_interaction", "chaine_1", "residu_1", "numero_1", "atome_1",
              "chaine_2", "residu_2", "numero_2", "atome_2",
              "distance_A", "distance_H_A", "angle_deg", "remarque"]
    with open("results/tables/interactions.csv", "w") as fh:
        fh.write(",".join(header) + "\n")
        for r in rows:
            fh.write(",".join(str(x) for x in r) + "\n")

    # --- CSV : residus d'interface ---------------------------------------
    def partners_of(key, side):
        out = set()
        for (ka, kb) in core:
            if side == 'a' and ka == key:
                out.add("%s%d" % (kb[2].capitalize(), kb[1]))
            if side == 'b' and kb == key:
                out.add("%s%d" % (ka[2].capitalize(), ka[1]))
        return out

    types_by_res = defaultdict(set)
    for donor, acc, *_ in hbonds:
        types_by_res[donor.key].add("liaison H")
        types_by_res[acc.key].add("liaison H")
    for an, cat, _ in salts:
        types_by_res[an.key].add("pont salin")
        types_by_res[cat.key].add("pont salin")
    for a, b, _ in phobic:
        types_by_res[a.key].add("hydrophobe")
        types_by_res[b.key].add("hydrophobe")

    with open("results/tables/interface_residues.csv", "w") as fh:
        fh.write("partenaire,chaine,residu,numero,code1,distance_min_A,"
                 "types_interaction,residus_partenaires\n")
        for side, keys, label in (('a', iface_a, name_a), ('b', iface_b, name_b)):
            for k in keys:
                dmin = min(v[0] for kk, v in core.items()
                           if (kk[0] if side == 'a' else kk[1]) == k)
                fh.write("%s,%s,%s,%d,%s,%.2f,%s,%s\n" % (
                    label, k[0], k[2], k[1], THREE2ONE.get(k[2], 'X'), dmin,
                    "|".join(sorted(types_by_res.get(k, {"vdW"}))),
                    "|".join(sorted(partners_of(k, side)))))

    # --- synthese ---------------------------------------------------------
    def fmt(keys):
        return " ".join("%s%d" % (k[2].capitalize(), k[1]) for k in keys)

    lines = []
    W = lines.append
    W("=" * 78)
    W("SYNTHESE DE L'INTERFACE  %s (chaine %s)  <->  %s (chaine %s)"
      % (name_a, ch_a, name_b, ch_b))
    W("=" * 78)
    W("Structure : %s" % pdb)
    W("")
    W("SURFACE ENFOUIE")
    W("  SASA %s isole        : %8.1f A^2" % (name_a, sasa_a))
    W("  SASA %s isole      : %8.1f A^2" % (name_b, sasa_b))
    W("  SASA du complexe      : %8.1f A^2" % sasa_complex)
    W("  Surface enfouie totale: %8.1f A^2" % bsa_total)
    W("  Surface enfouie / cote: %8.1f A^2" % bsa_per_side)
    W("")
    W("DENOMBREMENT")
    W("  Residus d'interface %-8s (<= %.1f A) : %d" % (name_a, CONTACT_CUTOFF, len(iface_a)))
    W("  Residus d'interface %-8s (<= %.1f A) : %d" % (name_b, CONTACT_CUTOFF, len(iface_b)))
    W("  Couples de residus en contact          : %d" % len(core))
    W("  Liaisons hydrogene                     : %d" % len(hbonds))
    W("  Ponts salins                           : %d" % len(salts))
    W("  Contacts hydrophobes (couples)         : %d" % len(phobic))
    W("")
    W("RESIDUS D'INTERFACE - %s (chaine %s)" % (name_a, ch_a))
    W("  " + fmt(iface_a))
    W("")
    W("RESIDUS D'INTERFACE - %s (chaine %s)" % (name_b, ch_b))
    W("  " + fmt(iface_b))
    W("")
    W("LIAISONS HYDROGENE (D...A <= %.1f A, H...A <= %.1f A, angle >= %d deg)"
      % (HB_DA_MAX, HB_HA_MAX, HB_ANGLE_MIN))
    if not hbonds:
        W("  aucune")
    for donor, acc, d_da, d_ha, ang in sorted(hbonds, key=lambda x: x[2]):
        W("  %s %s %-4s  ...  %s %s %-4s   D...A %.2f A   H...A %.2f A   %3.0f deg"
          % (donor.chain, donor.label(), donor.name,
             acc.chain, acc.label(), acc.name, d_da, d_ha, ang))
    W("")
    W("PONTS SALINS (<= %.1f A)" % SALT_CUTOFF)
    if not salts:
        W("  aucun")
    for an, cat, d in sorted(salts, key=lambda x: x[2]):
        W("  %s %s %-4s  ...  %s %s %-4s   %.2f A"
          % (an.chain, an.label(), an.name, cat.chain, cat.label(), cat.name, d))
    W("")
    W("CONTACTS HYDROPHOBES (C...C <= %.1f A, chaines laterales apolaires)" % PHOBIC_CUTOFF)
    if not phobic:
        W("  aucun")
    seen = set()
    for a, b, d in sorted(phobic, key=lambda x: x[2]):
        k = (a.key, b.key)
        if k in seen:
            continue
        seen.add(k)
        W("  %s %-8s  ...  %s %-8s   %.2f A"
          % (a.chain, a.label(), b.chain, b.label(), d))
    W("")
    W("=" * 78)
    W("AVERTISSEMENT METHODOLOGIQUE")
    W("=" * 78)
    W("Ces resultats decrivent UNE conformation issue d'un docking corps-rigide.")
    W("Ils identifient des interactions GEOMETRIQUEMENT POSSIBLES dans cette pose.")
    W("Ils ne demontrent AUCUNE stabilite, ni aucune pertinence biologique.")
    W("")
    W("Formulation acceptable  : 'in the docked complex, residues X and Y form")
    W("                          a predicted hydrogen bond (2.9 A)'")
    W("Formulation NON valide  : 'residue X forms a key/stable hydrogen bond'")
    W("")
    W("Pour affirmer la stabilite il faut l'occupation sur une trajectoire de")
    W("dynamique moleculaire (gmx hbond, MDAnalysis) : une liaison presente dans")
    W(">= 50-70 %% des frames est rapportable comme stable. PyMOL ne peut pas")
    W("fournir cette information, quelle que soit la commande utilisee.")
    W("=" * 78)

    text = "\n".join(lines)
    with open("results/tables/summary.txt", "w") as fh:
        fh.write(text + "\n")
    print(text)

    write_pymol_script(ch_a, ch_b, iface_a, iface_b, hbonds, salts, name_a, name_b)
    print("")
    print("Fichiers ecrits :")
    print("  results/tables/summary.txt")
    print("  results/tables/interface_residues.csv")
    print("  results/tables/interactions.csv")
    print("  scripts/03_figure.pml")
    return 0


def write_pymol_script(ch_a, ch_b, iface_a, iface_b, hbonds, salts, name_a, name_b):
    """Genere le script PyMOL de figure a partir des residus reellement trouves.

    Le script cree deux objets separes (un par partenaire) : c'est indispensable
    car cartoon_transparency et surface_* sont des reglages d'OBJET, pas de
    selection -- les appliquer a une selection dans un objet unique n'a aucun
    effet.
    """
    sel_a = "+".join(str(k[1]) for k in iface_a) or "0"
    sel_b = "+".join(str(k[1]) for k in iface_b) or "0"

    def obj_of(chain):
        return "tlr4" if chain == ch_a else "vaccin"

    hb_list = ",\n".join(
        '    ("%s", %d, "%s", "%s", %d, "%s", %.2f)'
        % (obj_of(d.chain), d.resi, d.name, obj_of(a.chain), a.resi, a.name, dd)
        for d, a, dd, _, _ in sorted(hbonds, key=lambda x: x[2]))
    sb_list = ",\n".join(
        '    ("%s", %d, "%s", "%s", %d, "%s", %.2f)'
        % (obj_of(an.chain), an.resi, an.name, obj_of(c.chain), c.resi, c.name, dd)
        for an, c, dd in sorted(salts, key=lambda x: x[2]))

    # Residus impliques dans une interaction polaire : ce sont les seuls qu'on
    # etiquette, sinon la figure est illisible (71 etiquettes sur 41+30 residus).
    polar_a, polar_b = set(), set()
    for d, a, *_ in hbonds:
        (polar_a if d.chain == ch_a else polar_b).add(d.resi)
        (polar_a if a.chain == ch_a else polar_b).add(a.resi)
    for an, c, _ in salts:
        (polar_a if an.chain == ch_a else polar_b).add(an.resi)
        (polar_a if c.chain == ch_a else polar_b).add(c.resi)

    tpl = '''# =====================================================================
# 03_figure.pml -- figure de publication de l'interface {na} / {nb}
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
create tlr4,   complex and chain {ca} and polymer
create vaccin, complex and chain {cb} and polymer
delete complex

hide everything
show cartoon, tlr4 or vaccin
color grey70,   tlr4
color palecyan, vaccin

# --- residus d'interface ---------------------------------------------
select if_tlr4,   tlr4   and resi {sa}
select if_vaccin, vaccin and resi {sb}
select polar_tlr4,   tlr4   and resi {pa}
select polar_vaccin, vaccin and resi {pb}

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
{hblist}
]
SALTS = [
{sblist}
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
'''
    txt = tpl.format(
        ca=ch_a, cb=ch_b, sa=sel_a, sb=sel_b,
        pa="+".join(str(x) for x in sorted(polar_a)) or "0",
        pb="+".join(str(x) for x in sorted(polar_b)) or "0",
        hblist=hb_list, sblist=sb_list,
        na=name_a, nb=name_b)
    os.makedirs("scripts", exist_ok=True)
    with open("scripts/03_figure.pml", "w") as fh:
        fh.write(txt)


if __name__ == "__main__":
    sys.exit(main())
