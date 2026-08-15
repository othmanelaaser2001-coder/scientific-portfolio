# Provenance des fichiers d'entrée

## Structure analysée

| Champ | Valeur |
|---|---|
| Nom d'origine | `V1hantaTLR4G8A.pdb` |
| Chemin source | `C:\Users\outhmane\Desktop\vaccin contre andes\complexe vaccin 4G8A\V1hantaTLR4G8A.pdb` |
| Taille | 810 315 octets |
| MD5 | `BBCC99205DDBBD066846B8DA1BB124E9` |
| Copié vers | `structures/complex.pdb` et `structures/complex_original.pdb` |
| Date de copie | 2026-08-15 |
| Vérification | Les 3 empreintes MD5 (source + 2 copies) sont identiques |

## Contexte

- Vaccin : construction **V1** contre l'hantavirus (Andes / Hantaan)
- Séquence du vaccin : `Desktop\vaccin contre andes\Vaccin-1Hanta.fasta` (502 octets)
- Récepteur : TLR4, basé sur l'entrée PDB **4G8A** (à confirmer par la séquence, non supposé)
- Constructions parallèles disponibles : `V2hantaTLR4G8A.pdb`, `V3hantaTLR4G8A.pdb`
  → le même pipeline devra tourner à l'identique sur les trois.

## Résultats de l'inventaire (étape 1)

Sortie complète : `results/logs/01_inventory.txt`

| Observation | Valeur |
|---|---|
| Lignes / atomes | 10 261 / 10 256 (tous `ATOM`, aucun `HETATM`) |
| Blocs internes | `HEADER rec.pdb` puis `HEADER lig.000.01.pdb`, séparés par `TER` |
| Chaîne A | 601 résidus, numérotés **27–627**, segid `RA0`, aucun trou |
| Chaîne B | 477 résidus, numérotés **1–477**, segid `LB0`, aucun trou |
| Résidus non standards | aucun (pas d'eau, d'ion, de ligand, de glycane) |
| Positions alternatives | aucune |
| Hydrogènes | 1 836 / 10 256 (18 %), **polaires uniquement** (aucun HA/HB) |
| Ruptures de chaîne (CA–CA > 4,5 Å) | aucune |
| Distance minimale lourd–lourd A↔B | 2,46 Å |
| Atomes lourds de B à ≤ 4,0 Å de A | 115 |
| Occupancies / B-factors | tous 1,00 / tous 0,00 (valeurs synthétiques) |

### Interprétation

- Le fichier est la **concaténation d'un récepteur et d'un ligand issus d'un docking
  corps-rigide** (`rec.pdb` + `lig.000.01.pdb`). Ce n'est **pas** une frame de dynamique
  moléculaire : B-factors nuls, occupancies unitaires, hydrogènes polaires seuls,
  aucune molécule d'eau.
- Chaîne A : protéine à répétitions riches en leucine (motifs `LxxLxLxxN` récurrents),
  numérotation 27–627 compatible avec l'ectodomaine de TLR4 humain (peptide signal 1–23).
  **À confirmer par BLAST contre UniProt O00206** — non supposé.
- Chaîne B : architecture typique d'un vaccin multi-épitopes —
  adjuvant β-défensine en N-terminal, linker rigide `EAAAK`, épitopes séparés par
  `GPGPG` puis `AAY`, étiquette `HHHHHH` en C-terminal.
  **À confirmer contre `Vaccin-1Hanta.fasta`** — non supposé.
- MD-2 est **absent** : le complexe ne contient que deux chaînes.

## À documenter (obligatoire pour la section Méthodes)

- [ ] Logiciel de docking utilisé et version (le format `rec.pdb` / `lig.000.01.pdb` est à préciser)
- [ ] Ce fichier a-t-il été soumis à une dynamique moléculaire ? Si oui, où est la structure post-MD ?
- [ ] Si MD : quelle trajectoire, quelle frame, et **comment** cette frame a été choisie
      (structure représentative du cluster le plus peuplé / frame moyenne / dernière frame)
- [ ] Champ de force et durée de simulation, le cas échéant
- [x] Vérification BLAST de la chaîne A — voir ci-dessous
- [ ] Confirmer si la structure source est 4G8A ou 3FXI (déplier le cluster BLAST)
- [ ] Vérifier si Gly299 / Ile399 se trouvent à l'interface avec le vaccin (étape 3)

## Vérification d'identité — chaîne A (récepteur)

BLASTP, base ClusteredNR, RID `81GWUEYB014`, longueur de requête 601.

| Champ | Valeur |
|---|---|
| Meilleur résultat | `Chain A, Toll-like receptor 4 [Homo sapiens]` |
| Accession | `3FXI_A` (représentant d'un cluster de 2 membres, 1 organisme) |
| Query Cover | 100 % |
| E value | 0.0 |
| Per. Ident | **99,67 %** |
| Max Score | 1209 |

**Conclusion : la chaîne A est l'ectodomaine de TLR4 humain.** Numérotation 27–627,
conforme à la numérotation UniProt (peptide signal 1–23 retiré), 601 résidus sans trou.

### ⚠️ Le récepteur porte le variant polymorphe D299G / T399I

99,67 % d'identité sur 601 résidus correspond à **2 différences**. Vérification directe
dans le fichier :

| Position | Résidu de référence (canonique) | Résidu dans cette structure |
|---|---|---|
| 299 | Asp (D) | **Gly (G)** |
| 399 | Thr (T) | **Ile (I)** |

Ce sont exactement les deux polymorphismes humains documentés de TLR4
(**D299G** = rs4986790, **T399I** = rs4986791), tous deux situés dans l'ectodomaine.

**Conséquence pour l'article :** la section Méthodes doit préciser que le récepteur
modélisé est le variant D299G/T399I et non la forme canonique. Ces variants sont
associés à une réponse modifiée au LPS ; si l'un des deux se révèle à l'interface
avec le vaccin, cela devient un point de discussion majeur — à vérifier à l'étape 3.
- [x] Vérification de la chaîne B contre `Vaccin-1Hanta.fasta` — voir ci-dessous

## Vérification d'identité — chaîne B (vaccin)

| Élément | Valeur |
|---|---|
| Référence | `Desktop\vaccin contre andes\Vaccin-1Hanta.fasta` |
| En-tête du FASTA | `>1Vhanta\|andes\|4600aa` |
| Longueur de la référence | 477 aa |
| Longueur de la chaîne B du PDB | 477 aa |
| Différences | 0 |
| **Identité** | **477/477 = 100,00 %** |

**Conclusion : la chaîne B est la construction vaccinale V1, sans perte ni modification
de résidu au cours du docking.**

> Anomalie d'annotation à corriger avant soumission : l'en-tête du FASTA annonce
> `4600aa` alors que la séquence compte 477 acides aminés. La séquence est correcte,
> seul le libellé est faux.

## Journal

| Date | Étape | Résultat |
|---|---|---|
| 2026-08-15 | 1a — copie et vérification du fichier | ✅ MD5 identiques |
| 2026-08-15 | 1b — inventaire structural | ✅ 2 chaînes, interface réelle, structure saine |
| | 2 — identification des partenaires | en attente |
