#!/usr/bin/env python3
"""
01_inventory.py -- ETAPE 1 : inventaire structural d'un complexe PDB.

LECTURE SEULE. Ce script ne modifie jamais le fichier d'entree.

Il repond aux questions qu'il faut resoudre AVANT toute analyse
d'interface :
  1. de quoi le fichier est-il fait (types d'enregistrements, blocs) ?
  2. combien de chaines, quelle numerotation, y a-t-il des trous ?
  3. y a-t-il des residus non standards (ligands, ions, eau, glycanes) ?
  4. les hydrogenes sont-ils presents, et lesquels (tous / polaires seuls) ?
  5. les chaines sont-elles continues (pas de rupture de liaison peptidique) ?
  6. les deux partenaires sont-ils reellement en contact ?
  7. les sequences, pour pouvoir identifier chaque chaine par BLAST.

Aucune dependance externe : Python 3 standard suffit.

UTILISATION, depuis le dossier vaccine_tlr4_analysis :
    python scripts/01_inventory.py structures/complex.pdb
    python scripts/01_inventory.py structures/complex.pdb > results/logs/01_inventory.txt
"""

import math
import sys
from collections import Counter, defaultdict

THREE2ONE = {
    'ALA': 'A', 'ARG': 'R', 'ASN': 'N', 'ASP': 'D', 'CYS': 'C',
    'GLN': 'Q', 'GLU': 'E', 'GLY': 'G', 'HIS': 'H', 'ILE': 'I',
    'LEU': 'L', 'LYS': 'K', 'MET': 'M', 'PHE': 'F', 'PRO': 'P',
    'SER': 'S', 'THR': 'T', 'TRP': 'W', 'TYR': 'Y', 'VAL': 'V',
}

# Colonnes du format PDB officiel, en indices Python (0-based).
COL = {
    'record': (0, 6), 'name': (12, 16), 'altloc': (16, 17),
    'resn': (17, 20), 'chain': (21, 22), 'resi': (22, 26), 'icode': (26, 27),
    'x': (30, 38), 'y': (38, 46), 'z': (46, 54),
    'occ': (54, 60), 'bfac': (60, 66), 'segi': (72, 76), 'elem': (76, 78),
}


def field(line, key):
    a, b = COL[key]
    return line[a:b].strip()


def rule(title):
    print("=" * 74)
    print(title)
    print("=" * 74)


def load(path):
    with open(path) as fh:
        return fh.read().splitlines()


def section_file(lines):
    rule("1. DE QUOI LE FICHIER EST-IL FAIT ?")
    print("  lignes totales : %d" % len(lines))
    types = Counter(line[:6].strip() for line in lines)
    for name, n in types.most_common():
        print("    %-8s %8d" % (name or "(vide)", n))
    print()
    print("  Lignes non atomiques (en-tetes, remarques, separateurs) :")
    n_shown = 0
    for line in lines:
        if not line.startswith(("ATOM", "HETATM")):
            print("    | " + line[:70])
            n_shown += 1
            if n_shown >= 25:
                print("    | ... (tronque)")
                break
    print()


def section_chains(atoms):
    rule("2. INVENTAIRE PAR CHAINE")
    print("  %-8s %9s %9s %14s %10s %8s" %
          ("chaine", "atomes", "residus", "numerotation", "segid", "trous"))
    print("  " + "-" * 64)
    by_chain = defaultdict(list)
    for line in atoms:
        by_chain[field(line, 'chain')].append(line)
    for chain in sorted(by_chain):
        sub = by_chain[chain]
        nums = sorted({int(field(line, 'resi')) for line in sub})
        gaps = [(a, b) for a, b in zip(nums, nums[1:]) if b != a + 1]
        segi = sorted({field(line, 'segi') for line in sub})
        print("  %-8s %9d %9d %14s %10s %8d" % (
            chain or "(vide)", len(sub), len(nums),
            "%d-%d" % (nums[0], nums[-1]), ",".join(segi) or "-", len(gaps)))
        for a, b in gaps[:10]:
            print("           trou : %d -> %d  (%d residus manquants)" % (a, b, b - a - 1))
    print()


def section_residues(atoms):
    rule("3. RESIDUS NON STANDARDS")
    odd = Counter((field(l, 'chain'), field(l, 'resn'))
                  for l in atoms if field(l, 'resn') not in THREE2ONE)
    if not odd:
        print("  aucun : tous les residus sont des acides amines standards.")
    else:
        for (chain, resn), n in sorted(odd.items()):
            print("  chaine %-6s %-6s %6d atomes" % (chain or "(vide)", resn, n))
    alt = Counter(field(l, 'altloc') for l in atoms)
    n_alt = sum(v for k, v in alt.items() if k)
    print("  atomes avec position alternative (altloc) : %d" % n_alt)
    print()


