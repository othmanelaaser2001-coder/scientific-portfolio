# Vaccine–TLR4 interface analysis (PyMOL workflow)

Reproducible workflow for characterising and visualising the protein–protein
interface of a vaccine construct bound to TLR4, starting from a final
docked/MD structure and ending with a publication-quality figure.

## Directory layout

```
vaccine_tlr4_analysis/
├── structures/          # coordinate files (inputs; never edited in place)
│   ├── complex_original.pdb   # untouched copy of what you produced
│   ├── complex.pdb            # the working copy every script reads
│   └── reference_docked.pdb   # pre-MD docked pose (keeps real chain IDs)
├── scripts/             # numbered PyMOL / Python scripts, run in order
├── results/
│   ├── logs/            # captured text output of each script
│   ├── tables/          # contact / H-bond / salt-bridge tables (CSV)
│   └── figures/         # ray-traced PNG/TIFF output
├── sessions/            # saved .pse PyMOL sessions
└── notes/               # provenance: where each file came from
```

## Running a script

From inside `vaccine_tlr4_analysis/`:

```bash
pymol -cq scripts/01_inventory.pml > results/logs/01_inventory.txt 2>&1
```

`-c` = no GUI, `-q` = quiet startup. Drop both flags (`pymol scripts/...`)
to watch it happen in the GUI instead.

## Workflow steps

| # | Script | Purpose |
|---|--------|---------|
| 1 | `01_inventory.pml` | Structural inventory: chains, residue numbering, gaps, non-standard residues, chain breaks |
| 2 | — | Identity of each chain, verified against reference sequences (see `notes/provenance.md`) |
| 3–7 | `02_interface_analysis.py` | Interface residues, hydrogen bonds, salt bridges, hydrophobic contacts, buried surface area, CSV tables |
| 8 | `03_figure.pml` | Publication figures + PyMOL session (generated automatically by step 3–7) |

## Important caveat carried through the whole workflow

Everything PyMOL reports is **geometry in a single conformation**. Geometric
contacts are hypotheses, not measured interactions. Claims made in a paper
about "stable" or "key" hydrogen bonds require occupancy over the MD
trajectory (e.g. `gmx hbond`, MDAnalysis, or PLIP over multiple frames),
not a single frame. See `notes/` for how each reported interaction was
validated.


## Rejouer le pipeline sur une autre construction (V2, V3, ...)

Trois commandes, aucun script à modifier :

```powershell
Copy-Item "chemin\vers\V2hantaTLR4G8A.pdb" -Destination "structures\complex.pdb" -Force
python scripts\01_inventory.py structures\complex.pdb > results\logs\01_inventory.txt
python scripts\02_interface_analysis.py structures\complex.pdb A B
```

puis dans PyMOL : `@scripts/03_figure.pml`

`03_figure.pml` est **régénéré** à chaque exécution de l'étape 2 à partir des
résidus réellement détectés — il n'y a donc jamais de résidu codé en dur qui
traînerait d'une analyse précédente.
