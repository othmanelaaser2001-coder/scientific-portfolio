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
| 2 | _(next)_ | Assign molecular identity to each chain (which is TLR4, which is the vaccine) |
| 3 | _(next)_ | Interface residue detection by heavy-atom distance cutoff |
| 4 | _(next)_ | Hydrogen-bond detection (geometry) |
| 5 | _(next)_ | Salt-bridge detection (charged-group geometry) |
| 6 | _(next)_ | Hydrophobic contact detection |
| 7 | _(next)_ | Export interaction tables |
| 8 | _(next)_ | Publication figure + session + high-resolution images |

## Important caveat carried through the whole workflow

Everything PyMOL reports is **geometry in a single conformation**. Geometric
contacts are hypotheses, not measured interactions. Claims made in a paper
about "stable" or "key" hydrogen bonds require occupancy over the MD
trajectory (e.g. `gmx hbond`, MDAnalysis, or PLIP over multiple frames),
not a single frame. See `notes/` for how each reported interaction was
validated.