def section_hydrogens(atoms):
    rule("4. HYDROGENES")
    elems = Counter(field(l, 'elem') for l in atoms)
    print("  composition elementaire : %s" % dict(elems))
    hyd = [l for l in atoms if field(l, 'elem') == 'H'
           or (not field(l, 'elem') and field(l, 'name').lstrip('0123456789').startswith('H'))]
    print("  atomes d'hydrogene : %d / %d (%.0f %%)"
          % (len(hyd), len(atoms), 100.0 * len(hyd) / max(1, len(atoms))))
    if not hyd:
        print("  -> AUCUN hydrogene : structure en atomes lourds seuls.")
        print("     Les liaisons hydrogene devront etre deduites de la geometrie")
        print("     donneur/accepteur lourds, ou apres ajout d'hydrogenes predits.")
        print()
        return
    # Un hydrogene apolaire porte un nom du type HA, HB2, HG12 (porte par un C).
    # Un hydrogene polaire porte un nom du type H, HG1, HZ1, HD21 (porte par N/O/S).
    apolar = {'HA', 'HA2', 'HA3', 'HB', 'HB1', 'HB2', 'HB3'}
    n_apolar = sum(1 for l in hyd if field(l, 'name') in apolar)
    names = Counter(field(l, 'name') for l in hyd)
    print("  noms d'hydrogene distincts : %d" % len(names))
    print("  exemples : %s" % ", ".join(n for n, _ in names.most_common(10)))
    if n_apolar == 0:
        print("  -> hydrogenes POLAIRES SEULEMENT (aucun HA/HB porte par un carbone).")
        print("     Suffisant pour les liaisons hydrogene et les ponts salins.")
        print("     Insuffisant pour un calcul d'energie tout-atome.")
    else:
        print("  -> hydrogenes complets (apolaires presents : %d)." % n_apolar)
    print()


def section_continuity(atoms):
    rule("5. CONTINUITE DES CHAINES (distance CA-CA consecutive)")
    print("  Une liaison peptidique donne CA-CA ~ 3.8 A.")
    print("  Au-dela de 4.5 A, les deux residus ne sont pas lies : rupture reelle.")
    print()
    cas = [(field(l, 'chain'), int(field(l, 'resi')), field(l, 'resn'),
            float(field(l, 'x')), float(field(l, 'y')), float(field(l, 'z')))
           for l in atoms if field(l, 'name') == 'CA']
    print("  nombre de carbones alpha : %d" % len(cas))
    breaks = 0
    for prev, cur in zip(cas, cas[1:]):
        if prev[0] != cur[0]:
            continue
        d = math.dist(prev[3:6], cur[3:6])
        if d > 4.5:
            breaks += 1
            print("  RUPTURE chaine %s entre %s%d et %s%d : CA-CA = %.2f A"
                  % (cur[0], prev[2], prev[1], cur[2], cur[1], d))
    if breaks == 0:
        print("  -> aucune rupture : chaque chaine est un polymere continu.")
    else:
        print("  -> %d rupture(s). Une chaine contenant une rupture peut cacher" % breaks)
        print("     deux molecules distinctes fusionnees sous un meme identifiant.")
    print()


def section_contact(atoms, cutoff=4.0, cell=5.0):
    rule("6. LES PARTENAIRES SONT-ILS EN CONTACT ?")
    chains = sorted({field(l, 'chain') for l in atoms})
    if len(chains) != 2:
        print("  %d chaines detectees : verification de contact ignoree." % len(chains))
        print()
        return
    ca, cb = chains
    heavy = [l for l in atoms if field(l, 'elem') != 'H']

    def coords(chain):
        return [(float(field(l, 'x')), float(field(l, 'y')), float(field(l, 'z')))
                for l in heavy if field(l, 'chain') == chain]

    pa, pb = coords(ca), coords(cb)
    grid = defaultdict(list)
    for p in pa:
        grid[(int(p[0] // cell), int(p[1] // cell), int(p[2] // cell))].append(p)
    best, n_close = float('inf'), 0
    for q in pb:
        k = (int(q[0] // cell), int(q[1] // cell), int(q[2] // cell))
        close = False
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for p in grid[(k[0] + dx, k[1] + dy, k[2] + dz)]:
                        d = math.dist(p, q)
                        best = min(best, d)
                        if d <= cutoff:
                            close = True
        if close:
            n_close += 1
    print("  atomes lourds : chaine %s = %d, chaine %s = %d" % (ca, len(pa), cb, len(pb)))
    print("  distance lourd-lourd minimale entre %s et %s : %.2f A" % (ca, cb, best))
    print("  atomes lourds de %s a moins de %.1f A de %s : %d" % (cb, cutoff, ca, n_close))
    if best > 5.0:
        print("  -> ATTENTION : les deux chaines ne se touchent pas. Ce n'est pas un complexe.")
    elif best < 2.0:
        print("  -> ATTENTION : contact anormalement court (< 2.0 A), possible clash sterique.")
    else:
        print("  -> interface reelle : les deux partenaires sont bien en contact.")
    print()


def section_sequences(atoms):
    rule("7. SEQUENCES (a verifier par BLAST, ne jamais supposer l'identite)")
    by_chain = defaultdict(list)
    seen = defaultdict(set)
    for line in atoms:
        chain = field(line, 'chain')
        key = (field(line, 'resi'), field(line, 'icode'))
        if key in seen[chain]:
            continue
        seen[chain].add(key)
        by_chain[chain].append(THREE2ONE.get(field(line, 'resn'), 'X'))
    for chain in sorted(by_chain):
        seq = "".join(by_chain[chain])
        print(">chaine_%s | %d residus" % (chain or "vide", len(seq)))
        for i in range(0, len(seq), 60):
            print("  %4d %s" % (i + 1, seq[i:i + 60]))
        print()


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "structures/complex.pdb"
    print("Fichier analyse : %s" % path)
    print()
    lines = load(path)
    atoms = [l for l in lines if l.startswith(("ATOM", "HETATM")) and len(l) >= 54]
    if not atoms:
        print("ERREUR : aucun enregistrement ATOM/HETATM lisible.")
        return 1
    section_file(lines)
    section_chains(atoms)
    section_residues(atoms)
    section_hydrogens(atoms)
    section_continuity(atoms)
    section_contact(atoms)
    section_sequences(atoms)
    rule("FIN DE L'INVENTAIRE")
    return 0


if __name__ == "__main__":
    sys.exit(main())
