# =====================================================================
# 01_inventory.pml  --  STEP 1: structural inventory / sanity check
# ---------------------------------------------------------------------
# PURPOSE
#   Read the complex ONCE and report, without modifying anything:
#     1. file-level facts (atoms, states, hydrogens, waters, HETATMs)
#     2. per-chain inventory (atoms, residues, numbering range, gaps)
#     3. residue names that are not standard amino acids
#     4. polymer continuity (CA-CA breaks) -> tells us whether the
#        chain IDs actually correspond to separate molecules
#
# HOW TO RUN (from the project root directory):
#   pymol -cq scripts/01_inventory.pml > results/logs/01_inventory.txt 2>&1
#   ...then open results/logs/01_inventory.txt
#
#   Or inside the PyMOL GUI:  @scripts/01_inventory.pml
#
# NOTE: this script is READ-ONLY. It never deletes, renames, or edits
#       an atom. Nothing here can damage your structure.
# =====================================================================

reinitialize
load structures/complex.pdb, complex

python
from pymol import cmd
from collections import Counter

obj = "complex"

STD_AA = set("ALA ARG ASN ASP CYS GLN GLU GLY HIS ILE LEU LYS "
             "MET PHE PRO SER THR TRP TYR VAL".split())
# residue names produced by MD force fields / protonation tools
MD_VARIANTS = set("HID HIE HIP HSD HSE HSP CYX CYM ASH GLH LYN "
                  "ACE NME NMA NHE NH2 CT3".split())

records = []
cmd.iterate(obj,
            "records.append((chain, segi, resv, resi, resn, alt))",
            space={"records": records})

def show(ch):
    return ch if ch.strip() else "(blank)"

# ---------------------------------------------------------------------
print("=" * 78)
print("1. FILE-LEVEL SUMMARY")
print("=" * 78)
print("  object loaded        : %s" % obj)
print("  states (MD frames)   : %d" % cmd.count_states(obj))
print("  total atoms          : %d" % cmd.count_atoms(obj))
print("  hydrogen atoms       : %d" % cmd.count_atoms(obj + " and hydro"))
print("  water atoms          : %d" % cmd.count_atoms(obj + " and solvent"))
print("  HETATM-flagged atoms : %d" % cmd.count_atoms(obj + " and hetatm"))
print("  atoms with altloc    : %d" % sum(1 for r in records if r[5].strip()))
print("  chain IDs seen       : %s" % (cmd.get_chains(obj) or "NONE"))
print("  segi values seen     : %s" % sorted({r[1] for r in records}))
print("")

# ---------------------------------------------------------------------
print("=" * 78)
print("2. PER-CHAIN INVENTORY")
print("=" * 78)
print("  %-10s %9s %9s %10s %10s   %s"
      % ("chain", "atoms", "residues", "first_res", "last_res", "numbering_gaps"))
print("  " + "-" * 74)

for ch in sorted({r[0] for r in records}):
    sub = [r for r in records if r[0] == ch]
    uniq_res = {(r[1], r[3]) for r in sub}          # (segi, resi) = true residue key
    nums = sorted({r[2] for r in sub})
    gaps = ["%d->%d" % (a, b) for a, b in zip(nums, nums[1:]) if b != a + 1]
    gap_txt = "none" if not gaps else ", ".join(gaps[:5]) + (" ..." if len(gaps) > 5 else "")
    print("  %-10s %9d %9d %10d %10d   %s"
          % (show(ch), len(sub), len(uniq_res), nums[0], nums[-1], gap_txt))
print("")

# ---------------------------------------------------------------------
print("=" * 78)
print("3. RESIDUE NAMES THAT ARE NOT STANDARD AMINO ACIDS")
print("=" * 78)
odd = Counter()
for ch, segi, resv, resi, resn, alt in records:
    if resn not in STD_AA:
        odd[(ch, resn)] += 1
if not odd:
    print("  none - every residue is a standard amino acid")
else:
    for (ch, resn), n in sorted(odd.items()):
        if resn in MD_VARIANTS:
            tag = "force-field protonation / terminal-cap variant"
        elif resn in ("HOH", "WAT", "TIP3", "SOL"):
            tag = "water"
        elif resn in ("NA", "CL", "K", "MG", "CA", "ZN", "SOD", "CLA", "POT"):
            tag = "ion"
        else:
            tag = "LIGAND / GLYCAN / NUCLEIC / UNKNOWN  <-- inspect this"
        print("  chain %-10s %-6s %7d atoms   %s" % (show(ch), resn, n, tag))
print("")

# ---------------------------------------------------------------------
print("=" * 78)
print("4. POLYMER CONTINUITY CHECK  (consecutive CA-CA distance)")
print("=" * 78)
print("  A real peptide bond gives CA-CA ~3.8 A. Anything > 4.5 A means the")
print("  two residues are NOT covalently connected, i.e. a true chain break.")
print("")
ca = []
cmd.iterate_state(1, obj + " and polymer and name CA",
                  "ca.append((chain, resv, resn, x, y, z))", space={"ca": ca})

if len(ca) < 2:
    print("  WARNING: fewer than 2 CA atoms found. Is this really a protein,")
    print("           and did the file load correctly?")
else:
    nbreak = 0
    prev = None
    for cur in ca:
        if prev is not None and prev[0] == cur[0]:
            d = ((prev[3] - cur[3]) ** 2 +
                 (prev[4] - cur[4]) ** 2 +
                 (prev[5] - cur[5]) ** 2) ** 0.5
            if d > 4.5:
                nbreak += 1
                print("  BREAK in chain %-8s between %s%d and %s%d    CA-CA = %6.2f A"
                      % (show(cur[0]), prev[2], prev[1], cur[2], cur[1], d))
        prev = cur
    print("")
    if nbreak == 0:
        print("  -> no breaks: each chain ID is one continuous polymer. Good.")
    else:
        print("  -> %d break(s) found. If a single chain ID contains a break," % nbreak)
        print("     two different molecules may have been merged under one ID.")
print("")
print("=" * 78)
print("END OF STEP 1 INVENTORY")
print("=" * 78)
python end
